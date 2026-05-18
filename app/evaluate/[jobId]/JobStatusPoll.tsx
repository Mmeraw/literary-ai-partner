"use client";

import { useEffect, useState, useCallback } from "react";
import type { GetJobApiResponse, JobRecord } from "@/lib/jobs/types";
import { toUiText } from "@/lib/jobs/ui-helpers";

// GOVERNANCE: This component polls the read-only API and renders canonical truth only.
// No derived statuses. No ETAs. No fabricated progress.

/**
 * PR-E: Checkpoint metadata returned by the /resume endpoint.
 * Determines which recovery message to show the user.
 */
type ResumeMode = 'phase2_handoff' | 'chunk_checkpoint' | 'full_restart';

type CheckpointInfo = {
  hasCheckpoint: boolean;
  cachedChunks: number;
  totalExpectedChunks: number;
  hasPhase2Handoff: boolean;
  resumeMode: ResumeMode | null;
  checked: boolean; // true once the artifact check has completed
};

const POLL_INTERVAL_MS = 1500;

type JobStatusPollProps = {
  jobId: string;
  initialJob?: JobRecord | null;
};

export function JobStatusPoll({ jobId, initialJob }: JobStatusPollProps) {
  const [job, setJob] = useState<JobRecord | null>(initialJob ?? null);
  const [notFound, setNotFound] = useState(false);

  // PR-E: checkpoint / resume state
  const [checkpoint, setCheckpoint] = useState<CheckpointInfo>({
    hasCheckpoint: false,
    cachedChunks: 0,
    totalExpectedChunks: 0,
    hasPhase2Handoff: false,
    resumeMode: null,
    checked: false,
  });
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 404 && mounted) {
            setNotFound(true);
          }
          return;
        }

        const data: GetJobApiResponse = await res.json();

        if (mounted && data.ok) {
          setJob(data.job);

          // CANON: Stop polling on terminal statuses (complete or failed only)
          if (data.job.status === "complete" || data.job.status === "failed") {
            if (interval) clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Failed to fetch job:", err);
      }
    };

    // Initial fetch
    fetchJob();

    // CANON: Only poll if not terminal (complete or failed)
    if (
      !initialJob ||
      (initialJob.status !== "complete" && initialJob.status !== "failed")
    ) {
      interval = setInterval(fetchJob, POLL_INTERVAL_MS);
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, initialJob]);

  // PR-E: When the job enters failed state, check for checkpoint artifacts.
  // This is a one-time read — we only need to know if a checkpoint exists.
  useEffect(() => {
    if (job?.status !== "failed" || checkpoint.checked) return;

    const checkCheckpoint = async () => {
      try {
        // Probe the resume endpoint with a dry-run check: we call it and inspect
        // has_checkpoint in the response without yet committing the requeue.
        // We use the checkpoint info endpoint if available; otherwise we infer
        // from the progress field already on the job record.
        //
        // Approach: read progress.pass1_checkpoint_resume and progress.phase
        // from the already-fetched job record to avoid an extra round-trip.
        const progress = job.progress as Record<string, unknown> | null;
        const chkResume = progress?.pass1_checkpoint_resume as
          | { cached_chunks?: number; expected_chunks?: number; cached_at?: string }
          | undefined;
        const resumeInfo = progress?.resume_has_checkpoint as boolean | undefined;

        // Determine from progress whether we have a checkpoint.
        // If the job was previously resumed, progress will have resume_* keys.
        const hasCachedChunks =
          typeof chkResume?.cached_chunks === 'number' && chkResume.cached_chunks > 0;
        const previousResumeHadCheckpoint = resumeInfo === true;
        const resumeCachedChunks = (chkResume?.cached_chunks ?? 0);
        const resumeTotalChunks = (chkResume?.expected_chunks ?? 0);

        // Check for phase2 handoff via progress field
        const phaseIsComplete =
          (progress?.phase === 'phase_1' && progress?.phase_status === 'complete') ||
          typeof progress?.pass12_handoff_written_at === 'string';

        setCheckpoint({
          hasCheckpoint: hasCachedChunks || previousResumeHadCheckpoint,
          cachedChunks: resumeCachedChunks,
          totalExpectedChunks: resumeTotalChunks,
          hasPhase2Handoff: phaseIsComplete,
          resumeMode: phaseIsComplete
            ? 'phase2_handoff'
            : hasCachedChunks
            ? 'chunk_checkpoint'
            : 'full_restart',
          checked: true,
        });
      } catch (err) {
        console.error("[JobStatusPoll] Checkpoint check failed:", err);
        setCheckpoint((prev) => ({ ...prev, checked: true }));
      }
    };

    checkCheckpoint();
  }, [job?.status, job?.progress, checkpoint.checked]);

  // PR-E: Resume handler — POST /api/jobs/[jobId]/resume
  const handleResume = useCallback(async () => {
    setResumeLoading(true);
    setResumeError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json() as {
        success?: boolean;
        error?: string;
        resume_mode?: string;
        cached_chunks?: number;
        total_expected_chunks?: number;
      };
      if (!res.ok || !data.success) {
        setResumeError(data.error ?? 'Failed to resume evaluation. Please try again.');
      } else {
        // Job is now queued — resume polling
        setResumed(true);
        // Reset checkpoint state so the UI switches back to active mode
        setCheckpoint({
          hasCheckpoint: false,
          cachedChunks: 0,
          totalExpectedChunks: 0,
          hasPhase2Handoff: false,
          resumeMode: null,
          checked: false,
        });
        // Trigger a fresh job fetch to pick up the new status
        const jobRes = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
        if (jobRes.ok) {
          const jobData: GetJobApiResponse = await jobRes.json();
          if (jobData.ok) setJob(jobData.job);
        }
      }
    } catch (err) {
      console.error('[JobStatusPoll] Resume failed:', err);
      setResumeError('An unexpected error occurred. Please try again.');
    } finally {
      setResumeLoading(false);
    }
  }, [jobId]);

  // GOVERNANCE: Only these UI states exist
  if (notFound) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-lg font-semibold text-red-900">Job Not Found</h2>
        <p className="mt-2 text-sm text-red-700">
          The requested job could not be found.
        </p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <span className="text-sm text-gray-600">Loading job status...</span>
        </div>
      </div>
    );
  }

  // CANON: Render exact status from API
  // Terminal statuses per JOB_CONTRACT_v1: complete, failed only
  const isTerminal = job.status === "complete" || job.status === "failed";
  const isActive = job.status === "queued" || job.status === "running";

  return (
    <div className="space-y-6">
      {/* Status Display */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>{" "}
            {/* GOVERNANCE: Filter to canonical statuses only */}
            {(job.status === "queued" ||
              job.status === "running" ||
              job.status === "complete" ||
              job.status === "failed") ? (
              <StatusBadge status={job.status} />
            ) : (
              <span className="font-mono text-xs">{job.status}</span>
            )}
          </div>

          {job.progress?.phase && (
            <div>
              <span className="text-gray-600">Phase:</span>{" "}
              <span className="font-mono font-medium">{job.progress.phase}</span>
            </div>
          )}

          {/* GOVERNANCE: phase_status is display-only */}
          {job.progress?.phase_status && (
            <div>
              <span className="text-gray-600">Phase Status:</span>{" "}
              <span className="font-mono text-xs">{job.progress.phase_status}</span>
            </div>
          )}

          {/* GOVERNANCE: Only show progress if both values exist */}
          {job.progress?.completed_units != null &&
            job.progress?.total_units != null && (
              <div>
                <span className="text-gray-600">Progress:</span>{" "}
                <span className="font-medium">
                  {toUiText(job.progress.completed_units)} / {toUiText(job.progress.total_units)}
                </span>
              </div>
            )}
        </div>

        {/* GOVERNANCE: Show last_error verbatim if present */}
        {job.last_error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-900">Error</p>
            <pre className="mt-1 whitespace-pre-wrap text-xs text-red-700">
              {job.last_error}
            </pre>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-3 text-xs text-gray-500">
          Last updated: {new Date(job.updated_at).toLocaleString()}
        </div>
      </div>

      {/* Active Job Message */}
      {isActive && !isTerminal && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {job.status === "queued"
                  ? "Job is queued and will start soon"
                  : "Evaluation in progress"}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                This page updates automatically every {POLL_INTERVAL_MS / 1000} seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Status Messages */}
      {job.status === "complete" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="text-lg font-semibold text-green-900">
            ✓ Evaluation Complete
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Your evaluation report is ready to view.
          </p>
        </div>
      )}

      {job.status === "failed" && (
        <FailedJobRecovery
          jobId={jobId}
          checkpoint={checkpoint}
          resumeLoading={resumeLoading}
          resumeError={resumeError}
          resumed={resumed}
          onResume={handleResume}
        />
      )}
    </div>
  );
}

// ── PR-E: Recovery UI ────────────────────────────────────────────────────────
// Shown when job.status === 'failed'. Replaces the dead-end error state with a
// recovery-oriented panel that surfaces checkpoint information and offers a
// targeted resume action vs. a new evaluation.

type FailedJobRecoveryProps = {
  jobId: string;
  checkpoint: CheckpointInfo;
  resumeLoading: boolean;
  resumeError: string | null;
  resumed: boolean;
  onResume: () => void;
};

function FailedJobRecovery({
  checkpoint,
  resumeLoading,
  resumeError,
  onResume,
}: FailedJobRecoveryProps) {
  // Build contextual message based on what we know about the checkpoint.
  const { hasCheckpoint, cachedChunks, totalExpectedChunks, hasPhase2Handoff, resumeMode, checked } = checkpoint;

  let headingText = "Processing interrupted";
  let bodyText: React.ReactNode;
  let resumeLabel = "Resume Evaluation";

  if (!checked) {
    // Still determining checkpoint status — show neutral message
    bodyText = <span className="text-amber-700">Checking for saved progress…</span>;
  } else if (hasPhase2Handoff) {
    headingText = "Nearly complete — only final synthesis needed";
    bodyText = (
      <span>
        Pass 1 and Pass 2 finished successfully. Your evaluation was interrupted before
        the final synthesis step. Resuming will complete it without reprocessing any of
        your manuscript.
      </span>
    );
    resumeLabel = "Resume — Final Step Only";
  } else if (hasCheckpoint && cachedChunks > 0) {
    const pct =
      totalExpectedChunks > 0
        ? Math.round((cachedChunks / totalExpectedChunks) * 100)
        : null;
    headingText = "Progress saved — ready to resume";
    bodyText = (
      <span>
        {pct !== null ? (
          <>
            <strong>{pct}% of your manuscript</strong> ({cachedChunks} of {totalExpectedChunks} sections)
            {' '}was processed before the interruption.
          </>
        ) : (
          <>
            <strong>{cachedChunks} section{cachedChunks !== 1 ? 's' : ''}</strong> of your manuscript
            {' '}was processed before the interruption.
          </>
        )}
        {' '}Resuming will continue from where it stopped and skip the already-completed work.
      </span>
    );
    resumeLabel = `Resume from ${pct !== null ? `${pct}%` : `section ${cachedChunks}`}`;
  } else {
    // No checkpoint found — be honest
    headingText = "Evaluation stopped";
    bodyText = (
      <span>
        No saved progress was found for this evaluation. Resuming will restart the
        evaluation from the beginning.
      </span>
    );
    resumeLabel = "Restart Evaluation";
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-amber-900">{headingText}</h2>
        <p className="mt-1 text-sm text-amber-800">{bodyText}</p>
      </div>

      {/* Resume mode pill */}
      {checked && resumeMode && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-600 font-medium">Recovery mode:</span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium ${
              resumeMode === 'phase2_handoff'
                ? 'bg-green-100 text-green-800 border-green-300'
                : resumeMode === 'chunk_checkpoint'
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            {resumeMode === 'phase2_handoff'
              ? 'phase 2 handoff'
              : resumeMode === 'chunk_checkpoint'
              ? 'chunk checkpoint'
              : 'full restart'}
          </span>
        </div>
      )}

      {/* Error message from resume attempt */}
      {resumeError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{resumeError}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Primary: Resume */}
        <button
          onClick={onResume}
          disabled={resumeLoading || !checked}
          className="inline-flex items-center gap-2 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resumeLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Resuming…
            </>
          ) : (
            resumeLabel
          )}
        </button>

        {/* Secondary: Start new evaluation — links back to upload */}
        <a
          href="/evaluate"
          className="inline-flex items-center rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors"
        >
          Start new evaluation
        </a>
      </div>

      {/* Fine print: what “resume” means vs “new” */}
      <p className="text-xs text-amber-600">
        <strong>Resume</strong> continues this evaluation from its last saved point.
        {' '}<strong>Start new</strong> creates a fresh evaluation with no reused progress.
      </p>
    </div>
  );
}

// GOVERNANCE: Status badge renders canonical status only
// CANON: JOB_CONTRACT_v1 allows: queued, running, complete, failed
function StatusBadge({
  status,
}: {
  status: "queued" | "running" | "complete" | "failed";
}) {
  const styles = {
    queued: "bg-gray-100 text-gray-800 border-gray-300",
    running: "bg-blue-100 text-blue-800 border-blue-300",
    complete: "bg-green-100 text-green-800 border-green-300",
    failed: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
