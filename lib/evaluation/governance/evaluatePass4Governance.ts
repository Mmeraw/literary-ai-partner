import type {
  CrossCheckCriterionResult,
  CrossCheckOutput,
} from "@/lib/evaluation/pipeline/perplexityCrossCheck";
import type { CriterionKey } from "@/schemas/criteria-keys";

export type GovernanceBlockCode =
  | "PASS4_CANON_INVALID"
  | "PASS4_WEAK_AGREEMENT"
  | "PASS4_DISPUTED_CRITERIA";

export interface GovernanceDecision {
  ok: boolean;
  blockCode?: GovernanceBlockCode;
  severity?: "warning" | "error";
  message?: string;
  auditContext?: Record<string, unknown>;
}

/**
 * Per-criterion conflict summary surfaced for the user / report renderer.
 * Carries everything needed to articulate the disagreement clearly:
 *   - both scores, both rationales, both evidence/signal lists
 *   - delta and direction
 * The report renderer reads this off auditContext.criterionConflicts to
 * show "PRIMARY says X because A, SECONDARY says Y because B" per
 * disputed criterion. No conflict ships without an articulated reason.
 */
export interface CriterionConflict {
  criterion: CriterionKey;
  primaryScore: number | null;
  primaryRationale: string;
  primaryDetectedSignals: string[];
  secondaryScore: number | null;
  secondaryRationale: string;
  secondaryDetectedSignals: string[];
  secondaryDoctrineTrace: string[];
  delta: number | null;
  direction: "HIGHER" | "LOWER" | "MATCH" | "MISSING" | "INVALID";
  reason: string;
}

function summarizeConflict(
  key: CriterionKey,
  result: CrossCheckCriterionResult,
): CriterionConflict {
  const direction = result.direction;
  const delta = result.delta;
  const primary = result.openaiScore;
  const secondary = result.perplexityScore;

  // Build a single-sentence reason so the consumer always has a clear
  // human-readable articulation of WHY this criterion is in conflict,
  // never just a criterion key.
  let reason: string;
  if (direction === "MISSING") {
    reason = `Secondary cross-check could not locate evidence for "${key}" in the manuscript window.`;
  } else if (direction === "INVALID") {
    reason = `Secondary cross-check returned a structurally invalid response for "${key}" (missing evidence, reasoning, or doctrine trace).`;
  } else if (direction === "MATCH") {
    reason = `Primary and Secondary agree on "${key}" (both at ${primary ?? "n/a"}).`;
  } else {
    const verdict = direction === "HIGHER" ? "higher" : "lower";
    const deltaPart = delta !== null ? ` (delta ${delta > 0 ? "+" : ""}${delta})` : "";
    reason =
      `Secondary scored "${key}" ${verdict} than Primary` +
      `${deltaPart}: Primary ${primary ?? "n/a"} vs Secondary ${secondary ?? "n/a"}. ` +
      `User should review both rationales and deconflict.`;
  }

  return {
    criterion: key,
    primaryScore: primary,
    primaryRationale: result.openaiRationale,
    primaryDetectedSignals: result.openaiDetectedSignals,
    secondaryScore: secondary,
    secondaryRationale: result.perplexityRationale,
    secondaryDetectedSignals: result.perplexityDetectedSignals,
    secondaryDoctrineTrace: result.perplexityDoctrineTrace,
    delta,
    direction,
    reason,
  };
}

function buildCriterionConflicts(
  crossCheck: CrossCheckOutput,
  keys: CriterionKey[],
): CriterionConflict[] {
  return keys
    .map((key) => {
      const result = crossCheck.criteria[key];
      if (!result) return null;
      return summarizeConflict(key, result);
    })
    .filter((c): c is CriterionConflict => c !== null);
}

export function evaluatePass4Governance(
  crossCheck?: CrossCheckOutput
): GovernanceDecision {
  if (!crossCheck) {
    return { ok: true };
  }

  // Only structural canon invalidity is a hard fail. Score disagreement
  // (weak / disputed) is ADVISORY — the report ships with both verdicts
  // surfaced per criterion and a clearly articulated reason for each
  // conflict. The user deconflicts, not the pipeline.
  if (!crossCheck.canonValid || crossCheck.invalidCriteria.length > 0) {
    const invalidConflicts = buildCriterionConflicts(
      crossCheck,
      crossCheck.invalidCriteria,
    );
    return {
      ok: false,
      blockCode: "PASS4_CANON_INVALID",
      severity: "error",
      message:
        `Pass 4 cross-check is canon-invalid on ${crossCheck.invalidCriteria.length} criteria: ` +
        `${crossCheck.invalidCriteria.join(", ")}. ` +
        "One or more criteria are missing evidence, reasoning, or doctrine trace " +
        "and cannot be deconflicted by the user.",
      auditContext: {
        canonValid: crossCheck.canonValid,
        invalidCriteria: crossCheck.invalidCriteria,
        disputedCriteria: crossCheck.disputedCriteria,
        overallAgreement: crossCheck.overallAgreement,
        model: crossCheck.model,
        crossCheckedAt: crossCheck.crossCheckedAt,
        criterionConflicts: invalidConflicts,
      },
    };
  }

  // Weak overall agreement: advisory warning, ships with per-criterion
  // articulation so the user understands WHY Primary and Secondary diverge.
  if (crossCheck.overallAgreement === "WEAK") {
    const conflicts = buildCriterionConflicts(
      crossCheck,
      crossCheck.disputedCriteria,
    );
    const list =
      crossCheck.disputedCriteria.length > 0
        ? crossCheck.disputedCriteria.join(", ")
        : "(none individually disputed; overall pattern weak)";
    return {
      ok: false,
      blockCode: "PASS4_WEAK_AGREEMENT",
      severity: "warning",
      message:
        `Primary and Secondary evaluations diverge on ${crossCheck.disputedCriteria.length} criteria: ` +
        `${list}. Report ships with both verdicts surfaced per criterion; ` +
        "user should review the rationale on each disputed criterion and deconflict.",
      auditContext: {
        disputedCriteria: crossCheck.disputedCriteria,
        overallAgreement: crossCheck.overallAgreement,
        model: crossCheck.model,
        crossCheckedAt: crossCheck.crossCheckedAt,
        criterionConflicts: conflicts,
      },
    };
  }

  // Some disputed criteria but overall agreement is STRONG or MODERATE:
  // still advisory, same per-criterion articulation.
  if (crossCheck.disputedCriteria.length > 0) {
    const conflicts = buildCriterionConflicts(
      crossCheck,
      crossCheck.disputedCriteria,
    );
    return {
      ok: false,
      blockCode: "PASS4_DISPUTED_CRITERIA",
      severity: "warning",
      message:
        `Primary and Secondary disagree on ${crossCheck.disputedCriteria.length} criteria: ` +
        `${crossCheck.disputedCriteria.join(", ")}. ` +
        "Overall agreement is otherwise sound; user should review the rationale on each " +
        "disputed criterion and deconflict.",
      auditContext: {
        disputedCriteria: crossCheck.disputedCriteria,
        overallAgreement: crossCheck.overallAgreement,
        model: crossCheck.model,
        crossCheckedAt: crossCheck.crossCheckedAt,
        criterionConflicts: conflicts,
      },
    };
  }

  return { ok: true };
}
