import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { RuntimeModule } from '../runtime/runtime.module.js';
import { GovernanceModule } from '../governance/governance.module.js';
import { FeaturesController } from './features.controller.js';
import { FeaturesService } from './features.service.js';

@Module({
  imports: [GithubModule, AuditModule, RuntimeModule, GovernanceModule],
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
