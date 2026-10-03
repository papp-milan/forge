import { Injectable } from '@nestjs/common';
import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

@Injectable()
export class GithubService {
  private readonly app: App;

  constructor() {
    const appId = process.env['GITHUB_APP_ID'];
    const privateKeyPath = process.env['GITHUB_PRIVATE_KEY_PATH'];

    if (!appId) {
      throw new Error('GITHUB_APP_ID is not configured');
    }

    if (!privateKeyPath) {
      throw new Error('GITHUB_PRIVATE_KEY_PATH is not configured');
    }

    const privateKey = readFileSync(
      resolve(process.cwd(), privateKeyPath),
      'utf8',
    );

    this.app = new App({
      appId,
      privateKey,
    });
  }

  private async getClient(): Promise<Octokit> {
    const installationId = process.env['GITHUB_INSTALLATION_ID'];

    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID is not configured');
    }

    return this.app.getInstallationOctokit(
      Number(installationId),
    ) as unknown as Octokit;
  }

  async getRepository(owner: string, repo: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    return {
      name: data.name,
      fullName: data.full_name,
      private: data.private,
      url: data.html_url,
      defaultBranch: data.default_branch,
    };
  }
}
