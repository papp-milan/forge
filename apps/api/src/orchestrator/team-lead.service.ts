import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TeamLeadProposalDto } from './dto/team-lead-proposal.dto.js';

@Injectable()
export class TeamLeadService {
  constructor(private readonly prisma: PrismaService) {}

  async createProposal(projectId: string, proposal: TeamLeadProposalDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    const existingPitch = await this.prisma.pitch.findFirst({
      where: {
        projectId,
        status: {
          in: ['PENDING_APPROVAL', 'CHANGES_REQUESTED'],
        },
      },
    });

    if (existingPitch) {
      throw new BadRequestException('Project already has an unresolved pitch');
    }

    if (proposal.tasks.length === 0) {
      throw new BadRequestException(
        'Team Lead proposal must contain at least one task',
      );
    }

    return this.prisma.pitch.create({
      data: {
        title: proposal.title,
        description: proposal.description,
        rationale: proposal.impact,
        problem: proposal.problem,
        solution: proposal.solution,
        impact: proposal.impact,
        risks: proposal.risks,
        projectId,

        taskSuggestions: {
          create: proposal.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
            role: task.role,
          })),
        },
      },

      include: {
        project: true,
        taskSuggestions: true,
        reviews: true,
      },
    });
  }

  async getRevisionContext(pitchId: string) {
    const pitch = await this.prisma.pitch.findUnique({
      where: {
        id: pitchId,
      },
      include: {
        project: true,
        taskSuggestions: true,
        reviews: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!pitch) {
      throw new BadRequestException('Pitch not found');
    }

    if (pitch.status !== 'CHANGES_REQUESTED') {
      throw new BadRequestException('Pitch is not awaiting changes');
    }

    const latestChangeRequest = [...pitch.reviews]
      .reverse()
      .find((review) => review.action === 'CHANGES_REQUESTED');

    return {
      pitch: {
        id: pitch.id,
        title: pitch.title,
        description: pitch.description,
        problem: pitch.problem,
        solution: pitch.solution,
        impact: pitch.impact,
        risks: pitch.risks,
      },

      project: {
        id: pitch.project.id,
        name: pitch.project.name,
        description: pitch.project.description,
        repository: pitch.project.repository,
      },

      previousTasks: pitch.taskSuggestions.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        acceptanceCriteria: task.acceptanceCriteria,
        role: task.role,
      })),

      reviewHistory: pitch.reviews.map((review) => ({
        action: review.action,
        comment: review.comment,
        createdAt: review.createdAt,
      })),

      latestChangeRequest: latestChangeRequest?.comment ?? null,
    };
  }

  async reviseProposal(pitchId: string, proposal: TeamLeadProposalDto) {
    const context = await this.getRevisionContext(pitchId);

    if (proposal.tasks.length === 0) {
      throw new BadRequestException(
        'Team Lead proposal must contain at least one task',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pitchTaskSuggestion.deleteMany({
        where: {
          pitchId,
        },
      });

      await tx.pitch.update({
        where: {
          id: pitchId,
        },
        data: {
          title: proposal.title,
          description: proposal.description,
          rationale: proposal.impact,
          problem: proposal.problem,
          solution: proposal.solution,
          impact: proposal.impact,
          risks: proposal.risks,
          status: 'PENDING_APPROVAL',

          taskSuggestions: {
            create: proposal.tasks.map((task) => ({
              title: task.title,
              description: task.description,
              acceptanceCriteria: task.acceptanceCriteria,
              role: task.role,
            })),
          },
        },

        include: {
          project: true,
          taskSuggestions: true,
          reviews: true,
        },
      });

      return {
        pitch: await tx.pitch.findUnique({
          where: {
            id: pitchId,
          },
          include: {
            project: true,
            taskSuggestions: true,
            reviews: true,
          },
        }),

        basedOn: {
          latestChangeRequest: context.latestChangeRequest,
        },
      };
    });
  }
}
