import { BadRequestException, Injectable } from '@nestjs/common';
import { GovernanceService } from './governance.service.js';

export interface GovernancePerspective {
  agent: string;
  role: string;
  stance: 'SUPPORT' | 'OPPOSE' | 'CONDITIONAL' | 'ABSTAIN';
  rationale: string;
  evidence?: Record<string, unknown>;
}

@Injectable()
export class GovernanceDebateService {
  constructor(private readonly governance: GovernanceService) {}

  async runDeterministicReview(
    reviewId: string,
    perspectives: GovernancePerspective[],
    rounds = 2,
  ) {
    if (perspectives.length < 2) {
      throw new BadRequestException('Governance debate requires at least two independent perspectives.');
    }

    const review = await this.governance.getReview(reviewId);
    if (review.status === 'RESOLVED') {
      throw new BadRequestException('Governance review is already resolved.');
    }

    const totalRounds = Math.min(Math.max(rounds, 1), 5);
    for (let round = 1; round <= totalRounds; round++) {
      for (const perspective of perspectives) {
        const prior = round > 1
          ? `Round 1 opinions were already recorded. Re-evaluate the subject in light of opposing perspectives.`
          : 'Initial independent assessment.';
        await this.governance.addOpinion(reviewId, {
          agent: perspective.agent,
          role: perspective.role,
          stance: perspective.stance,
          rationale: `${perspective.rationale} ${prior}`,
          evidence: perspective.evidence ?? {},
          round,
        });
      }
    }

    const support = perspectives.filter((p) => p.stance === 'SUPPORT').length;
    const oppose = perspectives.filter((p) => p.stance === 'OPPOSE').length;
    const conditional = perspectives.filter((p) => p.stance === 'CONDITIONAL').length;

    const recommendation =
      oppose > support
        ? 'Do not proceed without addressing opposing findings.'
        : conditional > 0
          ? 'Proceed only after the stated conditions are satisfied.'
          : 'Proceed subject to the review findings and applicable human gates.';

    const dissent = oppose > 0 || conditional > 0
      ? `Dissent recorded: ${oppose} opposing and ${conditional} conditional perspective(s).`
      : null;

    return this.governance.finalizeReview(reviewId, { recommendation, dissent: dissent ?? undefined });
  }
}
