import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgentRuntimeService } from '../runtime/hermes-runtime.service.js';
import { WorkspaceService } from './workspace.service.js';
import { AuditService } from '../audit/audit.service.js';
import { GithubService } from '../github/github.service.js';

@Injectable()
export class HephaistosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AgentRuntimeService,
    private readonly workspaces: WorkspaceService,
    private readonly audit: AuditService,
    private readonly github: GithubService,
  ) {}

  async runTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, feature: { include: { project: true } } },
    });
    if (!task) throw new BadRequestException('Task not found');
    if (!task.assignee || task.assignee.role !== 'ENGINEER') throw new BadRequestException('Hephaistos can only execute tasks assigned to an ENGINEER');
    if (!task.feature.project.repository) throw new BadRequestException('Project has no GitHub repository configured');
    if (!task.branchName) throw new BadRequestException('Task must have a GitHub branch before Hephaistos can execute it');
    if (!['TODO', 'IN_PROGRESS'].includes(task.status)) throw new BadRequestException('Task cannot be executed from status ' + task.status);

    if (task.status === 'TODO') await this.prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });
    const workspace = await this.workspaces.prepare(task.feature.project.repository, task.branchName);

    await this.audit.record({
      actor: 'hephaistos', type: 'WORKER_STARTED', projectId: task.feature.projectId,
      entityType: 'task', entityId: task.id, summary: task.title,
      data: { repository: workspace.repository, branch: workspace.branch },
    });

    try {
      const result = await this.runtime.run({ cwd: workspace.cwd, env: workspace.env, maxTurns: 80, prompt: this.buildPrompt(task) });
      const success = result.exitCode === 0 && result.text.length > 0;
      await this.audit.record({
        actor: 'hephaistos', type: success ? 'WORKER_COMPLETED' : 'WORKER_FAILED',
        projectId: task.feature.projectId, entityType: 'task', entityId: task.id, summary: task.title,
        data: { repository: workspace.repository, branch: workspace.branch, sessionId: result.sessionId, exitCode: result.exitCode, text: result.text.slice(-4000), tokens: result.tokens ?? null },
      });
      if (success) {
        try {
          const [owner, repo] = workspace.repository.split('/');
          let pullRequestNumber = task.pullRequestNumber ?? null;
          let pullRequestUrl = task.pullRequestUrl ?? null;

          if (!pullRequestNumber) {
            const repository = await this.github.getRepository(owner, repo);
            const pullRequest = await this.github.createPullRequest(
              owner,
              repo,
              task.title,
              task.branchName,
              repository.defaultBranch,
              [
                'Implemented by Hephaistos.',
                '',
                'Task: ' + task.title,
                'Acceptance criteria: ' + (task.acceptanceCriteria ?? 'See task description.'),
              ].join('\n'),
            );
            pullRequestNumber = pullRequest.number;
            pullRequestUrl = pullRequest.url;
          }

          const updated = await this.prisma.task.update({
            where: { id: task.id },
            data: { status: 'IN_REVIEW', pullRequestNumber, pullRequestUrl },
            include: { assignee: true, feature: true },
          });

          return { status: 'IN_REVIEW', task: updated, result };
        } catch (error) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { status: 'BLOCKED' },
          });

          await this.audit.record({
            actor: 'hephaistos',
            type: 'WORKER_FAILED',
            projectId: task.feature.projectId,
            entityType: 'task',
            entityId: task.id,
            summary: 'Hephaistos implementation succeeded but PR creation failed',
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });

          return { status: 'BLOCKED', taskId: task.id, result };
        }
      }
      await this.prisma.task.update({ where: { id: task.id }, data: { status: 'BLOCKED' } });
      return { status: 'BLOCKED', taskId: task.id, result };
    } finally {
      await workspace.cleanup();
    }
  }

  private buildPrompt(task: any): string {
    return [
      'You are Hephaistos, Forge\'s Software Engineer.',
      'Work only on the assigned task in the current repository.',
      'Inspect the existing code before changing it.',
      'Implement the smallest complete solution that satisfies the acceptance criteria.',
      'Run the most relevant tests and build checks.',
      'Do not modify unrelated functionality.',
      'Commit the completed implementation to the current branch.',
      'Push the current branch to origin when the implementation is ready for review.',
      'Do not merge the pull request and do not release production.',
      '',
      'Task: ' + task.title,
      'Description: ' + (task.description ?? 'No additional description.'),
      'Acceptance criteria: ' + (task.acceptanceCriteria ?? 'Use the task description as the acceptance criteria.'),
      'Feature: ' + task.feature.title,
    ].join('\n');
  }
}