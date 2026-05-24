"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GetJobApiResponse, JobRecord } from "@/lib/jobs/types";
import { toUiText } from "@/lib/jobs/ui-helpers";
import {
  FailedJobRecovery,
  useFailedJobRecovery,
  deriveCheckpointFromProgress,
} from "@/components/evaluation/FailedJobRecovery";

// GOVERNANCE: This component polls the read-only API and renders canonical truth only.
// No derived statuses. No ETAs. No fabricated progress.

const POLL_INTERVAL_MS = 1500;

// How often to poll when job is at the Review Gate.
// Slower cadence — author is reading, no worker activity needed.
const REVIEW_GATE_POLL_INTERVAL_MS = 5000;

type JobStatusPollProps = {
  jobId: string;
  initialJob?: JobRecord | null;
};

// CANON: phase='review_gate' + phase_status='awaiting_approval'
// status is still 'queued' — the worker never claims review_gate jobs.
function isAtReviewGate(job: JobRecord): boolean {
  const j = job as unknown as { phase?: string; phase_status?: string };
  return j.phase === "review_gate" && j.phase_status === "awaiting_approval";
}

export function JobStatusPoll({ jobId, initialJob }: JobStatusPollProps) {
  const [job, setJob] = useState<JobRecord | null>(initialJob ?? null);
  const [notFound, setNotFound] = useState(false);

  // PR-E: checkpoint / resume — shared hook + component
  const jobProgressAsRecord =
    job?.status === "failed"
      ? (job as unknown as { progress?: Record<string, unknown> }).progress ?? null
      : null;
  const { checkpoint, resumeLoading, resumeError, resumed, handleResume } =
    useFailedJobRecovery(
      jobId,
      job?.status ?? null,
      jobProgressAsRecord,
      () => setJob((prev) => (prev ? { ...prev, status: "queued" } : prev)),
    );

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

          // CANON: Stop polling on terminal statuses (complete or failed only).
          // review_gate / awaiting_approval is NOT terminal — continue polling
          // so the UI updates if the author approves in another tab.
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
      // Use slower poll cadence at the Review Gate
      const pollMs =
        initialJob && isAtReviewGate(initialJob)
          ? REVIEW_GATE_POLL_INTERVAL_MS
          : POLL_INTERVAL_MS;
      interval = setInterval(fetchJob, pollMs);
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, initialJob]);

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
  const atReviewGate = isAtReviewGate(job);

  return (
    <div className="space-y-6">
      {/* Status Display */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>{" "}
            {/* GOVERNANCE: Filter to canonical statuses only */}
            {job.status === "queued" ||
            job.status === "running" ||
            job.status === "complete" ||
            job.status === "failed" ? (
              <StatusBadge status={job.status} />
            ) : (
              <span className="font-mono text-xs">{job.status}</span>
            )}
          </div>

          {/* Phase badge — show review_gate visually distinct */}
          {(job as unknown as { phase?: string }).phase && (
            <div>
              <span className="text-gray-600">Phase:</span>{" "}
              <PhaseBadge
                phase={(job as unknown as { phase: string }).phase}
                phaseStatus={
                  (job as unknown as { phase_status?: string }).phase_status
                }
              />
            </div>
          )}

          {/* GOVERNANCE: Only show progress if both values exist */}
          {(job as unknown as { progress?: { completed_units?: unknown; total_units?: unknown } }).progress
            ?.completed_units != null &&
            (job as unknown as { progress?: { completed_units?: unknown; total_units?: unknown } }).progress
              ?.total_units != null && (
              <div>
                <span className="text-gray-600">Progress:</span>{" "}
                <span className="font-medium">
                  {toUiText(
                    (
                      job as unknown as {
                        progress: { completed_units: unknown };
                      }
                    ).progress.completed_units,
                  )}{" "}
                  /{" "}
                  {toUiText(
                    (
                      job as unknown as { progress: { total_units: unknown } }
                    ).progress.total_units,
                  )}
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

      {/* ── REVIEW GATE CTA ─────────────────────────────────────────────── */}
      {/* Phase 1A complete. Author must review the Story Ledger before      */}
      {/* Phase 2 can be queued. This is a hard gate — backend enforced.     */}
      {atReviewGate && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-4">
            {/* Gate icon */}
            <div className="flex-shrink-0 mt-0.5">
              <svg
                className="h-6 w-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-amber-900">
                Story Ledger Ready — Review Gate
              </h3>
              <p className="mt-1 text-sm text-amber-800 leading-relaxed">
                Phase 1A is complete. RevisionGrade has built your Story Ledger
                — an 8-layer story map of your manuscript. Review it, then
                approve or reject to control whether Phase 2 (craft diagnostic)
                runs.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/evaluate/${jobId}/ledger`}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                  data-testid="button-review-story-ledger"
                >
                  Review Story Ledger
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
              <p className="mt-3 text-xs text-amber-700">
                Phase 2 will not start until you approve. This gate cannot be
                bypassed from the frontend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Job Message — only when running/queued and NOT at review gate */}
      {isActive && !isTerminal && !atReviewGate && (
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
                This page updates automatically every{" "}
                {POLL_INTERVAL_MS / 1000} seconds.
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

/**
 * PhaseBadge — renders the phase + phase_status pair.
 * review_gate/awaiting_approval gets a distinct amber treatment.
 */
function PhaseBadge({
  phase,
  phaseStatus,
}: {
  phase: string;
  phaseStatus?: string | null;
}) {
  const isGate =
    phase === "review_gate" && phaseStatus === "awaiting_approval";

  if (isGate) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-xs font-medium text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        review_gate · awaiting_approval
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs font-medium text-gray-700">
      {phase}
      {phaseStatus ? ` · ${phaseStatus}` : ""}
    </span>
  );
}
