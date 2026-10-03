import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrchestratorService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      include: {
        features: {
          include: {
            tasks: {
              include: {
                assignee: true,
              },
            },
          },
        },
        pitches: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const activeFeatures = project.features.filter(
      (feature) => feature.status !== 'RELEASED',
    );

    const pendingPitches = project.pitches.filter(
      (pitch) => pitch.status === 'PENDING_APPROVAL',
    );

    const changesRequestedPitches = project.pitches.filter(
      (pitch) => pitch.status === 'CHANGES_REQUESTED',
    );

    const blockedTasks = project.features
      .flatMap((feature) => feature.tasks)
      .filter((task) => task.status === 'BLOCKED');

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        repository: project.repository,
      },

      statistics: {
        featureCount: project.features.length,
        activeFeatureCount:
        activeFeatures.length,
        pendingPitchCount:
        pendingPitches.length,
        changesRequestedPitchCount:
        changesRequestedPitches.length,
        blockedTaskCount:
        blockedTasks.length,
      },

      features: project.features.map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
        status: feature.status,

        tasks: feature.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          assignee: task.assignee?.name ?? null,
        })),
      })),

      recentPitches: project.pitches.map((pitch) => ({
        id: pitch.id,
        title: pitch.title,
        status: pitch.status,
        createdAt: pitch.createdAt,
      })),
    };
  }

  async generatePitch(projectId: string) {
    const analysis = await this.analyzeProject(projectId);

    if (analysis.statistics.pendingPitchCount > 0) {
      throw new BadRequestException(
        'Project already has a pitch pending approval',
      );
    }

    if (analysis.statistics.changesRequestedPitchCount > 0) {
      throw new BadRequestException('Project has a pitch awaiting changes');
    }

    /*
     * Temporary Team Lead strategy.
     *
     * This is intentionally deterministic for now.
     * Later this method will delegate the actual
     * reasoning to an LLM.
     */

    let title: string;
    let description: string;
    let rationale: string;

    if (analysis.statistics.blockedTaskCount > 0) {
      title = 'Resolve blocked work';

      description =
        'Investigate the currently blocked tasks and identify the changes required to unblock the development workflow.';

      rationale = `${analysis.statistics.blockedTaskCount} task(s) are currently blocked. Resolving blockers should be evaluated before starting additional work.`;
    } else if (analysis.statistics.activeFeatureCount === 0) {
      title = 'Plan the next product improvement';

      description =
        'Analyze the current project state and propose the next meaningful product improvement.';

      rationale = 'The project currently has no active feature in development.';
    } else {
      title = 'Improve the current feature workflow';

      description =
        'Analyze the current feature and identify a concrete improvement that would provide additional value to the project.';

      rationale =
        'The project has active development work and should be evaluated for the next incremental improvement.';
    }

    return this.prisma.pitch.create({
      data: {
        title,
        description,
        rationale,
        projectId,
        status: 'PENDING_APPROVAL',
      },
      include: {
        project: true,
      },
    });
  }
}
