import { Injectable } from '@nestjs/common';
import { SafetyPolicyService } from './safety-policy.service.js';
import {
  TeamLeadAction,
  TeamLeadDecision,
} from './team-lead-decision.types.js';

export interface DecisionValidationResult {
  valid: boolean;
  executable: boolean;
  requiresCeoApproval: boolean;
  violations: string[];
}

@Injectable()
export class TeamLeadDecisionValidatorService {
  constructor(private readonly safety: SafetyPolicyService) {}

  validate(decision: TeamLeadDecision): DecisionValidationResult {
    const violations: string[] = [];


    if (!decision.title.trim()) {
      violations.push('Decision title cannot be empty.');
    }

    if (!decision.reasoning.trim()) {
      violations.push('Decision reasoning cannot be empty.');
    }

    for (const action of decision.actions) {
      violations.push(...this.validateAction(action));
    }

    const approvalRequired = decision.actions.some((action) =>
      this.safety.requiresCeoApproval(action),
    );

    if (approvalRequired && !decision.requiresCeoApproval) {
      violations.push('This decision contains an action that requires CEO approval.');
    }

    if (decision.type === 'RELEASE_FEATURE' && !decision.requiresCeoApproval) {
      violations.push('Feature releases always require CEO approval.');
    }

    const valid = violations.length === 0;

    return {
      valid,
      executable: valid && decision.actions.length > 0,
      requiresCeoApproval: decision.requiresCeoApproval,
      violations,
    };
  }

  private validateAction(action: TeamLeadAction): string[] {
    switch (action.type) {
      case 'CREATE_PITCH':
        return this.validateCreatePitch(action);
      case 'INVESTIGATE':
        return this.validateInvestigation(action);
      case 'UPDATE_MEMORY':
        return this.validateMemoryUpdate(action);
      case 'ESCALATE':
        return this.validateEscalation(action);
      case 'RELEASE_FEATURE':
        return this.validateReleaseFeature(action);
      default:
        return ['Unknown Team Lead action.'];
    }
  }

  private validateCreatePitch(
    action: Extract<TeamLeadAction, { type: 'CREATE_PITCH' }>,
  ): string[] {
    const violations: string[] = [];

    if (!action.title.trim()) violations.push('Pitch title cannot be empty.');
    if (!action.description.trim()) violations.push('Pitch description cannot be empty.');
    if (!action.problem.trim()) violations.push('Pitch problem cannot be empty.');
    if (!action.solution.trim()) violations.push('Pitch solution cannot be empty.');
    if (!action.impact.trim()) violations.push('Pitch impact cannot be empty.');
    if (action.tasks.length === 0) {
      violations.push('A pitch must contain at least one task suggestion.');
    }

    return violations;
  }

  private validateInvestigation(
    action: Extract<TeamLeadAction, { type: 'INVESTIGATE' }>,
  ): string[] {
    const violations: string[] = [];
    if (!action.question.trim()) violations.push('Investigation question cannot be empty.');
    if (!action.scope.trim()) violations.push('Investigation scope cannot be empty.');
    return violations;
  }

  private validateMemoryUpdate(
    action: Extract<TeamLeadAction, { type: 'UPDATE_MEMORY' }>,
  ): string[] {
    const violations: string[] = [];

    if (!action.path.endsWith('.md')) {
      violations.push('Memory updates must target a Markdown file.');
    }

    if (action.path.startsWith('/') || action.path.includes('..')) {
      violations.push('Memory path must remain inside the Forge memory vault.');
    }

    if (!action.reason.trim()) violations.push('Memory update requires a reason.');
    if (!action.content.trim()) violations.push('Memory content cannot be empty.');

    return violations;
  }

  private validateEscalation(
    action: Extract<TeamLeadAction, { type: 'ESCALATE' }>,
  ): string[] {
    return action.reason.trim()
      ? []
      : ['Escalation reason cannot be empty.'];
  }

  private validateReleaseFeature(
    action: Extract<TeamLeadAction, { type: 'RELEASE_FEATURE' }>,
  ): string[] {
    return action.featureId.trim()
      ? []
      : ['Release decision requires a feature id.'];
  }
}
