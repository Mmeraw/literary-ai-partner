// lib/evaluation/phase2.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import { upsertEvaluationArtifact, sha256Hex } from "./artifactPersistence";

export type Phase2Ok = { ok: true; artifactId: string };
export type Phase2Err = { ok: false; error: string; details?: string };
export type Phase2Result = Phase2Ok | Phase2Err;

/**
 * Type guard to narrow Phase2Result to the error variant
 */
export function isPhase2Err(r: Phase2Result): r is Phase2Err {
  return r.ok === false;
}

/**
 * Gate A5 (Flow 1): Persist the canonical evaluation_result to evaluation_artifacts.
 *
 * Rules:
 * - No schema changes
 * - Must be safe to rerun (idempotent via upsert on job_id + artifact_type)
 * - Must never throw (return { ok:false } on failure)
 * - Must use the passed-in Supabase client
 * - Writes to evaluation_artifacts table (canonical source of truth)
 *
 * @param supabase - Supabase client
 * @param jobId - Job ID to persist artifact for
 * @param evaluationResult - Optional. When provided (normal flow), persists directly.
 *   When omitted (admin retry), reads evaluation_result from evaluation_jobs row first.
 */
export async function runPhase2Aggregation(
  supabase: SupabaseClient,
  jobId: string,
  evaluationResult?: EvaluationResultV1
): Promise<Phase2Result> {
  try {
    // If no evaluationResult provided (admin retry), read from evaluation_jobs
    let result = evaluationResult;
    if (!result) {
      const { data, error } = await supabase
        .from("evaluation_jobs")
        .select("evaluation_result")
        .eq("id", jobId)
        .single();

      if (error || !data?.evaluation_result) {
        return {
          ok: false,
          error: "No evaluation_result found on job row",
          details: error?.message ?? "evaluation_result is null",
        };
      }
      result = data.evaluation_result as EvaluationResultV1;
    }

    // Compute stable source hash for idempotency
    const sourceHash = sha256Hex(
      JSON.stringify({
        jobId,
        manuscriptId: result.ids?.manuscript_id,
        userId: result.ids?.user_id,
        model: result.engine?.model,
        promptVersion: result.engine?.prompt_version,
      })
    );

    const manuscriptId = result.ids?.manuscript_id;
    if (!Number.isFinite(manuscriptId) || manuscriptId <= 0) {
      return {
        ok: false,
        error: "Phase 2 aggregation failed",
        details: `Missing or invalid manuscript_id for job ${jobId}`,
      };
    }

    // Persist to evaluation_artifacts via canonical upsert
    const artifactId = await upsertEvaluationArtifact({
      supabase,
      jobId,
      manuscriptId,
      artifactType: "evaluation_result_v1",
      content: result,
      sourceHash,
      artifactVersion: "evaluation_result_v1",
    });

    return { ok: true, artifactId };
  } catch (err) {
    return {
      ok: false,
      error: "Phase 2 aggregation failed",
      details: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
