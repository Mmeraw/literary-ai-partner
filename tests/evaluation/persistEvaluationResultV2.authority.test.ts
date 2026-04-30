import { describe, expect, test } from "@jest/globals";

import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { persistEvaluationResultV2 } from "@/lib/evaluation/persistEvaluationResultV2";

function makeBaseResult(
  overall: number,
  scores: { voice: number; proseControl: number; tone: number },
): EvaluationResultV2 {
  const makeCriterion = (key: string, score: number): any => ({
    key,
    scorable: true,
    status: "SCORABLE",
    signal_present: true,
    signal_strength: "SUFFICIENT",
    confidence_band: "HIGH",
    rationale: "Criterion rationale with concrete evidence.",
    evidence: [{ snippet: "Concrete manuscript evidence." }],
    recommendations: [],
    score_0_10: score,
  });

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
  ];

  const criteria = keys.map((key) => {
    if (key === "voice") return makeCriterion(key, scores.voice);
    if (key === "proseControl") return makeCriterion(key, scores.proseControl);
    if (key === "tone") return makeCriterion(key, scores.tone);
    return makeCriterion(key, 7);
  });

  return {
    schema_version: "evaluation_result_v2",
    score_denominator_policy: "full_canonical",
    ids: { evaluation_run_id: "run-authority", manuscript_id: 1, user_id: "user-authority" },
    generated_at: "2026-04-30T00:00:00.000Z",
    engine: { model: "test-model", provider: "openai", prompt_version: "test-prompt" },
    overview: {
      verdict: "pass",
      overall_score_0_100: overall,
      scored_criteria_count: 13,
      one_paragraph_summary: "Summary.",
      top_3_strengths: ["strength one", "strength two", "strength three"],
      top_3_risks: ["risk one", "risk two", "risk three"],
    },
    criteria,
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: {}, processing: {} },
    artifacts: [],
    governance: { confidence: 0.9, warnings: [], limitations: [], policy_family: "test-policy" },
  };
}

function mockSupabaseWithCapture() {
  let capturedPayload: any;

  const supabase = {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
    rpc: async (_fn: string, args: any) => {
      capturedPayload = args;
      return { data: [{ artifact_id: "artifact-authority" }], error: null };
    },
  } as any;

  return {
    supabase,
    getCapturedPayload: () => capturedPayload,
  };
}

async function persistAndCapture(evaluationResult: EvaluationResultV2) {
  const { supabase, getCapturedPayload } = mockSupabaseWithCapture();

  const result = await persistEvaluationResultV2({
    supabase,
    jobId: "job-authority",
    manuscriptId: 1,
    evaluationResult,
    sourceHash: "source-hash",
    progressSnapshot: {},
    totalUnits: 1,
    completedUnits: 1,
  });

  expect(result.persisted).toBe(true);
  const capturedPayload = getCapturedPayload();
  expect(capturedPayload).toBeDefined();
  expect(capturedPayload.p_evaluation_result).toBeDefined();
  return capturedPayload.p_evaluation_result as EvaluationResultV2;
}

describe("persistEvaluationResultV2 authority cap enforcement", () => {
  test("persists AUTHORITY_CAP_APPLIED when Authority Composite cap lowers the score", async () => {
    const persisted = await persistAndCapture(
      makeBaseResult(85, { voice: 4, proseControl: 4, tone: 4 }),
    );

    expect(persisted.overview.overall_score_0_100).toBe(40);
    expect(persisted.score_adjustments).toContainEqual(
      expect.objectContaining({
        reason: "AUTHORITY_CAP_APPLIED",
        composite_0_10: 4,
        threshold_0_10: 6,
        original_overall_0_100: 85,
        capped_overall_0_100: 40,
        inputs: { voice: 4, proseControl: 4, tone: 4 },
      }),
    );
  });

  test("does not persist cap at threshold boundary", async () => {
    const persisted = await persistAndCapture(
      makeBaseResult(70, { voice: 6, proseControl: 6, tone: 6 }),
    );

    expect(persisted.overview.overall_score_0_100).toBe(70);
    expect(persisted.score_adjustments ?? []).not.toContainEqual(
      expect.objectContaining({ reason: "AUTHORITY_CAP_APPLIED" }),
    );
  });

  test("does not raise score when rounded cap is greater than original", async () => {
    const persisted = await persistAndCapture(
      makeBaseResult(55, { voice: 5.95, proseControl: 5.95, tone: 5.95 }),
    );

    expect(persisted.overview.overall_score_0_100).toBe(55);
    expect(persisted.score_adjustments ?? []).not.toContainEqual(
      expect.objectContaining({ reason: "AUTHORITY_CAP_APPLIED" }),
    );
  });
});
