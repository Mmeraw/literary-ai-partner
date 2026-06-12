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
  /** Phase 0 authority proof: registry path/checksum, loaded paths, missing paths, authority checksums. */
  | "phase0_authority_proof_v1"
  /** Phase 0.5A governed story-map seed. Candidate/provisional baseline authority, not verified truth. */
  | "story_map_seed_v1"
  /** Phase 0.5B governed evaluation seed. Candidate/provisional baseline authority, not verified truth. */
  | "evaluation_seed_v1"
  /** Phase 0.5B governed revise opportunity seed. Not author-facing until admission/candidate validation. */
  | "revise_opportunity_seed_v1"
  | "diagnostic_pass3_snapshot_v1"
  /** Audit-grade: raw Pass 1 / Pass 2 / Pass 3 outputs as emitted on gate failure. Not user-visible. */
  | "pass_outputs_diagnostic_v1"
  /** Audit-grade: per-criterion gate diagnostics (independence overlap data) on gate failure. Not user-visible. */
  | "quality_gate_diagnostics_v1"
  /** Pass 3b — full 16-section DREAM document for long-form manuscripts (≥ 25,000 words). */
  | "longform_document_v1"
  /** Post-evaluation author-facing editorial translation audit. Does not mutate scores. */
  | "report_experience_v1"
  /** Post-QG consistency certification boundary before evaluation_result_v2 persistence. */
  | "artifact_consistency_gate_v1"
  /** Exact post-QG effective result snapshot for forensic reconstruction before canonical persistence/certification. */
  | "post_qg_effective_snapshot_v1"
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
   * Accepted Story Ledger — normalized, governance-validated story authority
   * artifact required by downstream Phase 2/3 consumers.
   */
  | "accepted_story_ledger_v1"
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
  | "pass3_preflight_draft_v1"
  /** Ledger quality report — story-canon readiness gate consumed by Revise context-quality decisions. */
  | "ledger_quality_report_v1"
  /**
   * Phase 1A chunk routing manifest — persisted once at Phase 1A start to eliminate
   * setup-tax on resumed batch invocations. Contains total_chunks, source_hash, and
   * deploy metadata. Not user-visible.
   */
  | "phase1a_chunk_routing_manifest_v1"
  /**
   * Revision opportunity ledger — normalized, evidence-anchored handoff from
   * evaluation diagnosis to Revise queue/workbench. Not itself governing story
   * authority; consumed by revision orchestration.
   */
  | "revision_opportunity_ledger_v1"
  /**
   * Evaluation-only SEED benchmark artifact — compares paired baseline vs SEED
   * evaluation runs for Story Ledger quality, evidence coverage, hallucination risk,
   * and latency. Non-governing; used to decide whether SEED should remain enabled.
   */
  | "evaluation_seed_benchmark_v1"
  /**
   * Evaluation-only SEED E2E proof artifact — validates a single SEED-enabled run
   * for required artifacts, Story Ledger quality, evidence coverage, and authority.
   */
  | "evaluation_seed_e2e_proof_v1"
  /**
   * Polish Pass — post-eval surface integrity scan. Genre-aware, voice-preserving
   * surface edits (grammar, passive voice, adverbs, punctuation, repetition, spelling).
   * Produces RevisionOpportunity[] tagged provenance='polish_pass'.
   * User-visible: drives the Surface Polish section of the Revise workbench.
   */
  | "polish_pass_v1"
  /**
   * Gate 15 audit — paired-gate structural purity (15.1) + voice/meaning protection
   * (15.2) validators. Runs as non-blocking post-evaluation layer for long-form
   * manuscripts (≥25,000 words). Does not fail the evaluation job.
   * User-visible: drives the Gate 15 section of the Canon Governance report.
   */
  | "gate_15_audit_v1"
  /**
   * Golden Spine / motif ledger — tracks primary/secondary narrative spines,
   * motif first-appearance, recurrence, and payoff status across manuscript.
   * Long-form only (≥25,000 words). Non-blocking post-evaluation layer.
   * User-visible: drives the Golden Spine section of the Canon Governance report.
   */
  | "golden_spine_v1"
  /**
   * Dialogue canon audit — structured dialogue quality assessment covering
   * speaker differentiation, attribution purity, exposition leakage, subtext
   * opportunity, and protected speech segments. Long-form only (≥25,000 words).
   * Non-blocking post-evaluation layer.
   */
  | "dialogue_canon_audit_v1"
  /**
   * Revision queue canon metadata: enriches each revision criterion with
   * source wave/gate attribution, severity justification, and canon risk
   * classification. Long-form only (≥25,000 words). Non-blocking.
   */
  /** Compact final verification rail for long-form report readiness. */
  | "revision_canon_metadata_v1"
  /** Canonical renderer adapter built from evaluation_result_v2 before any user-facing rendering. */
  | "unified_evaluation_document_v1"
  /** Renderer parity evidence showing field-level consumption per surface. */
  | "report_render_manifest_v1"
  /** Author exposure release certification; must be certified for author-facing surfaces. */
  | "author_exposure_certification_v1"
  /** Deterministic admin-readable failure packet persisted at job-failure finalization time. */
  | "failure_diagnosis_v1"
  /** Compact final verification rail for long-form report readiness. */
  | "final_external_audit_v1";

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

const TRANSIENT_ERROR_PATTERNS = [
  "statement timeout",
  "canceling statement",
  "connection reset",
  "connection refused",
  "connection terminated",
  "too many connections",
  "remaining connection slots",
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "socket hang up",
  "network error",
  "fetch failed",
  "aborted",
] as const;

function isTransientError(message: string): boolean {
  const lower = message.toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Upsert evaluation artifact to canonical storage
 * 
 * Uses unique(job_id, artifact_type) for idempotency.
 * Retries up to 3 times with exponential backoff on transient DB errors
 * (statement timeout, connection reset, etc.) so a momentary Supabase
 * hiccup does not kill an entire evaluation.
 * 
 * Fail-closed: throws if all retries are exhausted (caller must handle).
 * 
 * @returns artifact id (uuid)
 */
export async function upsertEvaluationArtifact(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  evaluationProjectId?: string | null;
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

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2_000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[ArtifactPersistence] ${params.jobId}: retry ${attempt}/${MAX_RETRIES} for ${params.artifactType} after ${delayMs}ms`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const { data, error } = await params.supabase
      .from("evaluation_artifacts")
      .upsert(
        {
          job_id: params.jobId,
          manuscript_id: params.manuscriptId,
          ...(params.evaluationProjectId !== undefined
            ? { evaluation_project_id: params.evaluationProjectId }
            : {}),
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

    if (!error && data?.id) {
      if (attempt > 0) {
        console.log(
          `[ArtifactPersistence] ${params.jobId}: ${params.artifactType} succeeded on retry ${attempt}`,
        );
      }
      return data.id as string;
    }

    if (error) {
      lastError = new Error(
        `[ArtifactPersistence] Upsert failed for job_id=${params.jobId}: ${error.message}`,
      );

      if (!isTransientError(error.message)) {
        throw lastError;
      }

      console.warn(
        `[ArtifactPersistence] ${params.jobId}: transient error on attempt ${attempt}: ${error.message}`,
      );
      continue;
    }

    lastError = new Error(
      `[ArtifactPersistence] Upsert returned null for job_id=${params.jobId}`,
    );
  }

  throw lastError ?? new Error(
    `[ArtifactPersistence] Upsert exhausted ${MAX_RETRIES} retries for job_id=${params.jobId}`,
  );
}
