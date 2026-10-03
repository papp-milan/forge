import { Module } from '@nestjs/common';
import { RuntimeController } from './runtime.controller.js';
import { HermesRuntimeService } from './hermes-runtime.service.js';

@Module({
  controllers: [RuntimeController],
  providers: [HermesRuntimeService],
  exports: [HermesRuntimeService],
})
export class RuntimeModule {}
