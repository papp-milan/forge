import { describe, expect, it } from 'vitest';
import { RetryPolicyService } from './retry-policy.service.js';

describe('RetryPolicyService', () => {
  it('retries QA quality failures until max attempts', () => {
    const service = new RetryPolicyService();
    const decision = service.decide({
      kind: 'QA',
      error: { message: 'QA failed: acceptance criteria not met' },
      attempt: 1,
      maxAttempts: 3,
    });

    expect(decision.retryable).toBe(true);
    expect(decision.failureClass).toBe('QUALITY_FAILURE');
    expect(decision.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('stops retrying at max attempts', () => {
    const service = new RetryPolicyService();
    const decision = service.decide({
      kind: 'QA',
      error: { message: 'QA failed' },
      attempt: 3,
      maxAttempts: 3,
    });

    expect(decision.retryable).toBe(false);
    expect(decision.failureClass).toBe('MAX_ATTEMPTS');
    expect(decision.nextAttemptAt).toBeNull();
  });

  it('keeps invalid QA output permanently failed', () => {
    const service = new RetryPolicyService();
    const decision = service.decide({
      kind: 'QA',
      error: new Error('Artemis returned invalid QA JSON'),
      attempt: 1,
      maxAttempts: 3,
    });

    expect(decision.retryable).toBe(false);
    expect(decision.failureClass).toBe('PERMANENT');
  });
});
