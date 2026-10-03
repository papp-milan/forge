import { Injectable } from '@nestjs/common';
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type AuditActor = 'ceo' | 'athena' | 'hephaistos' | 'artemis' | 'apollo' | 'nike' | 'atlas' | 'system' | 'team' | 'team_lead' | 'ui_ux' | 'engineer' | 'qa' | 'devops';
export type AuditEventType =
  | 'DECISION_CREATED' | 'DECISION_APPROVED' | 'DECISION_REJECTED'
  | 'DECISION_EXECUTION_STARTED' | 'DECISION_EXECUTED' | 'DECISION_BLOCKED' | 'DECISION_FAILED'
  | 'WORKER_STARTED' | 'WORKER_COMPLETED' | 'WORKER_FAILED'
  | 'QA_STARTED' | 'QA_PASSED' | 'QA_FAILED'
  | 'RELEASE_STARTED' | 'RELEASED' | 'RELEASE_FAILED' | 'RELEASE_SIMULATED'
  | 'QA_GATE_READY' | 'QA_APPROVED'
  | 'GOVERNANCE_REVIEW_CREATED' | 'GOVERNANCE_OPINION_RECORDED' | 'GOVERNANCE_FINDING_RECORDED' | 'GOVERNANCE_REVIEW_FINALIZED'
  | 'MEMORY_CREATED' | 'MEMORY_UPDATED' | 'MEMORY_DELETED'
  | 'ORCHESTRATOR_ERROR' | 'RECONCILIATION_COMPLETED';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: AuditActor;
  type: AuditEventType;
  projectId?: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  data?: Record<string, unknown>;
}

type AuditListOptions = {
  projectId?: string;
  type?: AuditEventType;
  limit?: number;
  before?: Date;
};

@Injectable()
export class AuditService {
  private readonly auditRoot = path.resolve(process.cwd(), '../../memory/audit');

  async record(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    const result: AuditEvent = { id: randomUUID(), timestamp: new Date().toISOString(), ...event };
    await mkdir(this.auditRoot, { recursive: true });
    const filePath = path.join(this.auditRoot, `${result.timestamp.slice(0, 10)}.jsonl`);
    await appendFile(filePath, `${JSON.stringify(result)}\n`, 'utf8');
    return result;
  }

  async list(options?: AuditListOptions): Promise<AuditEvent[]> {
    const files = await this.listFiles();
    const events: AuditEvent[] = [];
    const before = options?.before?.getTime();

    for (const filePath of files.reverse()) {
      let raw: string;
      try { raw = await readFile(filePath, 'utf8'); } catch { continue; }

      for (const line of raw.split('\n').filter(Boolean).reverse()) {
        try {
          const event = JSON.parse(line) as AuditEvent;
          if (before !== undefined && new Date(event.timestamp).getTime() >= before) continue;
          if (options?.projectId && event.projectId !== options.projectId) continue;
          if (options?.type && event.type !== options.type) continue;
          events.push(event);
          if (options?.limit && events.length >= options.limit) return events;
        } catch {
          // Ignore malformed historical records so one bad line cannot hide the rest.
        }
      }
    }

    return events.slice(0, options?.limit ?? 100);
  }

  private async listFiles(): Promise<string[]> {
    try {
      const entries = await readdir(this.auditRoot, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
        .sort()
        .map((entry) => path.join(this.auditRoot, entry.name));
    } catch {
      return [];
    }
  }
}
