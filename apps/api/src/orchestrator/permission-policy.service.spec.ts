import { PermissionPolicyService } from './permission-policy.service.js';

describe('PermissionPolicyService', () => {
  const policy = new PermissionPolicyService();

  it('allows CEO release capability', () => {
    expect(() => policy.assertAction('CEO', { type: 'RELEASE_FEATURE', featureId: 'f1' })).not.toThrow();
  });

  it('allows the system only to execute a gated release', () => {
    expect(() => policy.assertAction('SYSTEM', { type: 'RELEASE_FEATURE', featureId: 'f1' })).not.toThrow();
  });

  it('rejects engineering agents from releasing', () => {
    expect(() => policy.assertAction('HEPHAISTOS', { type: 'RELEASE_FEATURE', featureId: 'f1' })).toThrow();
  });
});
