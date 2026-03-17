/**
 * Canonical 13 story criteria from Volume II Canon.
 *
 * These are the exactly 13 criteria that every revision evaluation must contain.
 * No additions, no omissions, no deviations.
 *
 * Each criterion has:
 * - A canonical ID (from Canon Doctrine Registry)
 * - A scoring band [1..10]
 * - A weight multiplier (Volume II-A)
 * - Structural significance (for eligibility gate)
 */

export const CANONICAL_CRITERIA = [
  "CONCEPT",
  "MOMENTUM",
  "CHARACTER",
  "POVVOICE",
  "SCENE",
  "DIALOGUE",
  "THEME",
  "WORLD",
  "PACING",
  "PROSE",
  "TONE",
  "CLOSURE",
  "MARKET",
] as const;

export type CriterionKey = (typeof CANONICAL_CRITERIA)[number];

/**
 * Structural criteria are the subset that must pass a minimum threshold
 * for the eligibility gate to PASS (per Volume II-A).
 */
export const STRUCTURAL_CRITERIA: Set<CriterionKey> = new Set([
  "CONCEPT",
  "MOMENTUM",
  "CHARACTER",
  "SCENE",
  "PACING",
  "CLOSURE",
]);

/**
 * Canon ID mappings (Volume II-A reference).
 *
 * These map each criterion to its Canon Doctrine Registry ID.
 * All IDs must be ACTIVE in the registry; no invented placeholder IDs.
 */
export const CRITERION_CANON_ID_MAP: Record<CriterionKey, string> = {
  CONCEPT: "CRIT-CONCEPT-001", // Volume II canon for conceptual integrity
  MOMENTUM: "CRIT-MOMENTUM-001", // pacing and narrative drive
  CHARACTER: "CRIT-CHARACTER-001", // character development and arc
  POVVOICE: "CRIT-POVVOICE-001", // point of view and narrative voice
  SCENE: "CRIT-SCENE-001", // scene structure and composition
  DIALOGUE: "CRIT-DIALOGUE-001", // dialogue quality and authenticity
  THEME: "CRIT-THEME-001", // thematic coherence and depth
  WORLD: "CRIT-WORLD-001", // world-building and setting detail
  PACING: "CRIT-PACING-001", // narrative pacing and rhythm
  PROSE: "CRIT-PROSE-001", // prose quality and style
  TONE: "CRIT-TONE-001", // tonal consistency and appropriateness
  CLOSURE: "CRIT-CLOSURE-001", // ending and resolution quality
  MARKET: "CRIT-MARKET-001", // market viability and appeal
};

/**
 * Volume II-A Score Weights
 *
 * Each criterion has a weight for computing the weighted composite score (WCS).
 * These are locked constants from Volume II-A; do not alter.
 */
export const CRITERION_WEIGHT_MAP: Record<CriterionKey, number> = {
  CONCEPT: 0.10, // 10% weight: foundational
  MOMENTUM: 0.08, // 8% weight
  CHARACTER: 0.10, // 10% weight: foundational
  POVVOICE: 0.07, // 7% weight
  SCENE: 0.09, // 9% weight: structural
  DIALOGUE: 0.06, // 6% weight
  THEME: 0.07, // 7% weight
  WORLD: 0.08, // 8% weight
  PACING: 0.09, // 9% weight: structural
  PROSE: 0.06, // 6% weight
  TONE: 0.06, // 6% weight
  CLOSURE: 0.08, // 8% weight: structural
  MARKET: 0.06, // 6% weight
};

/**
 * Verify the weights sum to exactly 1.0 (sanity check).
 */
const weightSum = Object.values(CRITERION_WEIGHT_MAP).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1.0) > 0.001) {
  throw new Error(
    `CRITERION_WEIGHT_MAP does not sum to 1.0; got ${weightSum}. Weights are locked.`,
  );
}

export function isCanonicalCriterion(key: unknown): key is CriterionKey {
  return typeof key === "string" && CANONICAL_CRITERIA.includes(key as CriterionKey);
}

export function getCanonIdForCriterion(key: CriterionKey): string {
  return CRITERION_CANON_ID_MAP[key];
}

export function getWeightForCriterion(key: CriterionKey): number {
  return CRITERION_WEIGHT_MAP[key];
}

export function isStructuralCriterion(key: CriterionKey): boolean {
  return STRUCTURAL_CRITERIA.has(key);
}
