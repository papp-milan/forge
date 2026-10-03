import { SafetyPolicyService } from './safety-policy.service.js';

describe('SafetyPolicyService', () => {
  const policy = new SafetyPolicyService();

  it('requires CEO approval for pitches and releases', () => {
    expect(policy.requiresCeoApproval({ type: 'CREATE_PITCH', title: 'x', description: 'x', problem: 'x', solution: 'x', impact: 'x', tasks: [] })).toBe(true);
    expect(policy.requiresCeoApproval({ type: 'RELEASE_FEATURE', featureId: 'f1' })).toBe(true);
  });

  it('allows non-consequential memory updates without CEO approval', () => {
    expect(policy.requiresCeoApproval({ type: 'UPDATE_MEMORY', path: 'company/x.md', reason: 'r', content: 'c' })).toBe(false);
  });
});
