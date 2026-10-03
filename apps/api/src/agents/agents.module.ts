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
import { ApolloService } from './apollo.service.js';
import { AgentRunService } from './agent-run.service.js';
import { GovernanceModule } from '../governance/governance.module.js';

@Module({
  imports: [PrismaModule, GithubModule, RuntimeModule, AuditModule, GovernanceModule],
  controllers: [AgentsController],
  providers: [ArtemisService, HephaistosService, ApolloService, WorkspaceService, AgentRunService, AgentWorkerLoopService],
  exports: [ArtemisService, HephaistosService, ApolloService, AgentRunService],
})
export class AgentsModule {}
