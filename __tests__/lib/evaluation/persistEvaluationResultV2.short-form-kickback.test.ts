export {};

import { describe, expect, test } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { persistEvaluationResultV2 } from "../../../lib/evaluation/persistEvaluationResultV2";

function makeShortFormEvaluationWithLongFormLeak(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-short-form-kickback",
      job_id: "job-short-form-kickback",
      manuscript_id: 901,
      user_id: "00000000-0000-0000-0000-000000000901",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "short-form-kickback-test",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 70,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary:
        "This short-form report has adequate evidence but accidentally mentions WAVE in author-facing prose.",
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
      rationale:
        key === "concept"
          ? "The concept is clear, but the report should not reference Golden Spine or Phase 5 in a short-form artifact."
          : `Criterion ${key} is supported by concrete manuscript evidence.`,
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
      confidence_label: "medium",
      confidence_reasons: ["mixed_confidence_profile"],
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
      transparency: {
        propagation_summary: {
          low_confidence_count: 3,
          moderate_confidence_count: 4,
          weak_evidence_count: 1,
          missing_evidence_count: 0,
          scorable_low_confidence_count: 2,
          bottom_score_criteria: ["pacing", "theme"],
          upstream_integrity: "mixed",
          authority_level: "constrained",
          reasons: ["mixed_confidence_profile"],
        },
      },
    },
  };
}

function makeSupabaseStub() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const evaluationArtifactInserts: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ name: string; payload: Record<string, unknown> }> = [];

  return {
    evaluationJobUpdates,
    evaluationArtifactInserts,
    rpcCalls,
    rpc(name: string, payload: Record<string, unknown>) {
      rpcCalls.push({ name, payload });
      return Promise.resolve({ data: [{ artifact_id: "artifact-rpc-1" }], error: null });
    },
    from(table: string) {
      if (table === "evaluation_artifacts") {
        return {
          insert: (payload: Record<string, unknown>) => {
            evaluationArtifactInserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }

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

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("persistEvaluationResultV2 short-form sanity kickback", () => {
  test("SHORT_FORM_LONGFORM_ARTIFACT_LEAK requeues phase_3 with retry instruction instead of terminal failure", async () => {
    const supabase = makeSupabaseStub();

    const result = await persistEvaluationResultV2({
      supabase: supabase as unknown as SupabaseClient,
      jobId: "job-short-form-kickback",
      manuscriptId: 901,
      evaluationResult: makeShortFormEvaluationWithLongFormLeak(),
      sourceHash: "sha256:short-form-kickback",
      progressSnapshot: {
        phase: "phase_3",
        phase_status: "running",
        manuscript_word_count: 3_604,
      },
      totalUnits: 100,
      completedUnits: 100,
    });

    expect(result.persisted).toBe(false);
    expect(result.gateDecision).toBe("FAIL");
    expect(result.reason).toContain("SHORT_FORM_LONGFORM_ARTIFACT_LEAK");
    expect(supabase.rpcCalls).toHaveLength(0);

    expect(supabase.evaluationArtifactInserts).toHaveLength(1);
    expect(supabase.evaluationArtifactInserts[0]).toMatchObject({
      job_id: "job-short-form-kickback",
    });

    const requeueWrite = supabase.evaluationJobUpdates.find((payload) => payload.status === "queued");
    expect(requeueWrite).toBeDefined();
    expect(requeueWrite).toMatchObject({
      status: "queued",
      phase: "phase_3",
      phase_status: "queued",
      failure_code: null,
      last_error: null,
    });

    const progress = requeueWrite?.progress as Record<string, unknown> | undefined;
    expect(progress).toMatchObject({
      phase: "phase_3",
      phase_status: "queued",
      last_kick_failure_code: "SHORT_FORM_LONGFORM_ARTIFACT_LEAK",
      kick_attempts: {
        SHORT_FORM_LONGFORM_ARTIFACT_LEAK: 1,
      },
    });
    expect(progress?.short_form_retry_instruction).toEqual(expect.stringContaining("SHORT_FORM_LONGFORM_ARTIFACT_LEAK"));
    expect(progress?.short_form_retry_instruction).toEqual(expect.stringContaining("WAVE"));

    const terminalFailureWrite = supabase.evaluationJobUpdates.find((payload) => payload.status === "failed");
    expect(terminalFailureWrite).toBeUndefined();
  });
});
