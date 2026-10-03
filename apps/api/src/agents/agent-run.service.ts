import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AgentRunService {
  constructor(private readonly prisma: PrismaService) {}

  async start(input: {
    agent: string;
    kind: string;
    projectId?: string;
    taskId?: string;
    attempt?: number;
    maxAttempts?: number;
    context?: unknown;
  }) {
    return this.prisma.agentRun.create({
      data: {
        agent: input.agent,
        kind: input.kind,
        projectId: input.projectId,
        taskId: input.taskId,
        attempt: input.attempt ?? 1,
        maxAttempts: input.maxAttempts ?? 3,
        input: input.context as any,
      },
    });
  }

  async complete(id: string, output?: unknown) {
    return this.prisma.agentRun.update({
      where: { id },
      data: { status: 'COMPLETED', output: output as any, completedAt: new Date() },
    });
  }

  async fail(id: string, error: unknown, output?: unknown) {
    return this.prisma.agentRun.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        output: output as any,
        completedAt: new Date(),
      },
    });
  }

  async block(id: string, reason: string) {
    return this.prisma.agentRun.update({
      where: { id },
      data: { status: 'BLOCKED', error: reason, completedAt: new Date() },
    });
  }

  async recoverStale(maxAgeMs = Math.max(Number(process.env['AGENT_RUN_STALE_MS'] ?? 900_000), 60_000)) {
    const cutoff = new Date(Date.now() - maxAgeMs);
    return this.prisma.agentRun.updateMany({
      where: { status: 'RUNNING', startedAt: { lt: cutoff } },
      data: { status: 'FAILED', error: 'Agent run exceeded the stale-run timeout.', completedAt: new Date() },
    });
  }

  async recentForTask(taskId: string, limit = 10) {
    return this.prisma.agentRun.findMany({ where: { taskId }, orderBy: { createdAt: 'desc' }, take: limit });
  }
}
