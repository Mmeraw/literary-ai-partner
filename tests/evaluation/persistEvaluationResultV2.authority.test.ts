import { describe, expect, test } from "@jest/globals";

import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { persistEvaluationResultV2 } from "@/lib/evaluation/persistEvaluationResultV2";

function makeBaseResult(overall: number, scores: { voice: number; proseControl: number; tone: number }): EvaluationResultV2 {
  const makeCriterion = (key: string, score: number | null): any => ({
    key,
    scorable: score !== null,
    status: score !== null ? "SCORABLE" : "NO_SIGNAL",
    signal_present: score !== null,
    signal_strength: score !== null ? "SUFFICIENT" : "NONE",
    confidence_band: "HIGH",
    rationale: "r",
    evidence: [{ snippet: "e" }],
    recommendations: [],
    score_0_10: score,
    insufficient_signal_reason: score === null ? { looked_for: ["x"], not_found: ["y"] } : undefined,
  });

  const keys = [
    "concept","narrativeDrive","character","voice","sceneConstruction","dialogue",
    "theme","worldbuilding","pacing","proseControl","tone","narrativeClosure","marketability",
  ];

  const criteria = keys.map((k) => {
    if (k === "voice") return makeCriterion(k, scores.voice);
    if (k === "proseControl") return makeCriterion(k, scores.proseControl);
    if (k === "tone") return makeCriterion(k, scores.tone);
    return makeCriterion(k, 7);
  });

  return {
    schema_version: "evaluation_result_v2",
    ids: { evaluation_run_id: "run", manuscript_id: 1, user_id: "u" },
    generated_at: new Date().toISOString(),
    engine: { model: "m", provider: "openai", prompt_version: "p" },
    overview: {
      verdict: "pass",
      overall_score_0_100: overall,
      scored_criteria_count: 13,
      one_paragraph_summary: "s",
      top_3_strengths: ["a","b","c"],
      top_3_risks: ["x","y","z"],
    },
    criteria,
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: {}, processing: {} },
    artifacts: [],
    governance: { confidence: 0.9, warnings: [], limitations: [], policy_family: "pf" },
  };
}

function mockSupabase() {
  return {
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    rpc: async () => ({ data: [{ artifact_id: "a" }], error: null }),
  } as any;
}

describe("Authority cap at persistence boundary", () => {
  test("applies cap when composite < threshold", async () => {
    const result = makeBaseResult(85, { voice: 4, proseControl: 4, tone: 4 });
    const out = await persistEvaluationResultV2({
      supabase: mockSupabase(),
      jobId: "j",
      manuscriptId: 1,
      evaluationResult: result,
      sourceHash: "h",
      progressSnapshot: {},
      totalUnits: 1,
      completedUnits: 1,
    });

    expect(out.persisted).toBe(true);
    const capped = (out as any).evaluationResult ?? result; // best-effort read
    expect(capped.overview.overall_score_0_100).toBe(40);
    expect(capped.score_adjustments?.[0]?.reason).toBe("AUTHORITY_CAP_APPLIED");
  });

  test("does not apply cap at boundary (composite = 6)", async () => {
    const result = makeBaseResult(70, { voice: 6, proseControl: 6, tone: 6 });
    const out = await persistEvaluationResultV2({
      supabase: mockSupabase(),
      jobId: "j",
      manuscriptId: 1,
      evaluationResult: result,
      sourceHash: "h",
      progressSnapshot: {},
      totalUnits: 1,
      completedUnits: 1,
    });

    expect(out.persisted).toBe(true);
    const capped = (out as any).evaluationResult ?? result;
    expect(capped.overview.overall_score_0_100).toBe(70);
    expect(capped.score_adjustments).toBeUndefined();
  });

  test("no-raise guarantee holds (cap >= original)", async () => {
    const result = makeBaseResult(55, { voice: 5.95, proseControl: 5.95, tone: 5.95 } as any);
    const out = await persistEvaluationResultV2({
      supabase: mockSupabase(),
      jobId: "j",
      manuscriptId: 1,
      evaluationResult: result,
      sourceHash: "h",
      progressSnapshot: {},
      totalUnits: 1,
      completedUnits: 1,
    });

    expect(out.persisted).toBe(true);
    const capped = (out as any).evaluationResult ?? result;
    expect(capped.overview.overall_score_0_100).toBe(55);
    expect(capped.score_adjustments).toBeUndefined();
  });
});
