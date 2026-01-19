import { PHASE_1_STATES, Phase1State } from "./phase1";

export type Phase1Readiness = {
  phase_1_status: Phase1State;
  has_scores?: boolean;
  coverage_percent?: number;
};

export type GateDecision =
  | { ok: true }
  | { ok: false; reason: "phase_1_incomplete" | "insufficient_coverage" | "missing_scores"; detail: string };

export function gatePhase2OnPhase1(readiness: Phase1Readiness): GateDecision {
  if (readiness.phase_1_status !== PHASE_1_STATES.COMPLETED) {
    return {
      ok: false,
      reason: "phase_1_incomplete",
      detail: `Phase 1 status is ${readiness.phase_1_status}.`,
    };
  }

  if (readiness.has_scores === false) {
    return {
      ok: false,
      reason: "missing_scores",
      detail: "Phase 1 scores are missing.",
    };
  }

  const c = readiness.coverage_percent;
  if (typeof c === "number" && c < 0.8) {
    return {
      ok: false,
      reason: "insufficient_coverage",
      detail: `Coverage ${Math.round(c * 100)}% is below the required floor.`,
    };
  }

  return { ok: true };
}
