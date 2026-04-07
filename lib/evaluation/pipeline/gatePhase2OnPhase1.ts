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


/**
 * Async wrapper: fetches job data and evaluates Phase 1 gate.
 * Returns true if Phase 2 may proceed, false if blocked.
 */
export async function checkPhase1GateForJob(jobId: string): Promise<boolean> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check for any rejected chunks in this job's manuscript
    const { data: job } = await supabase
      .from("evaluation_jobs")
      .select("manuscript_id, status, progress")
      .eq("id", jobId)
      .single();

    if (!job) return false; // fail-closed: no job = no proceed

    const { data: chunks } = await supabase
      .from("manuscript_chunks")
      .select("status, failure_code, last_error")
      .eq("manuscript_id", job.manuscript_id);

    const allChunks = chunks || [];
    const totalChunks = allChunks.length;
    const completedChunks = allChunks.filter((c: any) => c.status === "complete").length;
    const hasRejection = allChunks.some(
      (c: any) => c.failure_code === "EVALUATION_GATE_REJECTED"
        || (c.last_error && c.last_error.includes("EVALUATION_GATE_REJECTED"))
    );
    const hasInvalid = allChunks.some((c: any) => c.status === "failed");

    const readiness: Phase1Readiness = {
      phase1status: job.progress?.phase_status === "complete"
        ? PHASE_1_STATES.COMPLETED
        : PHASE_1_STATES.IN_PROGRESS,
      hasscores: completedChunks > 0,
      coveragepercent: totalChunks > 0 ? completedChunks / totalChunks : 0,
      evaluationvalidity: hasRejection ? "INVALID" : "VALID",
      artifactaccepted: !hasRejection && completedChunks === totalChunks,
      artifactrejected: hasRejection,
      disputed: false,
    };

    const decision = gatePhase2OnPhase1(readiness);
    if (!decision.ok) {
      console.log("[Phase2Gate] Blocked:", decision);
    }
    return decision.ok;
  } catch (err) {
    console.error("[Phase2Gate] Error checking gate, fail-closed:", err);
    return false; // fail-closed
  }
}
