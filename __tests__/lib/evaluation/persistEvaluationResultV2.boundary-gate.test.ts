export {};

import { describe, expect, jest, test } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { persistEvaluationResultV2 } from "../../../lib/evaluation/persistEvaluationResultV2";

function makeValidEvaluationResultV2(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-step1-boundary",
      job_id: "job-step1-boundary",
      manuscript_id: 101,
      user_id: "00000000-0000-0000-0000-000000000101",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "step1-boundary-test",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 70,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: "Boundary gate valid fixture summary.",
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
      rationale: `Criterion ${key} is supported by concrete manuscript evidence.`,
      evidence: [
        { snippet: `"Evidence anchor A for ${key}"` },
        { snippet: `"Evidence anchor B for ${key}"` },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Improve ${key} with a targeted line-level revision tied to this evidence span.`,
          expected_impact: `Improves ${key} clarity and execution consistency.`,
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
      confidence: 0.8,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
      transparency: {},
    },
  };
}

function makeSupabaseStub() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const artifactUpsertRows: Array<Record<string, unknown>> = [];

  const artifactUpsertSingle = jest.fn(async () => ({
    data: { id: `artifact-${artifactUpsertRows.length || 1}` },
    error: null,
  }));
  const artifactUpsertSelect = jest.fn(() => ({ single: artifactUpsertSingle }));
  const artifactUpsert = jest.fn((payload: Record<string, unknown>) => {
    artifactUpsertRows.push(payload);
    return { select: artifactUpsertSelect };
  });

  const readBackQuery = {
    eq: jest.fn(() => readBackQuery),
    maybeSingle: jest.fn(async () => ({ data: { id: "artifact-readback-1" }, error: null })),
  };

  return {
    evaluationJobUpdates,
    from(table: string) {
      if (table === "evaluation_jobs") {
        return {
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "evaluation_artifacts") {
        return {
          upsert: artifactUpsert,
          select: () => readBackQuery,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    artifactUpsertRows,
  };
}

describe("persistEvaluationResultV2 Step 1 boundary gate", () => {
  test("invalid artifact rejects before persistence and never completes job", async () => {
    const supabase = makeSupabaseStub();

    const invalid = {
      ...makeValidEvaluationResultV2(),
      criteria: [],
      overview: {
        ...makeValidEvaluationResultV2().overview,
        scored_criteria_count: 0,
        overall_score_0_100: null,
      },
    } as EvaluationResultV2;

    const result = await persistEvaluationResultV2({
      supabase: supabase as unknown as SupabaseClient,
      jobId: "job-step1-invalid",
      manuscriptId: 101,
      evaluationResult: invalid,
      sourceHash: "sha256:invalid",
      progressSnapshot: { phase: "phase_2", phase_status: "running" },
      totalUnits: 5,
      completedUnits: 4,
    });

    expect(result.persisted).toBe(false);
    expect(result.gateDecision).toBe("FAIL");
    expect(supabase.artifactUpsertRows).toHaveLength(0);

    const completeWrites = supabase.evaluationJobUpdates.filter((p) => p.status === "complete");
    expect(completeWrites).toHaveLength(0);

    const failedWrite = supabase.evaluationJobUpdates.find((p) => p.status === "failed");
    expect(failedWrite).toBeDefined();
    expect(failedWrite).toMatchObject({
      phase_status: "failed",
      failure_code: "EVALUATION_ARTIFACT_VALIDATION_FAILED",
      validity_status: "invalid",
    });
  });

  test("valid artifact persists and marks job complete", async () => {
    const supabase = makeSupabaseStub();

    const result = await persistEvaluationResultV2({
      supabase: supabase as unknown as SupabaseClient,
      jobId: "job-step1-valid",
      manuscriptId: 102,
      evaluationResult: makeValidEvaluationResultV2(),
      sourceHash: "sha256:valid",
      progressSnapshot: { phase: "phase_2", phase_status: "running" },
      totalUnits: 5,
      completedUnits: 5,
    });

    expect(result.persisted).toBe(true);
    expect(result.gateDecision).toBe("PASS");
    expect(supabase.artifactUpsertRows).toHaveLength(1);

    const completeWrite = supabase.evaluationJobUpdates.find((p) => p.status === "complete");
    expect(completeWrite).toBeDefined();
    expect(completeWrite).toMatchObject({
      phase_status: "complete",
      evaluation_result_version: "evaluation_result_v2",
    });
  });

  test("invariant: gate FAIL path never writes status complete", async () => {
    const supabase = makeSupabaseStub();

    const invalid = {
      ...makeValidEvaluationResultV2(),
      criteria: [],
      overview: {
        ...makeValidEvaluationResultV2().overview,
        scored_criteria_count: 0,
        overall_score_0_100: null,
      },
    } as EvaluationResultV2;

    await persistEvaluationResultV2({
      supabase: supabase as unknown as SupabaseClient,
      jobId: "job-step1-invariant",
      manuscriptId: 103,
      evaluationResult: invalid,
      sourceHash: "sha256:invariant",
      progressSnapshot: { phase: "phase_2", phase_status: "running" },
      totalUnits: 5,
      completedUnits: 4,
    });

    expect(supabase.artifactUpsertRows).toHaveLength(0);

    for (const payload of supabase.evaluationJobUpdates) {
      const gateDecision =
        ((payload.progress as Record<string, unknown> | undefined)?.gate_enforcement as Record<string, unknown> | undefined)
          ?.gate_decision;
      if (gateDecision === "FAIL") {
        expect(payload.status).not.toBe("complete");
      }
    }
  });
});
