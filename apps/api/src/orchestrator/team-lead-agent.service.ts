import { Injectable } from '@nestjs/common';

import { TeamLeadContextService } from './team-lead-context.service.js';

import { TeamLeadContext } from './team-lead-context.types.js';

import { TeamLeadDecision } from './team-lead-decision.types.js';

@Injectable()
export class TeamLeadAgentService {
  constructor(private readonly contextService: TeamLeadContextService) {}

  async analyzeProject(projectId: string): Promise<{
    context: TeamLeadContext;
    decision: TeamLeadDecision;
  }> {
    const context = await this.contextService.build(projectId);

    const decision = this.analyze(context);

    return {
      context,
      decision,
    };
  }

  private analyze(context: TeamLeadContext): TeamLeadDecision {
    if (context.signals.inconsistencies.length > 0) {
      return {
        type: 'ESCALATE',
        priority: 'HIGH',

        title: 'Project state contains inconsistencies',

        reasoning:
          'The project contains inconsistencies between Forge state and external project state. These should be resolved before autonomous development continues.',

        evidence: context.signals.inconsistencies,

        actions: [
          {
            type: 'ESCALATE',
            reason:
              'GitHub repository references do not match the project repository.',
          },
        ],

        requiresCeoApproval: true,
      };
    }

    if (context.signals.blockers.length > 0) {
      return {
        type: 'ESCALATE',
        priority: 'HIGH',

        title: 'Project contains blocked work',

        reasoning:
          'One or more tasks are blocked and require investigation or intervention.',

        evidence: context.signals.blockers,

        actions: [
          {
            type: 'ESCALATE',
            reason:
              'Blocked tasks require investigation before additional work should be assigned.',
          },
        ],

        requiresCeoApproval: false,
      };
    }

    if (context.health.pendingPitches > 0) {
      return {
        type: 'NO_ACTION',
        priority: 'LOW',

        title: 'Existing proposal requires CEO decision',

        reasoning:
          'The project already contains unresolved product proposals. No additional product proposal should be created until those decisions are resolved.',

        evidence: [
          `${context.health.pendingPitches} pending pitch(es) require attention.`,
        ],

        actions: [],

        requiresCeoApproval: true,
      };
    }

    if (context.signals.opportunities.length > 0) {
      return {
        type: 'CREATE_PITCH',
        priority: 'MEDIUM',

        title: 'Project may benefit from new feature work',

        reasoning:
          'The project currently has capacity for additional product work.',

        evidence: context.signals.opportunities,

        actions: [
          {
            type: 'CREATE_PITCH',

            title: 'Investigate next product opportunity',

            description:
              'Analyze the project and identify a concrete feature that would provide meaningful value.',

            problem:
              'The project currently has available development capacity.',

            solution:
              'The Team Lead should analyze the project and propose the next valuable feature.',

            impact:
              'Provides a structured opportunity for continued product development.',

            risks:
              'The proposed feature may not provide sufficient value and therefore requires CEO approval.',
          },
        ],

        requiresCeoApproval: true,
      };
    }

    return {
      type: 'NO_ACTION',
      priority: 'LOW',

      title: 'No immediate action required',

      reasoning:
        'The project currently has no detected blocker, inconsistency or actionable opportunity requiring Team Lead intervention.',

      evidence: [],

      actions: [],

      requiresCeoApproval: false,
    };
  }
}
