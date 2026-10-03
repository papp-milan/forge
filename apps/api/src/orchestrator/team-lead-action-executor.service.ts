import { BadRequestException, Injectable } from '@nestjs/common';

import { TeamLeadService } from './team-lead.service.js';
import {
  TeamLeadAction,
  TeamLeadDecision,
} from './team-lead-decision.types.js';
import { TeamLeadDecisionValidatorService } from './team-lead-decision-validator.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { FeaturesService } from '../features/features.service.js';

export type ActionExecutionStatus = 'EXECUTED' | 'SKIPPED' | 'BLOCKED' | 'FAILED';

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
    private readonly memory: MemoryService,
    private readonly features: FeaturesService,
  ) {}

  async execute(projectId: string, decision: TeamLeadDecision): Promise<ActionExecutionResult[]> {
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

  private async executeAction(projectId: string, action: TeamLeadAction): Promise<ActionExecutionResult> {
    try {
      switch (action.type) {
        case 'CREATE_PITCH':
          return this.executeCreatePitch(projectId, action);
        case 'INVESTIGATE':
          return {
            status: 'BLOCKED',
            actionType: action.type,
            reason: 'Investigation execution is not implemented yet.',
          };
        case 'UPDATE_MEMORY':
          return this.executeUpdateMemory(action);
        case 'ESCALATE':
          return this.executeEscalation(projectId, action);
        case 'RELEASE_FEATURE':
          return this.executeReleaseFeature(projectId, action);
      }
    } catch (error) {
      return {
        status: 'FAILED',
        actionType: action.type,
        reason: error instanceof Error ? error.message : 'Unknown action execution error.',
      };
    }
  }

  private async executeUpdateMemory(
    action: Extract<TeamLeadAction, { type: 'UPDATE_MEMORY' }>,
  ): Promise<ActionExecutionResult> {
    const memory = await this.memory.remember({
      scope: 'company',
      subject: action.path,
      type: 'learning',
      source: 'team_lead',
      confidence: 'medium',
      content: action.content + '\n\nReason: ' + action.reason + '\nRequested path: ' + action.path,
    });

    return { status: 'EXECUTED', actionType: action.type, result: { memory: memory.path } };
  }

  private async executeEscalation(
    projectId: string,
    action: Extract<TeamLeadAction, { type: 'ESCALATE' }>,
  ): Promise<ActionExecutionResult> {
    const memory = await this.memory.remember({
      scope: 'projects',
      subject: 'escalation-' + projectId,
      type: 'decision',
      source: 'team_lead',
      confidence: 'high',
      content: 'CEO escalation: ' + action.reason,
    });

    return {
      status: 'EXECUTED',
      actionType: action.type,
      result: { memory: memory.path, reason: action.reason },
    };
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

    await this.memory.remember({
      scope: 'projects',
      subject: 'pitch-' + pitch.id,
      type: 'decision',
      source: 'team_lead',
      confidence: 'high',
      content: 'Athena created and approved the pitch "' + action.title + '". Problem: ' +
        action.problem + ' Solution: ' + action.solution + ' Impact: ' + action.impact,
    });

    return {
      status: 'EXECUTED',
      actionType: action.type,
      result: { pitchId: pitch.id, status: 'PENDING_APPROVAL' },
    };
  }

  private async executeReleaseFeature(
    projectId: string,
    action: Extract<TeamLeadAction, { type: 'RELEASE_FEATURE' }>,
  ): Promise<ActionExecutionResult> {
    const feature = await this.features.findOne(action.featureId);

    if (!feature || feature.projectId !== projectId) {
      throw new BadRequestException('Release feature does not belong to the project.');
    }

    if (feature.status === 'QA') {
      await this.features.approveQa(feature.id);
    }

    const released = await this.features.release(feature.id);

    return {
      status: 'EXECUTED',
      actionType: action.type,
      result: { feature: released },
    };
  }
}
