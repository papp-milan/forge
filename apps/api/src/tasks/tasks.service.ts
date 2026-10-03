import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { GithubService } from '../github/github.service.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) {}

  findAll() {
    return this.prisma.task.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
    });
  }

  create(data: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        acceptanceCriteria: data.acceptanceCriteria,
        featureId: data.featureId,
        assigneeId: data.assigneeId,
      },
    });
  }

  update(id: string, data: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async start(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'TODO') {
      throw new BadRequestException(
        `Task cannot be started from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
    });
  }

  async block(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Task cannot be blocked from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'BLOCKED',
      },
    });
  }

  async resume(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'BLOCKED') {
      throw new BadRequestException(
        `Task cannot be resumed from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
    });
  }

  async submitForReview(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Task cannot be submitted for review from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'IN_REVIEW',
      },
    });
  }

  async complete(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'IN_REVIEW') {
      throw new BadRequestException(
        `Task cannot be completed from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'DONE',
      },
    });
  }

  async assign(id: string, employeeId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException('Employee is not active');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        assigneeId: employeeId,
      },
      include: {
        assignee: true,
        feature: true,
      },
    });
  }

  async createGithubIssue(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        feature: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.githubIssueNumber) {
      throw new BadRequestException('Task already has a GitHub issue');
    }

    const repository = task.feature.project.repository;

    if (!repository) {
      throw new BadRequestException(
        'Project has no GitHub repository configured',
      );
    }

    const { owner, repo } = this.parseRepository(repository);

    const issue = await this.githubService.createIssue(
      owner,
      repo,
      task.title,
      this.buildGithubIssueBody(task),
    );

    return this.prisma.task.update({
      where: { id },
      data: {
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.url,
      },
      include: {
        feature: true,
        assignee: true,
      },
    });
  }

  async createGithubBranch(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        feature: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.branchName) {
      throw new BadRequestException('Task already has a GitHub branch');
    }

    const repository = task.feature.project.repository;

    if (!repository) {
      throw new BadRequestException(
        'Project has no GitHub repository configured',
      );
    }

    const { owner, repo } = this.parseRepository(repository);

    const branchName = `forge/task-${task.id}`;

    await this.githubService.createBranch(owner, repo, branchName);

    return this.prisma.task.update({
      where: { id },
      data: {
        branchName,
      },
      include: {
        feature: true,
        assignee: true,
      },
    });
  }

  private parseRepository(repository: string) {
    const url = new URL(repository);

    const parts = url.pathname.replace(/^\/|\/$/g, '').split('/');

    const [owner, repo] = parts;

    if (!owner || !repo) {
      throw new BadRequestException('Invalid GitHub repository URL');
    }

    return {
      owner,
      repo: repo.replace(/\.git$/, ''),
    };
  }

  private buildGithubIssueBody(task: {
    description: string | null;
    acceptanceCriteria: string | null;
  }) {
    const sections: string[] = [];

    if (task.description) {
      sections.push(`## Description\n\n${task.description}`);
    }

    if (task.acceptanceCriteria) {
      sections.push(`## Acceptance Criteria\n\n${task.acceptanceCriteria}`);
    }

    sections.push('---\n\nManaged by **Forge**.');

    return sections.join('\n\n');
  }

  async createGithubPullRequest(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        feature: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (!task.branchName) {
      throw new BadRequestException('Task has no GitHub branch');
    }

    if (task.pullRequestNumber) {
      throw new BadRequestException('Task already has a GitHub pull request');
    }

    const repository = task.feature.project.repository;

    if (!repository) {
      throw new BadRequestException(
        'Project has no GitHub repository configured',
      );
    }

    const { owner, repo } = this.parseRepository(repository);

    const githubRepository = await this.githubService.getRepository(
      owner,
      repo,
    );

    const pullRequest = await this.githubService.createPullRequest(
      owner,
      repo,
      task.title,
      task.branchName,
      githubRepository.defaultBranch,
      this.buildGithubPullRequestBody(task),
    );

    return this.prisma.task.update({
      where: { id },
      data: {
        pullRequestNumber: pullRequest.number,
        pullRequestUrl: pullRequest.url,
      },
      include: {
        feature: true,
        assignee: true,
      },
    });
  }

  private buildGithubPullRequestBody(task: {
    description: string | null;
    acceptanceCriteria: string | null;
    githubIssueNumber: number | null;
  }) {
    const sections: string[] = [];

    if (task.githubIssueNumber) {
      sections.push(`Closes #${task.githubIssueNumber}`);
    }

    if (task.description) {
      sections.push(`## Description\n\n${task.description}`);
    }

    if (task.acceptanceCriteria) {
      sections.push(`## Acceptance Criteria\n\n${task.acceptanceCriteria}`);
    }

    sections.push('---\n\nManaged by **Forge**.');

    return sections.join('\n\n');
  }
}
