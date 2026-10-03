import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { GithubModule } from '../github/github.module.js';

@Module({
  imports: [GithubModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
