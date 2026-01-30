"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FailedJob = {
  id: string;
  manuscript_id: number;
  job_type: string;
  status: string;
  phase: string | null;
  phase_status: string | null;
  attempt_count: number;
  max_attempts: number;
  failed_at: string | null;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  work_type: string | null;
  policy_family: string;
};

export default function DeadLetterQueuePage() {
  const [jobs, setJobs] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFailedJobs();
  }, []);

  async function fetchFailedJobs() {
    setLoading(true);
    setError(null);

    try {
      const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        throw new Error("Service role key not configured");
      }

      const res = await fetch("/api/admin/dead-letter", {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch failed jobs");
      }

      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("[Dead-Letter UI] Error fetching jobs:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function retryJob(jobId: string, reason?: string) {
    setRetryingJobs((prev) => new Set(prev).add(jobId));

    try {
      const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        throw new Error("Service role key not configured");
      }

      const res = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to retry job");
      }

      const data = await res.json();
      console.log(`[Dead-Letter UI] Retried job ${jobId}:`, data);

      // Refresh the list
      await fetchFailedJobs();
    } catch (err) {
      console.error(`[Dead-Letter UI] Error retrying job ${jobId}:`, err);
      alert(`Failed to retry job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRetryingJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  function formatDate(isoString: string | null): string {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/jobs" className="text-blue-600 hover:underline">
          ← Back to Admin Jobs
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dead-Letter Queue</h1>
        <p className="text-gray-600 mt-2">
          Failed jobs that have exhausted retries or encountered fatal errors.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading failed jobs...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            <strong>Error:</strong> {error}
          </p>
          <button
            onClick={() => fetchFailedJobs()}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No failed jobs found. 🎉</p>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manuscript
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phase
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failed At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    <Link
                      href={`/evaluate/${job.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {job.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {job.manuscript_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{job.phase || "—"}</div>
                      <div className="text-xs text-gray-500">{job.phase_status || "—"}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span
                      className={
                        job.attempt_count >= job.max_attempts
                          ? "text-red-600 font-medium"
                          : ""
                      }
                    >
                      {job.attempt_count} / {job.max_attempts}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(job.failed_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {job.last_error || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => retryJob(job.id, "Manual admin retry")}
                      disabled={retryingJobs.has(job.id)}
                      className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {retryingJobs.has(job.id) ? "Retrying..." : "Retry Now"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>
          <strong>Total failed jobs:</strong> {jobs.length}
        </p>
        <p className="mt-2">
          <strong>Note:</strong> Retrying a job resets its state to{" "}
          <code className="bg-gray-100 px-1 rounded">queued</code> and clears{" "}
          <code className="bg-gray-100 px-1 rounded">failed_at</code>, but
          preserves <code className="bg-gray-100 px-1 rounded">attempt_count</code>.
        </p>
      </div>
    </main>
  );
}
