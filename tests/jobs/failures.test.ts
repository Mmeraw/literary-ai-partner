import {
  assertValidFailureCode,
  isNonTransientFailure,
  isTransientFailure,
} from '@/lib/jobs/failures';

describe('failure taxonomy', () => {
  test('recognizes transient codes narrowly', () => {
    expect(isTransientFailure('TRANSIENT_NETWORK')).toBe(true);
    expect(isTransientFailure('TRANSIENT_UPSTREAM')).toBe(true);
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
});
