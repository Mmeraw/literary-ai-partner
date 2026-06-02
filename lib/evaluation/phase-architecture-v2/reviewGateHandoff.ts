import {
  deriveReviewGateReadiness,
  type PhaseV2ArtifactSet,
  type PhaseV2Progress,
  type ReviewGateDecision,
} from './gateValidity';

export type ReviewGateHandoff = {
  status: 'queued';
  phase: 'review_gate';
  phase_status: 'awaiting_approval';
  progress: {
    phase: 'phase_1a';
    phase_status: 'awaiting_approval';
    message: string;
    gate_ready_status: 'reviewable';
    review_gate_ready: true;
    hard_fail_present: false;
    story_layer_artifact_id: string;
    quality_report_artifact_id: string;
    pass3a_gate_validity: 'gate_valid';
    pass3a_status: 'done' | 'degraded';
    pass3a_artifact_id?: string;
    pass3a_degraded_reason?: string;
  };
};

export type ReviewGateBlocked = {
  status: 'blocked';
  review_gate_ready: false;
  decision: ReviewGateDecision;
  progress: {
    phase: 'phase_1a';
    phase_status: 'blocked';
    message: string;
    gate_ready_status: 'blocked' | 'blocked_retryable_technical' | 'blocked_content_hard_fail';
    review_gate_ready: false;
    hard_fail_present: boolean;
    block_code: string;
    block_reason: string;
    pass3a_gate_validity: ReviewGateDecision['gate_validity'];
    pass3a_status?: PhaseV2Progress['pass3a_status'];
  };
};

export type ReviewGateHandoffResult =
  | {
      ok: true;
      handoff: ReviewGateHandoff;
      decision: ReviewGateDecision;
      blocked?: undefined;
    }
  | {
      ok: false;
      blocked: ReviewGateBlocked;
      handoff?: undefined;
      decision?: undefined;
    };

function artifactId(ref: { artifact_id?: string | null } | null | undefined): string {
  return ref?.artifact_id ?? '';
}

export function buildReviewGateHandoff(
  progress: PhaseV2Progress = {},
  artifacts: PhaseV2ArtifactSet = {},
): ReviewGateHandoffResult {
  const decision = deriveReviewGateReadiness(progress, artifacts);

  if (!decision.ok) {
    const blockedGateStatus =
      decision.code === 'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK'
        ? 'blocked_retryable_technical'
        : decision.code === 'REVIEW_GATE_QUALITY_BLOCKED'
          ? 'blocked_content_hard_fail'
          : 'blocked';

    return {
      ok: false,
      blocked: {
        status: 'blocked',
        review_gate_ready: false,
        decision,
        progress: {
          phase: 'phase_1a',
          phase_status: 'blocked',
          message: `Review Gate blocked: ${decision.reason}`,
          gate_ready_status: blockedGateStatus,
          review_gate_ready: false,
          hard_fail_present: blockedGateStatus === 'blocked_content_hard_fail',
          block_code: decision.code,
          block_reason: decision.reason,
          pass3a_gate_validity: decision.gate_validity,
          pass3a_status: progress.pass3a_status,
        },
      },
    };
  }

  const pass3aStatus = progress.pass3a_status === 'degraded' ? 'degraded' : 'done';

  return {
    ok: true,
    decision,
    handoff: {
      status: 'queued',
      phase: 'review_gate',
      phase_status: 'awaiting_approval',
      progress: {
        phase: 'phase_1a',
        phase_status: 'awaiting_approval',
        message: 'Phase 1A complete — Story Layer, quality report, and Pass 3A preflight are ready for Review Gate',
        gate_ready_status: 'reviewable',
        review_gate_ready: true,
        hard_fail_present: false,
        story_layer_artifact_id: artifactId(artifacts.pass1a_story_layer_v1),
        quality_report_artifact_id: artifactId(artifacts.ledger_quality_report_v1),
        pass3a_gate_validity: 'gate_valid',
        pass3a_status: pass3aStatus,
        pass3a_artifact_id: artifactId(artifacts.pass3_preflight_draft_v1) || undefined,
        pass3a_degraded_reason: pass3aStatus === 'degraded' ? progress.degraded_reason : undefined,
      },
    },
  };
}
