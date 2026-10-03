import { Injectable } from '@nestjs/common';
import { App } from '@octokit/app';
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

  private async getClient() {
    const installationId = process.env['GITHUB_INSTALLATION_ID'];

    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID is not configured');
    }

    return this.app.getInstallationOctokit(Number(installationId));
  }

  async getRepository(owner: string, repo: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
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

  async createIssue(owner: string, repo: string, title: string, body?: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues',
      {
        owner,
        repo,
        title,
        body,
      },
    );

    return {
      number: data.number,
      title: data.title,
      url: data.html_url,
    };
  }

  async createBranch(owner: string, repo: string, branchName: string) {
    const octokit = await this.getClient();

    const { data: repository } = await octokit.request(
      'GET /repos/{owner}/{repo}',
      {
        owner,
        repo,
      },
    );

    const { data: ref } = await octokit.request(
      'GET /repos/{owner}/{repo}/git/ref/{ref}',
      {
        owner,
        repo,
        ref: `heads/${repository.default_branch}`,
      },
    );

    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    return {
      branchName,
    };
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ) {
    const octokit = await this.getClient();

    const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title,
      head,
      base,
      body,
    });

    return {
      number: data.number,
      title: data.title,
      url: data.html_url,
      state: data.state,
    };
  }
}
