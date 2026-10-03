import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';

@Injectable()
export class InfrastructureArchitectService {
  constructor(private readonly prisma: PrismaService, private readonly github: GithubService) {}

  async inspectProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project?.repository) return { projectId, status: 'NO_REPOSITORY' };
    const normalized = project.repository.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    const [owner, repo] = normalized.split('/');
    if (!owner || !repo) return { projectId, status: 'INVALID_REPOSITORY' };
    const repository = await this.github.getRepository(owner, repo);
    const branches = await this.github.getBranches(owner, repo);
    return {
      projectId,
      status: 'INSPECTED',
      repository,
      protectedBranches: branches.filter((branch) => branch.protected).map((branch) => branch.name),
    };
  }
}
