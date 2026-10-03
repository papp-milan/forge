import { Injectable } from '@nestjs/common';
import { GovernanceService } from './governance.service.js';

@Injectable()
export class GovernancePolicyService {
  constructor(private readonly governance: GovernanceService) {}

  async requestLifecycleReviews(input: { projectId: string; subjectType: string; subjectId?: string; title: string; context: Record<string, unknown>; domains: Array<'ARCHITECTURE' | 'PRIVACY' | 'SECURITY' | 'INFRASTRUCTURE' | 'COST'> }) {
    const reviews = [];
    for (const domain of [...new Set(input.domains)]) {
      reviews.push(await this.governance.requestReview({ projectId: input.projectId, domain, subjectType: input.subjectType, subjectId: input.subjectId, title: domain + ': ' + input.title, context: input.context, requiresHumanReview: domain === 'PRIVACY' }));
    }
    return reviews;
  }

  async hasBlockingReviews(projectId: string, subjectId: string) {
    const reviews = await this.governance.listReviews({ projectId });
    return reviews.filter((review) => review.subjectId === subjectId && ['OPEN', 'DEBATING', 'REQUIRES_HUMAN_REVIEW'].includes(review.status));
  }
}
