"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FailedJob = {
  id: string;
  user_id: string;
  owner_email: string | null;
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
      const res = await fetch("/api/admin/dead-letter");

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
      const res = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
      <Link
        href="/admin/jobs"
        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
      >
        ← Back to Admin Jobs
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-950">Failed Jobs</h1>

      <p className="mt-1 text-sm font-medium text-slate-700">
        Jobs in the canonical failed state. Retrying resets status to queued and
        clears failed_at.
      </p>

      {loading && (
        <div className="mt-8 text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="mt-4 text-sm font-medium text-slate-700">
            Loading failed jobs...
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-semibold text-red-800">
            <strong>Error:</strong> {error}
          </p>
          <button
            onClick={() => fetchFailedJobs()}
            className="mt-2 text-sm font-semibold text-red-700 hover:text-red-900 underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="mt-8 text-center py-12 rounded-lg border border-slate-300 bg-white">
          <p className="font-semibold text-slate-800">
            No failed jobs found.
          </p>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-300 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Job ID
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Manuscript
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  User Email
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Phase
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Attempts
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Failed At
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Reason
                </th>
                <th className="px-4 py-3 text-right font-bold text-slate-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold text-blue-700">
                    <Link
                      href={`/evaluate/${job.id}`}
                      className="hover:text-blue-900 hover:underline"
                    >
                      {job.id.slice(0, 8)}...
                    </Link>
                    <Link
                      href={`/admin/forensics/${job.id}`}
                      className="ml-2 text-amber-700 hover:text-amber-900 font-semibold text-xs"
                      title="SIPOC Forensic View"
                    >
                      forensic
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                    {job.manuscript_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                    {job.owner_email ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">
                      {job.phase || "—"}
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      {job.phase_status || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        job.attempt_count >= job.max_attempts
                          ? "font-bold text-red-700"
                          : "font-semibold text-slate-900"
                      }
                    >
                      {job.attempt_count} / {job.max_attempts}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                    {formatDate(job.failed_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block max-w-md truncate rounded bg-red-50 px-2 py-1 font-semibold text-red-800 ring-1 ring-red-200">
                      {job.last_error || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => retryJob(job.id, "Manual admin retry")}
                      disabled={retryingJobs.has(job.id)}
                      className="rounded bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
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

      <div className="mt-6 text-sm font-medium text-slate-700">
        <p>
          <strong className="text-slate-900">Total failed jobs:</strong>{" "}
          {jobs.length}
        </p>
        <p className="mt-2">
          <strong className="text-slate-900">Note:</strong> Retrying a job
          resets its state to{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900 ring-1 ring-slate-300">
            queued
          </code>{" "}
          and clears{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900 ring-1 ring-slate-300">
            failed_at
          </code>
          , but preserves{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900 ring-1 ring-slate-300">
            attempt_count
          </code>
          .
        </p>
      </div>
    </section>
  );
}
