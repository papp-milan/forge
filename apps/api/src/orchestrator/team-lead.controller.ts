import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TeamLeadService } from './team-lead.service.js';
import { TeamLeadProposalDto } from './dto/team-lead-proposal.dto.js';
import { TeamLeadContextService } from './team-lead-context.service.js';
import { TeamLeadAgentService } from './team-lead-agent.service.js';

@Controller('api/team-lead')
export class TeamLeadController {
  constructor(
    private readonly teamLeadService: TeamLeadService,
    private readonly contextService: TeamLeadContextService,
    private readonly agentService: TeamLeadAgentService,
  ) {}

  @Get('projects/:projectId/context')
  getProjectContext(@Param('projectId') projectId: string) {
    return this.contextService.build(projectId);
  }

  @Post('projects/:projectId/proposals')
  createProposal(
    @Param('projectId') projectId: string,
    @Body() proposal: TeamLeadProposalDto,
  ) {
    return this.teamLeadService.createProposal(projectId, proposal);
  }

  @Post('pitches/:pitchId/revise')
  reviseProposal(
    @Param('pitchId') pitchId: string,
    @Body() proposal: TeamLeadProposalDto,
  ) {
    return this.teamLeadService.reviseProposal(pitchId, proposal);
  }

  @Get('pitches/:pitchId/revision-context')
  getRevisionContext(@Param('pitchId') pitchId: string) {
    return this.teamLeadService.getRevisionContext(pitchId);
  }

  @Get('projects/:projectId/analyze')
  analyzeProject(@Param('projectId') projectId: string) {
    return this.agentService.analyzeProject(projectId);
  }
}
