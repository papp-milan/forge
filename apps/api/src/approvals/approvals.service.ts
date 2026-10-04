import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async pending(projectId?: string) {
    return this.prisma.agentDecision.findMany({
      where: { status: 'PENDING', requiresCeoApproval: true, ...(projectId ? { projectId } : {}) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { project: true },
    });
  }

  async pendingTasks(projectId?: string) {
    return this.prisma.task.findMany({
      where: {
        risk: 'LARGE',
        ceoApprovalAt: null,
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
        ...(projectId ? { feature: { projectId } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
      include: { assignee: true, feature: { include: { project: true } } },
    });
  }
}
