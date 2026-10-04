import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WorkforceController } from './workforce.controller.js';
import { WorkforceService } from './workforce.service.js';
import { ReleaseOrchestratorService } from './release-orchestrator.service.js';
import { InfrastructureArchitectService } from './infrastructure-architect.service.js';
import { NikeService } from './nike.service.js';
import { GithubModule } from '../github/github.module.js';
import { FeaturesModule } from '../features/features.module.js';

@Module({
  imports: [PrismaModule, GithubModule, FeaturesModule],
  controllers: [WorkforceController],
  providers: [WorkforceService, ReleaseOrchestratorService, InfrastructureArchitectService, NikeService],
  exports: [WorkforceService, ReleaseOrchestratorService, InfrastructureArchitectService, NikeService],
})
export class WorkforceModule {}
