import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { FeaturesModule } from './features/features.module.js';
import { PitchesModule } from './pitches/pitches.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { GithubModule } from './github/github.module.js';
import { OrchestratorModule } from './orchestrator/orchestrator.module.js';
import { MemoryModule } from './memory/memory.module.js';
import { AuditModule } from './audit/audit.module.js';
import { RuntimeModule } from './runtime/runtime.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { WorkforceModule } from './workforce/workforce.module.js';
import { GovernanceModule } from './governance/governance.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { ReconciliationModule } from './reconciliation/reconciliation.module.js';
import { SecurityModule } from './security/security.module.js';
import { IdeasModule } from './ideas/ideas.module.js';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './security/rate-limit.guard.js';

@Module({
  imports: [PrismaModule, ProjectsModule, EmployeesModule, FeaturesModule, PitchesModule, TasksModule, GithubModule, OrchestratorModule, MemoryModule, AuditModule, RuntimeModule, AgentsModule, WorkforceModule, GovernanceModule, ApprovalsModule, ObservabilityModule, ReconciliationModule, SecurityModule, IdeasModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
