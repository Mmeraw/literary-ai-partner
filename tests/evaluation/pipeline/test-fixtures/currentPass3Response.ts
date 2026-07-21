import {
  countMeaningfulOpportunityRecommendations,
  type GovernedEmptyRecommendationStatus,
} from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";

type JsonRecord = Record<string, unknown>;

export type CurrentRawPass3CriterionInput = JsonRecord & {
  key: CriterionKey;
  recommendations?: unknown[];
};

export type CurrentRawPass3CriterionOptions = {
  emptyDisposition?: {
    status: GovernedEmptyRecommendationStatus;
    rationale: string;
  };
};

export type CurrentRawPass3ResponseInput = JsonRecord & {
  criteria: readonly CurrentRawPass3CriterionInput[];
};

const DEFAULT_EMPTY_DISPOSITION = {
  status: "no_recommendation_warranted",
  rationale:
    "This current Pass 3 fixture intentionally provides no separate evidence-supported revision intervention for this criterion.",
} as const satisfies CurrentRawPass3CriterionOptions["emptyDisposition"];

function defaultRawCriterion(key: CriterionKey): CurrentRawPass3CriterionInput {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    final_rationale:
      `Current Pass 3 fixture analysis for ${key} remains grounded in the supplied axis evidence.`,
    evidence: [],
    recommendations: [],
  };
}

function assertNoDirectDispositionOverride(input: CurrentRawPass3CriterionInput): void {
  if (
    Object.prototype.hasOwnProperty.call(input, "recommendation_status")
    || Object.prototype.hasOwnProperty.call(input, "recommendation_status_rationale")
  ) {
    throw new Error(
      "Current Pass 3 success fixtures cannot override recommendation disposition fields directly. "
      + "Use buildInvalidRawPass3CriterionForDispositionTest only in a fail-closed contract test.",
    );
  }
}

/**
 * Canonical constructor for raw Pass 3 criteria used as successful producer output.
 *
 * The recommendation collection is the input authority. The fixture derives the
 * governed disposition from the same canonical meaningful-recommendation predicate
 * used by production, preventing successful tests from carrying stale or
 * contradictory status metadata.
 */
export function buildCurrentRawPass3Criterion(
  input: CurrentRawPass3CriterionInput,
  options: CurrentRawPass3CriterionOptions = {},
): JsonRecord {
  assertNoDirectDispositionOverride(input);

  const recommendations = Array.isArray(input.recommendations)
    ? [...input.recommendations]
    : [];
  const meaningfulRecommendationCount = countMeaningfulOpportunityRecommendations(
    recommendations,
  );

  if (meaningfulRecommendationCount > 0) {
    return {
      ...input,
      recommendations,
      recommendation_status: "recommendation_provided",
    };
  }

  const emptyDisposition = options.emptyDisposition ?? DEFAULT_EMPTY_DISPOSITION;
  if (emptyDisposition.rationale.trim().length < 20) {
    throw new Error("A current Pass 3 empty-disposition fixture rationale must be substantive.");
  }

  return {
    ...input,
    recommendations,
    recommendation_status: emptyDisposition.status,
    recommendation_status_rationale: emptyDisposition.rationale.trim(),
  };
}

/**
 * Builds complete current raw Pass 3 producer output by construction.
 *
 * Partial fixture overrides remain convenient, but absent canonical criteria are
 * materialized with governed empty dispositions. Duplicate or unknown criterion
 * identities fail instead of being resolved by array order.
 */
export function buildCurrentRawPass3Response<T extends CurrentRawPass3ResponseInput>(
  input: T,
): Omit<T, "criteria"> & { criteria: JsonRecord[] } {
  const overrides = new Map<CriterionKey, CurrentRawPass3CriterionInput>();

  for (const criterion of input.criteria) {
    if (!CRITERIA_KEYS.includes(criterion.key)) {
      throw new Error(`Unknown current Pass 3 fixture criterion: ${String(criterion.key)}`);
    }
    if (overrides.has(criterion.key)) {
      throw new Error(`Duplicate current Pass 3 fixture criterion: ${criterion.key}`);
    }
    overrides.set(criterion.key, criterion);
  }

  const criteria = CRITERIA_KEYS.map((key) =>
    buildCurrentRawPass3Criterion({
      ...defaultRawCriterion(key),
      ...overrides.get(key),
      key,
    }));

  return {
    ...input,
    criteria,
  };
}

export function buildCurrentRawPass3Json(
  input: CurrentRawPass3ResponseInput,
): string {
  return JSON.stringify(buildCurrentRawPass3Response(input));
}

/**
 * Explicit escape hatch for a test whose subject is fail-closed disposition
 * handling. Requiring the expected failure code makes malformed fixture intent
 * visible at the construction site.
 */
export function buildInvalidRawPass3CriterionForDispositionTest(
  input: CurrentRawPass3CriterionInput,
  contradiction: {
    expectedFailureCode: "CRITERION_OPPORTUNITY_COVERAGE_INVALID";
    recommendation_status?: unknown;
    recommendation_status_rationale?: unknown;
  },
): JsonRecord {
  const { expectedFailureCode: _expectedFailureCode, ...disposition } = contradiction;
  return {
    ...input,
    ...disposition,
    recommendations: Array.isArray(input.recommendations) ? [...input.recommendations] : [],
  };
}
