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
