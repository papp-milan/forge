import { Controller, Param, Post } from '@nestjs/common';
import { GithubSyncService } from './github-sync.service.js';

@Controller('api/github/sync')
export class GithubSyncController {
  constructor(private readonly sync: GithubSyncService) {}

  @Post('projects/:projectId')
  syncProject(@Param('projectId') projectId: string) {
    return this.sync.syncProject(projectId);
  }
}
