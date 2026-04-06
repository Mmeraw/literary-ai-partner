// lib/jobs/phase2.ts
import crypto from "crypto";
import * as metrics from "./metrics";
import { getJob, updateJob } from "./store";
import { getChunksForJob } from "@/lib/manuscripts/chunks";
import { JOB_STATUS, PHASES } from "./types";
import { writeArtifact, ARTIFACT_TYPES } from "@/lib/artifacts/writeArtifact";
import type { ReportContent, Credibility, RubricAxis } from "@/lib/evaluation/report-types";
import { gatePhase2OnPhase1 } from "@lib/evaluation/pipeline/gatePhase2OnPhase1";

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

interface Phase1ValidationResult {
  isValid: boolean;
  error?: string;
  doneCount: number;
  failedCount: number;
  totalCount: number;
}

/**
 * Stable hash marker for Evidence Gate (DB → UI proof).
 * We hash the exact artifact content we persist.
 */
function sha256Json(input: unknown): string {
  const json = JSON.stringify(input);
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * FAIL-FAST: Validate Phase 1 output is stable and ready for Phase 2
 *
 * Canon contract for Phase 2 input:
 * - job.progress.phase === "phase_1" AND phase_status === "complete"
 *   OR job.progress.phase === "phase_2" AND phase_status === "running" (normal lease transition)
 * - chunks exist for (manuscript_id, job_id)
 * - no chunks are "processing"
 * - at least one chunk is "done" with result_json
 */
async function validatePhase1Output(
  manuscriptId: number,
  jobId: string,
  jobProgress: any
): Promise<Phase1ValidationResult> {
  console.log(`[Phase2Validation] v2: running validatePhase1Output`, {
    jobId,
    manuscriptId,
    phase: jobProgress?.phase,
    phase_status: jobProgress?.phase_status,
  });

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
  jobProgress: any
): Promise<{
  summary: string;
  overallScore: number;
  chunkCount: number;
  processedCount: number;
  sourceHash: string;
  artifactContent: {
    summary: string;
    overall_score: number;
    chunk_count: number;
    processed_count: number;
    generated_at: string;
  };
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

  const generatedAt = new Date().toISOString();

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

Generated: ${generatedAt}
`;

  // Gate A6: Compute credibility metadata from chunk data
  const rubricBreakdown: RubricAxis[] = [
    {
      key: "overall_quality",
      label: "Overall Quality",
      score: avgScore,
      explanation: `Based on ${completed.length} evaluated chunks with an average score of ${avgScore.toFixed(2)}/10`,
    },
  ];

  // Coverage ratio: what fraction of chunks completed?
  const coverageRatio = chunks.length > 0 ? completed.length / chunks.length : 0;

  // Variance stability: how consistent are the scores? (1 = perfectly consistent)
  let varianceStability = 1.0;
  if (scores.length > 1) {
    const mean = avgScore;
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    // Normalize to 0-1 scale (lower variance = higher stability)
    varianceStability = mean > 0 ? Math.max(0, 1 - stdDev / mean) : 1;
  }

  // Confidence: conservative minimum of coverage and stability
  const confidence = Math.min(coverageRatio, varianceStability);

  // Validate credibility invariants (per GATE_A6_REPORT_CREDIBILITY.md section 6)
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Credibility confidence out of range: ${confidence}`);
  }
  if (coverageRatio < 0 || coverageRatio > 1) {
    throw new Error(`Coverage ratio out of range: ${coverageRatio}`);
  }
  if (varianceStability < 0 || varianceStability > 1) {
    throw new Error(`Variance stability out of range: ${varianceStability}`);
  }

  const credibility: Credibility = {
    rubricBreakdown,
    confidence,
    evidenceCount: completed.length,
    coverageRatio,
    varianceStability,
    modelVersion: process.env.EVAL_MODEL_VERSION ?? "v1.0-gate-a6",
  };

  const artifactContent: ReportContent = {
    summary,
    overall_score: avgScore,
    chunk_count: chunks.length,
    processed_count: completed.length,
    generated_at: generatedAt,
    credibility, // Gate A6: credibility metadata
  };

  // Deterministic source hash for Evidence Gate (DB → UI proof)
  const sourceHash = `sha256:${sha256Json({
    manuscript_id: manuscriptId,
    job_id: jobId,
    artifact_type: ARTIFACT_TYPES.ONE_PAGE_SUMMARY,
    content: artifactContent,
  })}`;

  return {
    summary,
    overallScore: avgScore,
    chunkCount: chunks.length,
    processedCount: completed.length,
    sourceHash,
    artifactContent,
  };
}

async function persistOutput(
  jobId: string,
  manuscriptId: number,
  result: {
    sourceHash: string;
    artifactContent: {
      summary: string;
      overall_score: number;
      chunk_count: number;
      processed_count: number;
      generated_at: string;
    };
  }
): Promise<{ persisted: boolean; artifactId?: string | null }> {
  /**
   * Report Authority Lock:
   * - NO pre-check for existence.
   * - Canonical output is ONE row per (job_id, artifact_type).
   * - DB uniqueness + upsert = idempotent and last-write-wins.
   */
  const artifactId = await writeArtifact({
    job_id: jobId,
    manuscript_id: manuscriptId,
    artifact_type: ARTIFACT_TYPES.ONE_PAGE_SUMMARY,
    artifact_version: "v1",
    content: result.artifactContent,
    source_phase: PHASES.PHASE_2,
    source_hash: result.sourceHash,
  });

  if (!artifactId) {
    // Fail-closed: artifact MUST exist after Phase 2 persistence attempt
    throw new Error(`[Phase2] Fail-closed: writeArtifact returned null for job_id=${jobId}. Artifact persistence failed.`);
  }

  console.log(`[Phase2] Artifact persisted id=${artifactId} job_id=${jobId}`);
  return { persisted: true, artifactId };
}

export async function runPhase2(jobId: string): Promise<void> {
  const phase2Start = Date.now();

  let job = await getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

      // -- EG: Fail-closed gate - block Phase 2 if Phase 1 rejected any chunk --
    const gateOk = await gatePhase2OnPhase1(jobId);
    if (!gateOk) {
      console.log('[Phase2] BLOCKED by evaluation gate - Phase 1 rejection detected', { job_id: jobId });
      return;
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
    typeof manuscriptIdRaw === "number"
      ? manuscriptIdRaw
      : Number.parseInt(String(manuscriptIdRaw), 10);

  if (!Number.isFinite(manuscriptId) || manuscriptId <= 0) {
    await updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      progress: {
        phase: PHASES.PHASE_2,
        phase_status: JOB_STATUS.FAILED,
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
        status: JOB_STATUS.FAILED,
        progress: {
          phase: PHASES.PHASE_2,
          phase_status: JOB_STATUS.FAILED,
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

    // STEP 3: persist canonical artifact (idempotent via upsert)
    const persistResult = await persistOutput(jobId, manuscriptId, {
      sourceHash: result.sourceHash,
      artifactContent: result.artifactContent,
    });

    // STEP 4: terminal job state only after persistence attempt
    await updateJob(jobId, {
      status: JOB_STATUS.COMPLETE,
      progress: {
        phase: PHASES.PHASE_2,
        phase_status: JOB_STATUS.COMPLETE,
        message: `Phase 2 complete: ${result.processedCount}/${result.chunkCount} chunks analyzed`,
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

    await updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      progress: {
        phase: PHASES.PHASE_2,
        phase_status: JOB_STATUS.FAILED,
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
