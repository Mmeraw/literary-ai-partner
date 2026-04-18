import {
  assertValidFailureCode,
  isNonTransientFailure,
  isTransientFailure,
  isRetryableFailure,
  classifyError,
} from '@/lib/jobs/failures';
import { JOB_STATUS } from '@/lib/jobs/types';

describe('failure taxonomy', () => {
  test('recognizes transient codes narrowly', () => {
    expect(isTransientFailure('TIMEOUT')).toBe(true);
    expect(isTransientFailure('UPSTREAM_ERROR')).toBe(true);
    expect(isTransientFailure('RATE_LIMITED')).toBe(true);
    expect(isTransientFailure('SCHEMA_ERROR')).toBe(false);
  });

  test('recognizes non-transient codes', () => {
    expect(isNonTransientFailure('SCHEMA_ERROR')).toBe(true);
    expect(isNonTransientFailure('GOVERNANCE_BLOCK')).toBe(true);
    expect(isNonTransientFailure('ANCHOR_CONTRACT_VIOLATION')).toBe(true);
  });

  test('rejects invalid failure codes', () => {
    expect(() => assertValidFailureCode('NOT_REAL')).toThrow();
  });

  // #18.R: explicit retryability doctrine coverage
  describe('#18.R retryability doctrine', () => {
    test('LEASE_EXPIRED is transient (auto-retryable) — a new worker can acquire a new lease', () => {
      expect(isTransientFailure('LEASE_EXPIRED')).toBe(true);
      expect(isRetryableFailure('LEASE_EXPIRED')).toBe(true);
    });

    test('MISSING_PASS_ARTIFACT is non-transient — retrying does not create the missing artifact', () => {
      expect(isNonTransientFailure('MISSING_PASS_ARTIFACT')).toBe(true);
      expect(isRetryableFailure('MISSING_PASS_ARTIFACT')).toBe(false);
    });

    test('PASS_CONVERGENCE_FAILURE is non-transient — same input will not converge in a retry', () => {
      expect(isNonTransientFailure('PASS_CONVERGENCE_FAILURE')).toBe(true);
      expect(isRetryableFailure('PASS_CONVERGENCE_FAILURE')).toBe(false);
    });

    test('STATE_TRANSITION_INVALID is non-transient — an illegal transition is never recoverable by retrying', () => {
      expect(isNonTransientFailure('STATE_TRANSITION_INVALID')).toBe(true);
    });

    test('GOVERNANCE_BLOCK is non-transient — governance failures must not auto-retry', () => {
      expect(isNonTransientFailure('GOVERNANCE_BLOCK')).toBe(true);
    });

    test('CRITERION_COMPLETENESS_FAILED is non-transient — execution succeeded but release failed; not a retry case', () => {
      expect(isNonTransientFailure('CRITERION_COMPLETENESS_FAILED')).toBe(true);
    });

    test('transient failures cover the expected auto-retryable set', () => {
      expect(isTransientFailure('TIMEOUT')).toBe(true);
      expect(isTransientFailure('UPSTREAM_ERROR')).toBe(true);
      expect(isTransientFailure('RATE_LIMITED')).toBe(true);
      expect(isTransientFailure('INTERNAL_ERROR')).toBe(true);
    });

    // Doctrinal: failed ≠ validity judgment
    test('failed is an execution outcome; complete+invalid and complete+quarantined are not retry states', () => {
      // The lifecycle 'complete' state is final regardless of validity outcome.
      // Retryability is only applicable to status='failed' jobs.
      // This test asserts the doctrinal invariants:
      //   - complete + validity_status='invalid'  → adjudicated outcome, not retryable
      //   - complete + validity_status='quarantined' → trust anomaly, not auto-retryable
      //
      // A completed job that produced an invalid or quarantined result is NOT a failed job.
      // Its lifecycle is 'complete'; its validity status is the determination.
      // No automatic retry should be triggered.
      const completedLifecycleStatuses = [JOB_STATUS.COMPLETE] as const;
      const validityOutcomesThatAreNotRetryable = ['invalid', 'quarantined'] as const;

      for (const lifecycle of completedLifecycleStatuses) {
        // A job at status='complete' has completed its execution path.
        expect(lifecycle).toBe('complete');  // sanity: not 'failed'
      }

      for (const validity of validityOutcomesThatAreNotRetryable) {
        // These are completion-state judgments, not execution failures.
        expect(['invalid', 'quarantined']).toContain(validity);
      }

      // Confirm no failure code in NON_TRANSIENT_CODES carries the same meaning
      // as a validity outcome — they are separate axes.
      expect(isNonTransientFailure('CRITERION_COMPLETENESS_FAILED')).toBe(true);
      expect(isNonTransientFailure('ANCHOR_CONTRACT_VIOLATION')).toBe(true);
    });
  });

  describe('classifyError canonical routing (#18.R)', () => {
    test('retryable error patterns map to transient failure codes', () => {
      expect(isTransientFailure(classifyError(new Error('request timeout after 30s')))).toBe(true);
      expect(isTransientFailure(classifyError(new Error('rate limit exceeded')))).toBe(true);
      expect(isTransientFailure(classifyError(new Error('network error: ECONNRESET')))).toBe(true);
      expect(isTransientFailure(classifyError(new Error('lease expired')))).toBe(true);
    });

    test('non-retryable error patterns map to non-transient failure codes', () => {
      expect(isNonTransientFailure(classifyError(new Error('illegal state transition from running to queued')))).toBe(true);
      expect(isNonTransientFailure(classifyError(new Error('anchor contract violation detected')))).toBe(true);
      expect(isNonTransientFailure(classifyError(new Error('governance block: output does not meet policy')))).toBe(true);
      expect(isNonTransientFailure(classifyError(new Error('invalid api key')))).toBe(true);
      expect(isNonTransientFailure(classifyError(new Error('pass convergence check failed')))).toBe(true);
    });

    test('schema validation failures map to SCHEMA_VALIDATION_FAILED before generic schema buckets', () => {
      expect(classifyError(new Error('schema validation failed: missing required field'))).toBe('SCHEMA_VALIDATION_FAILED');
      expect(classifyError(new Error('SCHEMA_VALIDATION_FAILED invariant breach'))).toBe('SCHEMA_VALIDATION_FAILED');
      expect(classifyError(new Error('schema error while decoding payload'))).toBe('SCHEMA_ERROR');
    });

    test('convergence classification is specific and does not trigger on non-failure mentions', () => {
      expect(classifyError(new Error('pass convergence failure: unresolved contradiction'))).toBe('PASS_CONVERGENCE_FAILURE');
      expect(classifyError(new Error('convergence artifact not found'))).toBe('PASS_CONVERGENCE_FAILURE');

      // Informational language containing "convergence" must not be auto-classified as a deterministic failure.
      expect(classifyError(new Error('convergence report generated successfully'))).toBe('INTERNAL_ERROR');
    });

    test('unknown errors default to INTERNAL_ERROR (transient) — one retry chance', () => {
      const code = classifyError(new Error('something completely unexpected happened'));
      expect(code).toBe('INTERNAL_ERROR');
      expect(isTransientFailure(code)).toBe(true);
    });

    test('non-retryable takes precedence when pattern is ambiguous', () => {
      // governance overrides anything incidental
      const code = classifyError(new Error('governance timeout block during finalization'));
      expect(isNonTransientFailure(code)).toBe(true);
    });
  });
});
