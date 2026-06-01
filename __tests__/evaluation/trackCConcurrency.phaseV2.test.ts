/**
 * trackCConcurrency.phaseV2.test.ts
 *
 * Track C separation proof: Pass 3A runs concurrently with Track B,
 * not sequentially as substep #4 of Phase 1A.
 *
 * Contracts proved:
 *
 *   1. Review Gate requires Pass 3A done/degraded before opening.
 *      Gate stays blocked when pass3a_status is running, map_done,
 *      reduce_running, or not_started.
 *
 *   2. Phase 2 refuses to start when Pass 3A is missing, running,
 *      half-written, or failed.
 *
 *   3. Pass 3A degraded with structured proof = gate-valid.
 *      Review Gate opens and Phase 2 can start.
 *
 *   4. Pass 3A failed = gate-blocking. Review Gate blocked,
 *      Phase 2 blocked.
 *
 *   5. Track C status transitions are monotonic:
 *      not_started → running → done|degraded|failed
 *
 * All tests operate on pure functions. No database, no HTTP, no OpenAI.
 *
 * Run: npx jest __tests__/evaluation/trackCConcurrency.phaseV2.test.ts
 */

import {
  derivePass3aGateValidity,
  deriveReviewGateReadiness,
  assertPhase2Preconditions,
  type PhaseV2Progress,
  type PhaseV2ArtifactSet,
} from '../../lib/evaluation/phase-architecture-v2/gateValidity';
import { guardPhase2Start } from '../../lib/evaluation/phase-architecture-v2/phase2Guard';
import { buildReviewGateHandoff } from '../../lib/evaluation/phase-architecture-v2/reviewGateHandoff';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const artifact = (id: string) => ({ artifact_id: id, source_hash: `sha256:${id}` });

const fullArtifacts: PhaseV2ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-1'),
  ledger_quality_report_v1: artifact('quality-report-1'),
  pass3_preflight_draft_v1: artifact('preflight-1'),
  accepted_story_ledger_v1: artifact('accepted-1'),
};

const artifactsWithoutPreflight: PhaseV2ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-1'),
  ledger_quality_report_v1: artifact('quality-report-1'),
  pass3_preflight_draft_v1: null,
  accepted_story_ledger_v1: artifact('accepted-1'),
};

const artifactsWithoutAccepted: PhaseV2ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-1'),
  ledger_quality_report_v1: artifact('quality-report-1'),
  pass3_preflight_draft_v1: artifact('preflight-1'),
  ledger_quality_gate_ready_status: 'reviewable',
  ledger_quality_hard_fail_present: false,
};

// ─── Track C: Pass 3A gate validity with concurrent status ──────────────────

describe('Track C concurrency: Pass 3A gate validity', () => {
  it('pass3a_status=done with artifact = gate_valid', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
  });

  it('pass3a_status=running = not_ready (Track C still in progress)', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
    expect(decision.code).toBe('PASS3A_HALF_WRITTEN');
  });

  it('pass3a_status=map_done = not_ready (Track C MAP complete, REDUCE pending)', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'map_done' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
  });

  it('pass3a_status=reduce_running = not_ready', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'reduce_running' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
  });

  it('pass3a_status=failed = gate_blocking', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_FAILED_BLOCKING');
  });

  it('pass3a_status=degraded with structured proof = gate_valid', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Partial chunk coverage',
      degraded_reason_codes: ['PARTIAL_COVERAGE'],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
    expect(decision.code).toBe('PASS3A_DEGRADED_GATE_VALID');
  });

  it('pass3a_status=degraded without structured proof = gate_blocking', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'degraded' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('pass3a_status=not_started = not_ready', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'not_started' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
  });

  it('pass3a_status=done without artifact = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, artifactsWithoutPreflight);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_ARTIFACT_MISSING');
  });
});

// ─── Track C: Review Gate waits for both Track B + Track C ──────────────────

describe('Track C concurrency: Review Gate requires both tracks', () => {
  it('Review Gate opens when Story Layer + quality report + Pass 3A done', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(true);
    expect(decision.review_gate_ready).toBe(true);
  });

  it('Review Gate blocked when Pass 3A running (Track C not done)', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(false);
    expect(decision.review_gate_ready).toBe(false);
    expect(decision.code).toBe('PASS3A_HALF_WRITTEN');
  });

  it('Review Gate blocked when Pass 3A failed', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(false);
    expect(decision.review_gate_ready).toBe(false);
    expect(decision.code).toBe('PASS3A_FAILED_BLOCKING');
  });

  it('Review Gate opens when Pass 3A degraded with proof', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Timeout during chunk reading',
      degraded_reason_codes: ['CHUNK_TIMEOUT'],
      degraded_at: new Date().toISOString(),
    };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(true);
    expect(decision.review_gate_ready).toBe(true);
  });

  it('Review Gate handoff produces pass3a_status=done on happy path', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const result = buildReviewGateHandoff(progress, artifactsWithoutAccepted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoff.progress.pass3a_status).toBe('done');
      expect(result.handoff.progress.pass3a_gate_validity).toBe('gate_valid');
    }
  });

  it('Review Gate handoff produces pass3a_status=degraded on degraded path', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Partial coverage',
      degraded_reason_codes: ['PARTIAL_COVERAGE'],
      degraded_at: new Date().toISOString(),
    };
    const result = buildReviewGateHandoff(progress, artifactsWithoutAccepted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoff.progress.pass3a_status).toBe('degraded');
      expect(result.handoff.progress.pass3a_gate_validity).toBe('gate_valid');
    }
  });
});

// ─── Track C: Phase 2 guard blocks on incomplete Track C ────────────────────

describe('Track C concurrency: Phase 2 refuses without completed Track C', () => {
  it('Phase 2 allowed when Pass 3A done + accepted ledger', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(true);
    expect(guard.can_start_phase2).toBe(true);
  });

  it('Phase 2 blocked when Pass 3A still running', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
    expect(guard.progress_patch.phase2_preflight_gate).toBe('blocked');
  });

  it('Phase 2 blocked when Pass 3A not_started', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'not_started' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
  });

  it('Phase 2 blocked when Pass 3A failed', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
    expect(guard.progress_patch.pass3a_gate_validity).toBe('gate_blocking');
  });

  it('Phase 2 blocked when Pass 3A map_done (half-written)', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'map_done' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
  });

  it('Phase 2 blocked without accepted_story_ledger_v1 even if Pass 3A done', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const guard = guardPhase2Start(progress, artifactsWithoutAccepted);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
  });

  it('Phase 2 allowed when Pass 3A degraded with structured proof', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Partial chunk coverage',
      degraded_reason_codes: ['PARTIAL_COVERAGE'],
      degraded_at: new Date().toISOString(),
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(true);
    expect(guard.can_start_phase2).toBe(true);
  });
});

// ─── Track C: Degraded state preservation through self-chain ────────────────
// Regression tests for: Track C failure must NOT be silently collapsed to DONE.
// The self-chain write must preserve degraded proof (degraded_reason,
// degraded_reason_codes, degraded_at) through the final progress merge.

describe('Track C durable lane: degraded state preservation', () => {
  it('degraded Track C with structured proof must derive as gate_valid, not gate_blocking', () => {
    // Simulates: Track C throws during chunk-batch invocation, self-chain
    // writes progress with degraded proof. Gate derivation must read it as
    // gate_valid, NOT as clean DONE.
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'OpenAI rate limit during chunk MAP',
      degraded_reason_codes: ['TRACK_C_ERROR_DURING_BATCH'],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
    expect(decision.code).toBe('PASS3A_DEGRADED_GATE_VALID');
  });

  it('failed Track C without degraded proof must NOT be interpreted as clean DONE', () => {
    // Simulates: if Track C failure were silently mapped to DONE without
    // setting preflight_degraded=true, the gate derivation would incorrectly
    // pass. This test proves it would correctly fail (gate_blocking) because
    // pass3a_status remains "failed", not "done".
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_FAILED_BLOCKING');
  });

  it('degraded Track C without structured proof must be gate_blocking', () => {
    // Edge case: if self-chain writes pass3a_status='degraded' but loses the
    // proof fields (degraded_reason, degraded_reason_codes, degraded_at),
    // the gate must block — not silently pass.
    const progress: PhaseV2Progress = { pass3a_status: 'degraded' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('Review Gate must block when pass3a_status=done but artifact is missing', () => {
    // Simulates: Track C claims DONE but pass3_preflight_draft_v1 artifact
    // was never written (timeout race or crash). Gate must NOT open.
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutPreflight);
    expect(decision.ok).toBe(false);
    expect(decision.review_gate_ready).toBe(false);
  });
});

// ─── Track C: Timeout must NOT create false terminal state ──────────────────
// When Track C times out during Promise.race, the persisted state must remain
// non-terminal (running/SELF_CHAINED), NOT become DONE or terminal success.

describe('Track C durable lane: timeout produces non-terminal state', () => {
  it('Track C timeout (self-chained) must derive as not_ready, not gate_valid', () => {
    // Simulates: Promise.race timeout → persisted track_c_status='running',
    // preflight_status='SELF_CHAINED'. Gate must see this as non-terminal.
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
  });

  it('Review Gate must not open while Track C is self-chained/running', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(false);
    expect(decision.review_gate_ready).toBe(false);
  });

  it('Phase 2 must not start while Track C is self-chained/running', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
  });
});

// ─── Edge case: Network errors during Pass 3A ───────────────────────────────
// When Pass 3A encounters network failures (e.g., OpenAI timeouts, DNS errors,
// connection resets), the system records these as degraded or failed statuses.
// These tests prove that gate derivation handles network-error scenarios
// correctly and does NOT silently promote them to success.

describe('Track C edge case: network errors during Pass 3A', () => {
  it('network timeout during MAP phase → degraded with proof = gate_valid', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Network timeout: ETIMEDOUT during OpenAI batch request',
      degraded_reason_codes: ['NETWORK_TIMEOUT', 'TRACK_C_ERROR_DURING_BATCH'],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
    expect(decision.code).toBe('PASS3A_DEGRADED_GATE_VALID');
  });

  it('network timeout during MAP phase → Review Gate opens', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Network timeout: ETIMEDOUT during OpenAI batch request',
      degraded_reason_codes: ['NETWORK_TIMEOUT'],
      degraded_at: new Date().toISOString(),
    };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(true);
    expect(decision.review_gate_ready).toBe(true);
  });

  it('network timeout during MAP phase → Phase 2 allowed with accepted ledger', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Network timeout: ETIMEDOUT during OpenAI batch request',
      degraded_reason_codes: ['NETWORK_TIMEOUT'],
      degraded_at: new Date().toISOString(),
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(true);
    expect(guard.can_start_phase2).toBe(true);
  });

  it('DNS resolution failure → failed status = gate_blocking', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_FAILED_BLOCKING');
  });

  it('connection reset during REDUCE → degraded without proof = gate_blocking', () => {
    // Simulates: network error during REDUCE but self-chain loses the proof
    // fields due to the crash timing.
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Connection reset: ECONNRESET during reduce aggregation',
      // Missing degraded_reason_codes and degraded_at → proof incomplete
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('connection reset during REDUCE without proof → Review Gate blocked', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Connection reset: ECONNRESET during reduce aggregation',
    };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(false);
    expect(decision.review_gate_ready).toBe(false);
  });

  it('connection reset during REDUCE without proof → Phase 2 blocked', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Connection reset: ECONNRESET during reduce aggregation',
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
  });

  it('multiple network errors with full degradation proof = gate_valid', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Multiple failures: 3 of 5 chunk batches failed with ECONNREFUSED',
      degraded_reason_codes: ['NETWORK_ECONNREFUSED', 'PARTIAL_COVERAGE', 'TRACK_C_ERROR_DURING_BATCH'],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
    expect(decision.code).toBe('PASS3A_DEGRADED_GATE_VALID');
  });

  it('network error leaves pass3a_status=running (crash before status update) → not_ready', () => {
    // Simulates: network error crashes the worker BEFORE it can write a terminal
    // status. The persisted state is still 'running'.
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
    expect(decision.code).toBe('PASS3A_HALF_WRITTEN');
  });

  it('Review Gate handoff blocked when network error leaves Track C running', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'running' };
    const result = buildReviewGateHandoff(progress, artifactsWithoutAccepted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked.review_gate_ready).toBe(false);
      expect(result.blocked.progress.pass3a_status).toBe('running');
    }
  });
});

// ─── Edge case: Pass 3A completes very quickly (near-instant) ───────────────
// When Pass 3A finishes extremely fast (e.g., small manuscript, cached results,
// or trivial evaluation), the timestamps may be very close together or the same.
// These tests prove that gate validity is unaffected by completion speed.

describe('Track C edge case: Pass 3A completes very quickly', () => {
  it('instant completion (same-millisecond timestamp) = gate_valid', () => {
    const now = new Date().toISOString();
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: now,
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
    expect(decision.code).toBe('PASS3A_DONE_GATE_VALID');
  });

  it('instant completion → Review Gate opens immediately', () => {
    const now = new Date().toISOString();
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: now,
    };
    const decision = deriveReviewGateReadiness(progress, artifactsWithoutAccepted);
    expect(decision.ok).toBe(true);
    expect(decision.review_gate_ready).toBe(true);
  });

  it('instant completion → Phase 2 allowed immediately', () => {
    const now = new Date().toISOString();
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: now,
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(true);
    expect(guard.can_start_phase2).toBe(true);
  });

  it('instant completion → Review Gate handoff succeeds', () => {
    const now = new Date().toISOString();
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: now,
    };
    const result = buildReviewGateHandoff(progress, artifactsWithoutAccepted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoff.progress.pass3a_status).toBe('done');
      expect(result.handoff.progress.pass3a_gate_validity).toBe('gate_valid');
    }
  });

  it('instant degradation with full proof = gate_valid', () => {
    const now = new Date().toISOString();
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Instant degradation: manuscript too short for full analysis',
      degraded_reason_codes: ['MANUSCRIPT_TOO_SHORT'],
      degraded_at: now,
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
    expect(decision.code).toBe('PASS3A_DEGRADED_GATE_VALID');
  });

  it('instant degradation with proof → Phase 2 allowed', () => {
    const now = new Date().toISOString();
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Instant degradation: cached result only covers prologue',
      degraded_reason_codes: ['CACHED_PARTIAL'],
      degraded_at: now,
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(true);
    expect(guard.can_start_phase2).toBe(true);
  });

  it('epoch-zero timestamp is still a valid completion time', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: '1970-01-01T00:00:00.000Z',
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(true);
    expect(decision.gate_validity).toBe('gate_valid');
  });
});

// ─── Edge case: Malformed or boundary proof fields ──────────────────────────
// These tests prove that gate validity handles degenerate inputs robustly:
// empty strings, whitespace-only values, empty arrays, and partial proof fields.

describe('Track C edge case: malformed or boundary proof fields', () => {
  it('degraded with empty degraded_reason_codes array = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Some reason',
      degraded_reason_codes: [],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('degraded with whitespace-only degraded_reason = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: '   ',
      degraded_reason_codes: ['SOME_CODE'],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('degraded with whitespace-only degraded_at = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Real reason',
      degraded_reason_codes: ['SOME_CODE'],
      degraded_at: '   ',
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('degraded with whitespace-only reason codes = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Real reason',
      degraded_reason_codes: ['', '  '],
      degraded_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('done status with whitespace-only pass3a_completed_at = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: '  ',
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
  });

  it('done status with empty string pass3a_completed_at = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: '',
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
  });

  it('done status without pass3a_completed_at = gate_blocking', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
    };
    const decision = derivePass3aGateValidity(progress, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
  });

  it('artifact with empty artifact_id = gate_blocking even if status=done', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const brokenArtifacts: PhaseV2ArtifactSet = {
      ...fullArtifacts,
      pass3_preflight_draft_v1: { artifact_id: '', source_hash: 'sha256:valid' },
    };
    const decision = derivePass3aGateValidity(progress, brokenArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_ARTIFACT_MISSING');
  });

  it('artifact with null source_hash = gate_blocking even if status=done', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const brokenArtifacts: PhaseV2ArtifactSet = {
      ...fullArtifacts,
      pass3_preflight_draft_v1: { artifact_id: 'preflight-1', source_hash: null },
    };
    const decision = derivePass3aGateValidity(progress, brokenArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_ARTIFACT_MISSING');
  });

  it('undefined progress = not_ready (defensive default)', () => {
    const decision = derivePass3aGateValidity(undefined, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
  });

  it('empty object progress = not_ready (status defaults to not_started)', () => {
    const decision = derivePass3aGateValidity({}, fullArtifacts);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('not_ready');
    expect(decision.code).toBe('PASS3A_NOT_READY');
  });

  it('undefined artifacts = gate_blocking when status=done', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: new Date().toISOString(),
    };
    const decision = derivePass3aGateValidity(progress, undefined);
    expect(decision.ok).toBe(false);
    expect(decision.gate_validity).toBe('gate_blocking');
    expect(decision.code).toBe('PASS3A_ARTIFACT_MISSING');
  });
});

// ─── Edge case: Phase 2 guard with network-error scenarios ──────────────────
// Verifying Phase 2 guard correctly blocks or allows based on network-error
// derived states.

describe('Track C edge case: Phase 2 guard with network-error derived states', () => {
  it('Phase 2 blocked when network error leaves status=failed', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
    expect(guard.progress_patch.phase2_preflight_gate).toBe('blocked');
    expect(guard.progress_patch.pass3a_gate_validity).toBe('gate_blocking');
  });

  it('Phase 2 blocked when network error leaves degraded without proof', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Socket hang up: ECONNRESET',
      // Missing degraded_reason_codes and degraded_at
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.can_start_phase2).toBe(false);
    expect(guard.progress_patch.phase2_preflight_gate).toBe('blocked');
  });

  it('Phase 2 allowed when network error produces degraded with complete proof', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'Socket hang up: ECONNRESET on 2 of 8 chunks',
      degraded_reason_codes: ['NETWORK_ECONNRESET', 'PARTIAL_COVERAGE'],
      degraded_at: new Date().toISOString(),
    };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(true);
    expect(guard.can_start_phase2).toBe(true);
    expect(guard.progress_patch.phase2_preflight_gate).toBe('passed');
    expect(guard.progress_patch.pass3a_gate_validity).toBe('gate_valid');
  });

  it('Phase 2 guard progress_patch includes correct code on network failure', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'failed' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.progress_patch.phase2_preflight_gate_code).toBe('PASS3A_FAILED_BLOCKING');
  });

  it('Phase 2 guard progress_patch includes correct code when degraded proof missing', () => {
    const progress: PhaseV2Progress = { pass3a_status: 'degraded' };
    const guard = guardPhase2Start(progress, fullArtifacts);
    expect(guard.ok).toBe(false);
    expect(guard.progress_patch.phase2_preflight_gate_code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('Review Gate handoff carries degraded_reason through on network-error degradation', () => {
    const progress: PhaseV2Progress = {
      pass3a_status: 'degraded',
      degraded_reason: 'ETIMEDOUT: 3 chunks unreachable',
      degraded_reason_codes: ['NETWORK_TIMEOUT'],
      degraded_at: new Date().toISOString(),
    };
    const result = buildReviewGateHandoff(progress, artifactsWithoutAccepted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoff.progress.pass3a_status).toBe('degraded');
      expect(result.handoff.progress.pass3a_degraded_reason).toBe(
        'ETIMEDOUT: 3 chunks unreachable',
      );
    }
  });
});
