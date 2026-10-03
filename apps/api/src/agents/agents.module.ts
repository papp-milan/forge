import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GithubModule } from '../github/github.module.js';
import { RuntimeModule } from '../runtime/runtime.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AgentsController } from './agents.controller.js';
import { ArtemisService } from './artemis.service.js';
import { HephaistosService } from './hephaistos.service.js';
import { WorkspaceService } from './workspace.service.js';
import { AgentWorkerLoopService } from './agent-worker-loop.service.js';

@Module({
  imports: [PrismaModule, GithubModule, RuntimeModule, AuditModule],
  controllers: [AgentsController],
  providers: [ArtemisService, HephaistosService, WorkspaceService, AgentWorkerLoopService],
  exports: [ArtemisService, HephaistosService],
})
export class AgentsModule {}
