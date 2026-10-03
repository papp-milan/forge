import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { TeamLeadAgentService } from './team-lead-agent.service.js';
import { ReconciliationService } from '../reconciliation/reconciliation.service.js';
import { LeaseService } from '../runtime/lease.service.js';
import { AgentDecisionService } from './agent-decision.service.js';
import { GithubService } from '../github/github.service.js';

@Injectable()
export class OrchestratorLoopService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  private readonly enabled = process.env['FORGE_AUTONOMOUS'] === 'true';
  private readonly intervalMs = Math.max(
    Number(process.env['FORGE_AUTONOMOUS_INTERVAL_MS'] ?? 300_000),
    30_000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: TeamLeadAgentService,
    private readonly audit: AuditService,
    private readonly reconciliation: ReconciliationService,
    private readonly lease: LeaseService,
    private readonly decisions: AgentDecisionService,
    private readonly github: GithubService,
  ) {}

  onModuleInit() {
    if (!this.enabled) return;

    void this.cycle();
    this.timer = setInterval(() => void this.cycle(), this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  status() {
    return {
      enabled: this.enabled,
      running: this.running,
      intervalMs: this.intervalMs,
    };
  }

  private async cycle() {
    if (this.running) return;
    if (!(await this.lease.acquire('forge:orchestrator-loop'))) return;

    this.running = true;
    this.github.beginCycle();

    try {
      await this.decisions.recoverStaleExecuting();
      const projects = await this.prisma.project.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const project of projects) {
        try {
          await this.reconciliation.reconcileProject(project.id);
          await this.agent.run(project.id);
        } catch (error) {
          await this.audit.record({
            actor: 'system',
            type: 'ORCHESTRATOR_ERROR',
            projectId: project.id,
            entityType: 'project',
            entityId: project.id,
            summary: project.name,
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    } finally {
      this.github.endCycle();
      this.running = false;
      await this.lease.release('forge:orchestrator-loop');
    }
  }
}
