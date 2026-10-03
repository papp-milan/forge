import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GithubModule } from '../github/github.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { OrchestratorController } from './orchestrator.controller.js';
import { OrchestratorService } from './orchestrator.service.js';
import { TeamLeadController } from './team-lead.controller.js';
import { TeamLeadService } from './team-lead.service.js';
import { TeamLeadContextService } from './team-lead-context.service.js';
import { TeamLeadAgentService } from './team-lead-agent.service.js';
import { TeamLeadActionExecutorService } from './team-lead-action-executor.service.js';
import { TeamLeadDecisionValidatorService } from './team-lead-decision-validator.service.js';
import { AgentDecisionService } from './agent-decision.service.js';
import { AgentDecisionController } from './agent-decision.controller.js';

@Module({
  imports: [PrismaModule, GithubModule, MemoryModule],
  controllers: [
    OrchestratorController,
    TeamLeadController,
    AgentDecisionController,
  ],
  providers: [
    OrchestratorService,
    TeamLeadService,
    TeamLeadContextService,
    TeamLeadAgentService,
    TeamLeadDecisionValidatorService,
    TeamLeadActionExecutorService,
    AgentDecisionService,
  ],
  exports: [
    OrchestratorService,
    TeamLeadService,
    TeamLeadContextService,
    AgentDecisionService,
  ],
})
export class OrchestratorModule {}
