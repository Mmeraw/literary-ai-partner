import {
  assertPhase2Preconditions,
  type GateDecision,
  type PhaseV2ArtifactSet,
  type PhaseV2Progress,
} from './gateValidity';

export type Phase2GuardResult =
  | {
      ok: true;
      can_start_phase2: true;
      decision: GateDecision;
      progress_patch: {
        phase2_preflight_gate: 'passed';
        phase2_preflight_gate_code: 'PHASE2_PRECONDITIONS_SATISFIED';
        phase2_preflight_gate_reason: string;
        pass3a_gate_validity: 'gate_valid';
      };
    }
  | {
      ok: false;
      can_start_phase2: false;
      decision: GateDecision;
      progress_patch: {
        phase2_preflight_gate: 'blocked';
        phase2_preflight_gate_code: string;
        phase2_preflight_gate_reason: string;
        pass3a_gate_validity: GateDecision['gate_validity'];
      };
    };

/**
 * Phase Architecture v2 Phase 2 entry guard.
 *
 * This helper is intentionally pure. Runtime callers can use it before moving a
 * job into Phase 2 without importing scoring, synthesis, worker, or WAVE logic.
 */
export function guardPhase2Start(
  progress: PhaseV2Progress = {},
  artifacts: PhaseV2ArtifactSet = {},
): Phase2GuardResult {
  const decision = assertPhase2Preconditions(progress, artifacts);

  if (!decision.ok) {
    return {
      ok: false,
      can_start_phase2: false,
      decision,
      progress_patch: {
        phase2_preflight_gate: 'blocked',
        phase2_preflight_gate_code: decision.code,
        phase2_preflight_gate_reason: decision.reason,
        pass3a_gate_validity: decision.gate_validity,
      },
    };
  }

  return {
    ok: true,
    can_start_phase2: true,
    decision,
    progress_patch: {
      phase2_preflight_gate: 'passed',
      phase2_preflight_gate_code: 'PHASE2_PRECONDITIONS_SATISFIED',
      phase2_preflight_gate_reason: decision.reason,
      pass3a_gate_validity: 'gate_valid',
    },
  };
}
