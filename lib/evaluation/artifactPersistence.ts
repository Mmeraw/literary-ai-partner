/**
 * Artifact Persistence
 * 
 * Canonical artifact storage with idempotent writes and fail-closed enforcement.
 * 
 * Authority Chain:
 * - EvaluationResultV1 schema → validated before persistence
 * - evaluation_artifacts table → canonical source of truth
 * - source_hash → deterministic identity (no timestamp/UUID noise)
 * - unique(job_id, artifact_type) → idempotent upserts
 */

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ArtifactType = "evaluation_result_v1" | "evaluation_result_v2";

/**
 * Compute SHA256 hex digest of input string
 */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Generate stable source hash for evaluation artifacts
 * 
 * Excludes:
 * - Timestamps (generated_at, runtime_ms)
 * - Random UUIDs (evaluation_run_id)
 * 
 * Includes:
 * - Manuscript identity (manuscript_id, job_id, user_id)
 * - Input text (manuscriptText)
 * - Engine contract (model, prompt_version)
 * 
 * This ensures identical inputs → identical hash → idempotent upsert.
 */
export function stableSourceHash(params: {
  manuscriptId: number;
  jobId: string;
  userId: string;
  manuscriptText: string;
  promptVersion: string;
  model: string;
}) {
  const payload = JSON.stringify({
    manuscriptId: params.manuscriptId,
    jobId: params.jobId,
    userId: params.userId,
    manuscriptText: params.manuscriptText,
    promptVersion: params.promptVersion,
    model: params.model,
  });
  return sha256Hex(payload);
}

/**
 * Upsert evaluation artifact to canonical storage
 * 
 * Uses unique(job_id, artifact_type) for idempotency.
 * 
 * Fail-closed: throws if write fails (caller must handle).
 * 
 * @returns artifact id (uuid)
 */
export async function upsertEvaluationArtifact(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  artifactType: ArtifactType;
  content: unknown; // jsonb
  sourceHash: string;
  artifactVersion: string; // e.g. "evaluation_result_v1"
}): Promise<string> {
  if (!Number.isFinite(params.manuscriptId) || params.manuscriptId <= 0) {
    throw new Error(
      `[ArtifactPersistence] Upsert aborted for job_id=${params.jobId}: invalid manuscriptId=${params.manuscriptId}`,
    );
  }

  const { data, error } = await params.supabase
    .from("evaluation_artifacts")
    .upsert(
      {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
        artifact_type: params.artifactType,
        content: params.content,
        source_hash: params.sourceHash,
        artifact_version: params.artifactVersion,
      },
      {
        onConflict: "job_id,artifact_type",
        ignoreDuplicates: false, // Allow updates (e.g., re-evaluation)
      }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`[ArtifactPersistence] Upsert failed for job_id=${params.jobId}: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`[ArtifactPersistence] Upsert returned null for job_id=${params.jobId}`);
  }

  return data.id as string;
}
