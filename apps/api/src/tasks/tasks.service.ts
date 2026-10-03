import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.task.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
    });
  }

  create(data: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        acceptanceCriteria: data.acceptanceCriteria,
        featureId: data.featureId,
        assigneeId: data.assigneeId,
      },
    });
  }

  update(id: string, data: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async start(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'TODO') {
      throw new BadRequestException(
        `Task cannot be started from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
    });
  }

  async block(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Task cannot be blocked from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'BLOCKED',
      },
    });
  }

  async resume(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'BLOCKED') {
      throw new BadRequestException(
        `Task cannot be resumed from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
    });
  }

  async submitForReview(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Task cannot be submitted for review from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'IN_REVIEW',
      },
    });
  }

  async complete(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== 'IN_REVIEW') {
      throw new BadRequestException(
        `Task cannot be completed from status ${task.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'DONE',
      },
    });
  }
}
