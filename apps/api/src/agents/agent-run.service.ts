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
    const stale = await this.prisma.agentRun.findMany({
      where: { status: 'RUNNING', startedAt: { lt: cutoff } },
      select: { id: true, taskId: true, projectId: true, agent: true },
    });

    if (stale.length === 0) return [];

    await this.prisma.$transaction([
      ...stale.map((run) => this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', error: 'Agent run exceeded the stale-run timeout.', completedAt: new Date() },
      })),
      ...stale.filter((run) => run.taskId).map((run) => this.prisma.task.updateMany({
        where: { id: run.taskId!, status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] } },
        data: { status: 'BLOCKED' },
      })),
    ]);

    return stale;
  }

  async recentForTask(taskId: string, limit = 10) {
    return this.prisma.agentRun.findMany({ where: { taskId }, orderBy: { createdAt: 'desc' }, take: limit });
  }
}
