import { Module } from '@nestjs/common';
import { GithubController } from './github.controller.js';
import { GithubWebhookController } from './github-webhook.controller.js';
import { GithubWebhookService } from './github-webhook.service.js';
import { GithubService } from './github.service.js';

@Module({
  controllers: [GithubController, GithubWebhookController],
  providers: [GithubService, GithubWebhookService],
  exports: [GithubService],
})
export class GithubModule {}
