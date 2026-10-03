import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WorkforceController } from './workforce.controller.js';
import { WorkforceService } from './workforce.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkforceController],
  providers: [WorkforceService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
