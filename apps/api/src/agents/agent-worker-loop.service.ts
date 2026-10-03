import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';
import { AuditService } from '../audit/audit.service.js';
import { HephaistosService } from './hephaistos.service.js';
import { ArtemisService } from './artemis.service.js';
import { ApolloService } from './apollo.service.js';
import { AgentRuntimeService } from '../runtime/agent-runtime.service.js';
import { AgentRunService } from './agent-run.service.js';
import { LeaseService } from '../runtime/lease.service.js';
import { GovernancePolicyService } from '../governance/governance-policy.service.js';
import { FeaturesService } from '../features/features.service.js';

@Injectable()
export class AgentWorkerLoopService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  private readonly enabled = process.env['FORGE_AUTONOMOUS'] === 'true';
  private readonly intervalMs = Math.max(
    Number(process.env['FORGE_AUTONOMOUS_INTERVAL_MS'] ?? 300_000),
    30_000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly hephaistos: HephaistosService,
    private readonly artemis: ArtemisService,
    private readonly apollo: ApolloService,
    private readonly audit: AuditService,
    private readonly runtime: AgentRuntimeService,
    private readonly agentRuns: AgentRunService,
    private readonly lease: LeaseService,
    private readonly governance: GovernancePolicyService,
    private readonly features: FeaturesService,
  ) {}

  onModuleInit() {
    if (!this.enabled) return;

    void this.cycle();
    this.timer = setInterval(() => void this.cycle(), this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce() {
    if (this.running) return { status: 'ALREADY_RUNNING' };
    await this.cycle();
    return { status: 'COMPLETED', runtime: this.runtime.mode() };
  }

  status() {
    return {
      enabled: this.enabled,
      running: this.running,
      intervalMs: this.intervalMs,
    };
  }

  private async cycle() {
    if (this.running) return;
    if (!(await this.lease.acquire('forge:agent-worker-loop'))) return;

    this.running = true;

    try {
      await this.recoverStaleRuns();
      await this.recoverRetryableTasks();
      await this.prepareEngineerTasks();
      await this.runEngineerTasks();
      await this.runQaTasks();
      await this.advanceFeatures();
    } catch (error) {
      await this.audit.record({
        actor: 'system',
        type: 'ORCHESTRATOR_ERROR',
        entityType: 'agent_worker_loop',
        summary: 'Autonomous worker loop failed',
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      this.running = false;
      await this.lease.release('forge:agent-worker-loop');
    }
  }

  private async recoverStaleRuns() {
    const stale = await this.agentRuns.recoverStale();
    for (const run of stale) {
      await this.audit.record({
        actor: 'system',
        type: 'WORKER_FAILED',
        projectId: run.projectId ?? undefined,
        entityType: 'agent_run',
        entityId: run.id,
        summary: 'Stale agent run recovered and task blocked',
        data: { agent: run.agent, taskId: run.taskId },
      });
    }
  }

  private async recoverRetryableTasks() {
    const tasks = await this.prisma.task.findMany({
      where: { status: 'BLOCKED', assignee: { role: { in: ['ENGINEER', 'UI_UX'] }, status: 'ACTIVE' } },
      orderBy: { updatedAt: 'asc' },
      take: 10,
      include: { feature: { select: { projectId: true } } },
    });

    for (const task of tasks) {
      const runs = await this.agentRuns.recentForTask(task.id, 1);
      const latest = runs[0];
      if (!latest || latest.attempt >= latest.maxAttempts || latest.status !== 'FAILED') continue;

      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: task.branchName ? 'IN_PROGRESS' : 'TODO' },
      });
      await this.audit.record({
        actor: 'system',
        type: 'WORKER_STARTED',
        projectId: task.feature.projectId,
        entityType: 'task',
        entityId: task.id,
        summary: `Retrying blocked task (attempt ${latest.attempt + 1}/${latest.maxAttempts})`,
      });
    }
  }

  private async prepareEngineerTasks() {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        assignee: { role: { in: ['ENGINEER', 'UI_UX'] }, status: 'ACTIVE' },
        feature: {
          project: {
            repository: { not: null },
          },
        },
      },
      include: {
        feature: { include: { project: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const task of tasks) {
      if (task.branchName) continue;

      if ((await this.governance.hasBlockingReviews(task.feature.projectId, task.featureId)).length > 0) continue;

      const repository = task.feature.project.repository;
      if (!repository) continue;

      const normalized = repository
        .replace(/^https?:\/\/(www\.)?github\.com\//, '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '');

      const [owner, repo] = normalized.split('/');
      if (!owner || !repo) continue;

      try {
        const branchName = `forge/task-${task.id}`;

        if (this.runtime.mode() === 'deterministic') {
          await this.prisma.task.update({ where: { id: task.id }, data: { branchName } });
          continue;
        }

        if (!task.githubIssueNumber) {
          const issue = await this.github.createIssue(
            owner,
            repo,
            task.title,
            [
              task.description ? `## Description\n\n${task.description}` : '',
              task.acceptanceCriteria
                ? `## Acceptance Criteria\n\n${task.acceptanceCriteria}`
                : '',
              '---\n\nManaged by **Forge**.',
            ].filter(Boolean).join('\n\n'),
          );

          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              githubIssueNumber: issue.number,
              githubIssueUrl: issue.url,
            },
          });
        }

        try {
          await this.github.createBranch(owner, repo, branchName);
        } catch (error) {
          const branches = await this.github.getBranches(owner, repo);
          if (!branches.some((branch) => branch.name === branchName)) {
            throw error;
          }
        }

        await this.prisma.task.update({
          where: { id: task.id },
          data: { branchName },
        });
      } catch (error) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { status: 'BLOCKED' },
        });

        await this.audit.record({
          actor: 'system',
          type: 'ORCHESTRATOR_ERROR',
          projectId: task.feature.projectId,
          entityType: 'task',
          entityId: task.id,
          summary: `Could not prepare task "${task.title}"`,
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private async runEngineerTasks() {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        assignee: { role: { in: ['ENGINEER', 'UI_UX'] }, status: 'ACTIVE' },
        branchName: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: 3,
      include: {
        assignee: true,
        feature: { select: { projectId: true } },
      },
    });

    for (const task of tasks) {
      const run = await this.agentRuns.start({
        agent: task.assignee?.role === 'UI_UX' ? 'apollo' : 'hephaistos',
        kind: 'ENGINEERING',
        projectId: task.feature.projectId,
        taskId: task.id,
        attempt: ((await this.agentRuns.recentForTask(task.id, 1))[0]?.attempt ?? 0) + 1,
        context: { title: task.title, runtime: this.runtime.mode() },
      });
      try {
        if (this.runtime.mode() === 'deterministic') {
          await this.prisma.task.update({ where: { id: task.id }, data: { status: 'IN_REVIEW' } });
          await this.audit.record({
            actor: task.assignee?.role === 'UI_UX' ? 'apollo' : 'hephaistos',
            type: 'WORKER_COMPLETED',
            projectId: task.feature.projectId,
            entityType: 'task',
            entityId: task.id,
            summary: 'Deterministic worker simulation completed',
            data: { runtime: 'deterministic' },
          });
          await this.agentRuns.complete(run.id, { status: 'IN_REVIEW', runtime: 'deterministic' });
          continue;
        }

        const result = task.assignee?.role === 'UI_UX'
          ? await this.apollo.runTask(task.id)
          : await this.hephaistos.runTask(task.id);
          if (result.status === 'BLOCKED') {
            await this.agentRuns.fail(run.id, result.result ?? result);
          } else {
            await this.agentRuns.complete(run.id, result);
          }
      } catch (error) {
        await this.agentRuns.fail(run.id, error);
        await this.audit.record({
          actor: task.assignee?.role === 'UI_UX' ? 'apollo' : 'hephaistos',
          type: 'WORKER_FAILED',
          projectId: task.feature.projectId,
          entityType: 'task',
          entityId: task.id,
          summary: `${task.assignee?.role === 'UI_UX' ? 'Apollo' : 'Hephaistos'} failed to run "${task.title}"`,
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private async runQaTasks() {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'IN_REVIEW',
        branchName: { not: null },
      },
      orderBy: { updatedAt: 'asc' },
      take: 3,
      include: {
        feature: { select: { projectId: true } },
      },
    });

    for (const task of tasks) {
      const run = await this.agentRuns.start({
        agent: 'artemis',
        kind: 'QA',
        projectId: task.feature.projectId,
        taskId: task.id,
        context: { title: task.title, runtime: this.runtime.mode() },
      });
      try {
        if (this.runtime.mode() === 'deterministic') {
          await this.prisma.task.update({ where: { id: task.id }, data: { status: 'DONE' } });
          await this.audit.record({
            actor: 'artemis',
            type: 'QA_PASSED',
            projectId: task.feature.projectId,
            entityType: 'task',
            entityId: task.id,
            summary: 'Deterministic QA simulation passed',
            data: { runtime: 'deterministic' },
          });
          await this.agentRuns.complete(run.id, { status: 'PASSED', runtime: 'deterministic' });
          continue;
        }

        const result = await this.artemis.reviewTask(task.id);
        if (result.status === 'PASSED') await this.agentRuns.complete(run.id, result);
        else await this.agentRuns.fail(run.id, result);
      } catch (error) {
        await this.agentRuns.fail(run.id, error);
        await this.audit.record({
          actor: 'artemis',
          type: 'QA_FAILED',
          projectId: task.feature.projectId,
          entityType: 'task',
          entityId: task.id,
          summary: `Artemis failed to review "${task.title}"`,
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private async advanceFeatures() {
    const features = await this.prisma.feature.findMany({
      where: {
        status: { in: ['PLANNED', 'IN_PROGRESS', 'QA'] },
      },
      include: { tasks: true },
    });

    for (const feature of features) {
      if (feature.tasks.length === 0) continue;
      if ((await this.governance.hasBlockingReviews(feature.projectId, feature.id)).length > 0) continue;

      const hasActiveWork = feature.tasks.some((task) =>
        ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(task.status),
      );

      if (hasActiveWork && feature.status === 'PLANNED') {
        await this.features.start(feature.id);
        continue;
      }

      const allTasksDone = feature.tasks.every((task) => task.status === 'DONE');

      if (allTasksDone && feature.status === 'IN_PROGRESS') {
        // Reaching QA is an explicit lifecycle gate. Never let the worker
        // jump directly from development to CEO release review.
        await this.features.submitForQa(feature.id);

        await this.audit.record({
          actor: 'artemis',
          type: 'QA_GATE_READY',
          projectId: feature.projectId,
          entityType: 'feature',
          entityId: feature.id,
          summary: 'Feature "' + feature.title + '" is ready for QA',
        });
      }
    }
  }
}
