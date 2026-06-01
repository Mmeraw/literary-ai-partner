import { buildReviewGateHandoff } from '../../lib/evaluation/phase-architecture-v2/reviewGateHandoff';
import type { PhaseV2ArtifactSet, PhaseV2Progress } from '../../lib/evaluation/phase-architecture-v2/gateValidity';

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
  it('builds a queued review_gate handoff only when Story Layer, quality report, and done Pass 3A are valid', () => {
    const result = buildReviewGateHandoff(doneProgress, doneArtifacts);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected Review Gate handoff to be ready');

    expect(result.handoff.status).toBe('queued');
    expect(result.handoff.phase).toBe('review_gate');
    expect(result.handoff.phase_status).toBe('awaiting_approval');
    expect(result.handoff.progress.review_gate_ready).toBe(true);
    expect(result.handoff.progress.gate_ready_status).toBe('reviewable');
    expect(result.handoff.progress.story_layer_artifact_id).toBe('story-layer');
    expect(result.handoff.progress.quality_report_artifact_id).toBe('quality-report');
    expect(result.handoff.progress.pass3a_status).toBe('done');
    expect(result.handoff.progress.pass3a_artifact_id).toBe('preflight');
  });

  it('builds a queued review_gate handoff when Pass 3A is degraded with structured proof', () => {
    const result = buildReviewGateHandoff(degradedProgress, storyArtifacts);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected degraded Pass 3A to be gate-valid');

    expect(result.handoff.status).toBe('queued');
    expect(result.handoff.phase).toBe('review_gate');
    expect(result.handoff.progress.review_gate_ready).toBe(true);
    expect(result.handoff.progress.pass3a_status).toBe('degraded');
    expect(result.handoff.progress.pass3a_degraded_reason).toBe('PASS3A_REDUCE_TIMEOUT');
    expect(result.handoff.progress.pass3a_artifact_id).toBeUndefined();
  });

  it('blocks handoff without pass1a_story_layer_v1', () => {
    const result = buildReviewGateHandoff(doneProgress, {
      ledger_quality_report_v1: artifact('quality-report'),
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected Review Gate handoff to block');

    expect(result.blocked.status).toBe('blocked');
    expect(result.blocked.progress.review_gate_ready).toBe(false);
    expect(result.blocked.progress.gate_ready_status).toBe('blocked');
    expect(result.blocked.progress.block_code).toBe('REVIEW_GATE_STORY_LAYER_MISSING');
  });

  it('blocks handoff without ledger_quality_report_v1', () => {
    const result = buildReviewGateHandoff(doneProgress, {
      pass1a_story_layer_v1: artifact('story-layer'),
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected Review Gate handoff to block');

    expect(result.blocked.progress.review_gate_ready).toBe(false);
    expect(result.blocked.progress.block_code).toBe('REVIEW_GATE_QUALITY_REPORT_MISSING');
  });

  it('blocks handoff when Pass 3A is missing/running/half-written/failed', () => {
    for (const status of ['not_started', 'running', 'map_done', 'reduce_running', 'failed'] as const) {
      const result = buildReviewGateHandoff(
        { pass3a_status: status },
        {
          ...storyArtifacts,
          pass3_preflight_draft_v1: artifact('preflight'),
        },
      );

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error(`Expected ${status} Pass 3A to block`);

      expect(result.blocked.progress.review_gate_ready).toBe(false);
      expect(result.blocked.progress.pass3a_status).toBe(status);
      expect(['PASS3A_NOT_READY', 'PASS3A_HALF_WRITTEN', 'PASS3A_FAILED_BLOCKING']).toContain(
        result.blocked.progress.block_code,
      );
    }
  });

  it('blocks handoff when done Pass 3A lacks pass3_preflight_draft_v1', () => {
    const result = buildReviewGateHandoff(doneProgress, storyArtifacts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected missing preflight artifact to block');

    expect(result.blocked.progress.block_code).toBe('PASS3A_ARTIFACT_MISSING');
    expect(result.blocked.progress.hard_fail_present).toBe(true);
  });

  it('blocks handoff when degraded Pass 3A lacks structured proof', () => {
    const result = buildReviewGateHandoff({ pass3a_status: 'degraded' }, storyArtifacts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected degraded without proof to block');

    expect(result.blocked.progress.block_code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
    expect(result.blocked.progress.hard_fail_present).toBe(true);
  });

  it('blocks handoff when quality report is blocked/hard-fail', () => {
    const result = buildReviewGateHandoff(doneProgress, {
      ...doneArtifacts,
      ledger_quality_gate_ready_status: 'blocked',
      ledger_quality_hard_fail_present: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected blocked quality report to block review gate handoff');

    expect(result.blocked.progress.review_gate_ready).toBe(false);
    expect(result.blocked.progress.block_code).toBe('REVIEW_GATE_QUALITY_BLOCKED');
  });

  it('blocks handoff when quality verdict metadata is unknown/malformed', () => {
    const result = buildReviewGateHandoff(doneProgress, {
      pass1a_story_layer_v1: artifact('story-layer'),
      ledger_quality_report_v1: artifact('quality-report'),
      pass3_preflight_draft_v1: artifact('preflight'),
      ledger_quality_gate_ready_status: null,
      ledger_quality_hard_fail_present: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unknown quality verdict metadata to block review gate handoff');

    expect(result.blocked.progress.review_gate_ready).toBe(false);
    expect(result.blocked.progress.block_code).toBe('REVIEW_GATE_QUALITY_VERDICT_UNKNOWN');
  });

  it('blocks handoff when quality report is repair_required', () => {
    const result = buildReviewGateHandoff(doneProgress, {
      ...doneArtifacts,
      ledger_quality_gate_ready_status: 'repair_required',
      ledger_quality_hard_fail_present: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected repair_required quality report to block review gate handoff');

    expect(result.blocked.progress.review_gate_ready).toBe(false);
    expect(result.blocked.progress.block_code).toBe('REVIEW_GATE_QUALITY_NOT_REVIEWABLE');
  });

  it('blocks handoff when Pass 3A is degraded but reducer failed', () => {
    const result = buildReviewGateHandoff(
      { ...degradedProgress, pass3a_status: 'degraded' },
      {
        ...storyArtifacts,
        pass3_preflight_draft_v1: artifact('preflight'),
        pass3_preflight_reducer_status: 'failed',
        pass3_preflight_authority: 'unavailable',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected reducer-failed Pass 3A to block review gate handoff');

    expect(result.blocked.progress.block_code).toBe('PASS3A_REDUCER_FAILED');
    expect(result.blocked.progress.pass3a_gate_validity).toBe('gate_blocking');
  });
});
