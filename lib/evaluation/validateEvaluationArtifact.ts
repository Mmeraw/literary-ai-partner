import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import {
  computeManuscriptCertification,
  criterionClaimScope,
} from "@/lib/evaluation/signal/manuscriptClaimPolicy";

export type ArtifactValidationIssueCode =
  | "ARTIFACT_NOT_OBJECT"
  | "CRITERIA_NOT_ARRAY"
  | "CRITERION_MISSING"
  | "CRITERION_SCORE_NOT_INTEGER"
  | "CRITERION_SCORE_OUT_OF_RANGE"
  | "CRITERION_EVIDENCE_MISSING"
  | "CRITERION_REASONING_MISSING"
  | "CRITERION_NON_CANONICAL_KEY"
  | "LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE";

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

    const isScorable = criterion.status === "SCORABLE";
    if (isScorable) {
      if (typeof criterion.score_0_10 !== "number" || !Number.isInteger(criterion.score_0_10)) {
        issues.push({
          code: "CRITERION_SCORE_NOT_INTEGER",
          path: `$.criteria.${key}.score_0_10`,
          message: `Criterion ${key} must have an integer score when status=SCORABLE.`,
        });
      } else if (criterion.score_0_10 < 0 || criterion.score_0_10 > 10) {
        issues.push({
          code: "CRITERION_SCORE_OUT_OF_RANGE",
          path: `$.criteria.${key}.score_0_10`,
          message: `Criterion ${key} score must be between 0 and 10 when status=SCORABLE.`,
        });
      }
    } else if (criterion.score_0_10 !== null) {
      issues.push({
        code: "CRITERION_SCORE_OUT_OF_RANGE",
        path: `$.criteria.${key}.score_0_10`,
        message: `Criterion ${key} must have score_0_10=null when status=${criterion.status}.`,
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

  const transparency = result.governance?.transparency;
  const coverageSummary = transparency?.coverage_summary;
  const evaluationScope = transparency?.evaluation_scope;
  const certification = computeManuscriptCertification({
    inputScale: evaluationScope?.input_scale,
    partialEvaluation: coverageSummary?.partial_evaluation ?? false,
    coverageScope:
      coverageSummary &&
      typeof coverageSummary.source_char_count === "number" &&
      typeof coverageSummary.source_word_count === "number" &&
      typeof coverageSummary.analyzed_char_count === "number" &&
      typeof coverageSummary.analyzed_word_count === "number" &&
      coverageSummary.sampling_strategy
        ? {
            sourceChars: coverageSummary.source_char_count,
            sourceWords: coverageSummary.source_word_count,
            analyzedChars: coverageSummary.analyzed_char_count,
            analyzedWords: coverageSummary.analyzed_word_count,
            strategy: coverageSummary.sampling_strategy,
          }
        : undefined,
    hasSynthesisCriteria: result.criteria.length === CRITERIA_KEYS.length,
  });

  if (
    certification.route === "LONG_FORM" &&
    !certification.manuscriptWideCertifiable
  ) {
    for (const criterion of result.criteria) {
      if (
        criterionClaimScope(evaluationScope?.input_scale, criterion.key) === "MANUSCRIPT_WIDE" &&
        criterion.status === "SCORABLE"
      ) {
        issues.push({
          code: "LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE",
          path: `$.criteria.${criterion.key}.status`,
          message: `Historical artifacts without required coverage fields are non-authoritative until backfilled and revalidated; criterion ${criterion.key} cannot remain SCORABLE for uncertified LONG_FORM coverage.`,
        });
      }
    }
  }

  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}