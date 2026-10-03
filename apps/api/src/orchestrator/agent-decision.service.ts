import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TeamLeadActionExecutorService } from './team-lead-action-executor.service.js';
import { TeamLeadDecision } from './team-lead-decision.types.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class AgentDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: TeamLeadActionExecutorService,
    private readonly audit: AuditService,
  ) {}

  async create(projectId: string, decision: TeamLeadDecision) {
    const existing = await this.prisma.agentDecision.findFirst({
      where: {
        projectId,
        agent: 'ATHENA',
        type: decision.type,
        title: decision.title,
        status: {
          in: decision.requiresCeoApproval
            ? ['PENDING', 'APPROVED']
            : ['APPROVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return this.get(existing.id);
    }

    const status = decision.requiresCeoApproval ? 'PENDING' : 'APPROVED';

    const created = await this.prisma.agentDecision.create({
      data: {
        agent: 'ATHENA',
        type: decision.type,
        priority: decision.priority,
        title: decision.title,
        reasoning: decision.reasoning,
        evidence: decision.evidence,
        actions: JSON.parse(JSON.stringify(decision.actions)),
        requiresCeoApproval: decision.requiresCeoApproval,
        status,
        projectId,
      },
      include: { project: true },
    });

    await this.audit.record({
      actor: 'athena',
      type: 'DECISION_CREATED',
      projectId,
      entityType: 'agent_decision',
      entityId: created.id,
      summary: created.title,
      data: {
        decisionType: created.type,
        priority: created.priority,
        requiresCeoApproval: created.requiresCeoApproval,
      },
    });

    return created;
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

    const transitioned = await this.prisma.agentDecision.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', approvedAt: new Date(), resolutionComment: comment },
    });
    if (transitioned.count !== 1) {
      const current = await this.get(id);
      throw new BadRequestException(`Decision was already resolved. Current status: ${current.status}`);
    }

    await this.audit.record({
      actor: 'ceo',
      type: 'DECISION_APPROVED',
      projectId: decision.projectId,
      entityType: 'agent_decision',
      entityId: id,
      summary: decision.title,
      data: { comment: comment ?? null },
    });

    return this.execute(id);
  }

  async reject(id: string, comment?: string) {
    const decision = await this.get(id);

    if (decision.status !== 'PENDING') {
      throw new BadRequestException(
        `Only pending decisions can be rejected. Current status: ${decision.status}`,
      );
    }

    const transitioned = await this.prisma.agentDecision.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectedAt: new Date(), resolutionComment: comment },
    });
    if (transitioned.count !== 1) {
      const current = await this.get(id);
      throw new BadRequestException(`Decision was already resolved. Current status: ${current.status}`);
    }
    const rejected = await this.get(id);

    await this.audit.record({
      actor: 'ceo',
      type: 'DECISION_REJECTED',
      projectId: decision.projectId,
      entityType: 'agent_decision',
      entityId: id,
      summary: decision.title,
      data: { comment: comment ?? null },
    });

    return rejected;
  }

  async recoverStaleExecuting(maxAgeMs = Math.max(Number(process.env['AGENT_DECISION_STALE_MS'] ?? process.env['AGENT_RUN_STALE_MS'] ?? 900_000), 60_000)) {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const stale = await this.prisma.agentDecision.findMany({
      where: { status: 'EXECUTING', executionStartedAt: { lt: cutoff } },
      select: { id: true, projectId: true, title: true },
    });
    for (const decision of stale) {
      await this.prisma.agentDecision.updateMany({
        where: { id: decision.id, status: 'EXECUTING' },
        data: { status: 'FAILED' },
      });
      await this.audit.record({
        actor: 'system', type: 'DECISION_FAILED', projectId: decision.projectId,
        entityType: 'agent_decision', entityId: decision.id,
        summary: decision.title, data: { reason: 'stale_execution_recovered' },
      });
    }
    return stale;
  }

  async execute(id: string) {
    const decision = await this.get(id);

    if (decision.status === 'EXECUTED') {
      return { decision, results: [] };
    }

    if (decision.status === 'EXECUTING') {
      throw new ConflictException('Decision execution is already in progress.');
    }

    if (decision.status !== 'APPROVED') {
      throw new BadRequestException(
        `Only approved decisions can be executed. Current status: ${decision.status}`,
      );
    }

    if (decision.requiresCeoApproval && !decision.approvedAt) {
      throw new BadRequestException('CEO approval is required before this decision can execute.');
    }

    const claimed = await this.prisma.agentDecision.updateMany({
      where: { id, status: 'APPROVED' },
      data: { status: 'EXECUTING', executionStartedAt: new Date() },
    });

    if (claimed.count !== 1) {
      const current = await this.get(id);
      if (current.status === 'EXECUTED') return { decision: current, results: [] };
      throw new ConflictException(`Decision execution could not be claimed. Current status: ${current.status}`);
    }

    await this.audit.record({
      actor: 'system',
      type: 'DECISION_EXECUTION_STARTED',
      projectId: decision.projectId,
      entityType: 'agent_decision',
      entityId: id,
      summary: decision.title,
    });

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

    try {
      const results = await this.executor.execute(decision.projectId, typedDecision);
      const failed = results.some((result) => result.status === 'FAILED');
      const blocked = results.some((result) => result.status === 'BLOCKED');
      const executed = results.some((result) => result.status === 'EXECUTED');

      const status = failed ? 'FAILED' : blocked ? 'BLOCKED' : 'EXECUTED';
      const updated = await this.prisma.agentDecision.update({
        where: { id },
        data: { status, executedAt: executed ? new Date() : undefined },
        include: { project: true },
      });

      await this.audit.record({
        actor: 'system',
        type: status === 'EXECUTED' ? 'DECISION_EXECUTED' : status === 'BLOCKED' ? 'DECISION_BLOCKED' : 'DECISION_FAILED',
        projectId: decision.projectId,
        entityType: 'agent_decision',
        entityId: id,
        summary: decision.title,
        data: { results },
      });

      return { decision: updated, results };
    } catch (error) {
      const updated = await this.prisma.agentDecision.update({
        where: { id },
        data: { status: 'FAILED' },
        include: { project: true },
      });
      await this.audit.record({
        actor: 'system',
        type: 'DECISION_FAILED',
        projectId: decision.projectId,
        entityType: 'agent_decision',
        entityId: id,
        summary: decision.title,
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return { decision: updated, results: [{ status: 'FAILED', actionType: 'DECISION', reason: error instanceof Error ? error.message : String(error) }] };
    }
  }
}
