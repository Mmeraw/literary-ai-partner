import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { EvaluationCriterionV2 } from "@/schemas/evaluation-result-v2";
import type { InputScale } from "./scopePolicy";

export type EvaluationRoute = "SHORT_FORM" | "LONG_FORM";
export type CriterionClaimScope = "LOCAL" | "MANUSCRIPT_WIDE";

export interface CoverageScopeLike {
  sourceChars: number;
  sourceWords: number;
  analyzedChars: number;
  analyzedWords: number;
  strategy: "full_text" | "sampled_beginning_middle_end";
}

export interface ManuscriptCertificationDecision {
  route: EvaluationRoute;
  manuscriptWideCertifiable: boolean;
  reasonCodes: string[];
}

const FULL_MANUSCRIPT_SCOPE_POLICY = Object.freeze(
  Object.fromEntries(
    CRITERIA_KEYS.map((key) => [key, "MANUSCRIPT_WIDE"]),
  ) as Record<CriterionKey, CriterionClaimScope>,
);

export function resolveEvaluationRoute(inputScale?: InputScale): EvaluationRoute {
  return inputScale === "full_manuscript" ? "LONG_FORM" : "SHORT_FORM";
}

export function criterionClaimScope(
  inputScale: InputScale | undefined,
  criterionKey: CriterionKey,
): CriterionClaimScope {
  if (inputScale === "full_manuscript") {
    return FULL_MANUSCRIPT_SCOPE_POLICY[criterionKey];
  }

  return "LOCAL";
}

export function computeManuscriptCertification(params: {
  inputScale?: InputScale;
  partialEvaluation: boolean;
  coverageScope?: CoverageScopeLike;
  hasSynthesisCriteria: boolean;
}): ManuscriptCertificationDecision {
  const route = resolveEvaluationRoute(params.inputScale);
  const reasonCodes: string[] = [];

  if (route === "SHORT_FORM") {
    return {
      route,
      manuscriptWideCertifiable: true,
      reasonCodes,
    };
  }

  if (!params.hasSynthesisCriteria) {
    reasonCodes.push("LONG_FORM_SYNTHESIS_MISSING");
  }

  if (!params.coverageScope) {
    reasonCodes.push("LONG_FORM_COVERAGE_SCOPE_MISSING");
  } else {
    if (params.coverageScope.strategy !== "full_text") {
      reasonCodes.push("LONG_FORM_SAMPLED_COVERAGE");
    }

    if (params.coverageScope.analyzedWords < params.coverageScope.sourceWords) {
      reasonCodes.push("LONG_FORM_INCOMPLETE_WORD_COVERAGE");
    }

    if (params.coverageScope.analyzedChars < params.coverageScope.sourceChars) {
      reasonCodes.push("LONG_FORM_INCOMPLETE_CHAR_COVERAGE");
    }
  }

  if (params.partialEvaluation) {
    reasonCodes.push("LONG_FORM_PARTIAL_EVALUATION");
  }

  return {
    route,
    manuscriptWideCertifiable: reasonCodes.length === 0,
    reasonCodes,
  };
}

export function downgradeCriterionForUncertifiedLongForm(
  criterion: EvaluationCriterionV2,
  reasonCodes: string[],
): EvaluationCriterionV2 {
  const existingReasons = criterion.confidence_reasons ?? [];
  const evidenceBacked = criterion.evidence.some((item) => item.snippet.trim().length > 0);
  const joinedReasonCodes = reasonCodes.join(", ");
  const prefix =
    "The V2 lane fails closed when certification cannot be established from required coverage inputs.";

  return {
    ...criterion,
    scorable: false,
    status: "INSUFFICIENT_SIGNAL",
    signal_present: evidenceBacked,
    signal_strength: evidenceBacked ? "WEAK" : "NONE",
    confidence_band: "LOW",
    score_0_10: null,
    rationale: `${prefix} Existing analysis was retained as local evidence only. Original rationale: ${criterion.rationale}`,
    confidence_score_0_100: 25,
    confidence_level: "low",
    confidence_reasons: [...existingReasons, ...reasonCodes],
    scorability_status: "non_scorable",
    insufficient_signal_reason: {
      looked_for: ["full-manuscript coverage", "certifiable manuscript-wide synthesis"],
      not_found: joinedReasonCodes.length > 0 ? reasonCodes : ["LONG_FORM_CERTIFICATION_WITHHELD"],
    },
  };
}

export function buildCoverageLimitedSummary(coverageScope?: CoverageScopeLike): string {
  if (!coverageScope) {
    return "This long-form evaluation is coverage-limited and cannot support certified manuscript-wide scoring.";
  }

  return `This long-form evaluation is coverage-limited and cannot support certified manuscript-wide scoring (${coverageScope.analyzedWords} of ${coverageScope.sourceWords} words analyzed via ${coverageScope.strategy}).`;
}