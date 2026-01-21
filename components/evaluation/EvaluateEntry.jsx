"use client";

import React from "react";
import { useJobs } from "../../lib/jobs/useJobs";
import { getJobDisplayInfo, getJobStatusBadge } from "../../lib/jobs/ui-helpers";

export default function EvaluateEntry() {
  const {
    jobs,
    isLoading,
    isError,
    runPhase1ForJob,
    isRunningPhase1,
    runPhase1Error,
  } = useJobs();

  if (isLoading) {
    return <div>Loading jobs…</div>;
  }

  if (isError) {
    return <div>Failed to load jobs.</div>;
  }

  return (
    <div>
      <h1>Evaluate page — API test</h1>

      {runPhase1Error ? (
        <div style={{ marginBottom: 12 }}>
          Run Phase 1 error: {runPhase1Error.message}
        </div>
      ) : null}

      <h2>Recent Jobs ({jobs.length})</h2>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Manuscript</th>
            <th>Type</th>
            <th>Status</th>
            <th>Phase</th>
            <th>Phase 1 Status</th>
            <th>Policy</th>
            <th>Voice</th>
            <th>Progress Stage</th>
            <th>Progress Message</th>
            <th>Units</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {jobs.map((job) => {
            const displayInfo = getJobDisplayInfo(job);
            const statusBadge = getJobStatusBadge(displayInfo.badge);
            const canRun =
              job.status === "queued" ||
              job.status === "running" ||
              job.phase_1_status === "notstarted" ||
              job.phase_1_status === "failed";

            const isRunning = job.status === "running";

            return (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td>{job.manuscript_id}</td>
                <td>{job.type}</td>
                <td>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </td>
                <td>{displayInfo.phaseDetail.display || "—"}</td>
                <td>{job.phase_1_status}</td>
                <td>{job.policy}</td>
                <td>{job.voice}</td>
                <td>{displayInfo.message || job.progress?.stage || ""}</td>
                <td>{displayInfo.progress.display}</td>
                <td>{displayInfo.progress.display}</td>
                <td>{job.created_at}</td>
                <td>
                  <button
                    onClick={() => runPhase1ForJob(job.id)}
                    disabled={isRunningPhase1 || !canRun || isRunning}
                  >
                    {isRunning ? "Running…" : isRunningPhase1 ? "Starting…" : "Run Phase 1"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
