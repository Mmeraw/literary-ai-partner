"use client";

import React from "react";
import { useJobs } from "../../lib/jobs/useJobs";

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
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {jobs.map((job) => {
            const canRun =
              job.status === "queued" ||
              job.status === "running" ||
              job.phase_1_status === "notstarted" ||
              job.phase_1_status === "failed";

            return (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td>{job.manuscript_id}</td>
                <td>{job.type}</td>
                <td>{job.status}</td>
                <td>{job.phase}</td>
                <td>{job.phase_1_status}</td>
                <td>{job.policy}</td>
                <td>{job.voice}</td>
                <td>{job.created_at}</td>
                <td>
                  <button
                    onClick={() => runPhase1ForJob(job.id)}
                    disabled={isRunningPhase1 || !canRun}
                  >
                    {isRunningPhase1 ? "Running…" : "Run Phase 1"}
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
