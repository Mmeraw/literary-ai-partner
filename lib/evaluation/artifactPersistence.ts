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

export type ArtifactType =
  | "evaluation_result_v1"
  | "evaluation_result_v2"
  | "diagnostic_pass3_snapshot_v1"
  /** Audit-grade: raw Pass 1 / Pass 2 / Pass 3 outputs as emitted on gate failure. Not user-visible. */
  | "pass_outputs_diagnostic_v1"
  /** Audit-grade: per-criterion gate diagnostics (independence overlap data) on gate failure. Not user-visible. */
  | "quality_gate_diagnostics_v1"
  /** Pass 3b — full 16-section DREAM document for long-form manuscripts (≥ 25,000 words). */
  | "longform_document_v1"
  /** Post-evaluation author-facing editorial translation audit. Does not mutate scores. */
  | "report_experience_v1"
  /**
   * Inter-invocation handoff: raw Pass 1 + Pass 2 outputs written at end of phase_1
   * so that a fresh Vercel invocation can resume at Pass 3 without re-running chunk
   * evaluation. Not user-visible. Consumed and deleted by the phase_2 processor path.
   */
  | "pass12_handoff_v1"
  /**
   * Chunk-level checkpoint: rolling save of per-chunk Pass 1 results as each chunk
   * completes during the chunked scoring loop. Written incrementally — one upsert per
   * chunk. When a job is retried after a wall-clock kill, Pass 1 reads this cache and
   * skips already-completed chunk indices, resuming from the interruption point.
   *
   * Key: (job_id, artifact_type='pass1_chunk_cache_v1') — one row per job.
   * Content shape: Pass1ChunkCacheArtifact (see runPass1.ts).
   * Lifecycle: written during Pass 1, deleted on successful Pass 1 completion.
   * Not user-visible.
   */
  | "pass1_chunk_cache_v1"
  /**
   * Pass 1A chunk-level checkpoint: rolling save of per-chunk Pass 1A results as
   * each character-evidence-sweep chunk completes. Mirrors pass1_chunk_cache_v1
   * exactly. Lets phase_1a resume from the last completed chunk after a wall-clock
   * kill instead of refiring all ~40 chunks cold.
   *
   * Key: (job_id, artifact_type='pass1a_chunk_cache_v1') — one row per job.
   * Content shape: Pass1aChunkCacheArtifact (see runPass1a.ts).
   * Not user-visible.
   */
  | "pass1a_chunk_cache_v1"
  /**
   * Durable watchdog recovery audit: written each time the frozen-heartbeat
   * watchdog rescues a job to phase_2/queued.  Survives log rotation and
   * lets operators trace every rescue event.  Not user-visible.
   */
  | "watchdog_rescue_v1"
  /**
   * Durable blocked-resume audit: written when the resume route denies
   * requeueing due to a terminal failure code.  Records the denial reason,
   * failure code, and deployed SHA so operators can trace why a user was
   * unable to resume and what action is needed (code fix, migration, config
   * change).  Not user-visible.
   */
  | "resume_blocked_v1"
  /**
   * Pass 1A character ledger — built immediately after Pass 1A sweep completes.
   * Written independently of Pass 1/2 outcome so the ledger survives a pipeline
   * timeout. Contains CharacterLedgerV2 (named characters, arcs, relationships,
   * objects, blockers). User-visible in the report Ledger tab.
   */
  | "pass1a_character_ledger_v1"
  /**
   * Author/operator Story Ledger response packet. Written from the interactive
   * Story Ledger review controls before Stage 2 is queued. Contains per-section
   * response states and comments that must be injected alongside the ledger into
   * Phase 2 so evaluation respects accepted corrections and flags.
   */
  | "story_ledger_response_packet_v1"
  /**
   * WAVE revision plan — written inline after evaluation persists (same execution
   * window). status field: complete | skipped | failed | timeout.
   * skipped = gate did not pass (manuscript too short or criteria below floor).
   * failed/timeout = gate passed but execution failed; retryable=true.
   * User-facing: drives the Revise tab unlock.
   */
  | "wave_revision_plan_v1"
  /**
   * Pass 3A preflight draft — independent full-manuscript read built in phase_1
   * alongside the Pass 1A character ledger. Contains provisional scores, coverage
   * map, arbitration questions, and character/object observations.
   * Non-fatal: partial/degraded preflight is persisted with reduced authority.
   * Consumed by Pass 3B (phase_3) as a prepared peer arbitrator input.
   * Not user-visible.
   */
  | "pass3_preflight_draft_v1";

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