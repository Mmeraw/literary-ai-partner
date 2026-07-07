/**
 * RARA Block 2 PR-1: Focused tests proving CLAIM_RPC_FAILED and DB_WRITE_FAILED
 * are emitted by classifyError() and route through existing retry/terminal behavior.
 */

import { describe, test, expect } from '@jest/globals';
import {
  classifyError,
  isTransientFailure,
  isRetryableFailureCode,
  assertValidFailureCode,
} from '../../../lib/jobs/failures';

describe('CLAIM_RPC_FAILED classification', () => {
  test('classifyError recognises batch claim RPC failure', () => {
    const error = new Error('claim_evaluation_jobs RPC failed: connection timeout');
    expect(classifyError(error)).toBe('CLAIM_RPC_FAILED');
  });

  test('classifyError recognises single-job claim RPC failure', () => {
    const error = new Error('claim_evaluation_job_by_id RPC failed: relation does not exist');
    expect(classifyError(error)).toBe('CLAIM_RPC_FAILED');
  });

  test('CLAIM_RPC_FAILED is a valid canonical failure code', () => {
    expect(() => assertValidFailureCode('CLAIM_RPC_FAILED')).not.toThrow();
  });

  test('CLAIM_RPC_FAILED is transient (retry-then-terminal)', () => {
    expect(isTransientFailure('CLAIM_RPC_FAILED')).toBe(true);
  });

  test('CLAIM_RPC_FAILED is retryable via isRetryableFailureCode', () => {
    expect(isRetryableFailureCode('CLAIM_RPC_FAILED')).toBe(true);
  });
});

describe('DB_WRITE_FAILED classification', () => {
  test('classifyError recognises ArtifactPersistence upsert failure', () => {
    const error = new Error(
      '[ArtifactPersistence] Upsert failed for job_id=abc123: statement timeout',
    );
    expect(classifyError(error)).toBe('DB_WRITE_FAILED');
  });

  test('classifyError recognises ArtifactPersistence retry exhaustion', () => {
    const error = new Error(
      '[ArtifactPersistence] Upsert exhausted 3 retries for job_id=abc123',
    );
    expect(classifyError(error)).toBe('DB_WRITE_FAILED');
  });

  test('classifyError recognises generic ArtifactPersistence error', () => {
    const error = new Error(
      '[ArtifactPersistence] Upsert returned null for job_id=abc123',
    );
    expect(classifyError(error)).toBe('DB_WRITE_FAILED');
  });

  test('DB_WRITE_FAILED is a valid canonical failure code', () => {
    expect(() => assertValidFailureCode('DB_WRITE_FAILED')).not.toThrow();
  });

  test('DB_WRITE_FAILED is transient (retry-then-terminal)', () => {
    expect(isTransientFailure('DB_WRITE_FAILED')).toBe(true);
  });

  test('DB_WRITE_FAILED is retryable via isRetryableFailureCode', () => {
    expect(isRetryableFailureCode('DB_WRITE_FAILED')).toBe(true);
  });
});

describe('existing classifyError behavior preserved', () => {
  test('TIMEOUT still classified correctly', () => {
    expect(classifyError(new Error('request timeout'))).toBe('TIMEOUT');
  });

  test('UPSTREAM_ERROR still classified correctly', () => {
    expect(classifyError(new Error('ECONNRESET'))).toBe('UPSTREAM_ERROR');
  });

  test('RATE_LIMITED still classified correctly', () => {
    expect(classifyError(new Error('rate limit exceeded 429'))).toBe('RATE_LIMITED');
  });

  test('LEASE_EXPIRED still classified correctly', () => {
    expect(classifyError(new Error('lease expired'))).toBe('LEASE_EXPIRED');
  });

  test('INTERNAL_ERROR fallback still works for unknown errors', () => {
    expect(classifyError(new Error('something completely unexpected'))).toBe('INTERNAL_ERROR');
  });

  test('non-retryable codes still blocked', () => {
    expect(isTransientFailure('MAX_RETRIES_EXCEEDED')).toBe(false);
    expect(isTransientFailure('SCHEMA_VALIDATION_FAILED')).toBe(false);
    expect(isTransientFailure('GOVERNANCE_BLOCK')).toBe(false);
  });
});

describe('LEASE_OVERLAP_DETECTED inspection', () => {
  test('LEASE_OVERLAP_DETECTED is NOT a canonical runtime code (atomic RPC prevents double-claim)', () => {
    expect(() => assertValidFailureCode('LEASE_OVERLAP_DETECTED')).toThrow('Unknown failure code');
  });
});
