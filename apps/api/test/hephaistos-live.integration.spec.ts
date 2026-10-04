import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { GithubService } from '../src/github/github.service.js';
import { HephaistosService } from '../src/agents/hephaistos.service.js';

describe('Hephaistos live coding integration', () => {
  const enabled = process.env['FORGE_HERMES_HEPHAISTOS_LIVE_TEST'] === 'true';
  let app: INestApplicationContext | null = null;

  beforeAll(async () => {
    if (!enabled) return;

    process.env['FORGE_AUTONOMOUS'] = 'false';
    process.env['AGENT_RUNTIME'] = 'hermes';

    app = await NestFactory.createApplicationContext(AppModule);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it.runIf(enabled)(
    'lets Hephaistos implement the Ideas success-banner contrast fix through Hermes',
    async () => {
      if (!app) throw new Error('Nest application context was not initialized');

      const prisma = app.get(PrismaService);
      const github = app.get(GithubService);
      const hephaistos = app.get(HephaistosService);

      const projectId = process.env['FORGE_HERMES_TEST_PROJECT_ID'];
      const project = projectId
        ? await prisma.project.findUnique({ where: { id: projectId } })
        : await prisma.project.findFirst({
            where: { repository: { not: null } },
            orderBy: { createdAt: 'asc' },
          });

      if (!project?.repository) {
        throw new Error(
          'No Forge project with a GitHub repository found. Set FORGE_HERMES_TEST_PROJECT_ID to the intended project.',
        );
      }

      const engineer = await prisma.employee.findFirst({
        where: { role: 'ENGINEER', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });

      if (!engineer) {
        throw new Error('No active ENGINEER employee found.');
      }

      const feature = await prisma.feature.create({
        data: {
          title: 'Hermes live coding test: Ideas success banner',
          description:
            'Temporary integration-test feature proving that Hephaistos can execute a real UI change through Hermes and Space Bunny Alpha.',
          projectId: project.id,
        },
      });

      const task = await prisma.task.create({
        data: {
          title: 'Improve contrast of the "Pitch created" success notification',
          description: [
            'This is a live Forge coding-agent integration test.',
            'In the Ideas view, find the success notification/banner shown after a pitch is created.',
            'Improve its visual contrast so the background, border and text are clearly readable in both light and dark themes.',
            'Keep the existing component structure and Angular/React design system conventions already used by the project.',
            'Do not change the behavior, wording, API, routing, or unrelated UI.',
          ].join('\n'),
          acceptanceCriteria: [
            'The "Pitch created" success notification has clearly readable text and a visibly stronger success-state treatment.',
            'The existing success notification behavior is unchanged.',
            'The implementation is limited to the relevant Ideas notification styling/component.',
            'Run the relevant web lint/build or test checks and fix any issues caused by the change.',
            'Commit the implementation and push the assigned branch.',
          ].join('\n'),
          featureId: feature.id,
          assigneeId: engineer.id,
        },
      });

      const repository = project.repository
        .replace(/^https?:\/\/(www\.)?github\.com\//, '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '');
      const [owner, repo] = repository.split('/');
      const branchName = `forge/hermes-live-banner-${task.id}`;

      await github.createBranch(owner, repo, branchName);
      await prisma.task.update({
        where: { id: task.id },
        data: { branchName, status: 'IN_PROGRESS' },
      });

      const result = await hephaistos.runTask(task.id);

      expect(result.status).toBe('IN_REVIEW');
      expect(result.result.exitCode).toBe(0);
      expect(result.result.sessionId).toBeTruthy();
      expect(result.result.text.length).toBeGreaterThan(40);
      expect(result.task.pullRequestNumber).toBeTruthy();
      expect(result.task.pullRequestUrl).toBeTruthy();

      console.log(JSON.stringify({
        taskId: task.id,
        featureId: feature.id,
        branchName,
        pullRequestNumber: result.task.pullRequestNumber,
        pullRequestUrl: result.task.pullRequestUrl,
        sessionId: result.result.sessionId,
        agentOutput: result.result.text.slice(-3000),
      }, null, 2));
    },
    10 * 60_000,
  );

  it.runIf(!enabled)(
    'is opt-in so CI and normal test runs never invoke the real coding agent',
    () => {
      expect(enabled).toBe(false);
    },
  );
});
