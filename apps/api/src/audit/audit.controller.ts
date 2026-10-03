import { Controller, Get, Query } from '@nestjs/common';
import { AuditEventType, AuditService } from './audit.service.js';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('type') type?: AuditEventType,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;

    return this.audit.list({
      projectId,
      type,
      limit:
        parsedLimit && Number.isFinite(parsedLimit)
          ? Math.min(Math.max(parsedLimit, 1), 500)
          : undefined,
    });
  }
}
