// Contract snapshot for Phase 1:
// progress lives at job.progress.{total_units,completed_units,failed_units}
// status transitions only in route.ts (queued→running) and terminal worker update (→complete|failed)

import * as metrics from "./metrics";

export const PHASE_1_STATES = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type Phase1State = (typeof PHASE_1_STATES)[keyof typeof PHASE_1_STATES];

const ALLOWED_TRANSITIONS: Record<Phase1State, Phase1State[]> = {
  not_started: ["running"],
  running: ["completed", "failed"],
  failed: ["running"],
  completed: [],
};

export function canTransitionPhase1(
  from: Phase1State,
  to: Phase1State,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canRetryPhase1(options: {
  phase_1_status: Phase1State;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
  now?: Date;
}): boolean {
  const {
    phase_1_status,
    retry_count,
    max_retries,
    next_retry_at,
    now = new Date(),
  } = options;

  if (phase_1_status !== PHASE_1_STATES.FAILED) return false;
  if (retry_count >= max_retries) return false;

  if (!next_retry_at) return true;

  const scheduled = new Date(next_retry_at);
  if (Number.isNaN(scheduled.getTime())) return true;

  return scheduled.getTime() <= now.getTime();
}

import { getJob, updateJob } from "./store";
import { ensureChunks, getManuscriptChunks, getEligibleChunksWithStuckRecovery, claimChunkForProcessing, markChunkSuccess, markChunkFailure } from "@/lib/manuscripts/chunks";
import { createLlmClient } from "@/lib/llm/client";

export async function runPhase1(jobId: string): Promise<void> {
  const phase1_start = Date.now();
  
  let job = await getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Initialize LLM client (stub or real based on env)
  const llmClient = createLlmClient();

  // Acquire lease atomically with eligibility check
  const { acquireLeaseForPhase1 } = await import("./store");
  const lease_id = crypto.randomUUID();
  const leasedJob = await acquireLeaseForPhase1(jobId, lease_id, 30); // 30 seconds TTL

  if (!leasedJob) {
    console.log("Phase1LeaseNotAcquired", {
      job_id: jobId,
      phase: "phase1",
      reason: "not eligible or already running",
    });
    return;
  }

  // Update job reference to leased version
  job = leasedJob;

  // Ensure chunks exist for this manuscript (convert string manuscript_id to number)
  const manuscriptIdRaw = job.manuscript_id;
  const manuscriptIdNum =
    typeof manuscriptIdRaw === "number"
      ? manuscriptIdRaw
      : Number.parseInt(String(manuscriptIdRaw), 10);

  if (!Number.isFinite(manuscriptIdNum) || manuscriptIdNum <= 0) {
    throw new Error(
      `Invalid manuscript_id on job ${jobId}: ${String(job.manuscript_id)}`
    );
  }

  const chunkCount = await ensureChunks(manuscriptIdNum);
  
  // Get eligible chunks with stuck recovery (handles worker crashes)
  // This fetches pending/failed chunks AND processing chunks stuck for >15 minutes
  const eligibleChunks = await getEligibleChunksWithStuckRecovery(manuscriptIdNum, 3, 15);
  
  // Get all chunks for total count and reporting
  const allChunks = await getManuscriptChunks(manuscriptIdNum);
  
  console.log(`[Phase1] Processing ${eligibleChunks.length} eligible chunks (${allChunks.length} total) for manuscript ${job.manuscript_id}`);

  const existing_index = job.progress.phase1_last_processed_index ?? -1;
  const start_index = existing_index + 1;
  
  // Count how many chunks are already done
  const doneChunks = allChunks.filter(c => c.status === 'done').length;
  const existing_completed = job.progress.completed_units ?? doneChunks;
  const completed_units = Math.max(
    existing_completed,
    doneChunks,
  );
  const started_at =
    job.progress.started_at ?? new Date().toISOString();

  // Set total_units based on actual chunk count, phase, phase_status
  await updateJob(jobId, {
    progress: {
      stage: "starting",
      message: `Initializing Phase 1 - ${eligibleChunks.length} chunks to process (${doneChunks} already done)`,
      total_units: allChunks.length,
      completed_units,
      started_at,
      phase: "phase1",
      phase_status: "running",
      phase1_last_processed_index: existing_index,
    },
    last_progress_at: new Date().toISOString(),
  });

  let processed = doneChunks; // Start from already completed count
  let failedCount = allChunks.filter(c => c.status === 'failed').length;
  let skippedCount = 0; // Track chunks skipped due to claim failure
  
  console.log(
    `[Phase1] Resume state: ${doneChunks} done, ${eligibleChunks.length} eligible, ${allChunks.length} total`,
  );

  try {
    // Process eligible chunks only (skip completed ones automatically)
    for (const chunk of eligibleChunks) {
      // Invariant checks
      const currentJob = await getJob(jobId);
      if (!currentJob) return;

      // Check for cancellation - exit immediately without mutating counters
      if (currentJob.status === "canceled") {
        console.log("Phase1Canceled", {
          job_id: jobId,
          phase: "phase1",
          processed_before_cancel: processed,
        });
        return;
      }

      const progress = currentJob.progress;

      if (progress.phase !== "phase1" || progress.phase_status !== "running") {
        console.log(
          "Phase1 invariant failed: phase or phase_status mismatch",
        );
        return;
      }

      if (
        progress.lease_expires_at &&
        new Date(progress.lease_expires_at) <= new Date()
      ) {
        console.log("Phase1LeaseExpired", {
          job_id: jobId,
          phase: "phase1",
          lease_id,
          processed_units: processed,
        });
        return;
      }

      if (
        (progress.completed_units || 0) > (progress.total_units || 0)
      ) {
        console.log(
          "Phase1 invariant failed: completed_units > total_units",
        );
        return;
      }

      // Atomically claim this chunk before processing
      // If claim fails, another worker got it or it's already done - skip it
      const claimed = await claimChunkForProcessing(chunk.id, 3);
      
      if (!claimed) {
        console.log(`[Phase1] Chunk ${chunk.chunk_index} already claimed or done, skipping`);
        skippedCount += 1;
        continue;
      }

      // Start heartbeat timer for this chunk
      const heartbeatInterval = setInterval(async () => {
        await updateJob(jobId, {
          last_heartbeat_at: new Date().toISOString(),
        });
      }, 10000); // 10 seconds

      try {
        // Phase 1 LLM evaluation (stub with realistic latency, or real LLM if configured)
        const result = await llmClient.evaluateChunk({
          chunkId: `${manuscriptIdNum}-${chunk.chunk_index}`,
          text: chunk.content,
          jobId,
          phase: 1,
        });

        // Mark chunk as done with result
        // This is the ONLY place that writes result_json
        await markChunkSuccess(manuscriptIdNum, chunk.chunk_index, result.resultJson);

        processed += 1; // Increment successful completion counter

      } catch (chunkError) {
        // Mark chunk as failed
        // CRITICAL: This NEVER touches result_json - preserves prior success
        const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
        await markChunkFailure(manuscriptIdNum, chunk.chunk_index, errorMessage);

        console.error("Phase1ChunkError", {
          job_id: jobId,
          chunk_index: chunk.chunk_index,
          error: errorMessage,
        });

        // Track failed chunks for partial completion reporting
        failedCount += 1;

        // Continue processing other chunks (partial completion strategy)
      } finally {
        // Stop heartbeat timer
        clearInterval(heartbeatInterval);
      }

      // Update job progress after each chunk
      const new_lease_expires_at = new Date(
        Date.now() + 30_000,
      ).toISOString();

      const chunkLabel = chunk.label || `Chunk ${chunk.chunk_index + 1}`;
      
      // Re-fetch current chunk status for accurate completed count
      const currentAllChunks = await getManuscriptChunks(manuscriptIdNum);
      const currentDoneCount = currentAllChunks.filter(c => c.status === 'done').length;

      await updateJob(jobId, {
        progress: {
          stage: "processing",
          message: `Processed ${chunkLabel} (${currentDoneCount}/${allChunks.length} complete)`,
          completed_units: currentDoneCount,
          phase1_last_processed_index: chunk.chunk_index,
          lease_expires_at: new_lease_expires_at,
        },
        last_progress_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("Phase1Error", {
      job_id: jobId,
      phase: "phase1",
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      processed_before_error: processed,
      total_units: allChunks.length,
    });
    // Don't set processed = 0; let the deterministic outcome logic handle it
  }

  // Deterministic job outcome based on actual chunk states
  // Re-fetch to get the current state of all chunks
  const finalChunks = await getManuscriptChunks(manuscriptIdNum);
  const finalDoneCount = finalChunks.filter(c => c.status === 'done').length;
  const finalFailedCount = finalChunks.filter(c => c.status === 'failed').length;
  const finalPendingCount = finalChunks.filter(c => c.status === 'pending').length;
  const finalProcessingCount = finalChunks.filter(c => c.status === 'processing').length;

  const finished_at = new Date().toISOString();

  // Decision matrix:
  // 1. All chunks are 'done' → phase completed (no partial flag)
  // 2. Some failed, none pending/processing → phase completed with partial=true
  // 3. Some failed, some pending/processing → keep running / allow re-run (don't mark completed)
  // 4. All failed (none done) → phase failed

  let final_phase_status: Phase1State;
  let message: string;
  let partial = false;

  if (finalDoneCount === finalChunks.length) {
    // Case 1: Perfect success
    final_phase_status = PHASE_1_STATES.COMPLETED;
    message = `Phase 1 completed successfully (${finalDoneCount}/${finalChunks.length} chunks)`;
  } else if (finalDoneCount > 0 && finalPendingCount === 0 && finalProcessingCount === 0) {
    // Case 2: Some done, some failed, nothing left to process
    final_phase_status = PHASE_1_STATES.COMPLETED;
    partial = true;
    message = `Phase 1 completed with ${finalFailedCount} failed chunks (${finalDoneCount}/${finalChunks.length} succeeded)`;
  } else if (finalDoneCount === 0 && finalFailedCount === finalChunks.length) {
    // Case 4: Total failure
    final_phase_status = PHASE_1_STATES.FAILED;
    message = `Phase 1 failed - all ${finalChunks.length} chunks failed`;
  } else {
    // Case 3: Work remaining (pending or processing chunks exist)
    // This allows resume - don't mark as completed yet
    final_phase_status = PHASE_1_STATES.RUNNING;
    message = `Phase 1 in progress: ${finalDoneCount} done, ${finalFailedCount} failed, ${finalPendingCount + finalProcessingCount} remaining`;
  }

  console.log("Phase1Outcome", {
    job_id: jobId,
    done: finalDoneCount,
    failed: finalFailedCount,
    pending: finalPendingCount,
    processing: finalProcessingCount,
    total: finalChunks.length,
    final_phase_status,
    partial,
    skipped: skippedCount,
  });

  // Update job based on outcome
  if (final_phase_status === PHASE_1_STATES.FAILED) {
    const retry_count = (job.progress.retry_count || 0) + 1;
    const max_retries = 3;

    if (retry_count <= max_retries) {
      const next_retry_at = new Date(
        Date.now() + retry_count * 60 * 1000,
      ).toISOString(); // backoff 1min, 2min, 3min

      await updateJob(jobId, {
        status: "retry_pending",
        progress: {
          stage: "failed",
          message,
          finished_at,
          phase_status: final_phase_status,
          retry_phase: "phase1",
          retry_count,
          next_retry_at,
          completed_units: finalDoneCount,
        },
        last_progress_at: new Date().toISOString(),
      });
    } else {
      await updateJob(jobId, {
        status: "failed",
        progress: {
          stage: "failed",
          message,
          finished_at,
          phase_status: final_phase_status,
          completed_units: finalDoneCount,
        },
        last_progress_at: new Date().toISOString(),
      });
    }
  } else if (final_phase_status === PHASE_1_STATES.COMPLETED) {
    // Phase 1 completed (either fully or partially)
    // Clear lease so Phase 2 can acquire immediately
    await updateJob(jobId, {
      progress: {
        stage: "complete",
        message,
        finished_at,
        phase: "phase1",
        phase_status: final_phase_status,
        completed_units: finalDoneCount,
        lease_id: null,
        lease_expires_at: null,
      },
      partial,
      last_progress_at: new Date().toISOString(),
    });
  } else {
    // RUNNING state - work remains, allow resume
    await updateJob(jobId, {
      progress: {
        stage: "processing",
        message,
        phase: "phase1",
        phase_status: final_phase_status,
        completed_units: finalDoneCount,
        lease_id: null,
        lease_expires_at: null,
      },
      last_progress_at: new Date().toISOString(),
    });
  }

  console.log("Phase1Completed", {
    job_id: jobId,
    done_chunks: finalDoneCount,
    failed_chunks: finalFailedCount,
    total_units: finalChunks.length,
    final_phase_status,
    partial,
  });

  // Emit metrics
  const phase1_duration = Date.now() - phase1_start;
  if (final_phase_status === PHASE_1_STATES.COMPLETED) {
    metrics.onPhaseCompleted(jobId, "phase1", phase1_duration);
  } else if (final_phase_status === PHASE_1_STATES.FAILED) {
    metrics.onJobFailed(jobId, "phase1", "Phase 1 failed - all chunks failed");
  }
}
