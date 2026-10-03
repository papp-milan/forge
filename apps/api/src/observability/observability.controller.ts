import { Controller, Get, Query } from '@nestjs/common';
import { ObservabilityService } from './observability.service.js';

@Controller('api/observability')
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Get('overview')
  overview(@Query('projectId') projectId?: string) {
    return this.observability.overview(projectId);
  }
}
