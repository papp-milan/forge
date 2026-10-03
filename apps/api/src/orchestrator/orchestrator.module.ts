import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GithubModule } from '../github/github.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { OrchestratorController } from './orchestrator.controller.js';
import { OrchestratorService } from './orchestrator.service.js';
import { TeamLeadController } from './team-lead.controller.js';
import { TeamLeadService } from './team-lead.service.js';
import { TeamLeadContextService } from './team-lead-context.service.js';

@Module({
  imports: [PrismaModule, GithubModule, MemoryModule],
  controllers: [OrchestratorController, TeamLeadController],
  providers: [OrchestratorService, TeamLeadService, TeamLeadContextService],
  exports: [OrchestratorService, TeamLeadService, TeamLeadContextService],
})
export class OrchestratorModule {}
