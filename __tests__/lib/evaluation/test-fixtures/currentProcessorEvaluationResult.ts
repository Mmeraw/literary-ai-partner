import {
  requireCurrentRecommendationDisposition,
  type RecommendationStatus,
} from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type {
  CurrentEvaluationCriterionV2,
  CurrentEvaluationResultV2,
  EvaluationCriterionV2,
  EvaluationResultV2,
  ScorableCriterionV2,
} from "@/schemas/evaluation-result-v2";

type CriterionRecommendation = EvaluationCriterionV2["recommendations"][number];

export type ProcessorCriterionFixtureOverride = Partial<
  Omit<
    ScorableCriterionV2,
    "key" | "recommendations" | "recommendation_status" | "recommendation_status_rationale"
  >
> & {
  key: CriterionKey;
  recommendations?: CriterionRecommendation[];
  recommendation_status?: RecommendationStatus;
  recommendation_status_rationale?: string;
};

type EvaluationIds = EvaluationResultV2["ids"];
type EvaluationEngine = EvaluationResultV2["engine"];
type EvaluationOverview = EvaluationResultV2["overview"];
type EvaluationRecommendations = EvaluationResultV2["recommendations"];
type EvaluationMetrics = EvaluationResultV2["metrics"];
type EvaluationGovernance = EvaluationResultV2["governance"];

export type ProcessorEvaluationResultFixtureOverrides = Omit<
  Partial<EvaluationResultV2>,
  "ids" | "engine" | "overview" | "criteria" | "recommendations" | "metrics" | "governance"
> & {
  ids?: Partial<EvaluationIds>;
  engine?: Partial<EvaluationEngine>;
  overview?: Partial<EvaluationOverview>;
  criteria?: readonly ProcessorCriterionFixtureOverride[];
  recommendations?: {
    quick_wins?: EvaluationRecommendations["quick_wins"];
    strategic_revisions?: EvaluationRecommendations["strategic_revisions"];
  };
  metrics?: {
    manuscript?: EvaluationMetrics["manuscript"];
    processing?: EvaluationMetrics["processing"];
  };
  governance?: Partial<EvaluationGovernance>;
};

const EMPTY_DISPOSITION_RATIONALE =
  "The processor fixture intentionally provides no supported revision recommendation for this criterion.";

function defaultCriterion(key: CriterionKey): ScorableCriterionV2 {
  return {
    key,
    scorable: true,
    status: "SCORABLE",
    signal_present: true,
    signal_strength: "SUFFICIENT",
    confidence_band: "MEDIUM",
    score_0_10: 7,
    rationale: `Criterion ${key} is supported by manuscript evidence and coherent analysis.`,
    evidence: [
      {
        snippet: `Manuscript evidence establishes the current ${key} assessment.`,
      },
    ],
    recommendations: [],
    recommendation_status: "no_recommendation_warranted",
    recommendation_status_rationale: EMPTY_DISPOSITION_RATIONALE,
  };
}

function buildCurrentCriterion(
  key: CriterionKey,
  override?: ProcessorCriterionFixtureOverride,
): CurrentEvaluationCriterionV2 {
  const base = defaultCriterion(key);
  const recommendations = override?.recommendations ?? base.recommendations;
  const hasRecommendations = recommendations.length > 0;
  const recommendationStatus =
    override?.recommendation_status
    ?? (hasRecommendations ? "recommendation_provided" : "no_recommendation_warranted");
  const recommendationStatusRationale = hasRecommendations
    ? override?.recommendation_status_rationale
    : override?.recommendation_status_rationale ?? EMPTY_DISPOSITION_RATIONALE;

  const candidate: ScorableCriterionV2 = {
    ...base,
    ...override,
    key,
    recommendations,
    recommendation_status: recommendationStatus,
    recommendation_status_rationale: recommendationStatusRationale,
  };

  return requireCurrentRecommendationDisposition(candidate, {
    score: candidate.score_0_10,
    scorable: candidate.scorable,
    criterionStatus: candidate.status,
    context: `processor_test_fixture:${key}`,
  });
}

function buildCurrentCriteria(
  overrides: readonly ProcessorCriterionFixtureOverride[] | undefined,
): CurrentEvaluationCriterionV2[] {
  const byKey = new Map<CriterionKey, ProcessorCriterionFixtureOverride>();
  for (const override of overrides ?? []) {
    if (byKey.has(override.key)) {
      throw new Error(`Duplicate processor fixture criterion override: ${override.key}`);
    }
    byKey.set(override.key, override);
  }

  return CRITERIA_KEYS.map((key) => buildCurrentCriterion(key, byKey.get(key)));
}

/**
 * Single construction authority for processor integration-test EvaluationResultV2 values.
 *
 * The factory keeps historical/read types out of current processor fixtures and makes
 * recommendation disposition/cardinality contradictions impossible to create silently.
 * Tests that intentionally exercise an invalid downstream gate should mock that gate's
 * violation result; they must not smuggle an unrelated malformed current-write artifact
 * through an earlier processor boundary.
 */
export function makeCurrentProcessorEvaluationResult(
  overrides: ProcessorEvaluationResultFixtureOverrides = {},
): CurrentEvaluationResultV2 {
  const criteria = buildCurrentCriteria(overrides.criteria);
  const scoredCriteriaCount = criteria.filter((criterion) => criterion.scorable).length;

  return {
    schema_version: "evaluation_result_v2",
    ...overrides,
    ids: {
      evaluation_run_id: "run-processor-fixture",
      manuscript_id: 456,
      user_id: "00000000-0000-0000-0000-000000000001",
      ...overrides.ids,
    },
    generated_at: overrides.generated_at ?? "2026-07-20T00:00:00.000Z",
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "processor-fixture-v1",
      ...overrides.engine,
    },
    overview: {
      verdict: "conditional",
      overall_score_0_100: 70,
      one_sentence_pitch:
        "A processor fixture preserves canonical evaluation authority across integration boundaries.",
      one_paragraph_pitch:
        "A processor fixture exercises canonical evaluation, governance, and persistence boundaries while retaining complete criterion coverage and governed recommendation dispositions.",
      one_paragraph_summary:
        "The processor fixture provides complete current-write evaluation authority for boundary-focused tests.",
      top_3_strengths: ["Canonical criterion coverage remains complete."],
      top_3_risks: ["Boundary regressions must fail before persistence."],
      ...overrides.overview,
      scored_criteria_count: overrides.overview?.scored_criteria_count ?? scoredCriteriaCount,
    },
    criteria,
    recommendations: {
      quick_wins: overrides.recommendations?.quick_wins ?? [],
      strategic_revisions: overrides.recommendations?.strategic_revisions ?? [],
    },
    metrics: {
      manuscript: overrides.metrics?.manuscript ?? {},
      processing: overrides.metrics?.processing ?? {},
    },
    artifacts: overrides.artifacts ?? [],
    governance: {
      confidence: 0.8,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      ...overrides.governance,
    },
  };
}
