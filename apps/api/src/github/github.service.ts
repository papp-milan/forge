import { ConflictException, Injectable } from '@nestjs/common';
import { App } from '@octokit/app';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GithubService {
  private readonly app: App;
  private readonly cycleCache = new Map<string, unknown>();
  private cycleActive = false;

  constructor(private readonly prisma: PrismaService) {
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

  beginCycle() {
    this.cycleCache.clear();
    this.cycleActive = true;
  }

  endCycle() {
    this.cycleCache.clear();
    this.cycleActive = false;
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    if (!this.cycleActive) return loader();
    const existing = this.cycleCache.get(key);
    if (existing !== undefined) return existing as T;
    const value = await loader();
    this.cycleCache.set(key, value);
    return value;
  }

  private invalidateCycleCache() {
    this.cycleCache.clear();
  }

  private operationKey(operation: string, input: unknown) {
    return createHash('sha256')
      .update(operation + ':' + JSON.stringify(input))
      .digest('hex');
  }

  private async idempotent<T>(operation: string, input: unknown, loader: () => Promise<T>): Promise<T> {
    const key = this.operationKey(operation, input);
    const existing = await this.prisma.githubOperation.findUnique({ where: { key } });

    if (existing?.status === 'COMPLETED' && existing.response !== null) {
      return existing.response as T;
    }

    if (existing?.status === 'RUNNING' && Date.now() - existing.startedAt.getTime() < 10 * 60_000) {
      throw new ConflictException('GitHub operation is already in progress: ' + operation);
    }

    let record;
    try {
      record = existing
      ? await this.prisma.githubOperation.update({
          where: { key },
          data: { status: 'RUNNING', error: null, startedAt: new Date(), completedAt: null },
        })
      : await this.prisma.githubOperation.create({
          data: { key, operation, status: 'RUNNING' },
        });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const concurrent = await this.prisma.githubOperation.findUnique({ where: { key } });
      if (concurrent?.status === 'COMPLETED' && concurrent.response !== null) return concurrent.response as T;
      throw new ConflictException('GitHub operation is already in progress: ' + operation);
    }

    try {
      const result = await loader();
      await this.prisma.githubOperation.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', response: JSON.parse(JSON.stringify(result)), completedAt: new Date() },
      });
      return result;
    } catch (error) {
      await this.prisma.githubOperation.update({
        where: { id: record.id },
        data: { status: 'FAILED', error: error instanceof Error ? error.message : String(error), completedAt: new Date() },
      });
      throw error;
    }
  }

  private async getClient() {
    const installationId = process.env['GITHUB_INSTALLATION_ID'];

    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID is not configured');
    }

    return this.app.getInstallationOctokit(Number(installationId));
  }

  async getInstallationToken(): Promise<string> {
    const installationId = process.env['GITHUB_INSTALLATION_ID'];
    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID is not configured');
    }

    const octokit = await this.getClient();
    const auth = await octokit.auth({
      type: 'installation',
      installationId: Number(installationId),
    });

    if (auth === null || typeof auth !== 'object' || !('token' in auth) || typeof auth.token !== 'string') {
      throw new Error('Unable to obtain GitHub installation token');
    }

    return auth.token;
  }

  async getRepository(owner: string, repo: string) {
    return this.cached(`repository:${owner}/${repo}`, async () => {
      const octokit = await this.getClient();
      const { data } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
      return {
        name: data.name,
        fullName: data.full_name,
        private: data.private,
        url: data.html_url,
        defaultBranch: data.default_branch,
      };
    });
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

  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    return this.cached(`pulls:${owner}/${repo}:${state}`, async () => {
      const octokit = await this.getClient();
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', { owner, repo, state, per_page: 100 });
      return data.map((pullRequest) => ({
        number: pullRequest.number,
        title: pullRequest.title,
        state: pullRequest.state,
        url: pullRequest.html_url,
        branch: pullRequest.head.ref,
        baseBranch: pullRequest.base.ref,
        draft: pullRequest.draft,
        merged: Boolean(pullRequest.merged_at),
        createdAt: pullRequest.created_at,
        updatedAt: pullRequest.updated_at,
      }));
    });
  }

  async getBranches(owner: string, repo: string) {
    return this.cached(`branches:${owner}/${repo}`, async () => {
      const octokit = await this.getClient();
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/branches', { owner, repo, per_page: 50 });
      return data.map((branch) => ({ name: branch.name, protected: branch.protected }));
    });
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
    return this.idempotent('CREATE_ISSUE', { owner, repo, title, body }, async () => {
      this.invalidateCycleCache();
      const octokit = await this.getClient();
      const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues', { owner, repo, title, body });
      return { number: data.number, title: data.title, url: data.html_url };
    });
  }

  async createBranch(owner: string, repo: string, branchName: string) {
    return this.idempotent('CREATE_BRANCH', { owner, repo, branchName }, async () => {
      this.invalidateCycleCache();
      const octokit = await this.getClient();
      const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
      const { data: ref } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${repository.default_branch}` });
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', { owner, repo, ref: `refs/heads/${branchName}`, sha: ref.object.sha });
      return { branchName };
    });
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

  async getPullRequestReviewState(owner: string, repo: string, pullNumber: number) {
    const octokit = await this.getClient();
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      { owner, repo, pull_number: pullNumber, per_page: 100 },
    );

    const latestByReviewer = new Map<number, { login: string; state: string }>();
    for (const review of data) {
      if (!review.user?.id || !review.user.login) continue;
      latestByReviewer.set(Number(review.user.id), {
        login: review.user.login,
        state: review.state,
      });
    }

    const reviews = [...latestByReviewer.values()];
    const changesRequested = reviews.filter((review) => review.state === 'CHANGES_REQUESTED');
    const approved = reviews.filter((review) => review.state === 'APPROVED');

    return {
      ready: changesRequested.length === 0 && approved.length > 0,
      approvedBy: approved.map((review) => review.login),
      changesRequestedBy: changesRequested.map((review) => review.login),
      reviews,
    };
  }

  async mergePullRequest(owner: string, repo: string, pullNumber: number) {
    return this.idempotent('MERGE_PULL_REQUEST', { owner, repo, pullNumber }, async () => {
      this.invalidateCycleCache();
      const octokit = await this.getClient();
      const { data } = await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', { owner, repo, pull_number: pullNumber, merge_method: 'squash' });
      return { merged: data.merged, sha: data.sha, message: data.message };
    });
  }


  async getPullRequestChecks(owner: string, repo: string, pullNumber: number) {
    return this.cached(`checks:${owner}/${repo}:${pullNumber}`, async () => {
      const octokit = await this.getClient();
      const { data: pullRequest } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: pullNumber });
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { owner, repo, ref: pullRequest.head.sha, per_page: 100 });
      const checks = data.check_runs.map((check) => ({ name: check.name, status: check.status, conclusion: check.conclusion }));
      return {
        ready: checks.length > 0 && checks.every((check) => check.status === 'completed' && check.conclusion === 'success'),
        checks,
      };
    });
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ) {
    return this.idempotent('CREATE_PULL_REQUEST', { owner, repo, title, head, base, body }, async () => {
      const octokit = await this.getClient();
      const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls', { owner, repo, title, head, base, body });
      return { number: data.number, title: data.title, url: data.html_url, state: data.state };
    });
  }
}
