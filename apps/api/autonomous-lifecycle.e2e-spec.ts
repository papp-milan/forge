import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { MemoryService } from './src/memory/memory.service.js';
import { AppModule } from './src/app.module.js';
import { PrismaService } from './src/prisma/prisma.service.js';

describe('autonomous Forge lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let featureId: string;
  let taskId: string;
  let employeeId: string;
  let memory: MemoryService;

  beforeAll(async () => {
    process.env['FORGE_AUTONOMOUS'] = 'false';
    process.env['AGENT_RUNTIME'] = 'deterministic';
    process.env['TEAM_LEAD_AGENT'] = 'deterministic';
    process.env['FORGE_MEMORY_ROOT'] = `/tmp/forge-e2e-memory-${process.pid}`;

    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    prisma = app.get(PrismaService);
    memory = app.get(MemoryService);

    const project = await prisma.project.create({
      data: {
        name: 'E2E Autonomous Lifecycle',
        description: 'Disposable project for the autonomous Forge lifecycle test.',
        repository: 'https://github.com/papp-milan/forge',
      },
    });
    projectId = project.id;

    const employee = await prisma.employee.create({
      data: {
        name: 'E2E Hephaistos',
        role: 'ENGINEER',
        status: 'ACTIVE',
      },
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.project.delete({ where: { id: projectId } });
    }
    if (employeeId) {
      await prisma.employee.delete({ where: { id: employeeId } }).catch(() => undefined);
    }
    await app.close();
    await rm(process.env['FORGE_MEMORY_ROOT']!, { recursive: true, force: true });
  });

  it('runs idea -> pitch -> CEO approval -> task -> QA -> release', async () => {
    const idea = await request(app.getHttpServer())
      .post('/api/ideas')
      .send({
        projectId,
        title: 'E2E autonomous feature',
        description: 'Validate the complete autonomous Forge control-plane lifecycle.',
        source: 'e2e',
      })
      .expect(201);

    expect(idea.body.status).toBe('CAPTURED');
    expect(idea.body.projectId).toBe(projectId);

    const pitched = await request(app.getHttpServer())
      .post(`/api/ideas/${idea.body.id}/pitch`)
      .expect(201);

    expect(pitched.body.status).toBe('PITCHED');
    expect(pitched.body.pitchId).toBeTruthy();

    const pitch = await prisma.pitch.findUnique({
      where: { id: pitched.body.pitchId },
      include: { taskSuggestions: true },
    });
    expect(pitch?.status).toBe('PENDING_APPROVAL');
    expect(pitch?.taskSuggestions.length).toBeGreaterThan(0);

    const approved = await request(app.getHttpServer())
      .post(`/api/pitches/${pitch!.id}/approve`)
      .send({ comment: 'Approved by the E2E CEO gate.' })
      .expect(201);

    expect(approved.body.pitch.status).toBe('APPROVED');
    expect(approved.body.feature.status).toBe('PLANNED');
    expect(approved.body.tasks.length).toBeGreaterThan(0);
    featureId = approved.body.feature.id;
    taskId = approved.body.tasks[0].id;

    const pending = await request(app.getHttpServer())
      .get('/api/approvals/pending-tasks')
      .query({ projectId })
      .expect(200);
    expect(pending.body).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/features/${featureId}/start`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/start`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/submit-for-review`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/complete`)
      .expect(201);

    const done = await prisma.task.findUnique({ where: { id: taskId } });
    expect(done?.status).toBe('DONE');

    await request(app.getHttpServer())
      .post(`/api/features/${featureId}/submit-for-qa`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/features/${featureId}/approve-qa`)
      .expect(201);

    const released = await request(app.getHttpServer())
      .post(`/api/features/${featureId}/release`)
      .expect(201);

    expect(released.body.status).toBe('RELEASED');

    const persistedFeature = await prisma.feature.findUnique({
      where: { id: featureId },
    });
    expect(persistedFeature?.status).toBe('RELEASED');

    const memories = await memory.list('projects');
    expect(memories.some((item) => item.content.includes(`Feature "${approved.body.feature.title}" was released`))).toBe(true);
  });
});
