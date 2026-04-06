import { PHASE_1_STATES, type Phase1State } from "./phase1";
import type { ValidityState } from "@/lib/governance/types";

export type Phase1Readiness = {
  phase1status: Phase1State;
  hasscores?: boolean;
  coveragepercent?: number;
  // New governed runtime fields
  evaluationvalidity?: ValidityState;
  artifactaccepted?: boolean;
  artifactrejected?: boolean;
  disputed?: boolean;
};

export type GateDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "phase1incomplete"
        | "missingscores"
        | "insufficientcoverage"
        | "artifactrejected"
        | "artifactinvalid"
        | "artifactdisputed";
      detail: string;
    };

export function gatePhase2OnPhase1(readiness: Phase1Readiness): GateDecision {
  if (readiness.phase1status !== PHASE_1_STATES.COMPLETED) {
    return {
      ok: false,
      reason: "phase1incomplete",
      detail: `Phase 1 status is ${readiness.phase1status}.`,
    };
  }

  // New fail-closed artifact checks first
  if (readiness.artifactrejected === true || readiness.artifactaccepted === false) {
    return {
      ok: false,
      reason: "artifactrejected",
      detail: "Phase 1 produced a rejected artifact.",
    };
  }

  if (readiness.evaluationvalidity === "INVALID") {
    return {
      ok: false,
      reason: "artifactinvalid",
      detail: "Phase 1 evaluation artifact is INVALID.",
    };
  }

  if (readiness.evaluationvalidity === "DISPUTED" || readiness.disputed === true) {
    return {
      ok: false,
      reason: "artifactdisputed",
      detail: "Phase 1 evaluation artifact is DISPUTED.",
    };
  }

  if (readiness.hasscores === false) {
    return {
      ok: false,
      reason: "missingscores",
      detail: "Phase 1 scores are missing.",
    };
  }

  const c = readiness.coveragepercent;
  if (typeof c === "number" && c < 0.8) {
    return {
      ok: false,
      reason: "insufficientcoverage",
      detail: `Coverage ${Math.round(c * 100)}% is below the required floor.`,
    };
  }

  return { ok: true };
}
