import { Injectable } from '@nestjs/common';

import { TeamLeadContextService } from './team-lead-context.service.js';
import { TeamLeadContext } from './team-lead-context.types.js';
import { TeamLeadDecision } from './team-lead-decision.types.js';
import { TeamLeadDecisionValidatorService } from './team-lead-decision-validator.service.js';
import { AgentDecisionService } from './agent-decision.service.js';
import { HermesRuntimeService } from '../runtime/hermes-runtime.service.js';

@Injectable()
export class TeamLeadAgentService {
  constructor(
    private readonly contextService: TeamLeadContextService,
    private readonly validator: TeamLeadDecisionValidatorService,
    private readonly decisionService: AgentDecisionService,
    private readonly hermes: HermesRuntimeService,
  ) {}

  async analyzeProject(projectId: string): Promise<{
    context: TeamLeadContext;
    decision: TeamLeadDecision;
    validation: ReturnType<TeamLeadDecisionValidatorService['validate']>;
  }> {
    const context = await this.contextService.build(projectId);
    const decision = process.env['TEAM_LEAD_AGENT'] === 'hermes'
      ? await this.analyzeWithHermes(context)
      : this.analyze(context);
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

    if (analysis.decision.type === 'NO_ACTION') {
      return {
        status: 'NO_ACTION' as const,
        analysis,
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

  private async analyzeWithHermes(context: TeamLeadContext): Promise<TeamLeadDecision> {
    const prompt = [
      'You are Athena, Forge\'s Team Lead.',
      'Analyze the supplied project context and return exactly one JSON object.',
      'Do not use markdown fences. Do not add commentary outside the JSON.',
      'The JSON must contain: type, priority, title, reasoning, evidence, actions, requiresCeoApproval.',
      'Allowed types: NO_ACTION, CREATE_PITCH, INVESTIGATE, UPDATE_MEMORY, ESCALATE, RELEASE_FEATURE.',
      'Allowed priorities: LOW, MEDIUM, HIGH, CRITICAL.',
      'For CREATE_PITCH, action must contain title, description, problem, solution, impact, risks and tasks.'
      ' For RELEASE_FEATURE, action must contain featureId and CEO approval is mandatory.',
      'Each task must contain title and role; role must be TEAM_LEAD, UI_UX, ENGINEER, QA or DEVOPS.',
      'Treat CEO approval as mandatory for consequential product decisions.',
      'Do not invent project facts. Base evidence only on the supplied context.',
      '',
      JSON.stringify(context, null, 2),
    ].join('\\n');

    const result = await this.hermes.run({
      prompt,
      maxTurns: 12,
    });

    if (result.exitCode !== 0 || !result.text) {
      throw new Error(
        `Hermes Team Lead run failed with exit code ${result.exitCode}`,
      );
    }

    try {
      return JSON.parse(this.extractJson(result.text)) as TeamLeadDecision;
    } catch {
      throw new Error('Hermes returned invalid Team Lead JSON.');
    }
  }

  private extractJson(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');

    if (first === -1 || last <= first) {
      throw new Error('Hermes response did not contain a JSON object.');
    }

    return text.slice(first, last + 1);
  }


  private analyze(context: TeamLeadContext): TeamLeadDecision {
    if (context.health.readyForRelease.length > 0) {
      const feature = context.health.readyForRelease[0];
      return {
        type: 'RELEASE_FEATURE',
        priority: 'HIGH',
        title: 'Release QA-approved feature',
        reasoning: 'A feature has completed task-level QA and is waiting for the CEO release gate.',
        evidence: [`Feature "${feature.title}" is in QA and all tracked tasks are complete.`],
        actions: [{ type: 'RELEASE_FEATURE', featureId: feature.id }],
        requiresCeoApproval: true,
      };
    }

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
        requiresCeoApproval: true,
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
