import type { CriterionConfidenceLevel } from "./criterionConfidence";

export type ScoreConfidenceReconciliationInput = {
  score_0_10: number | null;
  confidence_score_0_100: number;
  confidence_level: CriterionConfidenceLevel;
  support_family_score: number;
  explanation_family_score: number;
  has_meaningful_anchor: boolean;
  has_mechanism_reasoning: boolean;
  has_anchored_recommendation: boolean;
};

export type ScoreConfidenceReconciliationResult = {
  confidence_score_0_100: number;
  confidence_level: CriterionConfidenceLevel;
  reasons: string[];
};

const LOW_MAX = 59;
const MODERATE_MIN = 60;
const MODERATE_FLOOR_FOR_SUPPORTED_HIGH_SCORE = 60;
const MODERATE_CEILING_FOR_UNSTABLE_LOW_SCORE = 84;

function toConfidenceLevel(score: number): CriterionConfidenceLevel {
  if (score >= 85) return "high";
  if (score >= MODERATE_MIN) return "moderate";
  return "low";
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function hasEvidenceBackedHighScore(input: ScoreConfidenceReconciliationInput): boolean {
  if (input.score_0_10 === null || input.score_0_10 <= 5) return false;

  const balancedSupport = input.support_family_score >= 25 && input.explanation_family_score >= 20;
  const explicitEvidenceChain =
    input.has_meaningful_anchor &&
    input.has_mechanism_reasoning &&
    input.has_anchored_recommendation;

  return balancedSupport || explicitEvidenceChain;
}

function hasUnstableLowScoreAuthority(input: ScoreConfidenceReconciliationInput): boolean {
  if (input.score_0_10 === null || input.score_0_10 >= 4) return false;

  return input.support_family_score < 45 || input.explanation_family_score < 25;
}

/**
 * Deterministically reconciles the authority of a criterion confidence label
 * with its emitted score before QualityGateV2 sees the artifact.
 *
 * This deliberately does NOT blind-cap scores. If a high score has enough
 * evidence/reasoning support, confidence is raised to moderate. If it does
 * not, the low-confidence/high-score contradiction is preserved so
 * QualityGateV2 can still fail closed.
 */
export function reconcileScoreConfidence(
  input: ScoreConfidenceReconciliationInput,
): ScoreConfidenceReconciliationResult {
  const reasons: string[] = [];
  let confidenceScore = clamp(input.confidence_score_0_100);
  let confidenceLevel = input.confidence_level;

  if (hasEvidenceBackedHighScore(input) && confidenceLevel === "low") {
    confidenceScore = Math.max(confidenceScore, MODERATE_FLOOR_FOR_SUPPORTED_HIGH_SCORE);
    confidenceLevel = toConfidenceLevel(confidenceScore);
    reasons.push(
      "Score-confidence reconciled to moderate because the score has manuscript anchor, mechanism reasoning, and recommendation support",
    );
  }

  if (hasUnstableLowScoreAuthority(input) && confidenceLevel === "high") {
    confidenceScore = Math.min(confidenceScore, MODERATE_CEILING_FOR_UNSTABLE_LOW_SCORE);
    confidenceLevel = toConfidenceLevel(confidenceScore);
    reasons.push(
      "Score-confidence reconciled to moderate because a low score lacks enough support to carry high-confidence authority",
    );
  }

  // Keep unsupported high-score/low-confidence contradictions visible. The gate
  // must still reject them instead of letting reconciliation launder weak output.
  if (
    input.score_0_10 !== null &&
    input.score_0_10 > 5 &&
    confidenceLevel === "low" &&
    confidenceScore <= LOW_MAX
  ) {
    reasons.push(
      "Score-confidence contradiction preserved for QualityGateV2 because evidence support is insufficient",
    );
  }

  return {
    confidence_score_0_100: confidenceScore,
    confidence_level: confidenceLevel,
    reasons,
  };
}
