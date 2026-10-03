import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from './github.service.js';
import { MemoryService } from '../memory/memory.service.js';

@Injectable()
export class GithubSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly memory: MemoryService,
  ) {}

  async syncProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { features: { include: { tasks: true } } },
    });
    if (!project?.repository) throw new BadRequestException('Project has no GitHub repository configured');

    const tasks = project.features.flatMap((feature) => feature.tasks.map((task) => ({ ...task, feature })));

    const [owner, repo] = project.repository.split('/');
    if (!owner || !repo) throw new BadRequestException('Repository must use owner/name format');

    const [issues, pulls, branches, commits] = await Promise.all([
      this.github.getIssues(owner, repo),
      this.github.getPullRequests(owner, repo),
      this.github.getBranches(owner, repo),
      this.github.getRecentCommits(owner, repo),
    ]);

    const updates = [];
    for (const task of tasks) {
      const issue = issues.find((item) => item.number === task.githubIssueNumber);
      const pull = pulls.find((item) => item.number === task.pullRequestNumber || item.branch === task.branchName);
      const branch = branches.find((item) => item.name === task.branchName);
      const data: Record<string, unknown> = {};
      if (issue && !task.githubIssueUrl) data.githubIssueUrl = issue.url;
      if (pull) {
        data.pullRequestNumber = pull.number;
        data.pullRequestUrl = pull.url;
        data.status = 'IN_REVIEW';
      }
      if (branch && !task.branchName) data.branchName = branch.name;
      if (Object.keys(data).length) {
        updates.push(await this.prisma.task.update({ where: { id: task.id }, data }));
      }
    }

    const memory = await this.memory.remember({
      scope: 'projects',
      subject: project.name + ' github sync',
      type: 'fact',
      source: 'system',
      confidence: 'high',
      content: 'GitHub sync observed ' + issues.length + ' open issues, ' + pulls.length + ' open pull requests, ' + branches.length + ' branches and ' + commits.length + ' recent commits.',
    });

    return {
      projectId,
      repository: project.repository,
      syncedAt: new Date().toISOString(),
      counts: { issues: issues.length, pullRequests: pulls.length, branches: branches.length, commits: commits.length, taskUpdates: updates.length },
      taskUpdates: updates,
      memory: memory.path,
    };
  }
}
