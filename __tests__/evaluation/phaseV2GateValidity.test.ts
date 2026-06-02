import {
  assertPhase2Preconditions,
  derivePass3aGateValidity,
  deriveReviewGateReadiness,
  type PhaseV2ArtifactSet,
  type PhaseV2Progress,
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

describe('Phase Architecture v2 — Pass 3A gate validity', () => {
  it('treats failed Pass 3A as gate-blocking, never gate-valid', () => {
    const result = derivePass3aGateValidity({ pass3a_status: 'failed' }, doneArtifacts);

    expect(result.ok).toBe(false);
    expect(result.gate_validity).toBe('gate_blocking');
    expect(result.code).toBe('PASS3A_FAILED_BLOCKING');
  });

  it('treats running/map_done/reduce_running as not-ready half-written states', () => {
    for (const status of ['running', 'map_done', 'reduce_running'] as const) {
      const result = derivePass3aGateValidity({ pass3a_status: status }, doneArtifacts);

      expect(result.ok).toBe(false);
      expect(result.gate_validity).toBe('not_ready');
      expect(result.code).toBe('PASS3A_HALF_WRITTEN');
    }
  });

  it('treats done without pass3_preflight_draft_v1 as gate-blocking', () => {
    const result = derivePass3aGateValidity(doneProgress, storyArtifacts);

    expect(result.ok).toBe(false);
    expect(result.gate_validity).toBe('gate_blocking');
    expect(result.code).toBe('PASS3A_ARTIFACT_MISSING');
  });

  it('treats done without completion metadata as gate-blocking', () => {
    const result = derivePass3aGateValidity(
      { pass3a_status: 'done' },
      { pass3_preflight_draft_v1: artifact('preflight') },
    );

    expect(result.ok).toBe(false);
    expect(result.gate_validity).toBe('gate_blocking');
    expect(result.code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
  });

  it('treats done with valid artifact and completion metadata as gate-valid', () => {
    const result = derivePass3aGateValidity(doneProgress, doneArtifacts);

    expect(result.ok).toBe(true);
    expect(result.gate_validity).toBe('gate_valid');
    expect(result.code).toBe('PASS3A_DONE_GATE_VALID');
  });

  it('treats done as gate-blocking when preflight reducer failed', () => {
    const result = derivePass3aGateValidity(doneProgress, {
      ...doneArtifacts,
      pass3_preflight_reducer_status: 'failed',
      pass3_preflight_authority: 'unavailable',
    });

    expect(result.ok).toBe(false);
    expect(result.gate_validity).toBe('gate_blocking');
    expect(result.code).toBe('PASS3A_REDUCER_FAILED');
  });

  it('treats degraded without structured proof as gate-blocking', () => {
    const result = derivePass3aGateValidity({ pass3a_status: 'degraded' }, {});

    expect(result.ok).toBe(false);
    expect(result.gate_validity).toBe('gate_blocking');
    expect(result.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('treats degraded with structured proof as gate-valid', () => {
    const result = derivePass3aGateValidity(degradedProgress, {});

    expect(result.ok).toBe(true);
    expect(result.gate_validity).toBe('gate_valid');
    expect(result.code).toBe('PASS3A_DEGRADED_GATE_VALID');
  });
});

describe('Phase Architecture v2 — derived Review Gate readiness', () => {
  it('blocks Review Gate without pass1a_story_layer_v1', () => {
    const result = deriveReviewGateReadiness(doneProgress, {
      ledger_quality_report_v1: artifact('quality-report'),
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(false);
    expect(result.review_gate_ready).toBe(false);
    expect(result.code).toBe('REVIEW_GATE_STORY_LAYER_MISSING');
  });

  it('blocks Review Gate without ledger_quality_report_v1', () => {
    const result = deriveReviewGateReadiness(doneProgress, {
      pass1a_story_layer_v1: artifact('story-layer'),
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(false);
    expect(result.review_gate_ready).toBe(false);
    expect(result.code).toBe('REVIEW_GATE_QUALITY_REPORT_MISSING');
  });

  it('blocks Review Gate when quality verdict metadata is unknown/malformed', () => {
    const result = deriveReviewGateReadiness(doneProgress, {
      pass1a_story_layer_v1: artifact('story-layer'),
      ledger_quality_report_v1: artifact('quality-report'),
      pass3_preflight_draft_v1: artifact('preflight'),
      ledger_quality_gate_ready_status: null,
      ledger_quality_hard_fail_present: null,
    });

    expect(result.ok).toBe(false);
    expect(result.review_gate_ready).toBe(false);
    expect(result.code).toBe('REVIEW_GATE_QUALITY_VERDICT_UNKNOWN');
  });

  it('blocks Review Gate when Pass 3A is missing/running/half-written/failed', () => {
    for (const status of ['not_started', 'running', 'map_done', 'reduce_running', 'failed'] as const) {
      const result = deriveReviewGateReadiness(
        { pass3a_status: status },
        {
          ...storyArtifacts,
          pass3_preflight_draft_v1: artifact('preflight'),
        },
      );

      expect(result.ok).toBe(false);
      expect(result.review_gate_ready).toBe(false);
    }
  });

  it('opens Review Gate when Story Layer, quality report, and done preflight are valid', () => {
    const result = deriveReviewGateReadiness(doneProgress, doneArtifacts);

    expect(result.ok).toBe(true);
    expect(result.review_gate_ready).toBe(true);
    expect(result.code).toBe('REVIEW_GATE_READY');
  });

  it('opens Review Gate when Story Layer, quality report, and degraded preflight proof are valid', () => {
    const result = deriveReviewGateReadiness(degradedProgress, storyArtifacts);

    expect(result.ok).toBe(true);
    expect(result.review_gate_ready).toBe(true);
    expect(result.code).toBe('REVIEW_GATE_READY');
  });

  it('blocks Review Gate when ledger quality report is blocked/hard-fail', () => {
    const result = deriveReviewGateReadiness(doneProgress, {
      ...doneArtifacts,
      ledger_quality_gate_ready_status: 'blocked',
      ledger_quality_hard_fail_present: true,
    });

    expect(result.ok).toBe(false);
    expect(result.review_gate_ready).toBe(false);
    expect(result.code).toBe('REVIEW_GATE_QUALITY_BLOCKED');
  });

  it('blocks Review Gate as retryable technical block when quality status is technical', () => {
    const result = deriveReviewGateReadiness(doneProgress, {
      ...doneArtifacts,
      ledger_quality_gate_ready_status: 'blocked_retryable_technical',
      ledger_quality_hard_fail_present: false,
    });

    expect(result.ok).toBe(false);
    expect(result.review_gate_ready).toBe(false);
    expect(result.code).toBe('REVIEW_GATE_QUALITY_TECHNICAL_BLOCK');
  });
});

describe('Phase Architecture v2 — Phase 2 preconditions', () => {
  it('blocks Phase 2 without accepted_story_ledger_v1', () => {
    const result = assertPhase2Preconditions(doneProgress, doneArtifacts);

    expect(result.ok).toBe(false);
    expect(result.gate_validity).toBe('gate_blocking');
    expect(result.code).toBe('PHASE2_STORY_AUTHORITY_MISSING');
  });

  it('blocks Phase 2 when Pass 3A is missing/running/half-written/failed', () => {
    for (const status of ['not_started', 'running', 'map_done', 'reduce_running', 'failed'] as const) {
      const result = assertPhase2Preconditions(
        { pass3a_status: status },
        {
          accepted_story_ledger_v1: artifact('accepted-ledger'),
          pass3_preflight_draft_v1: artifact('preflight'),
        },
      );

      expect(result.ok).toBe(false);
      expect(['PASS3A_NOT_READY', 'PASS3A_HALF_WRITTEN', 'PASS3A_FAILED_BLOCKING']).toContain(result.code);
    }
  });

  it('blocks Phase 2 when done lacks pass3_preflight_draft_v1', () => {
    const result = assertPhase2Preconditions(doneProgress, {
      accepted_story_ledger_v1: artifact('accepted-ledger'),
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PASS3A_ARTIFACT_MISSING');
  });

  it('blocks Phase 2 when degraded lacks structured proof', () => {
    const result = assertPhase2Preconditions(
      { pass3a_status: 'degraded' },
      { accepted_story_ledger_v1: artifact('accepted-ledger') },
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('allows Phase 2 when accepted ledger and done preflight are valid', () => {
    const result = assertPhase2Preconditions(doneProgress, {
      accepted_story_ledger_v1: artifact('accepted-ledger'),
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(true);
    expect(result.gate_validity).toBe('gate_valid');
    expect(result.code).toBe('PHASE2_PRECONDITIONS_SATISFIED');
  });

  it('allows Phase 2 when accepted ledger and degraded preflight proof are valid', () => {
    const result = assertPhase2Preconditions(degradedProgress, {
      accepted_story_ledger_v1: artifact('accepted-ledger'),
    });

    expect(result.ok).toBe(true);
    expect(result.gate_validity).toBe('gate_valid');
    expect(result.code).toBe('PHASE2_PRECONDITIONS_SATISFIED');
  });
});
