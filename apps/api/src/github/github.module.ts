import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module.js';
import { GithubController } from './github.controller.js';
import { GithubWebhookController } from './github-webhook.controller.js';
import { GithubWebhookService } from './github-webhook.service.js';
import { GithubSyncController } from './github-sync.controller.js';
import { GithubSyncService } from './github-sync.service.js';
import { GithubService } from './github.service.js';

@Module({
  imports: [MemoryModule],
  controllers: [GithubController, GithubWebhookController, GithubSyncController],
  providers: [GithubService, GithubWebhookService, GithubSyncService],
  exports: [GithubService, GithubSyncService],
})
export class GithubModule {}
