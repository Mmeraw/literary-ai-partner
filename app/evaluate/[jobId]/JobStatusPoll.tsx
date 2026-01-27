"use client";

import { useEffect, useState } from "react";
import type { GetJobApiResponse, JobRecord } from "@/lib/jobs/types";
import { toUiText } from "@/lib/jobs/ui-helpers";

// GOVERNANCE: This component polls the read-only API and renders canonical truth only.
// No derived statuses. No ETAs. No fabricated progress.

const POLL_INTERVAL_MS = 1500;

type JobStatusPollProps = {
  jobId: string;
  initialJob?: JobRecord | null;
};

export function JobStatusPoll({ jobId, initialJob }: JobStatusPollProps) {
  const [job, setJob] = useState<JobRecord | null>(initialJob ?? null);
  const [notFound, setNotFound] = useState(false);

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

          **{job.progress?.phase && (
            <div>
              <span className="text-gray-600">Phase:</span>{" "}
              <span className="font-mono font-medium">{job.progress.phase}</span>
            </div>
          )}**

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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-red-900">Job Failed</h2>
          <p className="mt-2 text-sm text-red-700">
            {job.last_error ? "See error details above." : "Job failed—no error message recorded."}
          </p>
        </div>
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
