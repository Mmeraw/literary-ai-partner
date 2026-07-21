export {};

import { describe, expect, test } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { persistEvaluationResultV2 } from "../../../lib/evaluation/persistEvaluationResultV2";

jest.mock("@/lib/evaluation/pipeline/shortFormFinalSanityCheck", () => ({
  runShortFormFinalSanityCheck: jest.fn(() => ({
    schema_version: "short_form_final_sanity_check_v1",
    verdict: "BLOCK",
    codes: [],
    blocking: true,
    public_safe_reason: "Mocked checker bug: blocking verdict without codes.",
    internal_reason: "Mocked empty violation code list.",
  })),
}));

function makeValidShortFormEvaluationResult(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-empty-codes",
      job_id: "job-empty-codes",
      manuscript_id: 4242,
      user_id: "00000000-0000-0000-0000-000000004242",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "empty-codes-test",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 68,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: "A clean short-form fixture used to isolate the empty-code blocked path.",
      top_3_strengths: ["voice", "dialogue", "pacing"],
      top_3_risks: ["theme", "closure", "worldbuilding"],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true as const,
      status: "SCORABLE" as const,
      signal_present: true,
      signal_strength: "SUFFICIENT" as const,
      confidence_band: "MEDIUM" as const,
      score_0_10: 6,
      rationale: `Criterion ${key}: supported by concrete short-form evidence.`,
      evidence: [
        { snippet: `"Evidence anchor A for ${key}"` },
        { snippet: `"Evidence anchor B for ${key}"` },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Refine ${key} with one manuscript-specific adjustment.`,
          expected_impact: `Improves ${key} clarity and execution consistency.`,
        },
      ],
      recommendation_status: "recommendation_provided" as const,
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
      confidence: 0.75,
      confidence_label: "medium",
      confidence_reasons: [],
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
  const artifactInserts: Array<Record<string, unknown>> = [];

  return {
    evaluationJobUpdates,
    artifactInserts,
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
          insert: (payload: Record<string, unknown>) => {
            artifactInserts.push(payload);
            return {
              then: (cb: (result: { error: null }) => unknown) => {
                return Promise.resolve().then(() => cb({ error: null }));
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table in empty-codes test stub: ${table}`);
    },
    rpc() {
      throw new Error("Atomic persistence must not be reached for blocked empty-codes sanity result.");
    },
  };
}

describe("persistEvaluationResultV2 — short-form blocked sanity with empty codes", () => {
  test("skips kick entirely and terminal-fails when violationCodes is empty", async () => {
    const supabase = makeSupabaseStub();

    const result = await persistEvaluationResultV2({
      supabase: supabase as unknown as SupabaseClient,
      jobId: "job-empty-codes",
      manuscriptId: 4242,
      evaluationResult: makeValidShortFormEvaluationResult(),
      sourceHash: "sha256:empty-codes",
      progressSnapshot: {
        phase: "phase_3",
        phase_status: "running",
        manuscript_word_count: 3_500,
      },
      totalUnits: 10,
      completedUnits: 10,
    });

    expect(result.persisted).toBe(false);
    expect(result.gateDecision).toBe("FAIL");
    expect(supabase.artifactInserts).toHaveLength(0);

    const queuedWrite = supabase.evaluationJobUpdates.find((payload) => payload.status === "queued");
    expect(queuedWrite).toBeUndefined();

    const failedWrite = supabase.evaluationJobUpdates.find((payload) => payload.status === "failed");
    expect(failedWrite).toBeDefined();
    expect(failedWrite).toMatchObject({
      failure_code: "SHORT_FORM_FINAL_SANITY_BLOCKED",
      phase_status: "failed",
    });

    const failedProgress = failedWrite?.progress as Record<string, unknown> | undefined;
    expect(failedProgress?.short_form_final_sanity_check).toMatchObject({
      verdict: "BLOCK",
      blocking: true,
      codes: [],
    });
    expect(failedProgress?.short_form_retry_instruction).toBeUndefined();
    expect(failedProgress?.last_kick_failure_code).toBeUndefined();
  });
});
