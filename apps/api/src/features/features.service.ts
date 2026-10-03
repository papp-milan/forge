import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFeatureDto } from './dto/create-feature.dto.js';
import { UpdateFeatureDto } from './dto/update-feature.dto.js';

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
}
