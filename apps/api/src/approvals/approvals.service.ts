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
}
