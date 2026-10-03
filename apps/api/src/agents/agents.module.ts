import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GithubModule } from '../github/github.module.js';
import { RuntimeModule } from '../runtime/runtime.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AgentsController } from './agents.controller.js';
import { HephaistosService } from './hephaistos.service.js';
import { WorkspaceService } from './workspace.service.js';

@Module({
  imports: [PrismaModule, GithubModule, RuntimeModule, AuditModule],
  controllers: [AgentsController],
  providers: [HephaistosService, WorkspaceService],
  exports: [HephaistosService],
})
export class AgentsModule {}
