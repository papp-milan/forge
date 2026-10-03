import { Controller, Get } from '@nestjs/common';
import { AgentRuntimeService } from './agent-runtime.service.js';

@Controller('api/runtime')
export class RuntimeController {
  constructor(private readonly runtime: AgentRuntimeService) {}

  @Get('hermes/health')
  health() {
    return this.runtime.health();
  }
}
