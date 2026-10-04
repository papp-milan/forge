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
import { AtlasService } from './atlas.service.js';
import { AgentCommunicationService } from './agent-communication.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { NikeService } from '../workforce/nike.service.js';

@Injectable()
export class AgentWorkerLoopService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private phase: 'IDLE' | 'RECOVERING' | 'PREPARING' | 'ENGINEERING' | 'QA' | 'ADVANCING' | 'RELEASING' = 'IDLE';
  private currentAgent: string | null = null;
  private currentTaskId: string | null = null;
  private lastCycleStartedAt: string | null = null;
  private lastCycleFinishedAt: string | null = null;
  private lastError: string | null = null;
  private nextCycleAt: string | null = null;

  private readonly enabled = (() => {
    if (process.env['FORGE_AUTONOMOUS'] === 'false') return false;
    if (process.env['NODE_ENV'] !== 'production') return true;
    return process.env['AGENT_RUNTIME'] === 'hermes'
      || process.env['FORGE_AUTONOMOUS_DETERMINISTIC'] === 'true';
  })();
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
    private readonly atlas: AtlasService,
    private readonly communications: AgentCommunicationService,
    private readonly sessions: AgentSessionService,
    private readonly nike: NikeService,
  ) {}

  onModuleInit() {
    if (!this.enabled) return;

    void this.cycle();
    this.nextCycleAt = new Date(Date.now() + this.intervalMs).toISOString();
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
      runtime: this.runtime.mode(),
      phase: this.phase,
      currentAgent: this.currentAgent,
      currentTaskId: this.currentTaskId,
      lastCycleStartedAt: this.lastCycleStartedAt,
      lastCycleFinishedAt: this.lastCycleFinishedAt,
      lastError: this.lastError,
      nextCycleAt: this.nextCycleAt,
    };
  }

  private async cycle() {
    if (this.running) return;
    if (!(await this.lease.acquire('forge:agent-worker-loop'))) return;

    this.running = true;
    this.lastCycleStartedAt = new Date().toISOString();
    this.lastError = null;
    this.nextCycleAt = new Date(Date.now() + this.intervalMs).toISOString();
    this.github.beginCycle();

    try {
      this.phase = 'RECOVERING';
      await this.recoverStaleRuns();
      await this.recoverRetryableTasks();
      this.phase = 'PREPARING';
      await this.prepareEngineerTasks();
      this.phase = 'ENGINEERING';
      await this.runEngineerTasks();
      this.phase = 'QA';
      await this.runQaTasks();
      this.phase = 'ADVANCING';
      await this.advanceFeatures();
      this.phase = 'RELEASING';
      await this.nike.releaseAutonomousReady();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
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
      this.github.endCycle();
      this.running = false;
      this.phase = 'IDLE';
      this.currentAgent = null;
      this.currentTaskId = null;
      this.lastCycleFinishedAt = new Date().toISOString();
      this.nextCycleAt = new Date(Date.now() + this.intervalMs).toISOString();
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
      where: { status: 'BLOCKED', assignee: { role: { in: ['ENGINEER', 'UI_UX', 'DEVOPS'] }, status: 'ACTIVE' } },
      orderBy: { updatedAt: 'asc' },
      take: 10,
      include: { feature: { select: { projectId: true } } },
    });

    const latestRuns = await this.agentRuns.latestForTasks(tasks.map((task) => task.id));

    for (const task of tasks) {
      const latest = latestRuns.get(task.id);
      if (!latest || latest.status !== 'FAILED') continue;
      if (!latest.retryable || latest.attempt >= latest.maxAttempts) {
        await this.communications.notifyOnce({
          fromAgent: 'system', toAgent: 'athena', kind: 'ESCALATION', priority: 'HIGH',
          subject: 'Agent task exhausted retries: ' + task.title,
          content: { taskId: task.id, attempts: latest.attempt, maxAttempts: latest.maxAttempts, failureClass: latest.failureClass, error: latest.error },
          projectId: task.feature.projectId, featureId: task.featureId, taskId: task.id,
        });
        continue;
      }
      if (latest.nextAttemptAt && latest.nextAttemptAt > new Date()) continue;

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
        assignee: { role: { in: ['ENGINEER', 'UI_UX', 'DEVOPS'] }, status: 'ACTIVE' },
        feature: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          project: { repository: { not: null } },
        },
      },
      include: {
        assignee: true,
        feature: { include: { project: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const latestPreparationRuns = await this.agentRuns.latestForTasks(tasks.map((task) => task.id));
    const governanceByProject = new Map<string, Map<string, string[]>>();
    for (const projectId of new Set(tasks.map((task) => task.feature.projectId))) {
      const subjectIds = tasks.filter((task) => task.feature.projectId === projectId).map((task) => task.featureId);
      governanceByProject.set(projectId, await this.governance.blockingReviewsForSubjects(projectId, [...new Set(subjectIds)]));
    }

    for (const task of tasks) {
      this.currentTaskId = task.id;
      this.currentAgent = task.assignee?.role === 'UI_UX' ? 'apollo' : task.assignee?.role === 'DEVOPS' ? 'atlas' : 'hephaistos';
      if (task.risk === 'LARGE' && !task.ceoApprovalAt) {
        await this.communications.notifyOnce({
          fromAgent: 'system',
          toAgent: 'ATHENA',
          kind: 'ESCALATION',
          priority: 'HIGH',
          subject: 'CEO approval required: ' + task.title,
          content: { taskId: task.id, risk: task.risk, reason: 'Large work is intentionally gated before autonomous implementation.', nextStep: 'Obtain CEO approval and record it on the task.' },
          projectId: task.feature.projectId,
          featureId: task.featureId,
          taskId: task.id,
        });
        continue;
      }
      if (task.branchName) continue;

      if ((governanceByProject.get(task.feature.projectId)?.get(task.featureId)?.length ?? 0) > 0) continue;

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
        const prepRun = await this.agentRuns.start({
          agent: task.assignee?.role === 'UI_UX' ? 'apollo' : task.assignee?.role === 'DEVOPS' ? 'atlas' : 'hephaistos',
          kind: 'GITHUB_PREPARATION',
          projectId: task.feature.projectId,
          taskId: task.id,
          attempt: (latestPreparationRuns.get(task.id)?.attempt ?? 0) + 1,
          context: { title: task.title, phase: 'github_preparation' },
        });
        await this.agentRuns.fail(prepRun.id, error, undefined, { kind: 'GITHUB_PREPARATION' });

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
        assignee: { role: { in: ['ENGINEER', 'UI_UX', 'DEVOPS'] }, status: 'ACTIVE' },
        branchName: { not: null },
        feature: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      },
      orderBy: { createdAt: 'asc' },
      take: 3,
      include: {
        assignee: true,
        feature: { select: { projectId: true, id: true } },
      },
    });

    const latestRuns = await this.agentRuns.latestForTasks(tasks.map((task) => task.id));
    const governanceByProject = new Map<string, Map<string, string[]>>();
    for (const projectId of new Set(tasks.map((task) => task.feature.projectId))) {
      const subjectIds = tasks.filter((task) => task.feature.projectId === projectId).map((task) => task.feature.id);
      governanceByProject.set(projectId, await this.governance.blockingReviewsForSubjects(projectId, [...new Set(subjectIds)]));
    }

    for (const task of tasks) {
      this.currentTaskId = task.id;
      this.currentAgent = task.assignee?.role === 'UI_UX' ? 'apollo' : task.assignee?.role === 'DEVOPS' ? 'atlas' : 'hephaistos';
      if (task.risk === 'LARGE' && !task.ceoApprovalAt) continue;
      if ((governanceByProject.get(task.feature.projectId)?.get(task.feature.id)?.length ?? 0) > 0) continue;
      const run = await this.agentRuns.start({
        agent: task.assignee?.role === 'UI_UX' ? 'apollo' : task.assignee?.role === 'DEVOPS' ? 'atlas' : 'hephaistos',
        kind: 'ENGINEERING',
        projectId: task.feature.projectId,
        taskId: task.id,
        attempt: (latestRuns.get(task.id)?.attempt ?? 0) + 1,
        context: { title: task.title, runtime: this.runtime.mode() },
      });
      try {
        if (this.runtime.mode() === 'deterministic') {
          await this.prisma.task.update({ where: { id: task.id }, data: { status: 'IN_REVIEW' } });
          await this.audit.record({
            actor: task.assignee?.role === 'UI_UX' ? 'apollo' : task.assignee?.role === 'DEVOPS' ? 'atlas' : 'hephaistos',
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

        const agent = task.assignee?.role === 'UI_UX'
          ? 'apollo'
          : task.assignee?.role === 'DEVOPS'
            ? 'atlas'
            : 'hephaistos';
        const session = await this.sessions.start({
          agent,
          runtime: this.runtime.mode(),
          projectId: task.feature.projectId,
          taskId: task.id,
        });
        const result = task.assignee?.role === 'UI_UX'
          ? await this.apollo.runTask(task.id)
          : task.assignee?.role === 'DEVOPS'
            ? await this.atlas.runTask(task.id)
            : await this.hephaistos.runTask(task.id);
        if (result.status === 'BLOCKED') {
          await this.sessions.finish(session.id, 'BLOCKED');
          await this.agentRuns.fail(run.id, result.result ?? result);
        } else {
          await this.sessions.finish(session.id, 'COMPLETED');
          await this.agentRuns.complete(run.id, result);
        }
      } catch (error) {
        await this.prisma.task.update({ where: { id: task.id }, data: { status: 'BLOCKED' } });
        await this.agentRuns.fail(run.id, error);
        await this.audit.record({
          actor: task.assignee?.role === 'UI_UX' ? 'apollo' : 'hephaistos',
          type: 'WORKER_FAILED',
          projectId: task.feature.projectId,
          entityType: 'task',
          entityId: task.id,
          summary: `${task.assignee?.role === 'UI_UX' ? 'Apollo' : task.assignee?.role === 'DEVOPS' ? 'Atlas' : 'Hephaistos'} failed to run "${task.title}"`,
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
      this.currentTaskId = task.id;
      this.currentAgent = 'artemis';
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
        else await this.agentRuns.fail(run.id, result, result, { retryable: true, kind: 'QA' });
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

    const governanceByProject = new Map<string, Map<string, string[]>>();
    for (const projectId of new Set(features.map((feature) => feature.projectId))) {
      const subjectIds = features.filter((feature) => feature.projectId === projectId).map((feature) => feature.id);
      governanceByProject.set(projectId, await this.governance.blockingReviewsForSubjects(projectId, [...new Set(subjectIds)]));
    }

    for (const feature of features) {
      if (feature.tasks.length === 0) continue;
      if ((governanceByProject.get(feature.projectId)?.get(feature.id)?.length ?? 0) > 0) continue;

      const hasActiveWork = feature.tasks.some((task) =>
        ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(task.status),
      );

      if (hasActiveWork && feature.status === 'PLANNED') {
        await this.features.start(feature.id);
        continue;
      }

      const allTasksDone = feature.tasks.every((task) => task.status === 'DONE');

      if (allTasksDone && feature.status === 'IN_PROGRESS') {
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

      if (allTasksDone && feature.status === 'QA') {
        await this.audit.record({
          actor: 'artemis',
          type: 'QA_GATE_READY',
          projectId: feature.projectId,
          entityType: 'feature',
          entityId: feature.id,
          summary: 'Feature "' + feature.title + '" passed task-level QA and is waiting for explicit QA approval',
        });
      }
    }
  }
}
