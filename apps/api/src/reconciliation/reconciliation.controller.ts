import { Controller, Param, Post } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service.js';

@Controller('api/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}
  @Post('projects/:projectId')
  reconcile(@Param('projectId') projectId: string) { return this.reconciliation.reconcileProject(projectId); }
}
