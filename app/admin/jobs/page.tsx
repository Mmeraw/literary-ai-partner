"use client";

import React, { useState, useEffect } from "react";
import { getJobDisplayInfo, getJobStatusBadge } from "../../../lib/jobs/ui-helpers";

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    phase: "all",
    dateFrom: "",
  });
  const [selectedJob, setSelectedJob] = useState(null);

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for updates
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000); // 2 second polling
    return () => clearInterval(interval);
  }, []);

  // Cancel job
  const handleCancel = async (jobId) => {
    if (!confirm("Are you sure you want to cancel this job?")) return;

    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
      if (res.ok) {
        alert("Job canceled successfully");
        fetchJobs();
      } else {
        const error = await res.json();
        alert(`Failed to cancel: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to cancel job");
    }
  };

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filters.status !== "all" && job.status !== filters.status) return false;
    if (filters.phase !== "all" && job.progress?.phase !== filters.phase) return false;
    if (filters.dateFrom && new Date(job.created_at) < new Date(filters.dateFrom)) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Job Management</h1>
        <p>Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Job Management Dashboard</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            className="border rounded px-3 py-2"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="complete">Complete</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
            <option value="retry_pending">Retry Pending</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phase</label>
          <select
            className="border rounded px-3 py-2"
            value={filters.phase}
            onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
          >
            <option value="all">All</option>
            <option value="phase1">Phase 1</option>
            <option value="phase2">Phase 2</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
        </div>

        <button
          className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
          onClick={() => setFilters({ status: "all", phase: "all", dateFrom: "" })}
        >
          Clear Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded">
          <div className="text-2xl font-bold">{jobs.length}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-blue-100 p-4 rounded">
          <div className="text-2xl font-bold">{jobs.filter(j => j.status === "running").length}</div>
          <div className="text-sm text-gray-600">Running</div>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <div className="text-2xl font-bold">{jobs.filter(j => j.status === "complete").length}</div>
          <div className="text-sm text-gray-600">Complete</div>
        </div>
        <div className="bg-red-100 p-4 rounded">
          <div className="text-2xl font-bold">{jobs.filter(j => j.status === "failed").length}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <div className="text-2xl font-bold">{jobs.filter(j => j.status === "retry_pending").length}</div>
          <div className="text-sm text-gray-600">Retry Pending</div>
        </div>
        <div className="bg-gray-100 p-4 rounded">
          <div className="text-2xl font-bold">{jobs.filter(j => j.status === "canceled").length}</div>
          <div className="text-sm text-gray-600">Canceled</div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredJobs.map((job) => {
              const displayInfo = getJobDisplayInfo(job);
              const badge = getJobStatusBadge(displayInfo.badge);

              return (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{job.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{displayInfo.phaseDetail.display || "—"}</td>
                  <td className="px-4 py-3 text-sm">{displayInfo.progress.display}</td>
                  <td className="px-4 py-3 text-sm">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => setSelectedJob(job)}
                    >
                      View
                    </button>
                    {displayInfo.canCancel && (
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleCancel(job.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredJobs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No jobs found matching filters
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Job Details</h2>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => setSelectedJob(null)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Job ID</div>
                  <div className="font-mono">{selectedJob.id}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Manuscript ID</div>
                  <div className="font-mono">{selectedJob.manuscript_id}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div>{selectedJob.status}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Created</div>
                  <div>{new Date(selectedJob.created_at).toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Updated</div>
                  <div>{new Date(selectedJob.updated_at).toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Progress Snapshot</div>
                  <pre className="bg-gray-100 p-4 rounded mt-2 text-xs overflow-auto">
                    {JSON.stringify(selectedJob.progress, null, 2)}
                  </pre>
                </div>

                {selectedJob.progress?.last_error && (
                  <div>
                    <div className="text-sm font-medium text-red-600">Last Error</div>
                    <div className="bg-red-50 p-4 rounded mt-2 text-sm">
                      {selectedJob.progress.last_error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
