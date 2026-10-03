import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { GovernanceController } from './governance.controller.js';
import { GovernanceService } from './governance.service.js';
import { GovernancePolicyService } from './governance-policy.service.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [GovernanceController],
  providers: [GovernanceService, GovernancePolicyService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
