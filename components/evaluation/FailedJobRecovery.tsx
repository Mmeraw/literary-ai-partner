"use client";

/**
 * FailedJobRecovery
 *
 * Recovery UI shown when a job enters status='failed'.
 * Replaces the dead-end error state with a checkpoint-aware panel that offers:
 *   - phase2_handoff: continue from the saved Pass 1+2 handoff
 *   - chunk_checkpoint: continue from cached chunk progress
 *   - full_restart: operator-only attempt to continue from the safest available
 *       saved state; non-operators are directed to a new evaluation.
 *
 * Used by both EvaluationPoller (inline on the report page) and JobStatusPoll.
 * Checkpoint detection happens client-side by reading job progress fields when
 * available, with a fallback API call to /api/jobs/[jobId]/resume for requeue.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CancelEvaluationButton } from "@/components/evaluation/CancelEvaluationButton";

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
 * Derive checkpoint info from a job's progress JSONB when raw progress is
 * available. Some status API responses expose only percentage progress; in that
 * case this safely falls back to "no checkpoint" and lets the resume endpoint
 * make the authoritative server-side decision.
 */
export function deriveCheckpointFromProgress(
  progress: Record<string, unknown> | null | undefined,
): CheckpointInfo {
  if (!progress || typeof progress !== "object") {
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

  const hasPhase2Handoff =
    progress.resume_has_phase2_handoff === true ||
    (progress.phase === "phase_1a" && progress.phase_status === "complete") ||
    typeof progress.pass12_handoff_written_at === "string" ||
    typeof progress.pass3_completed_at === "string" ||
    (progress.phase === "phase_1a" &&
      progress.phase_status === "running" &&
      typeof progress.completed_units === "number" &&
      progress.completed_units >= 1);

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
        setResumeError(data.error ?? "Unable to continue this evaluation. Please try again or start a new evaluation.");
      } else {
        setResumed(true);
        setCheckpoint(CHECKPOINT_UNCHECKED);
        onResumed?.();
        // The failed job card stops polling at terminal failure. After the
        // server accepts the continue request, reload once so the poller starts
        // from the fresh queued/running state without showing a manual Refresh CTA.
        window.setTimeout(() => window.location.reload(), 350);
      }
    } catch (err) {
      console.error("[FailedJobRecovery] Continue failed:", err);
      setResumeError("An unexpected error occurred. Please try again or start a new evaluation.");
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
  /** When false (non-operator), hides internal checkpoint detail and recovery mode pill */
  showOperationalDetails?: boolean;
  cancelledByUser?: boolean;
};

export function FailedJobRecovery({
  jobId,
  checkpoint,
  resumeLoading,
  resumeError,
  resumed,
  onResume,
  showOperationalDetails = false,
  cancelledByUser = false,
}: FailedJobRecoveryProps) {
  const { hasPhase2Handoff, resumeMode, checked, cachedChunks, totalExpectedChunks } = checkpoint;

  if (cancelledByUser) {
    return (
      <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-900">Evaluation cancelled</p>
        <p className="text-sm text-red-800">
          Your writing was not evaluated to completion. No score or report was generated.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/evaluate"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50"
          >
            Return to job list
          </Link>
          <Link
            href="/evaluate"
            className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            Start new evaluation
          </Link>
        </div>
      </div>
    );
  }

  if (!showOperationalDetails) {
    return (
      <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm text-amber-800">
          This issue may be recoverable. Continue will ask RevisionGrade to resume from the last
          known safe checkpoint. You do not need to upload your writing again unless the
          problem continues.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onResume}
            disabled={resumeLoading || resumed}
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resumeLoading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Continuing evaluation…
              </>
            ) : resumed ? (
              "Evaluation Continuing"
            ) : (
              "Continue Evaluation"
            )}
          </button>
          <Link
            href="/evaluate"
            className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            Start New Evaluation
          </Link>
          <Link
            href="/evaluate"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50"
          >
            Return to job list
          </Link>
          <CancelEvaluationButton
            jobId={jobId}
            label="Cancel"
            returnHref="/evaluate"
            buttonClassName="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
          />
        </div>
        {resumeError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-700">{resumeError}</p>
          </div>
        )}
      </div>
    );
  }

  const bodyText: React.ReactNode = !checked ? (
    <span className="text-amber-700">Checking for saved progress…</span>
  ) : hasPhase2Handoff ? (
    <span>
      RevisionGrade found saved progress after the main analysis passes. Continue will use the
      safest saved point; you do not need to upload your writing again.
    </span>
  ) : resumeMode === "chunk_checkpoint" ? (
    <span>
      {cachedChunks > 0
        ? `${cachedChunks}${totalExpectedChunks > 0 ? ` of ${totalExpectedChunks}` : ""} chunks were saved. Continue will pick up from the safest saved point.`
        : "Saved chunk progress was found. Continue will pick up from the safest saved point."}
    </span>
  ) : (
    <span>
      This issue may be recoverable. Continue will ask RevisionGrade to proceed from the safest
      available saved point; you do not need to upload your writing again unless the problem
      continues.
    </span>
  );

  return (
    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div>
        <p className="text-sm text-amber-800">{bodyText}</p>
      </div>

      {checked && resumeMode && showOperationalDetails && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-amber-600">Saved-state mode:</span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium ${
              resumeMode === "phase2_handoff"
                ? "border-green-300 bg-green-100 text-green-800"
                : resumeMode === "chunk_checkpoint"
                ? "border-blue-300 bg-blue-100 text-blue-800"
                : "border-gray-300 bg-gray-100 text-gray-700"
            }`}
          >
            {resumeMode === "phase2_handoff"
              ? "saved handoff"
              : resumeMode === "chunk_checkpoint"
              ? "saved chunks"
              : "safest available point"}
          </span>
        </div>
      )}

      {resumeError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{resumeError}</p>
        </div>
      )}

      {resumed && !resumeError && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
          <p className="text-xs font-medium text-green-800">
            Evaluation continuing from saved progress.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onResume}
          disabled={resumeLoading || !checked || resumed}
          className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resumeLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Continuing evaluation…
            </>
          ) : resumed ? (
            "Evaluation Continuing"
          ) : (
            "Continue Evaluation"
          )}
        </button>
        <Link
          href="/evaluate"
          className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50"
        >
          Return to job list
        </Link>
        <CancelEvaluationButton
          jobId={jobId}
          label="Cancel"
          returnHref="/evaluate"
          buttonClassName="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
        />
      </div>
    </div>
  );
}
