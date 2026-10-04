import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './src/app.module.js';
import { PrismaService } from './src/prisma/prisma.service.js';

describe('autonomous Forge lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let featureId: string;
  let taskId: string;

  beforeAll(async () => {
    process.env['FORGE_AUTONOMOUS'] = 'false';
    process.env['AGENT_RUNTIME'] = 'deterministic';
    process.env['TEAM_LEAD_AGENT'] = 'deterministic';

    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    prisma = app.get(PrismaService);

    const project = await prisma.project.create({
      data: {
        name: 'E2E Autonomous Lifecycle',
        description: 'Disposable project for the autonomous Forge lifecycle test.',
        repository: 'https://github.com/papp-milan/forge',
      },
    });
    projectId = project.id;

    await prisma.employee.create({
      data: {
        name: 'E2E Hephaistos',
        role: 'ENGINEER',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.project.delete({ where: { id: projectId } });
    }
    await app.close();
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

    const releaseMemory = await prisma.memory.findFirst({
      where: { subject: `release-${featureId}` },
    });
    expect(releaseMemory).toBeTruthy();

    const releaseAudit = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'feature',
        entityId: featureId,
        type: 'RELEASED',
      },
    });
    expect(releaseAudit).toBeTruthy();
  });
});
