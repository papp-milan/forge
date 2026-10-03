import { Module } from '@nestjs/common';
import { RuntimeController } from './runtime.controller.js';
import { HermesRuntimeService } from './hermes-runtime.service.js';
import { AgentRuntimeService } from './agent-runtime.service.js';

@Module({
  controllers: [RuntimeController],
  providers: [HermesRuntimeService, AgentRuntimeService],
  exports: [HermesRuntimeService, AgentRuntimeService],
})
export class RuntimeModule {}
