/**
 * Processor failure taxonomy regression contract.
 *
 * Purpose: prevent silent regressions in the failure-code classification that
 * gates whether a job is rescued by selfRecoverRetryableFailedJobs or is
 * permanently stuck as terminal.
 *
 * Rules enforced (from processor.ts doctrine):
 *  1. Terminal codes → no self-recovery retries.
 *  2. Transient codes → at least 1 self-recovery retry (maxSelfRecoveryAttemptsForFailureCode > 0).
 *  3. Bucket classification must be consistent with retryability.
 *  4. `LLR_PRE_ARTIFACT_GENERATION_BLOCK` is explicitly rescuable despite the LLR_ prefix.
 *  5. PASS3_FAILED is terminal (legacy path; deterministic on retry).
 *  6. PASS1_FAILED and PASS2_FAILED are NOT terminal (provider transient; retry allowed).
 *  7. All TIMEOUT variants are retryable.
 *  8. Non-kick-eligible QG_ codes are terminal. Kick-eligible QG_ codes get 1 backward kick per FIPOC KICK_MATRIX.
 */

import {
  isTerminalFailureCode,
  maxSelfRecoveryAttemptsForFailureCode,
  classifyFailureBucket,
  isSelfRecoverableFailureCode,
  isKickEligibleFailureCode,
} from '@/lib/evaluation/processor';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isRescuable(code: string): boolean {
  return !isTerminalFailureCode(code) && maxSelfRecoveryAttemptsForFailureCode(code) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// TERMINAL codes — must never auto-retry
// ─────────────────────────────────────────────────────────────────────────────

describe('Terminal failure codes — must not auto-retry', () => {
  const terminalCodes = [
    // Quality gate — content-driven; retrying produces identical failure
    // NOTE: kick-eligible QG codes (QG_DUPLICATE_REC, QG_MISSING_RATIONALE, etc.)
    // are NOT terminal — they get 1 FIPOC backward kick. Only generic QG codes remain terminal.
    'QG_FAILED',
    'QG_SCORE_TOO_LOW',
    'QG_CRITERION_INVALID',
    'QG_SUMMARY_MISMATCH',
    'QG_STRUCTURAL_FAIL',

    // Governance / policy violations — deterministic code-level failures
    'POLICY_VIOLATION',
    'POLICY_VIOLATION: pass12_handoff_v1 gate check failed',
    'LLR_BLOCK',
    'LLR_PRE_PASS1_BLOCK',

    // Pass 4 / Perplexity content-driven failures
    'PASS4_CANON_INVALID',
    'PASS4_WEAK_AGREEMENT',
    'PASS4_REFUSAL_EXHAUSTED',
    'PASS4_GOVERNANCE_FAILED',
    'PASS4_SCHEMA_INVALID',
    'PASS4_EXTERNAL_ADJUDICATION_MISSING_KEY',

    // Deterministic pipeline failures
    'PASS3_FAILED',
    'PASS2_INDEPENDENCE_REWRITE_FAILED',
    // TEMPLATE_COMPLETENESS_GATE_FAILED moved to kick-eligible (FIPOC KICK_MATRIX)
    'SCOPE_CLASSIFICATION_FAILED',
    'MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE',
    'CHUNK_BUDGET_OVERFLOW',
    'PIPELINE_INPUT_INVALID',
    'SCHEMA_INVALID',
    'SCHEMA_VIOLATION',
    'SCHEMA_VALIDATION_FAILED',
    'MANUSCRIPT_NOT_FOUND',
    'AUTH_FAILED',
    'AUTHORIZATION_ERROR',
    'QUOTA_EXCEEDED',
    'INVALID_INPUT',
    'EVALUATION_GATE_REJECTED',

    // Lifecycle — terminal by design
    'USER_CANCELLED',
    'REVIEW_GATE_REJECTED_BY_AUTHOR',
    'TECHNICAL_FAILURE_REQUIRES_REVIEW',
  ] as const;

  for (const code of terminalCodes) {
    it(`isTerminalFailureCode('${code}') → true`, () => {
      expect(isTerminalFailureCode(code)).toBe(true);
    });

    it(`maxSelfRecoveryAttemptsForFailureCode('${code}') → 0`, () => {
      expect(maxSelfRecoveryAttemptsForFailureCode(code)).toBe(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESCUABLE codes — must allow at least one self-recovery attempt
// ─────────────────────────────────────────────────────────────────────────────

describe('Rescuable failure codes — must allow at least one self-recovery attempt', () => {
  const rescuableCodes = [
    // Provider timeouts — transient; new attempt gets a fresh request
    'PASS1_TIMEOUT',
    'PASS2_TIMEOUT',
    'PASS3_TIMEOUT',
    'WORKER_TIMEOUT',

    // Pass 1+2 failures from OpenAI — provider transient
    'PASS1_FAILED',
    'PASS2_FAILED',
    'PHASE2_PASS12_FAILED',

    // Platform lease/claim transient failures
    'LEASE_EXPIRED',
    'PROCESSOR_UNCAUGHT_ERROR',

    // Handoff gate — gets exactly one retry (S06b policy)
    'HANDOFF_GATE_FAILED',
    'HANDOFF_SCHEMA_INVALID',

    // LLR exception: pre-artifact-generation block IS rescuable despite LLR_ prefix
    'LLR_PRE_ARTIFACT_GENERATION_BLOCK',
  ] as const;

  for (const code of rescuableCodes) {
    it(`isTerminalFailureCode('${code}') → false`, () => {
      expect(isTerminalFailureCode(code)).toBe(false);
    });

    it(`maxSelfRecoveryAttemptsForFailureCode('${code}') > 0`, () => {
      expect(maxSelfRecoveryAttemptsForFailureCode(code)).toBeGreaterThan(0);
    });

    it(`isRescuable('${code}') → true`, () => {
      expect(isRescuable(code)).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-recovery attempt COUNTS — specific policy assertions
// ─────────────────────────────────────────────────────────────────────────────

describe('Self-recovery attempt count policy', () => {
  it('HANDOFF_ codes get exactly 1 retry (S06b policy)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('HANDOFF_GATE_FAILED')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('HANDOFF_SCHEMA_INVALID')).toBe(1);
  });

  it('PROCESSOR_UNCAUGHT_ERROR gets 2 retries', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('PROCESSOR_UNCAUGHT_ERROR')).toBe(2);
  });

  it('LEASE_EXPIRED gets 3 retries (platform transient)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('LEASE_EXPIRED')).toBe(3);
  });

  it('WORKER_TIMEOUT gets 3 retries (platform transient)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('WORKER_TIMEOUT')).toBe(3);
  });

  it('OPENAI_* prefix codes get 3 retries (provider transient)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('OPENAI_RATE_LIMITED')).toBe(3);
    expect(maxSelfRecoveryAttemptsForFailureCode('OPENAI_SERVER_ERROR')).toBe(3);
  });

  it('PASS*_TIMEOUT codes get 3 retries (provider timeout transient)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('PASS1_TIMEOUT')).toBe(3);
    expect(maxSelfRecoveryAttemptsForFailureCode('PASS2_TIMEOUT')).toBe(3);
    expect(maxSelfRecoveryAttemptsForFailureCode('PASS3_TIMEOUT')).toBe(3);
  });

  it('terminal codes always get 0 retries regardless of category', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_FAILED')).toBe(0);
    expect(maxSelfRecoveryAttemptsForFailureCode('PASS3_FAILED')).toBe(0);
    expect(maxSelfRecoveryAttemptsForFailureCode('USER_CANCELLED')).toBe(0);
  });

  it('FIPOC kick-eligible codes get exactly 1 retry (backward kick budget)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('TEMPLATE_COMPLETENESS_GATE_FAILED')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_DUPLICATE_REC')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_MISSING_RATIONALE')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_MISSING_EVIDENCE')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_DENSITY_FLOOR_VIOLATION')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_ARTIFACT_GATE_FAIL')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_PITCH_IDENTITY_DUPLICATE')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_EVIDENCE_FABRICATION')).toBe(1);
  });

  it('null/undefined code defaults to 2 retries (conservative unknown-error policy)', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode(null)).toBe(2);
    expect(maxSelfRecoveryAttemptsForFailureCode(undefined)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bucket classification consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyFailureBucket — bucket assignment contract', () => {
  it('QG_ codes route to app_logic bucket (content-driven, not infra)', () => {
    expect(classifyFailureBucket('QG_FAILED')).toBe('app_logic');
    expect(classifyFailureBucket('QG_SCORE_TOO_LOW')).toBe('app_logic');
  });

  it('PASS1_FAILED and PASS2_FAILED route to openai_provider bucket', () => {
    expect(classifyFailureBucket('PASS1_FAILED')).toBe('openai_provider');
    expect(classifyFailureBucket('PASS2_FAILED')).toBe('openai_provider');
  });

  it('PASS*_TIMEOUT codes route to openai_provider bucket', () => {
    expect(classifyFailureBucket('PASS1_TIMEOUT')).toBe('openai_provider');
    expect(classifyFailureBucket('PASS2_TIMEOUT')).toBe('openai_provider');
    expect(classifyFailureBucket('PASS3_TIMEOUT')).toBe('openai_provider');
  });

  it('PASS3_FAILED routes to openai_provider bucket (legacy terminal via prefix list, not bucket)', () => {
    // bucket is openai_provider but isTerminalFailureCode still returns true
    // because TERMINAL_FAILURE_PREFIXES check is independent of bucket
    expect(classifyFailureBucket('PASS3_FAILED')).toBe('openai_provider');
    expect(isTerminalFailureCode('PASS3_FAILED')).toBe(true);
  });

  it('PHASE2_PASS12_FAILED routes to openai_provider bucket and remains self-recoverable', () => {
    expect(classifyFailureBucket('PHASE2_PASS12_FAILED')).toBe('openai_provider');
    expect(isTerminalFailureCode('PHASE2_PASS12_FAILED')).toBe(false);
    expect(isSelfRecoverableFailureCode('PHASE2_PASS12_FAILED')).toBe(true);
  });

  it('PASS4_* non-infra codes route to perplexity_adjudication bucket', () => {
    expect(classifyFailureBucket('PASS4_REFUSAL_EXHAUSTED')).toBe('perplexity_adjudication');
    expect(classifyFailureBucket('PASS4_CANON_INVALID')).toBe('perplexity_adjudication');
    expect(classifyFailureBucket('PASS4_EXTERNAL_ADJUDICATION_FAILED')).toBe('perplexity_adjudication');
  });

  it('PASS4_EXTERNAL_ADJUDICATION_FAILED is not terminal (network error — retryable)', () => {
    // This is a Perplexity API error (network unreachable), not a content refusal
    expect(isTerminalFailureCode('PASS4_EXTERNAL_ADJUDICATION_FAILED')).toBe(false);
    expect(maxSelfRecoveryAttemptsForFailureCode('PASS4_EXTERNAL_ADJUDICATION_FAILED')).toBeGreaterThan(0);
  });

  it('ARTIFACT_PERSISTENCE_FAILED routes to supabase_contract bucket', () => {
    expect(classifyFailureBucket('ARTIFACT_PERSISTENCE_FAILED')).toBe('supabase_contract');
  });

  it('LEASE_EXPIRED and WORKER_TIMEOUT route to vercel_platform bucket', () => {
    expect(classifyFailureBucket('LEASE_EXPIRED')).toBe('vercel_platform');
    expect(classifyFailureBucket('WORKER_TIMEOUT')).toBe('vercel_platform');
  });

  it('unknown/null codes default to app_logic bucket', () => {
    expect(classifyFailureBucket(null)).toBe('app_logic');
    expect(classifyFailureBucket(undefined)).toBe('app_logic');
    expect(classifyFailureBucket('')).toBe('app_logic');
    expect(classifyFailureBucket('COMPLETELY_UNKNOWN_CODE')).toBe('app_logic');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases and prefix matching
// ─────────────────────────────────────────────────────────────────────────────

describe('Prefix-matching edge cases', () => {
  it('non-kick-eligible QG_ prefixed codes are terminal — prefix match', () => {
    expect(isTerminalFailureCode('QG_')).toBe(true);
    expect(isTerminalFailureCode('QG_CUSTOM_FAILURE_2026')).toBe(true);
    expect(isTerminalFailureCode('QG_ARBITRARY_FUTURE_CODE')).toBe(true);
  });

  it('kick-eligible QG_ codes are NOT terminal — FIPOC override', () => {
    expect(isTerminalFailureCode('QG_DUPLICATE_REC')).toBe(false);
    expect(isTerminalFailureCode('QG_MISSING_RATIONALE')).toBe(false);
    expect(isTerminalFailureCode('QG_MISSING_EVIDENCE')).toBe(false);
    expect(isTerminalFailureCode('QG_DENSITY_FLOOR_VIOLATION')).toBe(false);
    expect(isTerminalFailureCode('QG_ARTIFACT_GATE_FAIL')).toBe(false);
    expect(isTerminalFailureCode('QG_PITCH_IDENTITY_DUPLICATE')).toBe(false);
    expect(isTerminalFailureCode('QG_EVIDENCE_FABRICATION')).toBe(false);
  });

  it('any POLICY_VIOLATION prefixed code is terminal', () => {
    expect(isTerminalFailureCode('POLICY_VIOLATION')).toBe(true);
    expect(isTerminalFailureCode('POLICY_VIOLATION: some detail')).toBe(true);
  });

  it('LLR_ prefix is generally terminal but LLR_PRE_ARTIFACT_GENERATION_BLOCK is explicitly exempted', () => {
    expect(isTerminalFailureCode('LLR_BLOCK')).toBe(true);
    expect(isTerminalFailureCode('LLR_PRE_ARTIFACT_GENERATION_BLOCK')).toBe(false);
  });

  it('SCHEMA_INVALID and SCHEMA_VIOLATION are terminal (exact prefix entries)', () => {
    expect(isTerminalFailureCode('SCHEMA_INVALID')).toBe(true);
    expect(isTerminalFailureCode('SCHEMA_VIOLATION')).toBe(true);
  });

  it('SCHEMA_VALIDATION_FAILED is terminal — aligned with lib/jobs/failures non-transient policy', () => {
    expect(isTerminalFailureCode('SCHEMA_VALIDATION_FAILED')).toBe(true);
    expect(maxSelfRecoveryAttemptsForFailureCode('SCHEMA_VALIDATION_FAILED')).toBe(0);
  });

  it('OPENAI_ prefix codes are NOT terminal — provider transient', () => {
    expect(isTerminalFailureCode('OPENAI_RATE_LIMITED')).toBe(false);
    expect(isTerminalFailureCode('OPENAI_SERVER_ERROR')).toBe(false);
    expect(isTerminalFailureCode('OPENAI_TIMEOUT')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Governance anti-regression: codes that must NOT silently change category
// ─────────────────────────────────────────────────────────────────────────────

describe('Governance anti-regression: critical category invariants', () => {
  it('PASS1_TIMEOUT is rescuable — a new worker gets a fresh timeout budget', () => {
    expect(isRescuable('PASS1_TIMEOUT')).toBe(true);
  });

  it('PASS2_TIMEOUT is rescuable — same rationale as PASS1_TIMEOUT', () => {
    expect(isRescuable('PASS2_TIMEOUT')).toBe(true);
  });

  it('PASS3_TIMEOUT is rescuable — synthesis timeout is infra, not content', () => {
    expect(isRescuable('PASS3_TIMEOUT')).toBe(true);
  });

  it('PASS3_FAILED is TERMINAL — legacy code path; deterministic on retry (not infra)', () => {
    expect(isTerminalFailureCode('PASS3_FAILED')).toBe(true);
    expect(isRescuable('PASS3_FAILED')).toBe(false);
  });

  it('TEMPLATE_COMPLETENESS_GATE_FAILED is kick-eligible — FIPOC backward kick to re-synthesis', () => {
    expect(isTerminalFailureCode('TEMPLATE_COMPLETENESS_GATE_FAILED')).toBe(false);
    expect(isKickEligibleFailureCode('TEMPLATE_COMPLETENESS_GATE_FAILED')).toBe(true);
    expect(isRescuable('TEMPLATE_COMPLETENESS_GATE_FAILED')).toBe(true);
    expect(maxSelfRecoveryAttemptsForFailureCode('TEMPLATE_COMPLETENESS_GATE_FAILED')).toBe(1);
  });

  it('PASS2_INDEPENDENCE_REWRITE_FAILED is terminal — deterministic editorial failure', () => {
    expect(isTerminalFailureCode('PASS2_INDEPENDENCE_REWRITE_FAILED')).toBe(true);
    expect(isRescuable('PASS2_INDEPENDENCE_REWRITE_FAILED')).toBe(false);
  });

  it('QUOTA_EXCEEDED is terminal — requires admin action before any retry', () => {
    expect(isTerminalFailureCode('QUOTA_EXCEEDED')).toBe(true);
    expect(isRescuable('QUOTA_EXCEEDED')).toBe(false);
  });

  it('QG_FAILED retrying would produce the same result — terminal', () => {
    expect(isTerminalFailureCode('QG_FAILED')).toBe(true);
    expect(isRescuable('QG_FAILED')).toBe(false);
  });
});
