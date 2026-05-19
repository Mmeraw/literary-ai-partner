"use client";

/**
 * FailedJobRecovery
 *
 * Recovery UI shown when a job enters status='failed'.
 * Replaces the dead-end error state with a checkpoint-aware panel that offers:
 *   - phase2_handoff: "Final step only" — Pass1+Pass2 complete, just re-run Pass3
 *   - chunk_checkpoint: Resume from cached chunk N of M
 *   - full_restart: No checkpoint — honest full re-run
 *
 * Used by both EvaluationPoller (inline on the report page) and JobStatusPoll.
 * All checkpoint detection happens client-side by reading job.progress fields,
 * with a fallback API call to /api/jobs/[jobId]/resume for the actual requeue.
 */

import { useCallback, useEffect, useState } from "react";

export type ResumeMode = "phase2_handoff" | "chunk_checkpoint" | "full_restart";

export type CheckpointInfo = {
  hasCheckpoint: boolean;
  cachedChunks: number;
  totalExpectedChunks: number;
  hasPhase2Handoff: boolean;
  resumeMode: ResumeMode | null;
  checked: boolean;
};

export const CHECKPOINT_UNCHECKED: CheckpointInfo = {
  hasCheckpoint: false,
  cachedChunks: 0,
  totalExpectedChunks: 0,
  hasPhase2Handoff: false,
  resumeMode: null,
  checked: false,
};

/**
 * Derive checkpoint info from a job's progress JSONB without an extra API call.
 * The resume API is only called when the user actually clicks Resume.
 */
export function deriveCheckpointFromProgress(
  progress: Record<string, unknown> | null | undefined,
): CheckpointInfo {
  if (!progress) {
    return { ...CHECKPOINT_UNCHECKED, checked: true };
  }

  const chkResume = progress.pass1_checkpoint_resume as
    | { cached_chunks?: number; expected_chunks?: number }
    | undefined;
  const resumeInfo = progress.resume_has_checkpoint as boolean | undefined;
  const hasCachedChunks =
    typeof chkResume?.cached_chunks === "number" && chkResume.cached_chunks > 0;
  const cachedChunks = chkResume?.cached_chunks ?? 0;
  const totalExpectedChunks = chkResume?.expected_chunks ?? 0;

  // Phase-2 handoff: Pass1+Pass2 wrote the handoff artifact. The resume API
  // queries evaluation_artifacts directly so we rely on that — here we detect
  // from progress keys. The progress field from job 56d499c7 showed:
  //   phase: "phase_2", pass3_completed_at set, phase1_completed_at set
  // Also check resume_has_phase2_handoff written by a previous resume call.
  const hasPhase2Handoff =
    progress.resume_has_phase2_handoff === true ||
    (progress.phase === "phase_1" && progress.phase_status === "complete") ||
    typeof progress.pass12_handoff_written_at === "string" ||
    // pass3_completed_at present = Pass3 ran (handoff existed), job failed in validation
    typeof progress.pass3_completed_at === "string";

  const resumeMode: ResumeMode = hasPhase2Handoff
    ? "phase2_handoff"
    : hasCachedChunks || resumeInfo === true
    ? "chunk_checkpoint"
    : "full_restart";

  return {
    hasCheckpoint: hasCachedChunks || resumeInfo === true,
    cachedChunks,
    totalExpectedChunks,
    hasPhase2Handoff,
    resumeMode,
    checked: true,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

type UseFailedJobRecoveryResult = {
  checkpoint: CheckpointInfo;
  resumeLoading: boolean;
  resumeError: string | null;
  resumed: boolean;
  handleResume: () => Promise<void>;
};

export function useFailedJobRecovery(
  jobId: string,
  jobStatus: string | null | undefined,
  jobProgress: Record<string, unknown> | null | undefined,
  onResumed?: () => void,
): UseFailedJobRecoveryResult {
  const [checkpoint, setCheckpoint] = useState<CheckpointInfo>(CHECKPOINT_UNCHECKED);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);

  // Derive checkpoint info as soon as the job enters failed state.
  useEffect(() => {
    if (jobStatus !== "failed" || checkpoint.checked) return;
    setCheckpoint(deriveCheckpointFromProgress(jobProgress));
  }, [jobStatus, jobProgress, checkpoint.checked]);

  const handleResume = useCallback(async () => {
    setResumeLoading(true);
    setResumeError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        resume_mode?: string;
        cached_chunks?: number;
        total_expected_chunks?: number;
      };
      if (!res.ok || !data.success) {
        setResumeError(data.error ?? "Failed to resume evaluation. Please try again.");
      } else {
        setResumed(true);
        setCheckpoint(CHECKPOINT_UNCHECKED);
        onResumed?.();
      }
    } catch (err) {
      console.error("[FailedJobRecovery] Resume failed:", err);
      setResumeError("An unexpected error occurred. Please try again.");
    } finally {
      setResumeLoading(false);
    }
  }, [jobId, onResumed]);

  return { checkpoint, resumeLoading, resumeError, resumed, handleResume };
}

// ── UI Component ──────────────────────────────────────────────────────────────

type FailedJobRecoveryProps = {
  jobId: string;
  checkpoint: CheckpointInfo;
  resumeLoading: boolean;
  resumeError: string | null;
  resumed: boolean;
  onResume: () => void;
};

export function FailedJobRecovery({
  checkpoint,
  resumeLoading,
  resumeError,
  onResume,
}: FailedJobRecoveryProps) {
  const { hasPhase2Handoff, resumeMode, checked } = checkpoint;

  // ONE button, context-aware label:
  //   handoff present  → "Restart"  (piggybacks the handoff, skips Pass1+2)
  //   no handoff       → "Re-evaluate"  (full re-run from scratch)
  const buttonLabel = hasPhase2Handoff ? "Restart" : "Re-evaluate";

  const bodyText: React.ReactNode = !checked ? (
    <span className="text-amber-700">Checking for saved progress…</span>
  ) : hasPhase2Handoff ? (
    <span>
      Pass 1 &amp; 2 completed successfully — only the final synthesis step is needed.
      Restart will skip all chunk processing and complete from the saved handoff.
    </span>
  ) : (
    <span>
      No handoff was saved. Re-evaluate will reprocess the full manuscript from the beginning.
    </span>
  );

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4">
      <div>
        <p className="text-sm text-amber-800">{bodyText}</p>
      </div>

      {/* Recovery mode pill — operator transparency */}
      {checked && resumeMode && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-600 font-medium">Recovery mode:</span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium ${
              resumeMode === "phase2_handoff"
                ? "bg-green-100 text-green-800 border-green-300"
                : resumeMode === "chunk_checkpoint"
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : "bg-gray-100 text-gray-700 border-gray-300"
            }`}
          >
            {resumeMode === "phase2_handoff"
              ? "phase 2 handoff"
              : resumeMode === "chunk_checkpoint"
              ? "chunk checkpoint"
              : "full restart"}
          </span>
        </div>
      )}

      {resumeError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{resumeError}</p>
        </div>
      )}

      {/* Single action button */}
      <button
        onClick={onResume}
        disabled={resumeLoading || !checked}
        className="inline-flex items-center gap-2 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {resumeLoading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {hasPhase2Handoff ? "Restarting…" : "Re-evaluating…"}
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
}
