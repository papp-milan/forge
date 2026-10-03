import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ObservabilityService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async overview(projectId?: string) {
    const where = projectId ? { projectId } : {};
    const [runs, decisions, features, tasks, reviews, audit] = await Promise.all([
      this.prisma.agentRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.agentDecision.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.feature.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.prisma.task.findMany({ where: projectId ? { feature: { projectId } } : {}, orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.prisma.governanceReview.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.audit.list({ projectId, limit: 200 }),
    ]);
    return { generatedAt: new Date().toISOString(), runs, decisions, features, tasks, governanceReviews: reviews, audit };
  }
}
