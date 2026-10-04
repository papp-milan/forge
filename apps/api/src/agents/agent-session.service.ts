import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AgentSessionService {
  constructor(private readonly prisma: PrismaService) {}

  start(input: { agent: string; runtime: string; projectId?: string; taskId?: string }) {
    return this.prisma.agentSession.create({ data: input });
  }

  async get(id: string) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id }, include: { messages: { orderBy: { sequence: 'asc' } }, toolCalls: { orderBy: { createdAt: 'asc' } }, artifacts: { orderBy: { createdAt: 'asc' } }, usage: true },
    });
    if (!session) throw new NotFoundException('Agent session not found');
    return session;
  }

  async message(id: string, role: string, content: unknown) {
    const session = await this.prisma.agentSession.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!session) throw new NotFoundException('Agent session not found');
    if (session.status !== 'RUNNING') throw new BadRequestException('Only running sessions can receive messages.');
    const last = await this.prisma.agentMessage.findFirst({ where: { sessionId: id }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
    return this.prisma.agentMessage.create({ data: { sessionId: id, role, sequence: (last?.sequence ?? 0) + 1, content: JSON.parse(JSON.stringify(content)) } });
  }

  toolStart(id: string, name: string, input?: unknown) {
    return this.prisma.agentToolCall.create({ data: { sessionId: id, name, input: input === undefined ? undefined : JSON.parse(JSON.stringify(input)) } });
  }

  async toolComplete(id: string, status: string, output?: unknown, error?: string) {
    const existing = await this.prisma.agentToolCall.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundException('Agent tool call not found');
    if (existing.status !== 'RUNNING') throw new BadRequestException('Only running tool calls can be completed.');
    return this.prisma.agentToolCall.update({ where: { id }, data: { status, output: output === undefined ? undefined : JSON.parse(JSON.stringify(output)), error, completedAt: new Date() } });
  }

  artifact(input: { sessionId: string; name: string; type: string; uri?: string; checksum?: string; metadata?: unknown; projectId?: string; taskId?: string }) {
    return this.prisma.agentArtifact.create({ data: { ...input, metadata: input.metadata === undefined ? undefined : JSON.parse(JSON.stringify(input.metadata)) } });
  }

  artifactsForTask(taskId: string) {
    return this.prisma.agentArtifact.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } });
  }

  usage(sessionId: string, input: { provider: string; model?: string; inputTokens?: number; outputTokens?: number; cachedTokens?: number; costUsd?: number }) {
    return this.prisma.agentUsage.upsert({ where: { sessionId }, create: { sessionId, ...input }, update: { ...input } });
  }

  async finish(id: string, status: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED') {
    const session = await this.prisma.agentSession.findUnique({ where: { id }, select: { status: true } });
    if (!session) throw new NotFoundException('Agent session not found');
    if (session.status !== 'RUNNING') throw new BadRequestException('Only running sessions can be finished.');
    return this.prisma.agentSession.update({ where: { id }, data: { status, completedAt: new Date() } });
  }
}
