import { Controller, Get, Query } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';

@Controller('api/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get('pending')
  pending(@Query('projectId') projectId?: string) {
    return this.approvals.pending(projectId);
  }

  @Get('pending-tasks')
  pendingTasks(@Query('projectId') projectId?: string) {
    return this.approvals.pendingTasks(projectId);
  }
}
