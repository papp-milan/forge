import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FeaturesService } from '../features/features.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class NikeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeaturesService,
    private readonly audit: AuditService,
  ) {}

  async releaseApprovedFeature(featureId: string) {
    const feature = await this.prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new Error('Feature not found');
    return this.features.release(featureId, 'nike');
  }

  async releaseAutonomousReady() {
    const features = await this.prisma.feature.findMany({
      where: { status: 'READY_FOR_REVIEW', releasePolicy: 'AUTONOMOUS' },
      orderBy: { updatedAt: 'asc' },
      take: 3,
    });

    const results = [];
    for (const feature of features) {
      try {
        const released = await this.features.release(feature.id, 'nike');
        results.push({ featureId: feature.id, status: 'RELEASED', feature: released });
      } catch (error) {
        await this.audit.record({
          actor: 'nike',
          type: 'RELEASE_FAILED',
          projectId: feature.projectId,
          entityType: 'feature',
          entityId: feature.id,
          summary: feature.title,
          data: { error: error instanceof Error ? error.message : String(error) },
        });
        results.push({ featureId: feature.id, status: 'FAILED', reason: error instanceof Error ? error.message : String(error) });
      }
    }

    return results;
  }

  async prepareRelease(featureId: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id: featureId },
      include: { tasks: true },
    });
    if (!feature) return { status: 'NOT_FOUND' as const };
    const blockers = feature.tasks.filter((task) => task.status !== 'DONE');
    return {
      status: blockers.length === 0 && feature.status === 'READY_FOR_REVIEW' ? 'READY' as const : 'BLOCKED' as const,
      releasePolicy: feature.releasePolicy,
      blockers: blockers.map((task) => ({ id: task.id, title: task.title, status: task.status })),
    };
  }
}
