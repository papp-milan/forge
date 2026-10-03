import type { EmployeeRole } from '../generated/prisma/enums.js';

export type TeamLeadDecisionType =
  | 'NO_ACTION'
  | 'CREATE_PITCH'
  | 'INVESTIGATE'
  | 'UPDATE_MEMORY'
  | 'ESCALATE'
  | 'RELEASE_FEATURE';

export type TeamLeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TeamLeadDecision {
  type: TeamLeadDecisionType;
  priority: TeamLeadPriority;
  title: string;
  reasoning: string;
  evidence: string[];
  actions: TeamLeadAction[];
  requiresCeoApproval: boolean;
}

export type TeamLeadAction =
  | {
      type: 'CREATE_PITCH';
      title: string;
      description: string;
      problem: string;
      solution: string;
      impact: string;
      risks?: string;
      tasks: TeamLeadPitchTask[];
    }
  | {
      type: 'INVESTIGATE';
      question: string;
      scope: string;
    }
  | {
      type: 'UPDATE_MEMORY';
      path: string;
      reason: string;
      content: string;
    }
  | {
      type: 'ESCALATE';
      reason: string;
    }
  | {
      type: 'RELEASE_FEATURE';
      featureId: string;
    };

export interface TeamLeadPitchTask {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  role: EmployeeRole;
}
