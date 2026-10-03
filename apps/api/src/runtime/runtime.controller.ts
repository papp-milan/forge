import { Controller, Get } from '@nestjs/common';
import { HermesRuntimeService } from './hermes-runtime.service.js';

@Controller('api/runtime')
export class RuntimeController {
  constructor(private readonly hermes: HermesRuntimeService) {}

  @Get('hermes/health')
  health() {
    return this.hermes.health();
  }
}
