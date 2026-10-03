import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GithubService } from '../github/github.service.js';

export interface Workspace {
  cwd: string;
  repository: string;
  branch: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
}

@Injectable()
export class WorkspaceService {
  private readonly root = path.resolve(
    process.env['FORGE_WORKSPACE_ROOT'] ?? path.join(os.tmpdir(), 'forge-workspaces'),
  );

  constructor(private readonly github: GithubService) {}

  async prepare(repository: string, branch: string): Promise<Workspace> {
    const { owner, repo } = this.parseRepository(repository);
    const token = await this.github.getInstallationToken();
    await mkdir(this.root, { recursive: true });
    const repoRoot = path.join(this.root, owner, repo);
    const cwd = path.join(repoRoot, branch.replace(/[^a-zA-Z0-9._-]/g, '-'));
    await rm(cwd, { recursive: true, force: true });
    await mkdir(path.dirname(cwd), { recursive: true });

    const askpass = path.join(await mkdtemp(path.join(os.tmpdir(), 'forge-askpass-')), 'askpass.sh');
    await writeFile(askpass, '#!/bin/sh\ncase "$1" in\n  *Username*) echo x-access-token ;;\n  *) echo "$GITHUB_INSTALLATION_TOKEN" ;;\nesac\n', { mode: 0o700 });
    const env = { GIT_ASKPASS: askpass, GIT_TERMINAL_PROMPT: '0', GITHUB_INSTALLATION_TOKEN: token };

    try {
      await this.runGit(['clone', '--single-branch', '--branch', branch, 'https://github.com/' + owner + '/' + repo + '.git', cwd], env);
    } catch {
      await this.runGit(['clone', '--single-branch', 'https://github.com/' + owner + '/' + repo + '.git', cwd], env);
      await this.runGit(['checkout', '-b', branch], env, cwd);
    }

    return {
      cwd,
      repository: owner + '/' + repo,
      branch,
      env,
      cleanup: async () => rm(path.dirname(askpass), { recursive: true, force: true }),
    };
  }

  private parseRepository(value: string): { owner: string; repo: string } {
    const normalized = value.trim()
      .replace(/^git@github\.com:/, '')
      .replace(/^https?:\/\/(www\.)?github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
    const parts = normalized.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException('Project repository must be a GitHub repository URL or owner/repo');
    }
    return { owner: parts[0], repo: parts[1] };
  }

  private runGit(args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || 'git exited with ' + code)));
    });
  }
}