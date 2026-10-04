import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { OrchestratorModule } from '../orchestrator/orchestrator.module.js';
import { IdeasController } from './ideas.controller.js';
import { IdeasService } from './ideas.service.js';

@Module({
  imports: [PrismaModule, AuditModule, OrchestratorModule],
  controllers: [IdeasController],
  providers: [IdeasService],
  exports: [IdeasService],
})
export class IdeasModule {}
