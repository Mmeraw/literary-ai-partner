/**
 * Canon Drift Assertion Helper — RevisionGrade
 *
 * Use inside fixture tests and success-path tests to verify that a
 * PassArtifact contains all canonical criteria from CRITERIA_KEYS.
 *
 * This catches the exact mismatch where a fixture builder drifts
 * below canon (e.g., uses 1 criterion instead of 13).
 */
import { CRITERIA_KEYS } from "../../schemas/criteria-keys";
import type { PassArtifact } from "../../lib/jobs/finalize.types";

export function assertCanonCompletePassArtifact(artifact: PassArtifact): void {
  const required = new Set<string>(CRITERIA_KEYS);
  const actual = artifact.criteria.map((c) => c.criterion_id);
  const unique = new Set(actual);

  if (actual.length !== CRITERIA_KEYS.length) {
    throw new Error(
      `Expected exactly ${CRITERIA_KEYS.length} criteria entries, got ${actual.length}`,
    );
  }

  if (unique.size !== CRITERIA_KEYS.length) {
    throw new Error(
      `Expected ${CRITERIA_KEYS.length} unique criteria, got ${unique.size}`,
    );
  }

  for (const key of required) {
    if (!unique.has(key)) {
      throw new Error(`Missing canonical criterion: ${key}`);
    }
  }

  // Validate each criterion has required fields
  for (const criterion of artifact.criteria) {
    if (
      typeof criterion.score_0_10 !== "number"
      || !Number.isFinite(criterion.score_0_10)
      || criterion.score_0_10 < 0
      || criterion.score_0_10 > 10
    ) {
      throw new Error(
        `Criterion ${criterion.criterion_id}: invalid score (${criterion.score_0_10})`,
      );
    }
    if (!criterion.rationale || criterion.rationale.trim().length === 0) {
      throw new Error(
        `Criterion ${criterion.criterion_id}: empty rationale`,
      );
    }
    if (!criterion.evidence || criterion.evidence.length === 0) {
      throw new Error(
        `Criterion ${criterion.criterion_id}: no evidence anchors`,
      );
    }
  }
}
