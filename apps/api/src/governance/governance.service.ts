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
    const existing = await this.prisma.governanceReview.findFirst({
      where: {
        projectId: input.projectId,
        domain: input.domain,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return this.getReview(existing.id);

    const review = await this.prisma.governanceReview.create({
      data: {
        projectId: input.projectId,
        domain: input.domain,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        context: JSON.parse(JSON.stringify(input.context)),
        status: input.requiresHumanReview ? 'REQUIRES_HUMAN_REVIEW' : 'OPEN',
        requiresHumanReview: input.requiresHumanReview ?? false,
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
        evidence: JSON.parse(JSON.stringify(input.evidence ?? {})),
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

  async addFinding(reviewId: string, input: { severity: string; category: string; title: string; description: string; remediation?: string }) {
    const review = await this.prisma.governanceReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Governance review not found.');
    const finding = await this.prisma.governanceFinding.create({ data: { reviewId, severity: input.severity, category: input.category, title: input.title, description: input.description, remediation: input.remediation } });
    await this.audit.record({ actor: 'system', type: 'GOVERNANCE_FINDING_RECORDED', projectId: review.projectId, entityType: 'governance_review', entityId: reviewId, summary: input.title, data: { severity: input.severity, category: input.category } });
    return finding;
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
    if (review.status === 'RESOLVED') throw new BadRequestException('Resolved reviews cannot be finalized again.');
    if (['RECOMMENDED', 'REQUIRES_HUMAN_REVIEW'].includes(review.status)) return review;
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

  async resolveHumanReview(reviewId: string, comment: string) {
    const review = await this.prisma.governanceReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Governance review not found.');
    if (review.status !== 'REQUIRES_HUMAN_REVIEW') throw new BadRequestException('Review is not awaiting human review.');
    const resolved = await this.prisma.governanceReview.update({ where: { id: reviewId }, data: { status: 'RESOLVED', recommendation: (review.recommendation ?? '') + '\\n\\nHuman review: ' + comment } , include: { opinions: true, findings: true } });
    await this.audit.record({ actor: 'ceo', type: 'GOVERNANCE_REVIEW_FINALIZED', projectId: review.projectId, entityType: 'governance_review', entityId: reviewId, summary: 'Governance review resolved by human authority', data: { comment } });
    return resolved;
  }

  async hasBlockingReview(projectId: string, subjectId: string) {
    return this.prisma.governanceReview.findMany({
      where: {
        projectId,
        subjectId,
        status: { in: ['OPEN', 'DEBATING', 'REQUIRES_HUMAN_REVIEW'] },
      },
      orderBy: { createdAt: 'desc' },
    });
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
