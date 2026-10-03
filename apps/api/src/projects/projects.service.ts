import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.project.findUnique({
      where: {
        id,
      },
    });
  }

  create(data: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        repository: data.repository,
      },
    });
  }

  update(id: string, data: UpdateProjectDto) {
    return this.prisma.project.update({
      where: {
        id,
      },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.project.delete({
      where: {
        id,
      },
    });
  }
}
