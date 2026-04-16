import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { validateEvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { runQualityGateV2 } from "@/lib/evaluation/pipeline/qualityGate";

function makeBaseV2Fixture(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-qg-v2",
      job_id: "job-qg-v2",
      manuscript_id: 101,
      user_id: "00000000-0000-0000-0000-000000000101",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "pass1+pass2+pass3",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 70,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: "The chapter demonstrates solid craft with targeted revision opportunities.",
      top_3_strengths: ["voice", "character", "dialogue"],
      top_3_risks: ["pacing", "theme", "closure"],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true as const,
      status: "SCORABLE" as const,
      signal_present: true,
      signal_strength: "SUFFICIENT" as const,
      confidence_band: "MEDIUM" as const,
      score_0_10: 7,
      rationale: `Criterion ${key} is observable with manuscript-grounded evidence and coherent synthesis rationale.`,
      evidence: [
        { snippet: `Evidence anchor A for ${key} with sufficient textual detail.` },
        { snippet: `Evidence anchor B for ${key} to satisfy minimum observability thresholds.` },
        { snippet: `Evidence anchor C for ${key} ensuring deterministic gate compliance.` },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Strengthen ${key} through targeted revision anchored to existing scenes.`,
          expected_impact: `Improves ${key} consistency and reader clarity.`,
        },
      ],
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
      confidence: 0.85,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
    },
  };
}

describe("runQualityGateV2 integration", () => {
  it("passes a canonical EvaluationResultV2 fixture", () => {
    const fixture = makeBaseV2Fixture();
    const validation = validateEvaluationResultV2(fixture);
    expect(validation.valid).toBe(true);

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("fails when non-scorable criteria carry numeric scores", () => {
    const fixture = makeBaseV2Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      scorable: false,
      status: "NOT_APPLICABLE",
      signal_strength: "NONE",
      score_0_10: null,
    } as EvaluationResultV2["criteria"][number];
    fixture.criteria[1] = {
      ...fixture.criteria[1],
      scorable: false,
      status: "NO_SIGNAL",
      signal_strength: "NONE",
      score_0_10: 4,
      insufficient_signal_reason: {
        looked_for: ["scene-level evidence"],
        not_found: ["observable signal"],
      },
    } as EvaluationResultV2["criteria"][number];

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);
    expect(result.checks.some((check) => check.check_id === "v2_score_without_signal" && !check.passed)).toBe(true);
  });

  it("rejects non-canonical signal values via schema contract", () => {
    const fixture = makeBaseV2Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      signal_strength: "MODERATE" as never,
    };

    const validation = validateEvaluationResultV2(fixture);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("NONE|WEAK") || error.includes("SUFFICIENT|STRONG"))).toBe(true);
  });
});
