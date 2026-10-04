import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { GithubModule } from '../github/github.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { OrchestratorModule } from '../orchestrator/orchestrator.module.js';

@Module({
  imports: [GithubModule, AuditModule, AgentsModule, OrchestratorModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
