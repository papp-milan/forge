import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { MemoryController } from './memory.controller.js';
import { MemoryService } from './memory.service.js';

@Module({
  imports: [AuditModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
