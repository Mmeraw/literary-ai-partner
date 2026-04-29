import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";

export type ArtifactValidationIssueCode =
  | "ARTIFACT_NOT_OBJECT"
  | "CRITERIA_NOT_ARRAY"
  | "CRITERION_MISSING"
  | "CRITERION_SCORE_NOT_INTEGER"
  | "CRITERION_SCORE_OUT_OF_RANGE"
  | "CRITERION_EVIDENCE_MISSING"
  | "CRITERION_REASONING_MISSING"
  | "CRITERION_NON_CANONICAL_KEY";

export type ArtifactValidationIssue = {
  code: ArtifactValidationIssueCode;
  path: string;
  message: string;
};

export type ArtifactValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: ArtifactValidationIssue[] };

function hasNonEmptyText(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && item.trim().length > 0);
  }
  return false;
}

export function validateEvaluationArtifact(artifact: unknown): ArtifactValidationResult {
  const issues: ArtifactValidationIssue[] = [];

  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return {
      ok: false,
      issues: [
        {
          code: "ARTIFACT_NOT_OBJECT",
          path: "$",
          message: "Evaluation artifact must be an object.",
        },
      ],
    };
  }

  const result = artifact as EvaluationResultV2;
  if (!Array.isArray(result.criteria)) {
    return {
      ok: false,
      issues: [
        {
          code: "CRITERIA_NOT_ARRAY",
          path: "$.criteria",
          message: "Artifact must contain a criteria array.",
        },
      ],
    };
  }

  const criteriaByKey = new Map(result.criteria.map((criterion) => [criterion.key, criterion]));

  for (const key of CRITERIA_KEYS) {
    const criterion = criteriaByKey.get(key);
    if (!criterion) {
      issues.push({
        code: "CRITERION_MISSING",
        path: `$.criteria.${key}`,
        message: `Missing canonical criterion: ${key}`,
      });
      continue;
    }

    if (typeof criterion.score_0_10 !== "number" || !Number.isInteger(criterion.score_0_10)) {
      issues.push({
        code: "CRITERION_SCORE_NOT_INTEGER",
        path: `$.criteria.${key}.score_0_10`,
        message: `Criterion ${key} must have an integer score.`,
      });
    } else if (criterion.score_0_10 < 0 || criterion.score_0_10 > 10) {
      issues.push({
        code: "CRITERION_SCORE_OUT_OF_RANGE",
        path: `$.criteria.${key}.score_0_10`,
        message: `Criterion ${key} score must be between 0 and 10.`,
      });
    }

    const evidenceText = criterion.evidence.map((item) => item.snippet);
    if (!hasNonEmptyText(evidenceText)) {
      issues.push({
        code: "CRITERION_EVIDENCE_MISSING",
        path: `$.criteria.${key}.evidence`,
        message: `Criterion ${key} must include evidence.`,
      });
    }

    if (!hasNonEmptyText(criterion.rationale)) {
      issues.push({
        code: "CRITERION_REASONING_MISSING",
        path: `$.criteria.${key}.rationale`,
        message: `Criterion ${key} must include reasoning.`,
      });
    }
  }

  const canonicalKeySet = new Set(CRITERIA_KEYS);
  for (const criterion of result.criteria) {
    if (!canonicalKeySet.has(criterion.key)) {
      issues.push({
        code: "CRITERION_NON_CANONICAL_KEY",
        path: `$.criteria.${criterion.key}`,
        message: `Non-canonical criterion key found: ${criterion.key}`,
      });
    }
  }

  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}