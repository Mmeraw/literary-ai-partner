"use client";

import React from "react";
import { useJobs } from "../../lib/jobs/useJobs";

export default function EvaluateEntry() {
  const { jobs, isLoading, isError } = useJobs();

  if (isLoading) {
    return <div>Loading jobs…</div>;
  }

  if (isError) {
    return <div>Failed to load jobs.</div>;
  }

  return (
    <div>
      <h1>Evaluate page — API test</h1>
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
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
