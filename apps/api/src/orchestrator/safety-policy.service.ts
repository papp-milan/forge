import { Injectable } from '@nestjs/common';
import type { TeamLeadAction } from './team-lead-decision.types.js';

@Injectable()
export class SafetyPolicyService {
  requiresCeoApproval(action: TeamLeadAction): boolean {
    return action.type === 'CREATE_PITCH' || action.type === 'RELEASE_FEATURE';
  }

  canExecuteWithoutCeo(action: TeamLeadAction): boolean {
    return !this.requiresCeoApproval(action);
  }
}
