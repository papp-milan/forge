import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GovernanceService } from './governance.service.js';

@Controller('api/governance')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get('reviews')
  listReviews(@Query('projectId') projectId?: string, @Query('status') status?: string) {
    return this.governance.listReviews({ projectId, status });
  }

  @Get('reviews/:reviewId')
  getReview(@Param('reviewId') reviewId: string) {
    return this.governance.getReview(reviewId);
  }

  @Post('reviews')
  requestReview(@Body() body: {
    projectId: string;
    domain: 'ARCHITECTURE' | 'PRIVACY' | 'SECURITY' | 'INFRASTRUCTURE' | 'COST';
    subjectType: string;
    subjectId?: string;
    title: string;
    context: Record<string, unknown>;
    requiresHumanReview?: boolean;
  }) {
    return this.governance.requestReview(body);
  }

  @Post('reviews/:reviewId/opinions')
  addOpinion(@Param('reviewId') reviewId: string, @Body() body: {
    agent: string;
    role: string;
    stance: 'SUPPORT' | 'OPPOSE' | 'CONDITIONAL' | 'ABSTAIN';
    rationale: string;
    evidence?: Record<string, unknown>;
    round?: number;
  }) {
    return this.governance.addOpinion(reviewId, body);
  }

  @Post('reviews/:reviewId/finalize')
  finalizeReview(@Param('reviewId') reviewId: string, @Body() body: {
    recommendation: string;
    dissent?: string;
    requiresHumanReview?: boolean;
  }) {
    return this.governance.finalizeReview(reviewId, body);
  }
}
