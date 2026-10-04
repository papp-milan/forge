import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { TeamLeadContext } from './team-lead-context.types.js';

@Injectable()
export class TeamLeadContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly memory: MemoryService,
  ) {}

  async build(projectId: string): Promise<TeamLeadContext> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      include: {
        features: {
          include: {
            tasks: {
              include: {
                assignee: true,
              },
            },
          },
        },

        pitches: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
          include: {
            taskSuggestions: true,
            reviews: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [projectMemory, companyMemory, decisions, learnings, github, communications] =
      await Promise.all([
        this.memory.list(`projects/${projectId}`),

        this.memory.list('company'),

        this.memory.list('decisions'),

        this.memory.list('learnings'),

        project.repository
          ? this.loadGithubContext(project.repository)
          : Promise.resolve(null),

        this.prisma.agentCommunication.findMany({
          where: { projectId, toAgent: 'ATHENA', status: { in: ['UNREAD', 'READ', 'ACKNOWLEDGED'] } },
          orderBy: { createdAt: 'asc' },
          take: 50,
        }),
      ]);

    const tasks = project.features.flatMap((feature) => feature.tasks);

    const activeTasks = tasks.filter(
      (task) => task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW',
    );

    const blockedTasks = tasks.filter((task) => task.status === 'BLOCKED');

    const recentCompletedTasks = tasks
      .filter((task) => task.status === 'DONE')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10);

    const activeFeatures = project.features.filter(
      (feature) => feature.status !== 'RELEASED',
    );

    const pendingPitches = project.pitches.filter(
      (pitch) =>
        pitch.status === 'PENDING_APPROVAL' ||
        pitch.status === 'CHANGES_REQUESTED',
    );

    const blockers = this.detectBlockers(blockedTasks);

    const inconsistencies = this.detectInconsistencies(project, tasks, github);

    const opportunities = this.detectOpportunities(
      project,
      activeFeatures,
      pendingPitches,
      tasks,
      github,
    );

    const readyForRelease = project.features
      .filter((feature) => feature.status === 'READY_FOR_REVIEW')
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
      }));

    return {
      generatedAt: new Date().toISOString(),

      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        repository: project.repository,
      },

      health: {
        openTasks: tasks.filter((task) => task.status !== 'DONE').length,

        blockedTasks: blockedTasks.length,

        tasksInReview: tasks.filter((task) => task.status === 'IN_REVIEW')
          .length,

        activeFeatures: activeFeatures.length,

        pendingPitches: pendingPitches.length,
        readyForRelease,
      },

      work: {
        activeTasks: activeTasks.map((task) => this.mapTask(task)),

        blockedTasks: blockedTasks.map((task) => this.mapTask(task)),

        recentCompletedTasks: recentCompletedTasks.map((task) =>
          this.mapTask(task),
        ),
      },

      github: github
        ? {
            repository: github.repository,

            issues: github.issues.open,

            pullRequests: github.pullRequests.open,

            branches: github.branches,

            recentCommits: github.recentCommits,
          }
        : null,

      communications,

      memory: {
        company: companyMemory,

        project: projectMemory,

        decisions: decisions,

        learnings: learnings,
      },

      signals: {
        blockers,
        inconsistencies,
        opportunities,
      },
    };
  }

  private mapTask(task: any) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,

      acceptanceCriteria: task.acceptanceCriteria,

      status: task.status,

      assignee: task.assignee
        ? {
            id: task.assignee.id,
            name: task.assignee.name,
            role: task.assignee.role,
          }
        : null,

      github: {
        issueNumber: task.githubIssueNumber,

        issueUrl: task.githubIssueUrl,

        branchName: task.branchName,

        pullRequestNumber: task.pullRequestNumber,

        pullRequestUrl: task.pullRequestUrl,
      },
    };
  }

  private detectBlockers(blockedTasks: any[]): string[] {
    return blockedTasks.map((task) => `Task "${task.title}" is blocked.`);
  }

  private detectInconsistencies(
    project: any,
    tasks: any[],
    github: any,
  ): string[] {
    const inconsistencies: string[] = [];

    if (!project.repository || !github) {
      return inconsistencies;
    }

    const projectRepository = this.normalizeRepository(project.repository);

    for (const task of tasks) {
      if (!task.githubIssueUrl) {
        continue;
      }

      const taskRepository = this.repositoryFromUrl(task.githubIssueUrl);

      if (taskRepository && taskRepository !== projectRepository) {
        inconsistencies.push(
          `Task "${task.title}" references GitHub repository "${taskRepository}" while the project repository is "${projectRepository}".`,
        );
      }
    }

    return inconsistencies;
  }

  private detectOpportunities(
    project: any,
    activeFeatures: any[],
    pendingPitches: any[],
    tasks: any[],
    github: any,
  ): string[] {
    const opportunities: string[] = [];

    if (activeFeatures.length === 0 && pendingPitches.length === 0) {
      opportunities.push(
        'The project currently has no active feature work or pending proposals.',
      );
    }

    if (github && github.issues.open.length > 0) {
      opportunities.push(
        `${github.issues.open.length} open GitHub issue(s) may represent actionable work.`,
      );
    }

    if (tasks.length > 0 && tasks.every((task) => task.status === 'DONE')) {
      opportunities.push(
        'All tracked tasks are complete; the project may be ready for new feature proposals.',
      );
    }

    return opportunities;
  }

  private normalizeRepository(repository: string): string {
    return repository
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  private repositoryFromUrl(url: string): string | null {
    const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)/i);

    if (!match) {
      return null;
    }

    return this.normalizeRepository(match[1]);
  }

  private async loadGithubContext(repository: string) {
    const normalized = this.normalizeRepository(repository);

    const [owner, repo] = normalized.split('/');

    if (!owner || !repo) {
      return null;
    }

    try {
      const repositoryInfo = await this.github.getRepository(owner, repo);

      const [issues, pullRequests, branches, commits] = await Promise.all([
        this.github.getIssues(owner, repo),

        this.github.getPullRequests(owner, repo),

        this.github.getBranches(owner, repo),

        this.github.getRecentCommits(owner, repo, repositoryInfo.defaultBranch),
      ]);

      return {
        repository: repositoryInfo,

        issues: {
          open: issues,
        },

        pullRequests: {
          open: pullRequests,
        },

        branches,

        recentCommits: commits,
      };
    } catch (error) {
      return {
        repository: {
          owner,
          name: repo,
        },

        issues: {
          open: [],
        },

        pullRequests: {
          open: [],
        },

        branches: [],

        recentCommits: [],

        error:
          error instanceof Error
            ? error.message
            : 'Failed to load GitHub context',
      };
    }
  }
}
