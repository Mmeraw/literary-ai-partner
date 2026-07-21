/**
 * Unit tests: SHORT_FORM FIPOC kickback path in persistEvaluationResultV2
 *
 * Covers:
 *   1. Kick fires on SHORT_FORM_LONGFORM_ARTIFACT_LEAK (job re-queued to phase_3, not failed)
 *   2. Kicked job carries short_form_retry_instruction in progress
 *   3. Quarantine artifact is persisted (best-effort)
 *   4. kick_attempts counter increments correctly in progress
 *   5. Budget exhaustion (kick_attempts[code] >= 1) falls through to terminal fail
 *   6. Non-kickable codes (e.g. SHORT_FORM_MISSING_ANCHORS) still terminal-fail immediately
 *   7. Invariant: kicked job never writes status "failed"
 */

export {};

import { describe, expect, test } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { persistEvaluationResultV2 } from "../../../lib/evaluation/persistEvaluationResultV2";

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Minimal valid short-form EvaluationResultV2.
 * word count in progressSnapshot is set to 3,000 (well below 25,000 threshold)
 * so applyShortFormReadinessMetadata activates.
 */
function makeShortFormEvalResult(overrides: Partial<EvaluationResultV2> = {}): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-sf-kick-test",
      job_id: "job-sf-kick-test",
      manuscript_id: 9999,
      user_id: "00000000-0000-0000-0000-000000009999",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "sf-kick-test",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 65,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: "Short-form fixture summary with no long-form terminology.",
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
      rationale: `Criterion ${key}: solid execution with clear textual anchors.`,
      evidence: [
        { snippet: `"Anchor A for ${key}"` },
        { snippet: `"Anchor B for ${key}"` },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Refine ${key} with a targeted line-level revision.`,
          expected_impact: `Improves ${key} execution and consistency.`,
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
    ...overrides,
  } as EvaluationResultV2;
}

/**
 * Injects a forbidden long-form term ("WAVE") into the overview summary,
 * which will trigger SHORT_FORM_LONGFORM_ARTIFACT_LEAK in shortFormFinalSanityCheck.
 */
function injectLongFormArtifactLeak(result: EvaluationResultV2): EvaluationResultV2 {
  return {
    ...result,
    overview: {
      ...result.overview,
      one_paragraph_summary:
        "This manuscript is strong but does not qualify for WAVE certification at this stage.",
    },
  };
}

/**
 * Injects a pattern that triggers SHORT_FORM_INTERNAL_PROCESS_LEAK
 * (internal process term — also kickable).
 */
function injectInternalProcessLeak(result: EvaluationResultV2): EvaluationResultV2 {
  return {
    ...result,
    overview: {
      ...result.overview,
      one_paragraph_summary:
        "The manuscript passed all internal editorial checkpoints; see Phase 5 release gate notes.",
    },
  };
}

/** Progress snapshot for a short-form manuscript (< 25,000 words). */
const SHORT_FORM_PROGRESS: Record<string, unknown> = {
  phase: "phase_2",
  phase_status: "running",
  manuscript_word_count: 3_500,
};

/** Progress snapshot that simulates a job already kicked once (budget = 1). */
function exhaustedKickProgress(code: string): Record<string, unknown> {
  return {
    ...SHORT_FORM_PROGRESS,
    kick_attempts: { [code]: 1 },
  };
}

// ─── Supabase stub ────────────────────────────────────────────────────────────

type UpdateCapture = {
  payload: Record<string, unknown>;
  eqCalls: Array<{ column: string; value: unknown }>;
};

type InsertCapture = {
  table: string;
  payload: Record<string, unknown>;
};

interface StubOpts {
  /**
   * When set, the *first* evaluation_jobs update (the kick attempt) returns
   * this error. All subsequent updates succeed. This simulates a transient DB
   * failure on the kick write so we can assert the terminal-fail fallthrough.
   */
  kickUpdateError?: { message: string } | null;
  /**
   * When true, the rpc stub returns a successful artifact_id response instead
   * of throwing. Used for long-form bypass tests that reach atomic persistence.
   */
  allowRpc?: boolean;
}

function makeSupabaseStub(opts: StubOpts = {}) {
  const evaluationJobUpdates: UpdateCapture[] = [];
  const artifactInserts: InsertCapture[] = [];

  return {
    evaluationJobUpdates,
    artifactInserts,
    from(table: string) {
      if (table === "evaluation_jobs") {
        return {
          update: (payload: Record<string, unknown>) => {
            const capture: UpdateCapture = { payload, eqCalls: [] };
            evaluationJobUpdates.push(capture);
            // Only fail the *first* update (kick attempt) when kickUpdateError is set;
            // subsequent updates (terminal fail fallthrough) succeed.
            const isFirstUpdate = evaluationJobUpdates.length === 1;
            const errorForThisCall =
              isFirstUpdate && opts.kickUpdateError ? opts.kickUpdateError : null;
            return {
              eq: (column: string, value: unknown) => {
                capture.eqCalls.push({ column, value });
                return Promise.resolve({ error: errorForThisCall });
              },
            };
          },
        };
      }

      if (table === "evaluation_artifacts") {
        return {
          insert: (payload: Record<string, unknown>) => {
            artifactInserts.push({ table, payload });
            // Returns a thenable (best-effort; never throws)
            return {
              then: (cb: (result: { error: null }) => unknown) => {
                return Promise.resolve().then(() => cb({ error: null }));
              },
            };
          },
        };
      }

      // Unexpected tables — surface clearly in test output
      throw new Error(`[stub] unexpected table: ${table}`);
    },
    rpc(_name: string, _payload: Record<string, unknown>) {
      if (opts.allowRpc) {
        // Simulate successful atomic persistence for long-form bypass tests
        return Promise.resolve({ data: [{ artifact_id: "artifact-longform-bypass" }], error: null });
      }
      // rpc (persist_evaluation_v2_atomic) should NOT be called on the kick path
      throw new Error("[stub] rpc called — kickback path must not reach atomic persistence");
    },
  } as unknown as SupabaseClient;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("persistEvaluationResultV2 — SHORT_FORM FIPOC kickback path", () => {

  // ── 1. Kick fires, job re-queued to phase_3 ──────────────────────────────

  test("SHORT_FORM_LONGFORM_ARTIFACT_LEAK: job re-queued to phase_3 instead of failing", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    const result = await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-1",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-1",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    // Return value indicates kick (not a hard persist)
    expect(result.persisted).toBe(false);
    expect(result.gateDecision).toBe("FAIL");
    expect(result.validationResult).toBe("FAIL");
    expect(result.reason).toMatch(/ShortFormSanityKick|kicked back/i);

    // Exactly one update to evaluation_jobs
    expect(supabase.evaluationJobUpdates).toHaveLength(1);
    const update = supabase.evaluationJobUpdates[0];

    // Status must be QUEUED (not "failed")
    expect(update.payload.status).toBe("queued");
    expect(update.payload.phase).toBe("phase_3");
    expect(update.payload.phase_status).toBe("queued");

    // Lease fields must be cleared for clean re-claim
    expect(update.payload.claimed_by).toBeNull();
    expect(update.payload.claimed_at).toBeNull();
    expect(update.payload.lease_token).toBeNull();
    expect(update.payload.failure_code).toBeNull();
    expect(update.payload.last_error).toBeNull();

    // .eq('id', jobId) must be called
    expect(update.eqCalls).toContainEqual({ column: "id", value: "job-sf-kick-1" });
  });

  // ── 2. retry_instruction present in kicked progress ────────────────────

  test("kicked progress carries short_form_retry_instruction for Pass 3 consumption", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-2",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-2",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    const kickedProgress = supabase.evaluationJobUpdates[0]?.payload?.progress as
      | Record<string, unknown>
      | undefined;

    expect(kickedProgress).toBeDefined();
    expect(typeof kickedProgress?.short_form_retry_instruction).toBe("string");
    expect((kickedProgress?.short_form_retry_instruction as string).length).toBeGreaterThan(0);

    // last_kick_violation_summary must match
    expect(kickedProgress?.last_kick_violation_summary).toBe(
      kickedProgress?.short_form_retry_instruction,
    );

    // Failure code recorded for traceability
    expect(kickedProgress?.last_kick_failure_code).toBe("SHORT_FORM_LONGFORM_ARTIFACT_LEAK");

    // Phase set correctly in progress
    expect(kickedProgress?.phase).toBe("phase_3");
    expect(kickedProgress?.phase_status).toBe("queued");
  });

  // ── 3. kick_attempts increments correctly ────────────────────────────────

  test("kick_attempts counter is initialised to 1 on first kick", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-3",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-3",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    const kickedProgress = supabase.evaluationJobUpdates[0]?.payload?.progress as
      | Record<string, unknown>
      | undefined;

    const kickAttempts = kickedProgress?.kick_attempts as Record<string, number> | undefined;
    expect(kickAttempts).toBeDefined();
    expect(kickAttempts?.SHORT_FORM_LONGFORM_ARTIFACT_LEAK).toBe(1);
  });

  // ── 4. Quarantine artifact persisted ──────────────────────────────────────

  test("quarantine artifact is inserted into evaluation_artifacts on kick", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-4",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-4",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    expect(supabase.artifactInserts).toHaveLength(1);
    const insert = supabase.artifactInserts[0];
    expect(insert.table).toBe("evaluation_artifacts");
    expect(insert.payload.job_id).toBe("job-sf-kick-4");
    expect(typeof insert.payload.artifact_type).toBe("string");
    expect((insert.payload.artifact_type as string).toLowerCase()).toContain("quarantine");
    expect(insert.payload.content).toBeDefined();
  });

  // ── 5. Budget exhaustion → terminal fail ─────────────────────────────────

  test("terminal fail when kick budget is exhausted (kick_attempts[code] >= 1)", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    const result = await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-5",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-5",
      // Kick already used for this code
      progressSnapshot: exhaustedKickProgress("SHORT_FORM_LONGFORM_ARTIFACT_LEAK"),
      totalUnits: 10,
      completedUnits: 10,
    });

    expect(result.persisted).toBe(false);
    expect(result.gateDecision).toBe("FAIL");

    // Must terminal-fail, not re-queue
    const failedUpdate = supabase.evaluationJobUpdates.find(
      (u) => u.payload.status === "failed",
    );
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.payload.failure_code).toBe("SHORT_FORM_FINAL_SANITY_BLOCKED");

    // No QUEUED update
    const queuedUpdate = supabase.evaluationJobUpdates.find(
      (u) => u.payload.status === "queued",
    );
    expect(queuedUpdate).toBeUndefined();
  });

  // ── 6. Internal process leak is also kickable ─────────────────────────────

  test("SHORT_FORM_INTERNAL_PROCESS_LEAK is also kick-eligible and re-queues phase_3", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectInternalProcessLeak(makeShortFormEvalResult());

    const result = await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-6",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-6",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    expect(result.persisted).toBe(false);

    const kickedUpdate = supabase.evaluationJobUpdates.find(
      (u) => u.payload.status === "queued",
    );
    expect(kickedUpdate).toBeDefined();
    expect(kickedUpdate?.payload.phase).toBe("phase_3");

    const kickedProgress = kickedUpdate?.payload?.progress as Record<string, unknown> | undefined;
    expect(typeof kickedProgress?.short_form_retry_instruction).toBe("string");
  });

  // ── 7. Invariant: kicked job never writes status "failed" ────────────────

  test("invariant: no status:failed write when kick fires successfully", async () => {
    const supabase = makeSupabaseStub();
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-inv",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-inv",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    const failedWrites = supabase.evaluationJobUpdates.filter(
      (u) => u.payload.status === "failed",
    );
    expect(failedWrites).toHaveLength(0);
  });

  // ── 8. DB write failure on kick → falls through to terminal fail ──────────

  test("kick DB write failure falls through to terminal fail without crashing", async () => {
    const supabase = makeSupabaseStub({
      kickUpdateError: { message: "DB connection lost" },
    });
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    const result = await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-db-fail",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-kick-db-fail",
      progressSnapshot: SHORT_FORM_PROGRESS,
      totalUnits: 10,
      completedUnits: 10,
    });

    expect(result.persisted).toBe(false);
    expect(result.gateDecision).toBe("FAIL");

    // Must eventually write a failed status (the terminal fallthrough)
    const terminalFail = supabase.evaluationJobUpdates.find(
      (u) => u.payload.status === "failed",
    );
    expect(terminalFail).toBeDefined();
    expect(terminalFail?.payload.failure_code).toBe("SHORT_FORM_FINAL_SANITY_BLOCKED");
  });

  // ── 9. Long-form manuscripts (>= 25k words) bypass short-form gate ────────

  test("long-form manuscripts bypass short-form sanity gate even with forbidden terms", async () => {
    // allowRpc: true — long-form path reaches atomic persistence (rpc call)
    const supabase = makeSupabaseStub({ allowRpc: true });

    // Inject the forbidden term
    const leaked = injectLongFormArtifactLeak(makeShortFormEvalResult());

    // Supply a long-form word count — the short-form gate should be entirely inactive
    await persistEvaluationResultV2({
      supabase,
      jobId: "job-sf-kick-long-form-bypass",
      manuscriptId: 9999,
      evaluationResult: leaked,
      sourceHash: "sha256:sf-long-form-bypass",
      progressSnapshot: {
        ...SHORT_FORM_PROGRESS,
        manuscript_word_count: 30_000, // long-form: short-form gate inactive
      },
      totalUnits: 10,
      completedUnits: 10,
    });

    // The short-form kick must NOT fire — no QUEUED update
    const kickedUpdate = supabase.evaluationJobUpdates.find(
      (u) => u.payload.status === "queued",
    );
    expect(kickedUpdate).toBeUndefined();

    // SHORT_FORM_FINAL_SANITY_BLOCKED must not appear anywhere
    const shortFormFailUpdate = supabase.evaluationJobUpdates.find(
      (u) => u.payload.failure_code === "SHORT_FORM_FINAL_SANITY_BLOCKED",
    );
    expect(shortFormFailUpdate).toBeUndefined();
  });
});
