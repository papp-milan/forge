import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

type GovernanceDomain = 'ARCHITECTURE' | 'PRIVACY' | 'SECURITY' | 'INFRASTRUCTURE' | 'COST';
type OpinionStance = 'SUPPORT' | 'OPPOSE' | 'CONDITIONAL' | 'ABSTAIN';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async requestReview(input: {
    projectId: string;
    domain: GovernanceDomain;
    subjectType: string;
    subjectId?: string;
    title: string;
    context: Record<string, unknown>;
    requiresHumanReview?: boolean;
  }) {
    const review = await this.prisma.governanceReview.create({
      data: {
        projectId: input.projectId,
        domain: input.domain,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        context: input.context,
        status: input.requiresHumanReview ? 'REQUIRES_HUMAN_REVIEW' : 'OPEN',
      },
      include: { opinions: true, findings: true },
    });

    await this.audit.record({
      actor: 'system',
      type: 'GOVERNANCE_REVIEW_CREATED',
      projectId: input.projectId,
      entityType: 'governance_review',
      entityId: review.id,
      summary: input.domain + ' review created: ' + input.title,
      data: { subjectType: input.subjectType, subjectId: input.subjectId },
    });

    return review;
  }

  async addOpinion(reviewId: string, input: {
    agent: string;
    role: string;
    stance: OpinionStance;
    rationale: string;
    evidence?: Record<string, unknown>;
    round?: number;
  }) {
    const review = await this.prisma.governanceReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Governance review not found.');
    if (review.status === 'RESOLVED') throw new BadRequestException('Resolved reviews cannot receive new opinions.');

    const opinion = await this.prisma.governanceOpinion.create({
      data: {
        reviewId,
        agent: input.agent,
        role: input.role,
        stance: input.stance,
        rationale: input.rationale,
        evidence: input.evidence ?? {},
        round: input.round ?? 1,
      },
    });

    if (review.status === 'OPEN') {
      await this.prisma.governanceReview.update({
        where: { id: reviewId },
        data: { status: 'DEBATING' },
      });
    }

    await this.audit.record({
      actor: 'system',
      type: 'GOVERNANCE_OPINION_RECORDED',
      projectId: review.projectId,
      entityType: 'governance_review',
      entityId: reviewId,
      summary: input.agent + ' submitted a ' + input.stance + ' governance opinion',
      data: { role: input.role, round: input.round ?? 1 },
    });

    return opinion;
  }

  async finalizeReview(reviewId: string, input: {
    recommendation: string;
    dissent?: string;
    requiresHumanReview?: boolean;
  }) {
    const review = await this.prisma.governanceReview.findUnique({
      where: { id: reviewId },
      include: { opinions: true, findings: true },
    });
    if (!review) throw new NotFoundException('Governance review not found.');
    if (review.opinions.length === 0) {
      throw new BadRequestException('A governance review needs at least one recorded opinion.');
    }

    const requiresHumanReview = input.requiresHumanReview ?? review.domain === 'PRIVACY';
    const status = requiresHumanReview ? 'REQUIRES_HUMAN_REVIEW' : 'RECOMMENDED';

    const updated = await this.prisma.governanceReview.update({
      where: { id: reviewId },
      data: {
        recommendation: input.recommendation,
        dissent: input.dissent,
        requiresHumanReview,
        status,
      },
      include: { opinions: true, findings: true },
    });

    await this.audit.record({
      actor: 'system',
      type: 'GOVERNANCE_REVIEW_FINALIZED',
      projectId: review.projectId,
      entityType: 'governance_review',
      entityId: reviewId,
      summary: review.domain + ' governance review finalized',
      data: { status, requiresHumanReview },
    });

    return updated;
  }

  async getReview(reviewId: string) {
    const review = await this.prisma.governanceReview.findUnique({
      where: { id: reviewId },
      include: { opinions: { orderBy: [{ round: 'asc' }, { createdAt: 'asc' }] }, findings: true },
    });
    if (!review) throw new NotFoundException('Governance review not found.');
    return review;
  }

  listReviews(options?: { projectId?: string; status?: string }) {
    return this.prisma.governanceReview.findMany({
      where: {
        projectId: options?.projectId,
        status: options?.status as any,
      },
      include: { opinions: true, findings: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
