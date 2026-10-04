import { BadRequestException, Injectable } from '@nestjs/common';

import { TeamLeadService } from './team-lead.service.js';
import {
  TeamLeadAction,
  TeamLeadDecision,
} from './team-lead-decision.types.js';
import { TeamLeadDecisionValidatorService } from './team-lead-decision-validator.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { FeaturesService } from '../features/features.service.js';
import { PermissionPolicyService } from './permission-policy.service.js';
import { TeamLeadContextService } from './team-lead-context.service.js';
import { HermesRuntimeService } from '../runtime/hermes-runtime.service.js';

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
    private readonly permissions: PermissionPolicyService,
    private readonly contextService: TeamLeadContextService,
    private readonly hermes: HermesRuntimeService,
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
          return this.executeInvestigation(projectId, action);
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

  private async executeInvestigation(
    projectId: string,
    action: Extract<TeamLeadAction, { type: 'INVESTIGATE' }>,
  ): Promise<ActionExecutionResult> {
    const context = await this.contextService.build(projectId);
    const result = await this.hermes.run({
      maxTurns: 12,
      prompt: [
        'You are Athena conducting a bounded product investigation for Forge.',
        'Answer the investigation question using ONLY the supplied project context.',
        'Do not invent facts or claim external research you did not perform.',
        'Return concise JSON with: finding, evidence (string[]), recommendation, confidence.',
        '',
        'Question: ' + action.question,
        'Scope: ' + action.scope,
        '',
        JSON.stringify(context, null, 2),
      ].join('\n'),
    });

    if (result.exitCode !== 0 || !result.text) {
      throw new Error('Investigation runtime failed.');
    }

    const memory = await this.memory.remember({
      scope: 'projects',
      subject: 'investigation-' + projectId,
      type: 'learning',
      source: 'team_lead',
      confidence: 'medium',
      content: [
        'Athena investigation',
        'Question: ' + action.question,
        'Scope: ' + action.scope,
        '',
        result.text,
      ].join('\n'),
    });

    return {
      status: 'EXECUTED',
      actionType: action.type,
      result: {
        status: 'COMPLETED',
        question: action.question,
        scope: action.scope,
        memory: memory.path,
        sessionId: result.sessionId,
      },
    };
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
      content: 'Athena created the pitch "' + action.title + '". CEO approval is still required. Problem: ' +
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
    this.permissions.assertAction('SYSTEM', action);
    const feature = await this.features.findOne(action.featureId);

    if (!feature || feature.projectId !== projectId) {
      throw new BadRequestException('Release feature does not belong to the project.');
    }

    if (feature.status !== 'READY_FOR_REVIEW') {
      throw new BadRequestException('Feature must be QA-approved and READY_FOR_REVIEW before release.');
    }

    const released = await this.features.release(feature.id);

    return {
      status: 'EXECUTED',
      actionType: action.type,
      result: { feature: released },
    };
  }
}
