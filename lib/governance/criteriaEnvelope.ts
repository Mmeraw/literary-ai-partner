/**
 * Criteria envelope validation for governance.
 *
 * Enforces that exactly 13 criteria are present with valid scores.
 */

import {
  CANONICAL_CRITERIA,
  isCanonicalCriterion,
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
      "CRITERIA_SCHEMA_VIOLATION",
      "Evaluation envelope must have criteria array",
      { envelope }
    );
  }

  if (!Array.isArray(envelope.criteria)) {
    throw new GovernanceError(
      "CRITERIA_SCHEMA_VIOLATION",
      "Criteria must be an array",
      { criteria: envelope.criteria }
    );
  }

  if (envelope.criteria.length !== CANONICAL_CRITERIA.length) {
    throw new GovernanceError(
      "CRITERIA_SCHEMA_VIOLATION",
      `Expected exactly ${CANONICAL_CRITERIA.length} criteria, got ${envelope.criteria.length}`,
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
        "CRITERIA_SCHEMA_VIOLATION",
        `Missing required canonical criterion: ${canonKey}`,
        { missingKey: canonKey, provided: Array.from(providedKeys) }
      );
    }
  }

  // Verify no extra keys are present
  for (const key of providedKeys) {
    if (!isCanonicalCriterion(key)) {
      throw new GovernanceError(
        "CRITERIA_SCHEMA_VIOLATION",
        `Non-canonical criterion provided: ${key}`,
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
      "CRITERIA_SCHEMA_VIOLATION",
      `Criterion ${criterion.key} score must be a number, got ${typeof criterion.score}`,
      { key: criterion.key, scoreType: typeof criterion.score, score: criterion.score }
    );
  }

  if (!Number.isInteger(criterion.score)) {
    throw new GovernanceError(
      "CRITERIA_SCHEMA_VIOLATION",
      `Criterion ${criterion.key} score must be an integer, got ${criterion.score}`,
      { key: criterion.key, score: criterion.score }
    );
  }

  if (criterion.score < CRITERION_SCORE_MIN || criterion.score > CRITERION_SCORE_MAX) {
    throw new GovernanceError(
      "CRITERIA_SCHEMA_VIOLATION",
      `Criterion ${criterion.key} score must be in [${CRITERION_SCORE_MIN}..${CRITERION_SCORE_MAX}], got ${criterion.score}`,
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

  const { CRITERION_WEIGHT_MAP } = require("./canonicalCriteria");

  let wcs = 0;
  for (const criterion of envelope.criteria) {
    const weight = CRITERION_WEIGHT_MAP.get(criterion.key);
    if (weight === undefined) {
      throw new GovernanceError(
        "CRITERIA_SCHEMA_VIOLATION",
        `No weight mapping found for criterion ${criterion.key}`,
        { key: criterion.key }
      );
    }
    wcs += criterion.score * weight;
  }

  return wcs;
}
