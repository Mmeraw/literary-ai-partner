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
  if (!hasArtifactRef(artifacts.accepted_story_ledger_v1)) {
    return {
      ok: false,
      gate_validity: 'gate_blocking',
      reason: 'accepted_story_ledger_v1 is required before Phase 2.',
      code: 'PHASE2_ACCEPTED_STORY_LEDGER_MISSING',
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
