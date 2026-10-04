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
import { FeaturesModule } from '../features/features.module.js';
import { WorkforceModule } from '../workforce/workforce.module.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentCommunicationService } from './agent-communication.service.js';
import { RetryPolicyService } from './retry-policy.service.js';
import { AtlasService } from './atlas.service.js';
import { AgentActivityService } from './agent-activity.service.js';

@Module({
  imports: [PrismaModule, GithubModule, RuntimeModule, AuditModule, GovernanceModule, FeaturesModule, WorkforceModule],
  controllers: [AgentsController],
  providers: [ArtemisService, HephaistosService, ApolloService, AtlasService, WorkspaceService, AgentRunService, AgentWorkerLoopService, AgentSessionService, AgentCommunicationService, RetryPolicyService, AgentActivityService],
  exports: [ArtemisService, HephaistosService, ApolloService, AtlasService, AgentRunService, AgentSessionService, AgentCommunicationService, RetryPolicyService],
})
export class AgentsModule {}
