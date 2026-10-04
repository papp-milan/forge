import { Injectable } from '@nestjs/common';

export interface RetryDecision {
  retryable: boolean;
  failureClass: string;
  delayMs: number;
  nextAttemptAt: Date | null;
}

@Injectable()
export class RetryPolicyService {
  decide(input: { error?: unknown; attempt: number; maxAttempts: number; kind?: string }): RetryDecision {
    const message = input.error instanceof Error ? input.error.message : String(input.error ?? '');
    const normalized = message.toLowerCase();

    const permanent = ['invalid', 'not found', 'forbidden', 'unauthorized', 'acceptance criteria', 'invalid qa json', 'permission'];
    const transient = ['timeout', 'timed out', 'rate limit', '429', '502', '503', '504', 'network', 'econnreset', 'etimedout', 'temporarily unavailable'];

    if (permanent.some((token) => normalized.includes(token))) {
      return { retryable: false, failureClass: 'PERMANENT', delayMs: 0, nextAttemptAt: null };
    }

    if (input.attempt >= input.maxAttempts) {
      return { retryable: false, failureClass: 'MAX_ATTEMPTS', delayMs: 0, nextAttemptAt: null };
    }

    const failureClass = input.kind === 'QA'
      ? 'QUALITY_FAILURE'
      : transient.some((token) => normalized.includes(token)) ? 'TRANSIENT' : 'RETRYABLE';
    const delayMs = Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, input.attempt - 1));
    return { retryable: true, failureClass, delayMs, nextAttemptAt: new Date(Date.now() + delayMs) };
  }
}
