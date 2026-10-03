import { Module } from '@nestjs/common';
import { GithubService } from './github.service.js';
import { GithubController } from './github.controller.js';
import { GithubWebhookController } from './github-webhook.controller.js';

@Module({
  controllers: [GithubController, GithubWebhookController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
