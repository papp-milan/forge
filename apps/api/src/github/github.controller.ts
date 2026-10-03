import { Body, Controller, Get, Post } from '@nestjs/common';
import { GithubService } from './github.service.js';

@Controller('api/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('test')
  test() {
    return this.githubService.getRepository('Papp-Milan', 'forge');
  }

  @Post('issues')
  createIssue(
    @Body()
    body: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
    },
  ) {
    return this.githubService.createIssue(
      body.owner,
      body.repo,
      body.title,
      body.body,
    );
  }

  @Post('branches')
  createBranch(
    @Body()
    body: {
      owner: string;
      repo: string;
      branchName: string;
    },
  ) {
    return this.githubService.createBranch(
      body.owner,
      body.repo,
      body.branchName,
    );
  }

  @Post('pull-requests')
  createPullRequest(
    @Body()
    body: {
      owner: string;
      repo: string;
      title: string;
      head: string;
      base: string;
      body?: string;
    },
  ) {
    return this.githubService.createPullRequest(
      body.owner,
      body.repo,
      body.title,
      body.head,
      body.base,
      body.body,
    );
  }
}
