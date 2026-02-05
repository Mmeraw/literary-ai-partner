/**
 * Dead-Letter Path Tests — Terminal Failure Logic
 * 
 * Phase C Week 1 Item #2
 * 
 * Test coverage for terminal failure decisions and dead-letter enforcement.
 */

import { shouldMarkFailed, isNonRetryableError, isClaimable, isLegalFailedTransition } from './deadLetter';
import { FailureEnvelope, ERROR_CODES } from './types';

describe('Dead-Letter Path — shouldMarkFailed()', () => {
  
  describe('Terminal Condition: Non-Retryable Error', () => {
    test('marks job as failed on invalid_api_key', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'AUTH_FAILED',
        message: 'Invalid API key',
        retryable: false,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 1, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('non_retryable');
    });

    test('marks job as failed on malformed_request', () => {
      const envelope: FailureEnvelope = {
        provider: 'anthropic',
        code: 'INVALID_INPUT',
        message: 'Malformed prompt',
        retryable: false,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 2, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('non_retryable');
    });

    test('marks job as failed on model_not_found', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'INVALID_INPUT',
        message: 'Model not available for account',
        retryable: false,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 1, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('non_retryable');
    });
  });

  describe('Terminal Condition: Max Attempts Exceeded', () => {
    test('marks job as failed after 3 attempts (default max)', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        retryable: true, // Still retryable, but exhausted attempts
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 3, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('max_attempts');
    });

    test('marks job as failed after custom max attempts', () => {
      const envelope: FailureEnvelope = {
        provider: 'anthropic',
        code: 'TIMEOUT',
        message: 'Request timeout',
        retryable: true,
      } as FailureEnvelope;
      
      const customMaxAttempts = 5;
      const decision = shouldMarkFailed('running', 5, envelope, customMaxAttempts);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('max_attempts');
    });

    test('allows retry when under max attempts', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        retryable: true,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 2, envelope, 3);
      
      expect(decision.shouldFail).toBe(false);
      expect(decision.reason).toBe(null);
    });
  });

  describe('Terminal Condition: Already Failed (Idempotent)', () => {
    test('returns true for already failed jobs', () => {
      const decision = shouldMarkFailed('failed', 2, null);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('already_failed');
    });

    test('handles failed status even with retryable envelope', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'TIMEOUT',
        message: 'Timeout',
        retryable: true,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('failed', 1, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('already_failed');
    });
  });

  describe('Continue Retrying: Transient Errors', () => {
    test('allows retry for rate_limit under max attempts', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        retryable: true,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 1, envelope);
      
      expect(decision.shouldFail).toBe(false);
      expect(decision.reason).toBe(null);
    });

    test('allows retry for timeout under max attempts', () => {
      const envelope: FailureEnvelope = {
        provider: 'anthropic',
        code: 'TIMEOUT',
        message: 'Request timeout',
        retryable: true,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 2, envelope);
      
      expect(decision.shouldFail).toBe(false);
      expect(decision.reason).toBe(null);
    });

    test('allows retry for service_unavailable under max attempts', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Service temporarily unavailable',
        retryable: true,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 1, envelope);
      
      expect(decision.shouldFail).toBe(false);
      expect(decision.reason).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    test('handles null failure envelope (no previous failure)', () => {
      const decision = shouldMarkFailed('running', 1, null);
      
      expect(decision.shouldFail).toBe(false);
      expect(decision.reason).toBe(null);
    });

    test('handles unknown error code with retryable=false', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'unknown_custom_error',
        message: 'Unknown failure',
        retryable: false,
      } as FailureEnvelope;
      
      const decision = shouldMarkFailed('running', 1, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('non_retryable');
    });

    test('prioritizes already_failed over other conditions', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'AUTH_FAILED',
        message: 'Auth error',
        retryable: false,
      } as FailureEnvelope;
      
      // Even with non-retryable error at max attempts, already_failed takes precedence
      const decision = shouldMarkFailed('failed', 3, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('already_failed');
    });

    test('prioritizes max_attempts over non_retryable', () => {
      const envelope: FailureEnvelope = {
        provider: 'openai',
        code: 'RATE_LIMIT',
        message: 'Rate limit',
        retryable: true,
      } as FailureEnvelope;
      
      // At max attempts, should fail even though error is retryable
      const decision = shouldMarkFailed('running', 3, envelope);
      
      expect(decision.shouldFail).toBe(true);
      expect(decision.reason).toBe('max_attempts');
    });
  });
});

describe('Dead-Letter Path — isNonRetryableError()', () => {
  test('identifies invalid_api_key as non-retryable', () => {
    expect(isNonRetryableError('AUTH_FAILED')).toBe(true);
  });

  test('identifies malformed_request as non-retryable', () => {
    expect(isNonRetryableError('INVALID_INPUT')).toBe(true);
  });

  test('identifies model_not_found as non-retryable', () => {
    expect(isNonRetryableError('INVALID_INPUT')).toBe(true);
  });

  test('identifies rate_limit as retryable', () => {
    expect(isNonRetryableError('RATE_LIMIT')).toBe(false);
  });

  test('identifies timeout as retryable', () => {
    expect(isNonRetryableError('TIMEOUT')).toBe(false);
  });

  test('identifies service_unavailable as retryable', () => {
    expect(isNonRetryableError('PROVIDER_UNAVAILABLE')).toBe(false);
  });
});

describe('Dead-Letter Path — isClaimable()', () => {
  test('allows claiming queued jobs', () => {
    expect(isClaimable('queued')).toBe(true);
  });

  test('prevents claiming running jobs', () => {
    expect(isClaimable('running')).toBe(false);
  });

  test('prevents claiming complete jobs', () => {
    expect(isClaimable('complete')).toBe(false);
  });

  test('prevents claiming failed jobs', () => {
    expect(isClaimable('failed')).toBe(false);
  });
});

describe('Dead-Letter Path — isLegalFailedTransition()', () => {
  test('allows queued → failed', () => {
    expect(isLegalFailedTransition('queued', 'failed')).toBe(true);
  });

  test('allows running → failed', () => {
    expect(isLegalFailedTransition('running', 'failed')).toBe(true);
  });

  test('allows failed → failed (idempotent)', () => {
    expect(isLegalFailedTransition('failed', 'failed')).toBe(true);
  });

  test('prevents complete → failed', () => {
    expect(isLegalFailedTransition('complete', 'failed')).toBe(false);
  });

  test('allows transitions to non-failed statuses (passthrough)', () => {
    expect(isLegalFailedTransition('queued', 'running')).toBe(true);
    expect(isLegalFailedTransition('running', 'complete')).toBe(true);
  });
});

describe('Dead-Letter Path — Integration Scenarios', () => {
  test('Scenario: Worker retry loop with rate limit', () => {
    const envelope: FailureEnvelope = {
      provider: 'openai',
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      retryable: true,
    } as FailureEnvelope;

    // Attempt 1: Should retry
    let decision = shouldMarkFailed('running', 1, envelope);
    expect(decision.shouldFail).toBe(false);

    // Attempt 2: Should retry
    decision = shouldMarkFailed('running', 2, envelope);
    expect(decision.shouldFail).toBe(false);

    // Attempt 3: Dead-letter (max attempts)
    decision = shouldMarkFailed('running', 3, envelope);
    expect(decision.shouldFail).toBe(true);
    expect(decision.reason).toBe('max_attempts');
  });

  test('Scenario: Immediate failure on invalid_api_key', () => {
    const envelope: FailureEnvelope = {
      provider: 'anthropic',
      code: 'AUTH_FAILED',
      message: 'Invalid API key',
      retryable: false,
    } as FailureEnvelope;

    // Attempt 1: Immediate dead-letter
    const decision = shouldMarkFailed('running', 1, envelope);
    expect(decision.shouldFail).toBe(true);
    expect(decision.reason).toBe('non_retryable');
  });

  test('Scenario: Idempotent dead-letter check prevents re-processing', () => {
    const envelope: FailureEnvelope = {
      provider: 'openai',
      code: 'AUTH_FAILED',
      message: 'Auth failure',
      retryable: false,
    } as FailureEnvelope;

    // Job already marked failed
    const decision = shouldMarkFailed('failed', 5, envelope);
    expect(decision.shouldFail).toBe(true);
    expect(decision.reason).toBe('already_failed');
    
    // Even with 5 attempts and non-retryable error, idempotent check prevents re-processing
  });
});
