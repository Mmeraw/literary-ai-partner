export const PASS3A_STATUSES = [
  'not_started',
  'running',
  'map_done',
  'reduce_running',
  'done',
  'degraded',
  'failed',
] as const;

export type Pass3AStatus = (typeof PASS3A_STATUSES)[number];

export const PASS3A_GATE_VALIDITIES = [
  'not_ready',
  'gate_valid',
  'gate_blocking',
] as const;

export type Pass3AGateValidity = (typeof PASS3A_GATE_VALIDITIES)[number];

export type PhaseV2Progress = {
  phase0_status?: string;
  chunk_manifest_status?: string;
  phase1a_status?: string;

  pass3a_status?: Pass3AStatus;
  pass3a_gate_validity?: Pass3AGateValidity;
  pass3a_map_status?: 'not_started' | 'running' | 'done' | 'failed';
  pass3a_reduce_status?: 'not_started' | 'running' | 'done' | 'failed' | 'skipped';

  pass3a_artifact_id?: string;
  pass3a_completed_at?: string;

  degraded_reason?: string;
  degraded_reason_codes?: string[];
  degraded_at?: string;

  failed_reason?: string;
  failed_at?: string;

  review_gate_ready?: boolean;
};

export type ArtifactRef = {
  artifact_id?: string | null;
  source_hash?: string | null;
};

export type PhaseV2ArtifactSet = {
  pass1a_story_layer_v1?: ArtifactRef | null;
  ledger_quality_report_v1?: ArtifactRef | null;
  pass3_preflight_draft_v1?: ArtifactRef | null;
  accepted_story_ledger_v1?: ArtifactRef | null;
  /**
   * Truthful short-form Phase 1/2 handoff. This is valid Phase 2 authority for
   * short-form jobs (<25k) and must not be confused with author acceptance of a
   * long-form Story Ledger.
   */
  pass12_handoff_v1?: ArtifactRef | null;
  ledger_quality_gate_ready_status?:
    | 'reviewable'
    | 'blocked'
    | 'blocked_retryable_technical'
    | 'blocked_content_hard_fail'
    | 'repair_required'
    | null;
  ledger_quality_hard_fail_present?: boolean | null;
  pass3_preflight_reducer_status?: 'ok' | 'failed' | 'legacy' | null;
  pass3_preflight_authority?: string | null;
};

export type GateDecision = {
  ok: boolean;
  gate_validity: Pass3AGateValidity;
  reason: string;
  code: string;
};

export type ReviewGateDecision = GateDecision & {
  review_gate_ready: boolean;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasArtifactRef(ref: ArtifactRef | null | undefined): ref is Required<ArtifactRef> {
  return isNonEmptyString(ref?.artifact_id) && isNonEmptyString(ref?.source_hash);
}

function hasPhase2Authority(artifacts: PhaseV2ArtifactSet): boolean {
  return hasArtifactRef(artifacts.accepted_story_ledger_v1) || hasArtifactRef(artifacts.pass12_handoff_v1);
}

function hasStructuredDegradationProof(progress: PhaseV2Progress): boolean {
  return (
    isNonEmptyString(progress.degraded_reason) &&
    Array.isArray(progress.degraded_reason_codes) &&
    progress.degraded_reason_codes.some(isNonEmptyString) &&
    isNonEmptyString(progress.degraded_at)
  );
}

export function derivePass3aGateValidity(
  progress: PhaseV2Progress = {},
  artifacts: PhaseV2ArtifactSet = {},
): GateDecision {
  const status = progress.pass3a_status ?? 'not_started';
  const reducerFailed =
    artifacts.pass3_preflight_reducer_status === 'failed' ||
    artifacts.pass3_preflight_authority === 'unavailable';

  if (reducerFailed) {
    return {
      ok: false,
      gate_validity: 'gate_blocking',
      reason: 'Pass 3A preflight artifact indicates reducer failure/unavailable authority.',
      code: 'PASS3A_REDUCER_FAILED',
    };
  }

  switch (status) {
    case 'done': {
      if (!hasArtifactRef(artifacts.pass3_preflight_draft_v1)) {
        return {
          ok: false,
          gate_validity: 'gate_blocking',
          reason: 'Pass 3A status is done but pass3_preflight_draft_v1 is missing or malformed.',
          code: 'PASS3A_ARTIFACT_MISSING',
        };
      }

      if (!isNonEmptyString(progress.pass3a_completed_at)) {
        return {
          ok: false,
          gate_validity: 'gate_blocking',
          reason: 'Pass 3A status is done but completion metadata is missing.',
          code: 'PASS3A_COMPLETION_METADATA_MISSING',
        };
      }

      return {
        ok: true,
        gate_validity: 'gate_valid',
        reason: 'Pass 3A completed with a valid preflight artifact.',
        code: 'PASS3A_DONE_GATE_VALID',
      };
    }

    case 'degraded': {
      if (!hasStructuredDegradationProof(progress)) {
        return {
          ok: false,
          gate_validity: 'gate_blocking',
          reason: 'Pass 3A status is degraded but structured degradation proof is missing.',
          code: 'PASS3A_DEGRADED_PROOF_MISSING',
        };
      }

      return {
        ok: true,
        gate_validity: 'gate_valid',
        reason: 'Pass 3A degraded with structured proof.',
        code: 'PASS3A_DEGRADED_GATE_VALID',
      };
    }

    case 'failed':
      return {
        ok: false,
        gate_validity: 'gate_blocking',
        reason: 'Pass 3A failed and requires retry or operator intervention.',
        code: 'PASS3A_FAILED_BLOCKING',
      };

    case 'running':
    case 'map_done':
    case 'reduce_running':
      return {
        ok: false,
        gate_validity: 'not_ready',
        reason: `Pass 3A is not terminal yet: ${status}.`,
        code: 'PASS3A_HALF_WRITTEN',
      };

    case 'not_started':
    default:
      return {
        ok: false,
        gate_validity: 'not_ready',
        reason: 'Pass 3A has not started.',
        code: 'PASS3A_NOT_READY',
      };
  }
}

export function deriveReviewGateReadiness(
  progress: PhaseV2Progress = {},
  artifacts: PhaseV2ArtifactSet = {},
): ReviewGateDecision {
  if (!hasArtifactRef(artifacts.pass1a_story_layer_v1)) {
    return {
      ok: false,
      review_gate_ready: false,
      gate_validity: 'gate_blocking',
      reason: 'pass1a_story_layer_v1 is required before Review Gate.',
      code: 'REVIEW_GATE_STORY_LAYER_MISSING',
    };
  }

  if (!hasArtifactRef(artifacts.ledger_quality_report_v1)) {
    return {
      ok: false,
      review_gate_ready: false,
      gate_validity: 'gate_blocking',
      reason: 'ledger_quality_report_v1 is required before Review Gate.',
      code: 'REVIEW_GATE_QUALITY_REPORT_MISSING',
    };
  }

  const qualityGateReadyStatus = artifacts.ledger_quality_gate_ready_status;
  const qualityHardFailPresent = artifacts.ledger_quality_hard_fail_present;

  const hasKnownQualityGateReadyStatus =
    qualityGateReadyStatus === 'reviewable'
    || qualityGateReadyStatus === 'blocked'
    || qualityGateReadyStatus === 'blocked_retryable_technical'
    || qualityGateReadyStatus === 'blocked_content_hard_fail'
    || qualityGateReadyStatus === 'repair_required';

  if (!hasKnownQualityGateReadyStatus || typeof qualityHardFailPresent !== 'boolean') {
    return {
      ok: false,
      review_gate_ready: false,
      gate_validity: 'gate_blocking',
      reason: 'ledger_quality_report_v1 verdict metadata is missing or malformed; fail closed for Review Gate readiness.',
      code: 'REVIEW_GATE_QUALITY_VERDICT_UNKNOWN',
    };
  }

  if (qualityGateReadyStatus === 'blocked_retryable_technical') {
    return {
      ok: false,
      review_gate_ready: false,
      gate_validity: 'gate_blocking',
      reason: 'ledger_quality_report_v1 indicates technical incompleteness/degradation; retry Phase 1A recovery before content-quality judgment.',
      code: 'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK',
    };
  }

  if (
    qualityGateReadyStatus === 'blocked' ||
    qualityGateReadyStatus === 'blocked_content_hard_fail' ||
    qualityHardFailPresent === true
  ) {
    return {
      ok: false,
      review_gate_ready: false,
      gate_validity: 'gate_blocking',
      reason: 'ledger_quality_report_v1 is blocked/hard-fail and requires operator intervention.',
      code: 'REVIEW_GATE_QUALITY_BLOCKED',
    };
  }

  if (qualityGateReadyStatus === 'repair_required') {
    return {
      ok: false,
      review_gate_ready: false,
      gate_validity: 'gate_blocking',
      reason: 'ledger_quality_report_v1 is repair_required and not reviewable yet.',
      code: 'REVIEW_GATE_QUALITY_NOT_REVIEWABLE',
    };
  }

  const pass3aDecision = derivePass3aGateValidity(progress, artifacts);
  if (!pass3aDecision.ok) {
    return {
      ...pass3aDecision,
      review_gate_ready: false,
    };
  }

  return {
    ok: true,
    review_gate_ready: true,
    gate_validity: 'gate_valid',
    reason: 'Review Gate is ready: Story Layer, quality report, and Pass 3A are gate-valid.',
    code: 'REVIEW_GATE_READY',
  };
}

export function assertPhase2Preconditions(
  progress: PhaseV2Progress = {},
  artifacts: PhaseV2ArtifactSet = {},
): GateDecision {
  if (!hasPhase2Authority(artifacts)) {
    return {
      ok: false,
      gate_validity: 'gate_blocking',
      reason: 'accepted_story_ledger_v1 or truthful short-form pass12_handoff_v1 is required before Phase 2.',
      code: 'PHASE2_STORY_AUTHORITY_MISSING',
    };
  }

  const pass3aDecision = derivePass3aGateValidity(progress, artifacts);
  if (!pass3aDecision.ok) {
    return pass3aDecision;
  }

  return {
    ok: true,
    gate_validity: 'gate_valid',
    reason: 'Phase 2 preconditions satisfied.',
    code: 'PHASE2_PRECONDITIONS_SATISFIED',
  };
}
