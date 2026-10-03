import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TeamLeadActionExecutorService } from './team-lead-action-executor.service.js';
import { TeamLeadDecision } from './team-lead-decision.types.js';

@Injectable()
export class AgentDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: TeamLeadActionExecutorService,
  ) {}

  async create(projectId: string, decision: TeamLeadDecision) {
    const status = decision.requiresCeoApproval ? 'PENDING' : 'APPROVED';

    return this.prisma.agentDecision.create({
      data: {
        agent: 'ATHENA',
        type: decision.type,
        priority: decision.priority,
        title: decision.title,
        reasoning: decision.reasoning,
        evidence: decision.evidence,
        actions: decision.actions,
        requiresCeoApproval: decision.requiresCeoApproval,
        status,
        projectId,
      },
      include: { project: true },
    });
  }

  async list(status?: string) {
    return this.prisma.agentDecision.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { project: true },
    });
  }

  async get(id: string) {
    const decision = await this.prisma.agentDecision.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!decision) {
      throw new NotFoundException('Agent decision not found');
    }

    return decision;
  }

  async approve(id: string, comment?: string) {
    const decision = await this.get(id);

    if (decision.status !== 'PENDING') {
      throw new BadRequestException(
        `Only pending decisions can be approved. Current status: ${decision.status}`,
      );
    }

    return this.prisma.agentDecision.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        resolutionComment: comment,
      },
      include: { project: true },
    });
  }

  async reject(id: string, comment?: string) {
    const decision = await this.get(id);

    if (decision.status !== 'PENDING') {
      throw new BadRequestException(
        `Only pending decisions can be rejected. Current status: ${decision.status}`,
      );
    }

    return this.prisma.agentDecision.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        resolutionComment: comment,
      },
      include: { project: true },
    });
  }

  async execute(id: string) {
    const decision = await this.get(id);

    if (decision.status !== 'APPROVED') {
      throw new BadRequestException(
        `Only approved decisions can be executed. Current status: ${decision.status}`,
      );
    }

    const typedDecision: TeamLeadDecision = {
      type: decision.type as TeamLeadDecision['type'],
      priority: decision.priority as TeamLeadDecision['priority'],
      title: decision.title,
      reasoning: decision.reasoning,
      evidence: Array.isArray(decision.evidence)
        ? decision.evidence.map(String)
        : [],
      actions: decision.actions as TeamLeadDecision['actions'],
      requiresCeoApproval: decision.requiresCeoApproval,
    };

    const results = await this.executor.execute(
      decision.projectId,
      typedDecision,
    );

    const failed = results.some((result) => result.status === 'FAILED');
    const blocked = results.some((result) => result.status === 'BLOCKED');
    const executed = results.some((result) => result.status === 'EXECUTED');

    const status = failed
      ? 'FAILED'
      : blocked
        ? 'BLOCKED'
        : 'EXECUTED';

    const updated = await this.prisma.agentDecision.update({
      where: { id },
      data: {
        status,
        executedAt: executed ? new Date() : undefined,
      },
      include: { project: true },
    });

    return { decision: updated, results };
  }
}
