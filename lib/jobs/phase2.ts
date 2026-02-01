// lib/jobs/phase2.ts
import * as metrics from "./metrics";
import { getJob, updateJob } from "./store";
import { getChunksForJob } from "@/lib/manuscripts/chunks";
import { createClient } from "@supabase/supabase-js";
import { PHASES } from "./types";

export const PHASE_2_STATES = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  COMPLETED: "complete",
  FAILED: "failed",
} as const;

export type Phase2State = (typeof PHASE_2_STATES)[keyof typeof PHASE_2_STATES];

const PHASE2_ALLOWED_TRANSITIONS: Record<Phase2State, Phase2State[]> = {
  not_started: ["running"],
  running: ["complete", "failed"],
  failed: ["running"],
  complete: [],
};

export function canTransitionPhase2(from: Phase2State, to: Phase2State): boolean {
  const allowed = PHASE2_ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowed) ? allowed.includes(to) : false;
}

export function assertTransitionPhase2(from: Phase2State, to: Phase2State): void {
  if (!canTransitionPhase2(from, to)) {
    throw new Error(`Invalid Phase 2 transition: ${from} -> ${to}`);
  }
}

// SAFE FOR BUILD TIME: Lazy-load Supabase client only when needed
let _supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabaseClient;
}

interface Phase1ValidationResult {
  isValid: boolean;
  error?: string;
  doneCount: number;
  failedCount: number;
  totalCount: number;
}

/**
 * FAIL-FAST: Validate Phase 1 output is stable and ready for Phase 2
 *
 * Canon contract for Phase 2 input:
 * - job.progress.phase === "phase_1"
 * - job.progress.phase_status === "complete"
 * - chunks exist for (manuscript_id, job_id)
 * - no chunks are "processing"
 * - at least one chunk is "done" with result_json
 */
async function validatePhase1Output(
  manuscriptId: number,
  jobId: string,
  jobProgress: any,
): Promise<Phase1ValidationResult> {
  // Distinctive proof marker: if you don’t see this, you’re not running the new code.
  console.log(`[Phase2Validation] v2: running validatePhase1Output`, {
    jobId,
    manuscriptId,
    phase: jobProgress?.phase,
    phase_status: jobProgress?.phase_status,
  });

  // Accept two valid states:
  // 1. phase1/complete: Phase 1 just finished (rare - lease acquisition usually transitions first)
  // 2. phase2/running: Lease acquisition already transitioned from phase1/complete (normal case)
  const isValidPhase1Complete = 
    jobProgress?.phase === PHASES.PHASE_1 && jobProgress?.phase_status === "complete";
  const isValidPhase2Starting = 
    jobProgress?.phase === PHASES.PHASE_2 && jobProgress?.phase_status === "running";

  if (!isValidPhase1Complete && !isValidPhase2Starting) {
    return {
      isValid: false,
      error: `v2: phase1_not_complete_status: phase=${jobProgress?.phase}, phase_status=${jobProgress?.phase_status}`,
      doneCount: 0,
      failedCount: 0,
      totalCount: 0,
    };
  }

  const chunks = await getChunksForJob({
    manuscriptId,
    jobId,
    phase1StartedAt: jobProgress?.started_at as string | undefined,
    phase1FinishedAt: jobProgress?.finished_at as string | undefined,
    expectedChunkCount: jobProgress?.total_units as number | undefined,
  });

  console.log(`[Phase2Validation] v2: chunk_scan`, {
    jobId,
    manuscriptId,
    chunkCount: chunks.length,
  });

  if (chunks.length === 0) {
    return {
      isValid: false,
      error: `v2: phase1_no_chunks_for_job: manuscript_id=${manuscriptId}, job_id=${jobId}`,
      doneCount: 0,
      failedCount: 0,
      totalCount: 0,
    };
  }

  const doneChunks = chunks.filter((c) => c.status === "done" && c.result_json);
  const failedChunks = chunks.filter((c) => c.status === "failed");
  const processingChunks = chunks.filter((c) => c.status === "processing");

  console.log(`[Phase2Validation] v2: chunk_status`, {
    jobId,
    done: doneChunks.length,
    failed: failedChunks.length,
    processing: processingChunks.length,
    total: chunks.length,
  });

  if (processingChunks.length > 0) {
    return {
      isValid: false,
      error: `v2: phase1_not_stable_processing: processing=${processingChunks.length}`,
      doneCount: doneChunks.length,
      failedCount: failedChunks.length,
      totalCount: chunks.length,
    };
  }

  if (doneChunks.length === 0) {
    return {
      isValid: false,
      error: `v2: phase1_no_successful_chunks: failed=${failedChunks.length}, done=0`,
      doneCount: 0,
      failedCount: failedChunks.length,
      totalCount: chunks.length,
    };
  }

  return {
    isValid: true,
    doneCount: doneChunks.length,
    failedCount: failedChunks.length,
    totalCount: chunks.length,
  };
}

async function aggregateChunkResults(
  manuscriptId: number,
  jobId: string,
  jobProgress: any,
): Promise<{
  summary: string;
  overallScore: number;
  chunkCount: number;
  processedCount: number;
  sourceHash: string;
}> {
  const chunks = await getChunksForJob({
    manuscriptId,
    jobId,
    phase1StartedAt: jobProgress?.started_at as string | undefined,
    phase1FinishedAt: jobProgress?.finished_at as string | undefined,
    expectedChunkCount: jobProgress?.total_units as number | undefined,
  });
  const completed = chunks.filter((c) => c.status === "done" && c.result_json);

  const scores = completed
    .map((c) => c.result_json?.score)
    .filter((s) => typeof s === "number" && Number.isFinite(s)) as number[];

  const avgScore =
    scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

  const summary = `EVALUATION SUMMARY

Manuscript ID: ${manuscriptId}
Job ID: ${jobId}
Chunks Analyzed: ${completed.length} of ${chunks.length}
Overall Score: ${avgScore.toFixed(1)}/10

NOTES (sample):
${completed
  .slice(0, 3)
  .map((c, i) => {
    const idx = typeof c.chunk_index === "number" ? c.chunk_index + 1 : i + 1;
    const score = c.result_json?.score ?? "N/A";
    const notes = c.result_json?.notes ?? "No notes available";
    return `- Chunk ${idx}: score=${score}, notes=${String(notes).slice(0, 300)}`;
  })
  .join("\n")}

RECOMMENDATION:
${
  avgScore >= 7
    ? "Strong foundation. Ready for refinement."
    : avgScore >= 5
      ? "Solid potential. Focused revision recommended."
      : "Significant development needed. Major revision required."
}

Generated: ${new Date().toISOString()}
`;

  const sourceHash = `v2:${manuscriptId}:${jobId}:${completed.length}:${chunks.length}:${avgScore.toFixed(
    2,
  )}`;

  return {
    summary,
    overallScore: avgScore,
    chunkCount: chunks.length,
    processedCount: completed.length,
    sourceHash,
  };
}

async function artifactExists(jobId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("evaluation_artifacts")
    .select("id")
    .eq("job_id", jobId)
    .eq("artifact_type", "one_page_summary")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing artifact: ${error.message}`);
  }

  return !!data?.id;
}

async function persistOutput(
  jobId: string,
  manuscriptId: number,
  result: {
    summary: string;
    overallScore: number;
    chunkCount: number;
    processedCount: number;
    sourceHash: string;
  },
): Promise<{ persisted: boolean; alreadyExists: boolean; artifactId?: string }> {
  // Code-level idempotency check (fast exit)
  const exists = await artifactExists(jobId);
  if (exists) {
    console.log(`[Phase2] Artifact already exists (precheck) job_id=${jobId}`);
    return { persisted: false, alreadyExists: true };
  }

  // DB-level idempotency: UNIQUE(job_id, artifact_type)
  // Use upsert with ignoreDuplicates so we don't create dupes.
  const artifact = {
    job_id: jobId,
    manuscript_id: manuscriptId,
    artifact_type: "one_page_summary",
    artifact_version: "v1",
    content: {
      summary: result.summary,
      overall_score: result.overallScore,
      chunk_count: result.chunkCount,
      processed_count: result.processedCount,
      generated_at: new Date().toISOString(),
    },
    source_phase: PHASES.PHASE_2,
    source_hash: result.sourceHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabase()
    .from("evaluation_artifacts")
    .upsert(artifact as any, {
      onConflict: "job_id,artifact_type",
      ignoreDuplicates: true,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // If Supabase still surfaces unique conflicts differently, treat as already done.
    const code = (error as any)?.code;
    if (code === "23505") {
      console.log(`[Phase2] Artifact already exists (unique constraint) job_id=${jobId}`);
      return { persisted: false, alreadyExists: true };
    }
    throw new Error(`Failed to persist Phase 2 artifact: ${error.message}`);
  }

  if (!data?.id) {
    // ignoreDuplicates may return null row; treat as already exists.
    return { persisted: false, alreadyExists: true };
  }

  console.log(`[Phase2] Artifact persisted id=${data.id} job_id=${jobId}`);
  return { persisted: true, alreadyExists: false, artifactId: data.id };
}

export async function runPhase2(jobId: string): Promise<void> {
  const phase2Start = Date.now();

  let job = await getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const { acquireLeaseForPhase2 } = await import("./store");
  const leaseId = crypto.randomUUID();

  console.log(`[Phase2] Attempting lease acquire`, {
    job_id: jobId,
    status: job.status,
    phase: job.progress.phase,
    phase_status: job.progress.phase_status,
    lease_id: job.progress.lease_id,
    lease_expires_at: job.progress.lease_expires_at,
  });

  const leasedJob = await acquireLeaseForPhase2(jobId, leaseId, 30);
  if (!leasedJob) {
    console.log("Phase2LeaseNotAcquired", {
      job_id: jobId,
      phase: PHASES.PHASE_2,
      reason: "not eligible or already running",
    });
    return;
  }

  console.log(`[Phase2] Lease acquired`, { job_id: jobId, lease_id: leaseId });
  job = leasedJob;

  const manuscriptIdRaw = job.manuscript_id;
  const manuscriptId =
    typeof manuscriptIdRaw === "number" ? manuscriptIdRaw : Number.parseInt(String(manuscriptIdRaw), 10);

  if (!Number.isFinite(manuscriptId) || manuscriptId <= 0) {
    await updateJob(jobId, {
      status: "failed",
      progress: {
        phase: "phase_2",
        phase_status: "failed",
        message: "v2: invalid_manuscript_id",
        total_units: null,
        completed_units: null,
        lease_id: null,
        lease_expires_at: null,
      },
    });
    return;
  }

  try {
    // STEP 1: validate Phase 1 output
    const validation = await validatePhase1Output(manuscriptId, jobId, job.progress);

    if (!validation.isValid) {
      await updateJob(jobId, {
        status: "failed",
        progress: {
          phase: PHASES.PHASE_2,
          phase_status: "failed",
          message: `Phase 1 output not ready: ${validation.error}`,
          total_units: null,
          completed_units: null,
          lease_id: null,
          lease_expires_at: null,
        },
      });

      metrics.onJobFailed(jobId, PHASES.PHASE_2, validation.error || "v2: validation_failed");
      return;
    }

    // STEP 2: aggregate results
    const result = await aggregateChunkResults(manuscriptId, jobId, job.progress);

    // STEP 3: persist artifact (idempotent)
    const persistResult = await persistOutput(jobId, manuscriptId, result);

    // STEP 4: terminal job state only after persistence (or detected existing)
    await updateJob(jobId, {
      status: "complete", // CANONICAL terminal JobStatus in your repo
      progress: {
        phase: PHASES.PHASE_2,
        phase_status: "complete",
        message: persistResult.alreadyExists
          ? "Phase 2 already complete (idempotent)"
          : `Phase 2 complete: ${result.processedCount}/${result.chunkCount} chunks analyzed`,
        finished_at: new Date().toISOString(),
        overall_score: result.overallScore,
        artifact_id: persistResult.artifactId ?? null,
        total_units: result.chunkCount,
        completed_units: result.processedCount,
        lease_id: null,
        lease_expires_at: null,
      },
    });

    console.log("Phase2Completed", {
      job_id: jobId,
      manuscript_id: manuscriptId,
      processed_chunks: result.processedCount,
      total_chunks: result.chunkCount,
      overall_score: result.overallScore,
      artifact_persisted: persistResult.persisted,
      artifact_already_exists: persistResult.alreadyExists,
      source_hash: result.sourceHash,
    });

    const phase2Duration = Date.now() - phase2Start;
    metrics.onPhaseCompleted(jobId, PHASES.PHASE_2, phase2Duration);
    metrics.onJobCompleted(jobId, job.job_type, phase2Duration);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    console.error("Phase2Error", {
      job_id: jobId,
      error: msg,
      stack: e instanceof Error ? e.stack : undefined,
    });

    // Keep Phase 2 observable and retry-safe.
    await updateJob(jobId, {
      status: "failed",
      progress: {
        phase: PHASES.PHASE_2,
        phase_status: "failed",
        message: `v2: phase2_exception: ${msg}`,
        last_error: e instanceof Error ? e.stack : msg,
        total_units: null,
        completed_units: null,
        lease_id: null,
        lease_expires_at: null,
      },
    });

    metrics.onJobFailed(jobId, PHASES.PHASE_2, msg);
  }
}
