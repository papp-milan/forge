import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFeatureDto } from './dto/create-feature.dto.js';
import { UpdateFeatureDto } from './dto/update-feature.dto.js';
import { CreateFeatureTaskDto } from './dto/create-feature-tasks.dto.js';

@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.feature.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.feature.findUnique({
      where: {
        id,
      },
    });
  }

  create(data: CreateFeatureDto) {
    return this.prisma.feature.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
      },
    });
  }

  update(id: string, data: UpdateFeatureDto) {
    return this.prisma.feature.update({
      where: {
        id,
      },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.feature.delete({
      where: {
        id,
      },
    });
  }

  async plan(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'PROPOSED') {
      throw new BadRequestException(
        `Feature cannot be planned from status ${feature.status}`,
      );
    }

    return this.prisma.feature.update({
      where: { id },
      data: { status: 'PLANNED' },
    });
  }

  async start(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'PLANNED') {
      throw new BadRequestException(
        `Feature cannot be started from status ${feature.status}`,
      );
    }

    return this.prisma.feature.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
  }

  async submitForQa(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Feature cannot be submitted for QA from status ${feature.status}`,
      );
    }

    return this.prisma.feature.update({
      where: { id },
      data: { status: 'QA' },
    });
  }

  async approveQa(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'QA') {
      throw new BadRequestException(
        `Feature cannot leave QA from status ${feature.status}`,
      );
    }

    return this.prisma.feature.update({
      where: { id },
      data: { status: 'READY_FOR_REVIEW' },
    });
  }

  async release(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (feature.status !== 'READY_FOR_REVIEW') {
      throw new BadRequestException(
        `Feature cannot be released from status ${feature.status}`,
      );
    }

    return this.prisma.feature.update({
      where: { id },
      data: { status: 'RELEASED' },
    });
  }

  async createTasks(featureId: string, tasks: CreateFeatureTaskDto[]) {
    const feature = await this.prisma.feature.findUnique({
      where: { id: featureId },
    });

    if (!feature) {
      throw new BadRequestException('Feature not found');
    }

    if (tasks.length === 0) {
      throw new BadRequestException('At least one task is required');
    }

    for (const task of tasks) {
      if (task.assigneeId) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: task.assigneeId },
        });

        if (!employee) {
          throw new BadRequestException(
            `Employee ${task.assigneeId} not found`,
          );
        }

        if (employee.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Employee ${task.assigneeId} is not active`,
          );
        }
      }
    }

    const createdTasks = await this.prisma.$transaction(
      tasks.map((task) =>
        this.prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
            featureId,
            assigneeId: task.assigneeId,
          },
          include: {
            assignee: true,
          },
        }),
      ),
    );

    return createdTasks;
  }
}
