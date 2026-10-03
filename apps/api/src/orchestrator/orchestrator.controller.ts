import { Controller, Get, Param, Post } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service.js';
import { OrchestratorLoopService } from './orchestrator-loop.service.js';

@Controller('api/orchestrator')
export class OrchestratorController {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly loop: OrchestratorLoopService,
  ) {}

  @Get('projects/:projectId/analyze')
  analyze(@Param('projectId') projectId: string) {
    return this.orchestrator.analyzeProject(projectId);
  }

  @Get('status')
  status() {
    return this.loop.status();
  }
}
