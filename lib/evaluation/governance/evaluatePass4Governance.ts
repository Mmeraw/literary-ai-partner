import type { CrossCheckOutput } from "@/lib/evaluation/pipeline/perplexityCrossCheck";

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

export function evaluatePass4Governance(
  crossCheck?: CrossCheckOutput
): GovernanceDecision {
  if (!crossCheck) {
    return { ok: true };
  }

  if (!crossCheck.canonValid || crossCheck.invalidCriteria.length > 0) {
    return {
      ok: false,
      blockCode: "PASS4_CANON_INVALID",
      severity: "error",
      message:
        "Pass 4 cross-check is canon-invalid: one or more criteria are missing evidence, reasoning, or doctrine trace.",
      auditContext: {
        canonValid: crossCheck.canonValid,
        invalidCriteria: crossCheck.invalidCriteria,
        disputedCriteria: crossCheck.disputedCriteria,
        overallAgreement: crossCheck.overallAgreement,
        model: crossCheck.model,
        crossCheckedAt: crossCheck.crossCheckedAt,
      },
    };
  }

  if (crossCheck.overallAgreement === "WEAK") {
    return {
      ok: false,
      blockCode: "PASS4_WEAK_AGREEMENT",
      severity: "error",
      message:
        "Pass 4 cross-check found weak agreement with the primary evaluation.",
      auditContext: {
        disputedCriteria: crossCheck.disputedCriteria,
        overallAgreement: crossCheck.overallAgreement,
        model: crossCheck.model,
        crossCheckedAt: crossCheck.crossCheckedAt,
      },
    };
  }

  if (crossCheck.disputedCriteria.length > 0) {
    return {
      ok: false,
      blockCode: "PASS4_DISPUTED_CRITERIA",
      severity: "warning",
      message:
        "Pass 4 cross-check found disputed criteria requiring review.",
      auditContext: {
        disputedCriteria: crossCheck.disputedCriteria,
        overallAgreement: crossCheck.overallAgreement,
        model: crossCheck.model,
        crossCheckedAt: crossCheck.crossCheckedAt,
      },
    };
  }

  return { ok: true };
}
