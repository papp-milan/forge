import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService, type AuditEvent } from '../audit/audit.service.js';

export type AgentActivityEvent = {
  id: string; timestamp: string; agent: string;
  source: 'AUDIT' | 'RUN' | 'SESSION' | 'TOOL' | 'COMMUNICATION' | 'ARTIFACT';
  kind: string; status?: string; summary: string;
  projectId?: string; taskId?: string; metadata?: unknown;
};

@Injectable()
export class AgentActivityService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async listGlobal(limit = 100): Promise<AgentActivityEvent[]> {
    const [auditEvents, runs, sessions, communications, artifacts] = await Promise.all([
      this.audit.list({ limit: Math.min(limit, 250) }),
      this.prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.agentSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50),
        include: { toolCalls: { orderBy: { createdAt: 'desc' }, take: 20 } },
      }),
      this.prisma.agentCommunication.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.agentArtifact.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { session: { select: { agent: true } } },
      }),
    ]);

    const events: AgentActivityEvent[] = auditEvents.map((event: AuditEvent) => ({
      id: 'audit:' + event.id,
      timestamp: event.timestamp,
      agent: event.actor.toLowerCase(),
      source: 'AUDIT',
      kind: event.type,
      summary: event.summary,
      projectId: event.projectId,
      taskId: event.entityType === 'task' ? event.entityId : undefined,
      metadata: event.data,
    }));

    for (const run of runs) events.push({
      id: 'run:' + run.id,
      timestamp: (run.completedAt ?? run.startedAt).toISOString(),
      agent: run.agent,
      source: 'RUN',
      kind: run.kind,
      status: run.status,
      summary: run.kind + ' run · attempt ' + run.attempt + '/' + run.maxAttempts,
      projectId: run.projectId ?? undefined,
      taskId: run.taskId ?? undefined,
      metadata: { error: run.error, failureClass: run.failureClass, retryable: run.retryable },
    });

    for (const session of sessions) {
      events.push({
        id: 'session:' + session.id,
        timestamp: (session.updatedAt ?? session.startedAt).toISOString(),
        agent: session.agent,
        source: 'SESSION',
        kind: 'SESSION',
        status: session.status,
        summary: session.runtime + ' agent session',
        projectId: session.projectId ?? undefined,
        taskId: session.taskId ?? undefined,
        metadata: { startedAt: session.startedAt, completedAt: session.completedAt },
      });
      for (const tool of session.toolCalls) events.push({
        id: 'tool:' + tool.id,
        timestamp: (tool.completedAt ?? tool.startedAt).toISOString(),
        agent: session.agent,
        source: 'TOOL',
        kind: tool.name,
        status: tool.status,
        summary: 'Tool call · ' + tool.name,
        projectId: session.projectId ?? undefined,
        taskId: session.taskId ?? undefined,
        metadata: { input: tool.input, output: tool.output, error: tool.error },
      });
    }

    for (const message of communications) events.push({
      id: 'communication:' + message.id,
      timestamp: message.createdAt.toISOString(),
      agent: message.fromAgent,
      source: 'COMMUNICATION',
      kind: message.kind,
      status: message.status,
      summary: message.fromAgent.toLowerCase() === 'ceo'
        ? 'CEO → ' + message.toAgent + ' · ' + message.subject
        : message.fromAgent + ' → ' + message.toAgent + ' · ' + message.subject,
      projectId: message.projectId ?? undefined,
      taskId: message.taskId ?? undefined,
      metadata: { from: message.fromAgent, to: message.toAgent, priority: message.priority, content: message.content, correlationId: message.correlationId },
    });

    for (const artifact of artifacts) events.push({
      id: 'artifact:' + artifact.id,
      timestamp: artifact.createdAt.toISOString(),
      agent: artifact.session.agent,
      source: 'ARTIFACT',
      kind: artifact.type,
      summary: 'Artifact · ' + artifact.name,
      projectId: artifact.projectId ?? undefined,
      taskId: artifact.taskId ?? undefined,
      metadata: { uri: artifact.uri, checksum: artifact.checksum, metadata: artifact.metadata },
    });

    return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, Math.min(Math.max(limit, 1), 250));
  }

  async list(agent: string, projectId?: string, limit = 100): Promise<AgentActivityEvent[]> {
    const normalized = agent.toLowerCase();
    const [auditEvents, runs, sessions, communications, artifacts] = await Promise.all([
      this.audit.list({ projectId, limit: Math.min(limit, 250) }),
      this.prisma.agentRun.findMany({ where: { agent: normalized, ...(projectId ? { projectId } : {}) }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.agentSession.findMany({ where: { agent: normalized, ...(projectId ? { projectId } : {}) }, include: { toolCalls: { orderBy: { createdAt: 'desc' }, take: 20 } }, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 50) }),
      this.prisma.agentCommunication.findMany({ where: { ...(projectId ? { projectId } : {}), OR: [{ fromAgent: normalized }, { toAgent: normalized }] }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.agentArtifact.findMany({ where: { ...(projectId ? { projectId } : {}), session: { agent: normalized } }, orderBy: { createdAt: 'desc' }, take: limit }),
    ]);

    const events: AgentActivityEvent[] = auditEvents.filter((event) => event.actor.toLowerCase() === normalized).map((event: AuditEvent) => ({
      id: 'audit:' + event.id, timestamp: event.timestamp, agent: normalized, source: 'AUDIT', kind: event.type,
      summary: event.summary, projectId: event.projectId, taskId: event.entityType === 'task' ? event.entityId : undefined, metadata: event.data,
    }));

    for (const run of runs) events.push({
      id: 'run:' + run.id, timestamp: (run.completedAt ?? run.startedAt).toISOString(), agent: normalized, source: 'RUN',
      kind: run.kind, status: run.status, summary: run.kind + ' run · attempt ' + run.attempt + '/' + run.maxAttempts,
      projectId: run.projectId ?? undefined, taskId: run.taskId ?? undefined,
      metadata: { error: run.error, failureClass: run.failureClass, retryable: run.retryable },
    });

    for (const session of sessions) {
      events.push({
        id: 'session:' + session.id, timestamp: (session.updatedAt ?? session.startedAt).toISOString(), agent: normalized,
        source: 'SESSION', kind: 'SESSION', status: session.status, summary: session.runtime + ' agent session',
        projectId: session.projectId ?? undefined, taskId: session.taskId ?? undefined,
        metadata: { startedAt: session.startedAt, completedAt: session.completedAt },
      });
      for (const tool of session.toolCalls) events.push({
        id: 'tool:' + tool.id, timestamp: (tool.completedAt ?? tool.startedAt).toISOString(), agent: normalized,
        source: 'TOOL', kind: tool.name, status: tool.status, summary: 'Tool call · ' + tool.name,
        projectId: session.projectId ?? undefined, taskId: session.taskId ?? undefined,
        metadata: { input: tool.input, output: tool.output, error: tool.error },
      });
    }

    for (const message of communications) {
      const direction = message.fromAgent.toLowerCase() === normalized ? 'Sent' : 'Received';
      events.push({
        id: 'communication:' + message.id, timestamp: message.createdAt.toISOString(), agent: normalized, source: 'COMMUNICATION',
        kind: message.kind, status: message.status, summary: direction + ' · ' + message.subject,
        projectId: message.projectId ?? undefined, taskId: message.taskId ?? undefined,
        metadata: { from: message.fromAgent, to: message.toAgent, priority: message.priority, content: message.content, correlationId: message.correlationId },
      });
    }

    for (const artifact of artifacts) events.push({
      id: 'artifact:' + artifact.id, timestamp: artifact.createdAt.toISOString(), agent: normalized, source: 'ARTIFACT',
      kind: artifact.type, summary: 'Artifact · ' + artifact.name, projectId: artifact.projectId ?? undefined,
      taskId: artifact.taskId ?? undefined, metadata: { uri: artifact.uri, checksum: artifact.checksum, metadata: artifact.metadata },
    });

    return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, Math.min(Math.max(limit, 1), 250));
  }
}
