import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrchestratorController } from './orchestrator.controller.js';
import { OrchestratorService } from './orchestrator.service.js';
import { TeamLeadController } from './team-lead.controller.js';
import { TeamLeadService } from './team-lead.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrchestratorController, TeamLeadController],
  providers: [OrchestratorService, TeamLeadService],
  exports: [OrchestratorService, TeamLeadService],
})
export class OrchestratorModule {}
