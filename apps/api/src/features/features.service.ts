import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFeatureDto } from './dto/create-feature.dto.js';
import { UpdateFeatureDto } from './dto/update-feature.dto.js';
import { CreateFeatureTaskDto } from './dto/create-feature-tasks.dto.js';
import { GithubService } from '../github/github.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AgentRuntimeService } from '../runtime/agent-runtime.service.js';
import { GovernancePolicyService } from '../governance/governance-policy.service.js';
import { MemoryService } from '../memory/memory.service.js';

@Injectable()
export class FeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly audit: AuditService,
    private readonly runtime: AgentRuntimeService,
    private readonly governance: GovernancePolicyService,
    private readonly memory: MemoryService,
  ) {}

  findAll() {
    return this.prisma.feature.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.feature.findUnique({
      where: {
        id,
      },
    });
  }

  create(data: CreateFeatureDto) {
    return this.prisma.feature.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
      },
    });
  }

  update(id: string, data: UpdateFeatureDto) {
    return this.prisma.feature.update({
      where: {
        id,
      },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.feature.delete({
      where: {
        id,
      },
    });
  }

  async plan(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'PROPOSED') {
      throw new BadRequestException(
        `Feature cannot be planned from status ${feature.status}`,
      );
    }

    await this.governance.requestLifecycleReviews({ projectId: feature.projectId, subjectType: 'FEATURE', subjectId: feature.id, title: feature.title, context: { description: feature.description, lifecycle: 'PLANNING' }, domains: ['ARCHITECTURE','PRIVACY','SECURITY','INFRASTRUCTURE','COST'] });
    const planned = await this.transition(id, 'PROPOSED', 'PLANNED');
    return planned;
  }

  async start(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'PLANNED') {
      throw new BadRequestException(
        `Feature cannot be started from status ${feature.status}`,
      );
    }

    if ((await this.governance.hasBlockingReviews(feature.projectId, feature.id)).length > 0) {
      throw new BadRequestException('Feature cannot start while governance reviews remain blocking.');
    }

    return this.transition(id, 'PLANNED', 'IN_PROGRESS');
  }

  async submitForQa(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Feature cannot be submitted for QA from status ${feature.status}`,
      );
    }

    const tasks = await this.prisma.task.findMany({
      where: { featureId: id },
      select: { status: true },
    });

    if (tasks.length === 0) {
      throw new BadRequestException(
        'Feature cannot enter QA without at least one task',
      );
    }

    const unfinished = tasks.filter((task) => task.status !== 'DONE');

    if (unfinished.length > 0) {
      throw new BadRequestException(
        `Feature cannot enter QA while ${unfinished.length} task(s) are not done`,
      );
    }

    return this.transition(id, 'IN_PROGRESS', 'QA');
  }

  async approveQa(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'QA') {
      throw new BadRequestException(
        `Feature cannot leave QA from status ${feature.status}`,
      );
    }

    const tasks = await this.prisma.task.findMany({
      where: { featureId: id },
      select: { status: true },
    });
    if (tasks.length === 0 || tasks.some((task) => task.status !== 'DONE')) {
      throw new BadRequestException('Feature cannot become release-ready until every task has passed QA.');
    }

    return this.transition(id, 'QA', 'READY_FOR_REVIEW');
  }

  async release(id: string, actor: 'ceo' | 'nike' = 'ceo') {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: {
          include: { assignee: true },
        },
      },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'READY_FOR_REVIEW') {
      throw new BadRequestException(
        `Feature cannot be released from status ${feature.status}`,
      );
    }

    if (feature.tasks.length === 0) {
      throw new BadRequestException('Feature cannot be released without tasks');
    }

    const unfinished = feature.tasks.filter((task) => task.status !== 'DONE');
    if (unfinished.length > 0) {
      throw new BadRequestException(
        `Feature cannot be released while ${unfinished.length} task(s) are not done`,
      );
    }

    const blockingReviews = await this.governance.hasBlockingReviews(feature.projectId, feature.id);
    if (blockingReviews.length > 0) {
      throw new BadRequestException(
        `Feature cannot be released while ${blockingReviews.length} governance review(s) remain unresolved.`,
      );
    }

    if (!feature.project.repository) {
      throw new BadRequestException('Project has no GitHub repository configured');
    }

    const claimed = await this.prisma.feature.updateMany({
      where: { id, status: 'READY_FOR_REVIEW' },
      data: { status: 'RELEASING' },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Feature release is already in progress or the feature state changed.');
    }

    await this.audit.record({
      actor,
      type: 'RELEASE_STARTED',
      projectId: feature.projectId,
      entityType: 'feature',
      entityId: feature.id,
      summary: feature.title,
    });

    try {
      const parts = feature.project.repository
        .replace(/^https?:\/\/(www\.)?github\.com\//, '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '')
        .split('/');

      if (parts.length !== 2) {
        throw new BadRequestException('Project repository is not a valid GitHub repository');
      }

      const [owner, repo] = parts;

      if (this.runtime.mode() !== 'deterministic') {
        for (const task of feature.tasks) {
          if (task.assignee?.role === 'ENGINEER' && !task.pullRequestNumber) {
            throw new BadRequestException(
              `Engineer task "${task.title}" has no pull request`,
            );
          }

          if (!task.pullRequestNumber) {
            continue;
          }

          const mergeState = await this.github.isPullRequestMerged(
            owner,
            repo,
            task.pullRequestNumber,
          );

          if (!mergeState.merged) {
            const checks = await this.github.getPullRequestChecks(
              owner,
              repo,
              task.pullRequestNumber,
            );

            if (!checks.ready) {
              throw new BadRequestException(
                `Pull request #${task.pullRequestNumber} is not ready: all GitHub checks must complete successfully before autonomous release.`,
              );
            }

            const merged = await this.github.mergePullRequest(
              owner,
              repo,
              task.pullRequestNumber,
            );

            if (!merged.merged) {
              throw new BadRequestException(
                `Pull request #${task.pullRequestNumber} could not be merged`,
              );
            }
          }
        }
      } else {
        await this.audit.record({
          actor: 'system',
          type: 'RELEASE_SIMULATED',
          projectId: feature.projectId,
          entityType: 'feature',
          entityId: feature.id,
          summary: `Deterministic release simulated for "${feature.title}"`,
          data: { runtime: 'deterministic' },
        });
      }

      const released = await this.transition(id, 'RELEASING', 'RELEASED');

      await this.memory.remember({
        scope: 'projects',
        subject: 'release-' + feature.id,
        type: 'decision',
        source: 'nike',
        confidence: 'high',
        content: `Feature "${feature.title}" was released after QA, governance gates, and GitHub release checks.`,
      });

      await this.audit.record({
        actor,
        type: 'RELEASED',
        projectId: feature.projectId,
        entityType: 'feature',
        entityId: feature.id,
        summary: feature.title,
      });

      return released;
    } catch (error) {
      await this.prisma.feature.updateMany({
        where: { id, status: 'RELEASING' },
        data: { status: 'READY_FOR_REVIEW' },
      });
      await this.audit.record({
        actor,
        type: 'RELEASE_FAILED',
        projectId: feature.projectId,
        entityType: 'feature',
        entityId: feature.id,
        summary: feature.title,
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async transition(
    id: string,
    from: 'PROPOSED' | 'PLANNED' | 'IN_PROGRESS' | 'QA' | 'READY_FOR_REVIEW' | 'RELEASING',
    to: 'PLANNED' | 'IN_PROGRESS' | 'QA' | 'READY_FOR_REVIEW' | 'RELEASING' | 'RELEASED',
  ) {
    const result = await this.prisma.feature.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    if (result.count !== 1) {
      const current = await this.prisma.feature.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new BadRequestException('Feature not found');
      throw new ConflictException(`Feature transition ${from} -> ${to} failed; current status is ${current.status}.`);
    }
    return this.prisma.feature.findUniqueOrThrow({ where: { id } });
  }

  async createTasks(featureId: string, tasks: CreateFeatureTaskDto[]) {
    const feature = await this.prisma.feature.findUnique({
      where: { id: featureId },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (tasks.length === 0) {
      throw new BadRequestException('At least one task is required');
    }

    for (const task of tasks) {
      if (task.assigneeId) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: task.assigneeId },
        });

        if (!employee) {
          throw new BadRequestException(
            `Employee ${task.assigneeId} not found`,
          );
        }

        if (employee.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Employee ${task.assigneeId} is not active`,
          );
        }
      }
    }

    const createdTasks = await this.prisma.$transaction(
      tasks.map((task) =>
        this.prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
            featureId,
            assigneeId: task.assigneeId,
            risk: task.risk as any,
          },
          include: {
            assignee: true,
          },
        }),
      ),
    );

    return createdTasks;
  }
}
