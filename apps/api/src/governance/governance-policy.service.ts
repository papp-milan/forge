import { Injectable } from '@nestjs/common';
import { GovernanceService } from './governance.service.js';
import { GovernanceDebateService } from './governance-debate.service.js';

@Injectable()
export class GovernancePolicyService {
  constructor(private readonly governance: GovernanceService, private readonly debate: GovernanceDebateService) {}

  async requestLifecycleReviews(input: { projectId: string; subjectType: string; subjectId?: string; title: string; context: Record<string, unknown>; domains: Array<'ARCHITECTURE' | 'PRIVACY' | 'SECURITY' | 'INFRASTRUCTURE' | 'COST'> }) {
    const reviews = [];
    for (const domain of [...new Set(input.domains)]) {
      const review = await this.governance.requestReview({ projectId: input.projectId, domain, subjectType: input.subjectType, subjectId: input.subjectId, title: domain + ': ' + input.title, context: input.context, requiresHumanReview: domain === 'PRIVACY' });
      const role = domain === 'PRIVACY' ? 'DPO' : domain === 'ARCHITECTURE' ? 'ARCHITECTURE_BOARD' : domain === 'SECURITY' ? 'SECURITY_BOARD' : domain === 'INFRASTRUCTURE' ? 'INFRASTRUCTURE_ARCHITECT' : 'FINOPS';
      const alternate = domain === 'ARCHITECTURE' ? 'SECURITY_BOARD' : role === 'SECURITY_BOARD' ? 'ARCHITECTURE_BOARD' : 'ATHENA';
      await this.debate.runDeterministicReview(review.id, [
        { agent: role, role, stance: 'CONDITIONAL', rationale: 'Review the proposal against the domain-specific governance requirements.', evidence: { domain } },
        { agent: alternate, role: alternate, stance: 'SUPPORT', rationale: 'Independent counter-perspective finds the proposal potentially acceptable with documented controls.', evidence: { domain } },
      ]);
      reviews.push(await this.governance.getReview(review.id));
    }
    return reviews;
  }

  async hasBlockingReviews(projectId: string, subjectId: string) {
    const reviews = await this.governance.listReviews({ projectId });
    return reviews.filter((review) => review.subjectId === subjectId && ['OPEN', 'DEBATING', 'REQUIRES_HUMAN_REVIEW'].includes(review.status));
  }
}
