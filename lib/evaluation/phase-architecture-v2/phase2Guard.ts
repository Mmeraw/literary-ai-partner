import {
  assertPhase2Preconditions,
  type GateDecision,
  type PhaseV2ArtifactSet,
  type PhaseV2Progress,
} from './gateValidity';
import {
  assertChecklistPhaseMayStart,
  type ChecklistArtifactMap,
} from './checklistEnforcer';

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

function asBlockingGateDecision(code: string, reason: string): GateDecision {
  return {
    ok: false,
    gate_validity: 'gate_blocking',
    code,
    reason,
  };
}

export function guardPhase2Start(
  progress: PhaseV2Progress = {},
  artifacts: PhaseV2ArtifactSet = {},
  checklistArtifacts?: ChecklistArtifactMap,
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

  if (checklistArtifacts) {
    const checklistDecision = assertChecklistPhaseMayStart('phase_2', checklistArtifacts);
    if (!checklistDecision.ok) {
      const blockingDecision = asBlockingGateDecision(checklistDecision.code, checklistDecision.reason);

      return {
        ok: false,
        can_start_phase2: false,
        decision: blockingDecision,
        progress_patch: {
          phase2_preflight_gate: 'blocked',
          phase2_preflight_gate_code: checklistDecision.code,
          phase2_preflight_gate_reason: checklistDecision.reason,
          pass3a_gate_validity: 'gate_blocking',
        },
      };
    }
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
