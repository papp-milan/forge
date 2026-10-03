import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ObservabilityController } from './observability.controller.js';
import { ObservabilityService } from './observability.service.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
})
export class ObservabilityModule {}
