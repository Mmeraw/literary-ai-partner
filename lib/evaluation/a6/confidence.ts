import type { A6CriterionInput, A6AnchorLike } from "./types";

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function deriveCriterionConfidence(
  criterion: A6CriterionInput,
  anchorsForCriterion: A6AnchorLike[],
): number {
  let score = 0.4;

  if (criterion.reasoning.trim().length >= 20) score += 0.15;
  if (criterion.evidence_refs.length > 0) score += 0.15;
  if (criterion.evidence_refs.length >= 2) score += 0.1;
  if (anchorsForCriterion.length > 0) score += 0.1;
  if (anchorsForCriterion.every((a) => a.source_excerpt.trim().length > 0)) score += 0.1;

  return Number(clamp01(score).toFixed(2));
}

export function deriveOverallConfidence(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Number(clamp01(avg).toFixed(2));
}
