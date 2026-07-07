/**
 * RARA Block 2 PR-2 — Focused tests for SEED_GENERATION_FAILED,
 * WAVE_EXECUTION_TIMEOUT, and DREAM_TIMEOUT runtime taxonomy bridging.
 *
 * Each test proves:
 *   1. classifyError() emits the correct governance code for the failure pattern
 *   2. The code is a valid canonical FailureCode
 *   3. The code is transient (retryable via existing machinery)
 *
 * Regression guards ensure existing TIMEOUT, INTERNAL_ERROR, and
 * non-transient classification is not disturbed.
 */

import {
  classifyError,
  assertValidFailureCode,
  isTransientFailure,
  isRetryableFailure,
  isNonTransientFailure,
  isRetryableFailureCode,
  type FailureCode,
} from '../../../lib/jobs/failures';

// ── SEED_GENERATION_FAILED ─────────────────────────────────────────────────

describe('SEED_GENERATION_FAILED classification', () => {
  it('classifies PHASE05_SEMANTIC_SEED_GENERATION_INCOMPLETE', () => {
    const code = classifyError(new Error('PHASE05_SEMANTIC_SEED_GENERATION_INCOMPLETE'));
    expect(code).toBe('SEED_GENERATION_FAILED');
  });

  it('classifies seed generation failure message', () => {
    const code = classifyError(
      new Error('Phase 1A requires story_map_seed_v1 + evaluation_seed_v1 before chunk processing: seed generation timed out'),
    );
    expect(code).toBe('SEED_GENERATION_FAILED');
  });

  it('classifies SEED_ARTIFACT_READ_FAILED', () => {
    const code = classifyError(new Error('SEED_ARTIFACT_READ_FAILED: connection refused'));
    expect(code).toBe('SEED_GENERATION_FAILED');
  });

  it('classifies SEED_FIT_GAP_BLOCKED', () => {
    const code = classifyError(new Error('SEED_FIT_GAP_BLOCKED: missing 3 criteria'));
    expect(code).toBe('SEED_GENERATION_FAILED');
  });

  it('is a valid canonical FailureCode', () => {
    expect(() => assertValidFailureCode('SEED_GENERATION_FAILED')).not.toThrow();
  });

  it('is transient (retryable)', () => {
    expect(isTransientFailure('SEED_GENERATION_FAILED')).toBe(true);
    expect(isRetryableFailure('SEED_GENERATION_FAILED')).toBe(true);
    expect(isNonTransientFailure('SEED_GENERATION_FAILED')).toBe(false);
  });

  it('passes isRetryableFailureCode runtime check', () => {
    expect(isRetryableFailureCode('SEED_GENERATION_FAILED')).toBe(true);
  });
});

// ── WAVE_EXECUTION_TIMEOUT ─────────────────────────────────────────────────

describe('WAVE_EXECUTION_TIMEOUT classification', () => {
  it('classifies WAVE_TIMEOUT error (Promise.race rejection)', () => {
    const code = classifyError(new Error('WAVE_TIMEOUT'));
    expect(code).toBe('WAVE_EXECUTION_TIMEOUT');
  });

  it('classifies wave execution timeout message', () => {
    const code = classifyError(new Error('WAVE execution timeout after 60000ms'));
    expect(code).toBe('WAVE_EXECUTION_TIMEOUT');
  });

  it('is a valid canonical FailureCode', () => {
    expect(() => assertValidFailureCode('WAVE_EXECUTION_TIMEOUT')).not.toThrow();
  });

  it('is transient (retryable)', () => {
    expect(isTransientFailure('WAVE_EXECUTION_TIMEOUT')).toBe(true);
    expect(isRetryableFailure('WAVE_EXECUTION_TIMEOUT')).toBe(true);
    expect(isNonTransientFailure('WAVE_EXECUTION_TIMEOUT')).toBe(false);
  });

  it('passes isRetryableFailureCode runtime check', () => {
    expect(isRetryableFailureCode('WAVE_EXECUTION_TIMEOUT')).toBe(true);
  });
});

// ── DREAM_TIMEOUT ──────────────────────────────────────────────────────────

describe('DREAM_TIMEOUT classification', () => {
  it('classifies DreamWorker timeout error', () => {
    const code = classifyError(new Error('[DreamWorker] job-123: DREAM synthesis timeout after 750000ms'));
    expect(code).toBe('DREAM_TIMEOUT');
  });

  it('classifies DREAM evaluation timeout', () => {
    const code = classifyError(new Error('DREAM evaluation timed out'));
    expect(code).toBe('DREAM_TIMEOUT');
  });

  it('classifies dream synthesis timeout', () => {
    const code = classifyError(new Error('dream synthesis timeout'));
    expect(code).toBe('DREAM_TIMEOUT');
  });

  it('does NOT classify non-dream timeout as DREAM_TIMEOUT', () => {
    const code = classifyError(new Error('OpenAI request timeout'));
    expect(code).not.toBe('DREAM_TIMEOUT');
    expect(code).toBe('TIMEOUT');
  });

  it('is a valid canonical FailureCode', () => {
    expect(() => assertValidFailureCode('DREAM_TIMEOUT')).not.toThrow();
  });

  it('is transient (retryable)', () => {
    expect(isTransientFailure('DREAM_TIMEOUT')).toBe(true);
    expect(isRetryableFailure('DREAM_TIMEOUT')).toBe(true);
    expect(isNonTransientFailure('DREAM_TIMEOUT')).toBe(false);
  });

  it('passes isRetryableFailureCode runtime check', () => {
    expect(isRetryableFailureCode('DREAM_TIMEOUT')).toBe(true);
  });
});

// ── Regression guards ──────────────────────────────────────────────────────

describe('Regression: existing classification unchanged', () => {
  it('generic timeout still returns TIMEOUT', () => {
    expect(classifyError(new Error('Request timeout'))).toBe('TIMEOUT');
  });

  it('OpenAI timeout returns TIMEOUT (not WAVE or DREAM)', () => {
    expect(classifyError(new Error('OpenAI API timeout'))).toBe('TIMEOUT');
  });

  it('rate limit returns RATE_LIMITED', () => {
    expect(classifyError(new Error('rate limit exceeded'))).toBe('RATE_LIMITED');
  });

  it('unknown error returns INTERNAL_ERROR', () => {
    expect(classifyError(new Error('something unexpected happened'))).toBe('INTERNAL_ERROR');
  });

  it('non-transient codes remain non-transient', () => {
    const terminalCodes: FailureCode[] = [
      'EVALUATION_GATE_REJECTED',
      'SCHEMA_VALIDATION_FAILED',
      'STATE_TRANSITION_INVALID',
      'GOVERNANCE_BLOCK',
    ];
    for (const code of terminalCodes) {
      expect(isTransientFailure(code)).toBe(false);
      expect(isRetryableFailure(code)).toBe(false);
    }
  });

  it('WAVE_ERROR (non-timeout) does NOT classify as WAVE_EXECUTION_TIMEOUT', () => {
    expect(classifyError(new Error('WAVE_ERROR: createRevisionSession failed'))).not.toBe('WAVE_EXECUTION_TIMEOUT');
  });

  it('DREAM synthesis failed (non-timeout) does NOT classify as DREAM_TIMEOUT', () => {
    expect(classifyError(new Error('DREAM synthesis failed: invalid schema'))).not.toBe('DREAM_TIMEOUT');
  });
});
