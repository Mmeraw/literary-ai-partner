import {
  evaluateEvaluationFinalizerDecision,
} from "@/lib/evaluation/finalizer";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";

function buildValidEvaluationResult(): EvaluationResultV2 {
  const keys = [
    "concept",
    "narrativeDrive",
    "character",
    "voice",
    "sceneConstruction",
    "dialogue",
    "theme",
    "worldbuilding",
    "pacing",
    "proseControl",
    "tone",
    "narrativeClosure",
    "marketability",
  ] as const;

  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-1",
      manuscript_id: 1,
      user_id: "user-1",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "test",
    },
    overview: {
      verdict: "pass",
      overall_score_0_100: 84,
      scored_criteria_count: 13,
      one_paragraph_summary: "Summary",
      top_3_strengths: [],
      top_3_risks: [],
    },
    criteria: keys.map((key) => ({
      key,
      scorable: true as const,
      status: "SCORABLE" as const,
      signal_present: true,
      signal_strength: "SUFFICIENT" as const,
      confidence_band: "MEDIUM" as const,
      score_0_10: 7,
      rationale: `Rationale for ${key}`,
      evidence: [{ snippet: `Evidence for ${key}` }],
      recommendations: [],
    })),
    recommendations: {
      quick_wins: [],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {},
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.9,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
    },
  };
}

describe("evaluation finalizer decision", () => {
  test("accepts fully scorable 13/13 evaluations for release", () => {
    const result = evaluateEvaluationFinalizerDecision(buildValidEvaluationResult(), 0.75);

    expect(result.releaseBlocked).toBe(false);
    expect(result.validityStatus).toBe("valid");
    expect(result.errors).toEqual([]);
  });

  test("blocks release when any criterion is non-scorable", () => {
    const evaluation = buildValidEvaluationResult();
    evaluation.criteria[9] = {
      ...evaluation.criteria[9],
      scorable: false,
      status: "INSUFFICIENT_SIGNAL",
      signal_strength: "WEAK",
      score_0_10: null,
      insufficient_signal_reason: {
        looked_for: ["sentence control"],
        not_found: ["consistent sentence-level evidence"],
      },
    };
    evaluation.overview.scored_criteria_count = 12;

    const result = evaluateEvaluationFinalizerDecision(evaluation, 0.75);

    expect(result.releaseBlocked).toBe(true);
    expect(result.validityStatus).toBe("invalid");
    expect(result.reason).toMatch(/proseControl|non-scorable|Expected scored_criteria_count/i);
  });

  test("blocks release as disputed when confidence is below threshold", () => {
    const evaluation = buildValidEvaluationResult();
    evaluation.governance.confidence = 0.51;

    const result = evaluateEvaluationFinalizerDecision(evaluation, 0.75);

    expect(result.releaseBlocked).toBe(true);
    expect(result.validityStatus).toBe("disputed");
    expect(result.reason).toMatch(/below release threshold/i);
  });
});