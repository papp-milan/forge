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
  | 'RELEASE_STARTED' | 'RELEASED' | 'RELEASE_FAILED'
  | 'MEMORY_CREATED' | 'MEMORY_UPDATED' | 'MEMORY_DELETED'
  | 'ORCHESTRATOR_ERROR';

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

  async list(options?: { projectId?: string; type?: AuditEventType; limit?: number }): Promise<AuditEvent[]> {
    const files = await this.listFiles();
    const events: AuditEvent[] = [];
    for (const filePath of files.reverse()) {
      let raw: string;
      try { raw = await readFile(filePath, 'utf8'); } catch { continue; }
      for (const line of raw.split('\n').filter(Boolean).reverse()) {
        try { events.push(JSON.parse(line) as AuditEvent); } catch {}
        if (options?.limit && events.length >= options.limit) return this.filter(events, options);
      }
    }
    return this.filter(events, options);
  }

  private filter(events: AuditEvent[], options?: { projectId?: string; type?: AuditEventType; limit?: number }) {
    return events.filter((event) => !options?.projectId || event.projectId === options.projectId)
      .filter((event) => !options?.type || event.type === options.type)
      .slice(0, options?.limit ?? 100);
  }

  private async listFiles(): Promise<string[]> {
    try {
      const entries = await readdir(this.auditRoot, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl')).sort().map((entry) => path.join(this.auditRoot, entry.name));
    } catch { return []; }
  }
}
