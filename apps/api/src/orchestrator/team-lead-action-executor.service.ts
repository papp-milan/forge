import { BadRequestException, Injectable } from '@nestjs/common';

import { TeamLeadService } from './team-lead.service.js';
import {
  TeamLeadAction,
  TeamLeadDecision,
} from './team-lead-decision.types.js';
import { TeamLeadDecisionValidatorService } from './team-lead-decision-validator.service.js';

export type ActionExecutionStatus =
  'EXECUTED' | 'SKIPPED' | 'BLOCKED' | 'FAILED';

export interface ActionExecutionResult {
  status: ActionExecutionStatus;
  actionType: TeamLeadAction['type'];
  result?: unknown;
  reason?: string;
}

@Injectable()
export class TeamLeadActionExecutorService {
  constructor(
    private readonly validator: TeamLeadDecisionValidatorService,
    private readonly teamLeadService: TeamLeadService,
  ) {}

  async execute(
    projectId: string,
    decision: TeamLeadDecision,
  ): Promise<ActionExecutionResult[]> {
    const validation = this.validator.validate(decision);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Team Lead decision failed validation.',
        violations: validation.violations,
      });
    }

    const results: ActionExecutionResult[] = [];

    for (const action of decision.actions) {
      results.push(await this.executeAction(projectId, action));
    }

    return results;
  }

  private async executeAction(
    projectId: string,
    action: TeamLeadAction,
  ): Promise<ActionExecutionResult> {
    try {
      switch (action.type) {
        case 'CREATE_PITCH':
          return await this.executeCreatePitch(projectId, action);

        case 'INVESTIGATE':
          return {
            status: 'BLOCKED',
            actionType: action.type,
            reason: 'Investigation execution is not implemented yet.',
          };

        case 'UPDATE_MEMORY':
          return {
            status: 'BLOCKED',
            actionType: action.type,
            reason: 'Memory execution is not implemented yet.',
          };

        case 'ESCALATE':
          return {
            status: 'BLOCKED',
            actionType: action.type,
            reason: 'Escalation delivery is not implemented yet.',
          };
      }
    } catch (error) {
      return {
        status: 'FAILED',
        actionType: action.type,
        reason:
          error instanceof Error
            ? error.message
            : 'Unknown action execution error.',
      };
    }
  }

  private async executeCreatePitch(
    projectId: string,
    action: Extract<TeamLeadAction, { type: 'CREATE_PITCH' }>,
  ): Promise<ActionExecutionResult> {
    const pitch = await this.teamLeadService.createProposal(projectId, {
      title: action.title,
      description: action.description,
      problem: action.problem,
      solution: action.solution,
      impact: action.impact,
      risks: action.risks,
      tasks: action.tasks,
    });

    const execution = await this.teamLeadService.approveProposal(pitch.id);

    return {
      status: execution.manpower.sufficient ? 'EXECUTED' : 'BLOCKED',
      actionType: action.type,
      result: execution,
      reason: execution.manpower.sufficient
        ? undefined
        : `Missing manpower: ${execution.manpower.missingRoles.join(', ')}`,
    };
  }
}
