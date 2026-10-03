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

  async getInstallationToken(): Promise<string> {
    const octokit = await this.getClient();
    const auth = await octokit.auth();
    if (auth === null || typeof auth !== 'object' || !('token' in auth) || typeof auth.token !== 'string') {
      throw new Error('Unable to obtain GitHub installation token');
    }
    return auth.token;
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

  async getIssues(owner: string, repo: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues', {
      owner,
      repo,
      state: 'open',
      per_page: 20,
    });

    return data
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        labels: issue.labels.map((label) =>
          typeof label === 'string' ? label : label.name,
        ),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      }));
  }

  async getPullRequests(owner: string, repo: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      state: 'open',
      per_page: 20,
    });

    return data.map((pullRequest) => ({
      number: pullRequest.number,
      title: pullRequest.title,
      state: pullRequest.state,
      url: pullRequest.html_url,
      branch: pullRequest.head.ref,
      baseBranch: pullRequest.base.ref,
      draft: pullRequest.draft,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
    }));
  }

  async getBranches(owner: string, repo: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/branches',
      {
        owner,
        repo,
        per_page: 50,
      },
    );

    return data.map((branch) => ({
      name: branch.name,
      protected: branch.protected,
    }));
  }

  async getRecentCommits(owner: string, repo: string, branch?: string) {
    const octokit = await this.getClient();

    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/commits',
      {
        owner,
        repo,
        sha: branch,
        per_page: 20,
      },
    );

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author
        ? {
            name: commit.commit.author.name,
            email: commit.commit.author.email,
            date: commit.commit.author.date,
          }
        : null,
      url: commit.html_url,
    }));
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

  async isPullRequestMerged(owner: string, repo: string, pullNumber: number) {
    const octokit = await this.getClient();

    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner,
        repo,
        pull_number: pullNumber,
      },
    );

    return {
      merged: Boolean(data.merged_at),
      state: data.state,
      url: data.html_url,
    };
  }

  async mergePullRequest(owner: string, repo: string, pullNumber: number) {
    const octokit = await this.getClient();

    const { data } = await octokit.request(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
      {
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: 'squash',
      },
    );

    return {
      merged: data.merged,
      sha: data.sha,
      message: data.message,
    };
  }


  async getPullRequestChecks(owner: string, repo: string, pullNumber: number) {
    const octokit = await this.getClient();

    const { data: pullRequest } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      { owner, repo, pull_number: pullNumber },
    );

    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
      { owner, repo, ref: pullRequest.head.sha, per_page: 100 },
    );

    const checks = data.check_runs.map((check) => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion,
    }));

    return {
      ready: checks.length > 0 && checks.every((check) => check.status === 'completed' && check.conclusion === 'success'),
      checks,
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
