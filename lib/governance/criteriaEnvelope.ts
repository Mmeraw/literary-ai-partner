/**
 * Criteria envelope validation for governance.
 *
 * Enforces that exactly 13 criteria are present with valid scores.
 */

import {
  CANONICAL_CRITERIA,
  isCanonicalCriterion,
  CRITERION_WEIGHT_MAP,
} from "./canonicalCriteria";
import { GovernanceError } from "./errors";
import type { EvaluationEnvelope, CriterionScore } from "./types";

export const CRITERION_SCORE_MIN = 1;
export const CRITERION_SCORE_MAX = 10;

/**
 * Validates that an evaluation envelope has exactly 13 canonical criteria
 * with integer scores in [1..10].
 *
 * @throws GovernanceError with code CRITERIA_SCHEMA_VIOLATION if validation fails
 */
export function validateCriteriaEnvelope(envelope: EvaluationEnvelope): void {
  if (!envelope.criteria) {
    throw new GovernanceError(
      "Evaluation envelope must have criteria array",
      "CRITERIA_SCHEMA_VIOLATION",
      { envelope }
    );
  }

  if (!Array.isArray(envelope.criteria)) {
    throw new GovernanceError(
      "Criteria must be an array",
      "CRITERIA_SCHEMA_VIOLATION",
      { criteria: envelope.criteria }
    );
  }

  if (envelope.criteria.length !== CANONICAL_CRITERIA.length) {
    throw new GovernanceError(
      `Expected exactly ${CANONICAL_CRITERIA.length} criteria, got ${envelope.criteria.length}`,
      "CRITERIA_SCHEMA_VIOLATION",
      {
        expected: CANONICAL_CRITERIA.length,
        actual: envelope.criteria.length,
        provided: envelope.criteria.map((c) => c.key),
        canonical: Array.from(CANONICAL_CRITERIA),
      }
    );
  }

  const providedKeys = new Set(envelope.criteria.map((c) => c.key));

  // Verify all canonical keys are present
  for (const canonKey of CANONICAL_CRITERIA) {
    if (!providedKeys.has(canonKey)) {
      throw new GovernanceError(
        `Missing required canonical criterion: ${canonKey}`,
        "CRITERIA_SCHEMA_VIOLATION",
        { missingKey: canonKey, provided: Array.from(providedKeys) }
      );
    }
  }

  // Verify no extra keys are present
  for (const key of providedKeys) {
    if (!isCanonicalCriterion(key)) {
      throw new GovernanceError(
        `Non-canonical criterion provided: ${key}`,
        "CRITERIA_SCHEMA_VIOLATION",
        { nonCanonicalKey: key, canonical: Array.from(CANONICAL_CRITERIA) }
      );
    }
  }

  // Validate scores
  for (const criterion of envelope.criteria) {
    validateCriterionScore(criterion);
  }
}

/**
 * Validates a single criterion score.
 *
 * @throws GovernanceError with code CRITERIA_SCHEMA_VIOLATION if validation fails
 */
export function validateCriterionScore(criterion: CriterionScore): void {
  if (typeof criterion.score !== "number") {
    throw new GovernanceError(
      `Criterion ${criterion.key} score must be a number, got ${typeof criterion.score}`,
      "CRITERIA_SCHEMA_VIOLATION",
      { key: criterion.key, scoreType: typeof criterion.score, score: criterion.score }
    );
  }

  if (!Number.isInteger(criterion.score)) {
    throw new GovernanceError(
      `Criterion ${criterion.key} score must be an integer, got ${criterion.score}`,
      "CRITERIA_SCHEMA_VIOLATION",
      { key: criterion.key, score: criterion.score }
    );
  }

  if (criterion.score < CRITERION_SCORE_MIN || criterion.score > CRITERION_SCORE_MAX) {
    throw new GovernanceError(
      `Criterion ${criterion.key} score must be in [${CRITERION_SCORE_MIN}..${CRITERION_SCORE_MAX}], got ${criterion.score}`,
      "CRITERIA_SCHEMA_VIOLATION",
      {
        key: criterion.key,
        score: criterion.score,
        min: CRITERION_SCORE_MIN,
        max: CRITERION_SCORE_MAX,
      }
    );
  }
}

/**
 * Computes the weighted composite score (WCS) from criteria.
 *
 * Validates envelope structure first, then multiplies each criterion by its weight
 * and returns the sum.
 *
 * @throws GovernanceError if validation fails
 */
export function computeWeightedCompositeScore(envelope: EvaluationEnvelope): number {
  validateCriteriaEnvelope(envelope);

  let wcs = 0;
  for (const criterion of envelope.criteria) {
    const weight = CRITERION_WEIGHT_MAP[criterion.key];
    if (weight === undefined) {
      throw new GovernanceError(
        `No weight mapping found for criterion ${criterion.key}`,
        "CRITERIA_SCHEMA_VIOLATION",
        { key: criterion.key }
      );
    }
    wcs += criterion.score * weight;
  }

  return wcs;
}
