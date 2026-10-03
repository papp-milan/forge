import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RuntimeController } from './runtime.controller.js';
import { HermesRuntimeService } from './hermes-runtime.service.js';
import { AgentRuntimeService } from './agent-runtime.service.js';
import { LeaseService } from './lease.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [RuntimeController],
  providers: [HermesRuntimeService, AgentRuntimeService, LeaseService],
  exports: [HermesRuntimeService, AgentRuntimeService, LeaseService],
})
export class RuntimeModule {}
