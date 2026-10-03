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
 
  async approveProposal(pitchId: string, comment?: string) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      include: { taskSuggestions: true },
    });

    if (!pitch) {
      throw new BadRequestException('Pitch not found');
    }

    if (pitch.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `Pitch cannot be approved from status ${pitch.status}`,
      );
    }

    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    return this.prisma.$transaction(async (tx) => {
      const feature = await tx.feature.create({
        data: {
          title: pitch.title,
          description: pitch.description,
          projectId: pitch.projectId,
          status: 'PLANNED',
        },
      });

      const review = await tx.pitchReview.create({
        data: {
          action: 'APPROVED',
          comment,
          pitchId,
        },
      });

      const assignedRoleCounts = new Map<string, number>();
      const tasks = [];

      for (const suggestion of pitch.taskSuggestions) {
        const candidates = employees.filter(
          (employee) => employee.role === suggestion.role,
        );

        const index = assignedRoleCounts.get(suggestion.role) ?? 0;
        const employee = candidates[index % Math.max(candidates.length, 1)];

        tasks.push(
          await tx.task.create({
            data: {
              title: suggestion.title,
              description: suggestion.description,
              acceptanceCriteria: suggestion.acceptanceCriteria,
              featureId: feature.id,
              status: employee ? 'TODO' : 'BLOCKED',
              assigneeId: employee?.id,
            },
            include: { assignee: true },
          }),
        );

        if (employee) {
          assignedRoleCounts.set(suggestion.role, index + 1);
        }
      }

      const shortages = pitch.taskSuggestions
        .filter(
          (suggestion) =>
            !employees.some((employee) => employee.role === suggestion.role),
        )
        .map((suggestion) => suggestion.role);

      return {
        pitch: await tx.pitch.update({
          where: { id: pitchId },
          data: {
            status: 'APPROVED',
            featureId: feature.id,
          },
        }),
        feature,
        tasks,
        manpower: {
          sufficient: shortages.length === 0,
          missingRoles: [...new Set(shortages)],
        },
        review,
      };
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
