import { Controller, Get, Param, Post } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service.js';

@Controller('api/orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Get('projects/:projectId/analyze')
  analyzeProject(@Param('projectId') projectId: string) {
    return this.orchestratorService.analyzeProject(projectId);
  }

  @Post('projects/:projectId/generate-pitch')
  generatePitch(@Param('projectId') projectId: string) {
    return this.orchestratorService.generatePitch(projectId);
  }
}
