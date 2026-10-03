import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import type { AuditEventType } from './audit.service.js';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('type') type?: AuditEventType,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedBefore = before ? new Date(before) : undefined;

    return this.audit.list({
      projectId,
      type,
      limit: parsedLimit && Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : undefined,
      before: parsedBefore && !Number.isNaN(parsedBefore.getTime()) ? parsedBefore : undefined,
    });
  }
}
