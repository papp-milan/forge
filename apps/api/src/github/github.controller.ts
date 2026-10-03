import { Controller, Get } from '@nestjs/common';
import { GithubService } from './github.service.js';

@Controller('api/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('test')
  test() {
    return this.githubService.getRepository('Papp-Milan', 'forge');
  }
}
