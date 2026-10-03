import { Injectable } from '@nestjs/common';

import { TeamLeadContextService } from './team-lead-context.service.js';
import { TeamLeadContext } from './team-lead-context.types.js';
import { TeamLeadDecision } from './team-lead-decision.types.js';
import { TeamLeadDecisionValidatorService } from './team-lead-decision-validator.service.js';
import { TeamLeadActionExecutorService } from './team-lead-action-executor.service.js';
import { AgentDecisionService } from './agent-decision.service.js';

@Injectable()
export class TeamLeadAgentService {
  constructor(
    private readonly contextService: TeamLeadContextService,
    private readonly validator: TeamLeadDecisionValidatorService,
    private readonly executor: TeamLeadActionExecutorService,
    private readonly decisionService: AgentDecisionService,
  ) {}

  async analyzeProject(projectId: string): Promise<{
    context: TeamLeadContext;
    decision: TeamLeadDecision;
    validation: ReturnType<TeamLeadDecisionValidatorService['validate']>;
  }> {
    const context = await this.contextService.build(projectId);
    const decision = this.analyze(context);
    const validation = this.validator.validate(decision);

    return { context, decision, validation };
  }

  async run(projectId: string) {
    const analysis = await this.analyzeProject(projectId);

    if (!analysis.validation.valid) {
      return {
        status: 'BLOCKED' as const,
        analysis,
        reason: 'Decision failed validation.',
      };
    }

    const decision = await this.decisionService.create(
      projectId,
      analysis.decision,
    );

    if (decision.status === 'PENDING') {
      return {
        status: 'PENDING_APPROVAL' as const,
        decision,
        analysis,
      };
    }

    const execution = await this.decisionService.execute(decision.id);

    return {
      status: execution.decision.status,
      decision: execution.decision,
      analysis,
      results: execution.results,
    };
  }

  async executeDecision(projectId: string) {
    const analysis = await this.analyzeProject(projectId);

    if (!analysis.validation.valid) {
      return {
        status: 'BLOCKED' as const,
        analysis,
        reason: 'Decision failed validation.',
      };
    }

    const results = await this.executor.execute(projectId, analysis.decision);

    const executed = results.some((result) => result.status === 'EXECUTED');
    const failed = results.some((result) => result.status === 'FAILED');
    const blocked = results.some((result) => result.status === 'BLOCKED');

    let status: 'EXECUTED' | 'PARTIAL' | 'BLOCKED' | 'FAILED';

    if (failed) {
      status = 'FAILED';
    } else if (blocked && executed) {
      status = 'PARTIAL';
    } else if (blocked) {
      status = 'BLOCKED';
    } else {
      status = 'EXECUTED';
    }

    return { status, analysis, results };
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
            tasks: [
              {
                title: 'Analyze the next product opportunity',
                description:
                  'Analyze the project, existing functionality and user needs to identify a concrete feature opportunity.',
                acceptanceCriteria:
                  'A concrete feature proposal with clear value, scope and acceptance criteria is prepared.',
                role: 'TEAM_LEAD',
              },
            ],
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
