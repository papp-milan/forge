import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly github: GithubService, private readonly audit: AuditService) {}

  async reconcileProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { features: { include: { tasks: true } } } });
    if (!project?.repository) return { projectId, status: 'SKIPPED', reason: 'NO_REPOSITORY' };

    const normalized = project.repository.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    const [owner, repo] = normalized.split('/');
    if (!owner || !repo) return { projectId, status: 'FAILED', reason: 'INVALID_REPOSITORY' };

    const prs = await this.github.getPullRequests(owner, repo);
    const branches = await this.github.getBranches(owner, repo);
    const prByBranch = new Map(prs.map((pr) => [pr.branch, pr]));
    const findings: unknown[] = [];

    for (const feature of project.features) {
      for (const task of feature.tasks) {
        if (!task.branchName) continue;
        const pr = prByBranch.get(task.branchName);
        if (pr && (!task.pullRequestNumber || task.pullRequestNumber !== pr.number)) {
          await this.prisma.task.update({ where: { id: task.id }, data: { pullRequestNumber: pr.number, pullRequestUrl: pr.url } });
          findings.push({ taskId: task.id, action: 'LINKED_PULL_REQUEST', pullRequest: pr.number });
        }
        if (!branches.some((branch) => branch.name === task.branchName) && !pr) {
          await this.prisma.task.update({ where: { id: task.id }, data: { status: 'BLOCKED' } });
          findings.push({ taskId: task.id, action: 'BLOCKED_MISSING_BRANCH' });
        }
      }
    }

    await this.audit.record({ actor: 'system', type: 'RECONCILIATION_COMPLETED', projectId, entityType: 'project', entityId: projectId, summary: 'GitHub state reconciled', data: { findings } });
    return { projectId, status: 'COMPLETED', findings };
  }
}
