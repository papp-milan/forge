import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePitchDto } from './dto/create-pitch.dto.js';
import { UpdatePitchDto } from './dto/update-pitch.dto.js';
import { PitchDecisionDto } from './dto/pitch-decision.dto.js';

@Injectable()
export class PitchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.pitch.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.pitch.findUnique({
      where: {
        id,
      },
    });
  }

  create(data: CreatePitchDto) {
    return this.prisma.pitch.create({
      data: {
        title: data.title,
        description: data.description,
        rationale: data.rationale,
        projectId: data.projectId,
      },
    });
  }

  update(id: string, data: UpdatePitchDto) {
    return this.prisma.pitch.update({
      where: {
        id,
      },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.pitch.delete({
      where: {
        id,
      },
    });
  }

  async approve(id: string, data: PitchDecisionDto) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id },
    });

    if (!pitch) {
      throw new BadRequestException('Pitch not found');
    }

    if (pitch.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `Pitch cannot be approved from status ${pitch.status}`,
      );
    }

    const feature = await this.prisma.feature.create({
      data: {
        title: pitch.title,
        description: pitch.description,
        projectId: pitch.projectId,
      },
    });

    await this.prisma.pitchReview.create({
      data: {
        action: 'APPROVED',
        comment: data.comment,
        pitchId: id,
      },
    });

    return this.prisma.pitch.update({
      where: { id },
      data: {
        status: 'APPROVED',
        featureId: feature.id,
      },
      include: {
        feature: true,
        reviews: true,
      },
    });
  }

  async reject(id: string, data: PitchDecisionDto) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id },
    });

    if (!pitch) {
      throw new BadRequestException('Pitch not found');
    }

    if (pitch.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `Pitch cannot be rejected from status ${pitch.status}`,
      );
    }

    await this.prisma.pitchReview.create({
      data: {
        action: 'REJECTED',
        comment: data.comment,
        pitchId: id,
      },
    });

    return this.prisma.pitch.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
      include: {
        reviews: true,
      },
    });
  }

  async requestChanges(id: string, data: PitchDecisionDto) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id },
    });

    if (!pitch) {
      throw new BadRequestException('Pitch not found');
    }

    if (pitch.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `Changes cannot be requested from status ${pitch.status}`,
      );
    }

    await this.prisma.pitchReview.create({
      data: {
        action: 'CHANGES_REQUESTED',
        comment: data.comment,
        pitchId: id,
      },
    });

    return this.prisma.pitch.update({
      where: { id },
      data: {
        status: 'CHANGES_REQUESTED',
      },
      include: {
        reviews: true,
      },
    });
  }
}
