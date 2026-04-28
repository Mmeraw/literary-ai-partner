import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import type { CriterionKey } from "@/schemas/criteria-keys";
import { minAnchorsFor } from "@/lib/evaluation/signal/criterionObservability";

export type UpstreamIntegrity = "strong" | "mixed" | "weak";
export type AuthorityLevel = "normal" | "constrained" | "blocked";

export type PropagationThresholds = {
  weakLowConfidenceThreshold: number;
  weakMissingEvidenceThreshold: number;
  mixedLowConfidenceThreshold: number;
  mixedModerateConfidenceThreshold: number;
};

export const DEFAULT_PROPAGATION_THRESHOLDS: Readonly<PropagationThresholds> = {
  weakLowConfidenceThreshold: 5,
  weakMissingEvidenceThreshold: 4,
  mixedLowConfidenceThreshold: 3,
  mixedModerateConfidenceThreshold: 4,
};

export type PropagationIntegritySummary = {
  lowConfidenceCount: number;
  moderateConfidenceCount: number;
  weakEvidenceCount: number;
  missingEvidenceCount: number;
  scorableLowConfidenceCount: number;
  bottomScoreCriteria: CriterionKey[];
  upstreamIntegrity: UpstreamIntegrity;
  authorityLevel: AuthorityLevel;
  reasons: string[];
};

function deriveConfidenceLevel(
  c: EvaluationResultV2["criteria"][number],
): "high" | "moderate" | "low" {
  if (c.confidence_level) {
    return c.confidence_level;
  }

  const score = c.confidence_score_0_100;
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "moderate";
  }
  if (score >= 85) return "high";
  if (score >= 60) return "moderate";
  return "low";
}

function deriveBottomScoreCriteria(criteria: EvaluationResultV2["criteria"]): CriterionKey[] {
  const scored = criteria
    .filter((c) => c.status === "SCORABLE" && typeof c.score_0_10 === "number")
    .map((c) => ({ key: c.key, score: c.score_0_10 as number }));

  if (scored.length === 0) {
    return [];
  }

  const minScore = Math.min(...scored.map((c) => c.score));
  const threshold = Math.min(5, minScore + 1);

  return scored
    .filter((c) => c.score <= threshold)
    .map((c) => c.key);
}

export function summarizePropagationIntegrity(
  criteria: EvaluationResultV2["criteria"],
  thresholds: PropagationThresholds = DEFAULT_PROPAGATION_THRESHOLDS,
): PropagationIntegritySummary {
  const lowConfidenceCount = criteria.filter((c) => deriveConfidenceLevel(c) === "low").length;
  const moderateConfidenceCount = criteria.filter(
    (c) => deriveConfidenceLevel(c) === "moderate",
  ).length;

  const missingEvidenceCount = criteria.filter((c) => c.evidence.length === 0).length;
  const weakEvidenceCount = criteria.filter(
    (c) => c.status === "SCORABLE" && c.evidence.length < minAnchorsFor(c.key),
  ).length;
  const scorableLowConfidenceCount = criteria.filter(
    (c) => c.status === "SCORABLE" && c.scorability_status === "scorable_low_confidence",
  ).length;

  const reasons: string[] = [];
  let upstreamIntegrity: UpstreamIntegrity = "strong";

  if (
    lowConfidenceCount >= thresholds.weakLowConfidenceThreshold ||
    missingEvidenceCount >= thresholds.weakMissingEvidenceThreshold
  ) {
    upstreamIntegrity = "weak";
    reasons.push("low_or_missing_evidence_cluster");
  } else if (
    lowConfidenceCount >= thresholds.mixedLowConfidenceThreshold ||
    moderateConfidenceCount >= thresholds.mixedModerateConfidenceThreshold ||
    weakEvidenceCount >= thresholds.weakMissingEvidenceThreshold
  ) {
    upstreamIntegrity = "mixed";
    reasons.push("mixed_confidence_profile");
  }

  const authorityLevel: AuthorityLevel =
    upstreamIntegrity === "weak"
      ? "blocked"
      : upstreamIntegrity === "mixed"
        ? "constrained"
        : "normal";

  return {
    lowConfidenceCount,
    moderateConfidenceCount,
    weakEvidenceCount,
    missingEvidenceCount,
    scorableLowConfidenceCount,
    bottomScoreCriteria: deriveBottomScoreCriteria(criteria),
    upstreamIntegrity,
    authorityLevel,
    reasons,
  };
}

function keyToReadableToken(key: CriterionKey): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
}

export function summaryMentionsBottomWeakness(
  summary: string,
  bottomScoreCriteria: CriterionKey[],
): boolean {
  const normalizedSummary = summary.toLowerCase();
  return bottomScoreCriteria.some((key) => normalizedSummary.includes(keyToReadableToken(key)));
}
