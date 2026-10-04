import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AgentCommunicationInput {
  fromAgent: string;
  toAgent: string;
  kind: 'HANDOFF' | 'FEEDBACK' | 'DISPUTE' | 'ESCALATION' | 'DECISION' | 'STATUS';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subject: string;
  content: unknown;
  correlationId?: string;
  projectId?: string;
  featureId?: string;
  taskId?: string;
}

@Injectable()
export class AgentCommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async send(input: AgentCommunicationInput) {
    return this.prisma.agentCommunication.create({
      data: {
        fromAgent: input.fromAgent.toUpperCase(),
        toAgent: input.toAgent.toUpperCase(),
        kind: input.kind,
        priority: input.priority ?? 'MEDIUM',
        subject: input.subject,
        content: JSON.parse(JSON.stringify(input.content)),
        correlationId: input.correlationId,
        projectId: input.projectId,
        featureId: input.featureId,
        taskId: input.taskId,
      },
    });
  }

  async notifyOnce(input: AgentCommunicationInput) {
    const existing = await this.prisma.agentCommunication.findFirst({
      where: { fromAgent: input.fromAgent.toUpperCase(), toAgent: input.toAgent.toUpperCase(), kind: input.kind, taskId: input.taskId, status: { in: ['UNREAD', 'READ', 'ACKNOWLEDGED'] } },
    });
    return existing ?? this.send(input);
  }

  async inbox(agent: string, status?: 'UNREAD' | 'READ' | 'ACKNOWLEDGED' | 'RESOLVED') {
    return this.prisma.agentCommunication.findMany({
      where: { toAgent: agent.toUpperCase(), ...(status ? { status } : {}) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    });
  }

  async acknowledge(id: string) {
    const message = await this.prisma.agentCommunication.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Agent communication not found');

    return this.prisma.agentCommunication.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), deliveredAt: message.deliveredAt ?? new Date() },
    });
  }

  async resolve(id: string) {
    const message = await this.prisma.agentCommunication.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Agent communication not found');
    return this.prisma.agentCommunication.update({
      where: { id },
      data: { status: 'RESOLVED', deliveredAt: message.deliveredAt ?? new Date(), acknowledgedAt: message.acknowledgedAt ?? new Date() },
    });
  }

  async thread(correlationId: string) {
    return this.prisma.agentCommunication.findMany({
      where: { correlationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
