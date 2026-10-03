import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { FeaturesController } from './features.controller.js';
import { FeaturesService } from './features.service.js';

@Module({
  imports: [GithubModule, AuditModule],
  controllers: [FeaturesController],
  providers: [FeaturesService],
})
export class FeaturesModule {}
