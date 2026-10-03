import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AgentDecisionService } from './agent-decision.service.js';
import { ResolveAgentDecisionDto } from './dto/resolve-agent-decision.dto.js';

@Controller('api/agent-decisions')
export class AgentDecisionController {
  constructor(private readonly decisions: AgentDecisionService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.decisions.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.decisions.get(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: ResolveAgentDecisionDto,
  ) {
    return this.decisions.approve(id, body.comment);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: ResolveAgentDecisionDto,
  ) {
    return this.decisions.reject(id, body.comment);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string) {
    return this.decisions.execute(id);
  }
}
