import { Injectable } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { TeamLeadAction } from './team-lead-decision.types.js';

@Injectable()
export class PermissionPolicyService {
  private readonly permissions: Record<string, Set<string>> = {
    ATHENA: new Set(['CREATE_PITCH', 'INVESTIGATE', 'UPDATE_MEMORY', 'ESCALATE', 'RELEASE_FEATURE']),
    HEPHAISTOS: new Set(['ENGINEERING']),
    ARTEMIS: new Set(['QA']),
    APOLLO: new Set(['ENGINEERING']),
    NIKE: new Set(['RELEASE']),
    ATLAS: new Set(['INFRASTRUCTURE']),
    ARCHITECTURE_BOARD: new Set(['GOVERNANCE_ARCHITECTURE']),
    DPO: new Set(['GOVERNANCE_PRIVACY']),
    SECURITY_BOARD: new Set(['GOVERNANCE_SECURITY']),
    INFRASTRUCTURE_ARCHITECT: new Set(['GOVERNANCE_INFRASTRUCTURE']),
    FINOPS: new Set(['GOVERNANCE_COST']),
    CEO: new Set(['*']),
  };

  assertAction(agent: string, action: TeamLeadAction): void {
    const allowed = this.permissions[agent.toUpperCase()];
    if (!allowed || (!allowed.has('*') && !allowed.has(action.type))) {
      throw new ForbiddenException(`Agent ${agent} is not permitted to execute ${action.type}.`);
    }
    if (action.type === 'RELEASE_FEATURE' && agent.toUpperCase() !== 'CEO') {
      throw new ForbiddenException('Feature release execution is CEO-gated.');
    }
  }

  assertCapability(agent: string, capability: string): void {
    const allowed = this.permissions[agent.toUpperCase()];
    if (!allowed || (!allowed.has('*') && !allowed.has(capability))) {
      throw new ForbiddenException(`Agent ${agent} is not permitted to use ${capability}.`);
    }
  }
}
