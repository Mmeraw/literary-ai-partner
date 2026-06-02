import {
  buildReviewGateHandoff,
} from '../../lib/evaluation/phase-architecture-v2/reviewGateHandoff';
import type {
  PhaseV2ArtifactSet,
  PhaseV2Progress,
} from '../../lib/evaluation/phase-architecture-v2/gateValidity';

const artifact = (id: string) => ({ artifact_id: id, source_hash: `sha256:${id}` });

const storyArtifacts: PhaseV2ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer'),
  ledger_quality_report_v1: artifact('quality-report'),
  ledger_quality_gate_ready_status: 'reviewable',
  ledger_quality_hard_fail_present: false,
};

const doneProgress: PhaseV2Progress = {
  pass3a_status: 'done',
  pass3a_completed_at: '2026-05-26T00:00:00.000Z',
};

const doneArtifacts: PhaseV2ArtifactSet = {
  ...storyArtifacts,
  pass3_preflight_draft_v1: artifact('preflight'),
};

const degradedProgress: PhaseV2Progress = {
  pass3a_status: 'degraded',
  degraded_reason: 'PASS3A_REDUCE_TIMEOUT',
  degraded_reason_codes: ['PASS3A_REDUCE_TIMEOUT'],
  degraded_at: '2026-05-26T00:00:00.000Z',
};

describe('Phase Architecture v2 — Review Gate handoff helper', () => {
  it('opens Review Gate for Story Layer + quality report + done Pass 3A with preflight artifact', () => {
    const result = buildReviewGateHandoff(doneProgress, doneArtifacts);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.handoff.status).toBe('queued');
    expect(result.handoff.phase).toBe('review_gate');
    expect(result.handoff.phase_status).toBe('awaiting_approval');
    expect(result.handoff.progress.review_gate_ready).toBe(true);
    expect(result.handoff.progress.pass3a_gate_validity).toBe('gate_valid');
    expect(result.handoff.progress.pass3a_status).toBe('done');
    expect(result.handoff.progress.pass3a_artifact_id).toBe('preflight');
    expect(result.handoff.progress.story_layer_artifact_id).toBe('story-layer');
    expect(result.handoff.progress.quality_report_artifact_id).toBe('quality-report');
  });

  it('opens Review Gate for Story Layer + quality report + degraded Pass 3A with structured proof', () => {
    const result = buildReviewGateHandoff(degradedProgress, storyArtifacts);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.handoff.phase).toBe('review_gate');
    expect(result.handoff.phase_status).toBe('awaiting_approval');
    expect(result.handoff.progress.review_gate_ready).toBe(true);
    expect(result.handoff.progress.pass3a_gate_validity).toBe('gate_valid');
    expect(result.handoff.progress.pass3a_status).toBe('degraded');
    expect(result.handoff.progress.pass3a_degraded_reason).toBe('PASS3A_REDUCE_TIMEOUT');
  });

  it('blocks Review Gate when Pass 3A status is missing', () => {
    const result = buildReviewGateHandoff({}, doneArtifacts);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.blocked.review_gate_ready).toBe(false);
    expect(result.blocked.decision.code).toBe('PASS3A_NOT_READY');
    expect(result.blocked.progress.gate_ready_status).toBe('blocked');
    expect(result.blocked.progress.block_code).toBe('PASS3A_NOT_READY');
    expect(result.blocked.progress.pass3a_gate_validity).toBe('not_ready');
  });

  it('blocks Review Gate when Pass 3A is running/map_done/reduce_running', () => {
    for (const status of ['running', 'map_done', 'reduce_running'] as const) {
      const result = buildReviewGateHandoff({ pass3a_status: status }, doneArtifacts);

      expect(result.ok).toBe(false);
      if (result.ok) continue;

      expect(result.blocked.review_gate_ready).toBe(false);
      expect(result.blocked.decision.code).toBe('PASS3A_HALF_WRITTEN');
      expect(result.blocked.progress.block_code).toBe('PASS3A_HALF_WRITTEN');
      expect(result.blocked.progress.pass3a_status).toBe(status);
      expect(result.blocked.progress.pass3a_gate_validity).toBe('not_ready');
    }
  });

  it('kicks forward through Review Gate when Pass 3A failed (non-fatal)', () => {
    const result = buildReviewGateHandoff({ pass3a_status: 'failed' }, doneArtifacts);

    // Pass 3A failure is non-fatal — gate should open with degraded preflight.
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.decision.code).toBe('REVIEW_GATE_READY');
    expect(result.handoff.progress.pass3a_status).toBe('degraded');
  });

  it('blocks Review Gate when Pass 3A is done but preflight artifact is missing', () => {
    const result = buildReviewGateHandoff(doneProgress, storyArtifacts);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.blocked.review_gate_ready).toBe(false);
    expect(result.blocked.decision.code).toBe('PASS3A_ARTIFACT_MISSING');
    expect(result.blocked.progress.block_code).toBe('PASS3A_ARTIFACT_MISSING');
    expect(result.blocked.progress.pass3a_gate_validity).toBe('gate_blocking');
  });

  it('blocks Review Gate when Pass 3A is done without completion metadata', () => {
    const result = buildReviewGateHandoff(
      {
        pass3a_status: 'done',
      },
      doneArtifacts,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.blocked.review_gate_ready).toBe(false);
    expect(result.blocked.decision.code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
    expect(result.blocked.progress.block_code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
    expect(result.blocked.progress.pass3a_gate_validity).toBe('gate_blocking');
  });

  it('blocks Review Gate when Pass 3A is degraded without structured proof', () => {
    const result = buildReviewGateHandoff({ pass3a_status: 'degraded' }, storyArtifacts);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.blocked.review_gate_ready).toBe(false);
    expect(result.blocked.decision.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
    expect(result.blocked.progress.block_code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
    expect(result.blocked.progress.pass3a_gate_validity).toBe('gate_blocking');
  });

  it('marks blocked progress as retryable technical when quality report is technically blocked', () => {
    const result = buildReviewGateHandoff(doneProgress, {
      ...doneArtifacts,
      ledger_quality_gate_ready_status: 'blocked_retryable_technical',
      ledger_quality_hard_fail_present: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.blocked.decision.code).toBe('REVIEW_GATE_QUALITY_TECHNICAL_BLOCK');
    expect(result.blocked.progress.gate_ready_status).toBe('blocked_retryable_technical');
    expect(result.blocked.progress.hard_fail_present).toBe(false);
  });
});
