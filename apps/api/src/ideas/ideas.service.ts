import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { TeamLeadAgentService } from '../orchestrator/team-lead-agent.service.js';
import { CreateIdeaDto } from './dto/create-idea.dto.js';
import { UpdateIdeaDto } from './dto/update-idea.dto.js';

@Injectable()
export class IdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly teamLead: TeamLeadAgentService,
  ) {}

  findAll(projectId?: string) {
    return this.prisma.idea.findMany({
      where: projectId ? { projectId } : {},
      include: { project: true, pitch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.idea.findUnique({
      where: { id },
      include: { project: true, pitch: true },
    });
  }

  async create(data: CreateIdeaDto) {
    const project = await this.prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) throw new BadRequestException('Project not found');

    const idea = await this.prisma.idea.create({ data });
    await this.audit.record({
      actor: 'ceo',
      type: 'DECISION_CREATED',
      projectId: idea.projectId,
      entityType: 'idea',
      entityId: idea.id,
      summary: 'Idea captured: ' + idea.title,
      data: { source: idea.source ?? null },
    });
    return this.findOne(idea.id);
  }

  async update(id: string, data: UpdateIdeaDto) {
    await this.ensureExists(id);
    return this.prisma.idea.update({ where: { id }, data });
  }

  async archive(id: string) {
    await this.ensureExists(id);
    return this.prisma.idea.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async pitch(id: string) {
    const idea = await this.prisma.idea.findUnique({ where: { id }, include: { project: true } });
    if (!idea) throw new BadRequestException('Idea not found');
    if (idea.status === 'ARCHIVED') throw new BadRequestException('Archived ideas cannot be pitched');
    if (idea.pitchId) return this.findOne(id);

    const proposal = await this.teamLead.pitchIdea({
      title: idea.title,
      description: idea.description,
      projectId: idea.projectId,
    });

    const pitch = await this.prisma.pitch.create({
      data: {
        title: proposal.title,
        description: proposal.description,
        rationale: proposal.rationale,
        problem: proposal.problem,
        solution: proposal.solution,
        impact: proposal.impact,
        risks: proposal.risks,
        projectId: idea.projectId,
        ideaId: idea.id,
        taskSuggestions: {
          create: proposal.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
            role: task.role,
            risk: task.risk,
          })),
        },
      },
      include: { taskSuggestions: true },
    });

    await this.prisma.idea.update({
      where: { id },
      data: { status: 'PITCHED', pitchId: pitch.id },
    });

    await this.audit.record({
      actor: 'athena',
      type: 'DECISION_CREATED',
      projectId: idea.projectId,
      entityType: 'pitch',
      entityId: pitch.id,
      summary: 'Athena created pitch from idea: ' + idea.title,
      data: { ideaId: idea.id },
    });

    return this.findOne(id);
  }

  private async ensureExists(id: string) {
    const idea = await this.prisma.idea.findUnique({ where: { id }, select: { id: true } });
    if (!idea) throw new BadRequestException('Idea not found');
  }
}
