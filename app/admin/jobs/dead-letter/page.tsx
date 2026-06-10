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
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link
            href="/admin/jobs"
            className="text-sm text-rg-gold underline"
          >
            ← Back to Admin Jobs
          </Link>
          <p className="mt-4 font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            Admin · Dead Letter Queue
          </p>
          <h1 className="mt-2 font-rg-serif text-3xl font-semibold">Failed Jobs</h1>
          <p className="mt-2 text-sm text-rg-cream2/70">
            Jobs in the canonical failed state. Retrying resets status to queued and
            clears failed_at.
          </p>
        </header>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rg-gold"></div>
            <p className="mt-4 text-sm text-rg-cream2/70">
              Loading failed jobs...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-4">
            <p className="font-semibold text-red-300">
              <strong>Error:</strong> {error}
            </p>
            <button
              onClick={() => fetchFailedJobs()}
              className="mt-2 text-sm font-semibold text-red-300 hover:text-red-200 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="text-center py-12 rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
            <p className="font-semibold text-rg-cream2/70">
              No failed jobs found.
            </p>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
            <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
              <thead className="bg-rg-ink2">
                <tr>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Job ID
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Manuscript
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    User Email
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Phase
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Failed At
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-right font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rg-cream2/10">
                {jobs.map((job) => (
                  <tr key={job.id} className="transition hover:bg-rg-ink2/50">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold">
                      <Link
                        href={`/evaluate/${job.id}`}
                        className="text-rg-gold hover:text-rg-cream underline"
                      >
                        {job.id.slice(0, 8)}...
                      </Link>
                      <Link
                        href={`/admin/forensics/${job.id}`}
                        className="ml-2 text-amber-300 hover:text-amber-200 font-semibold text-xs"
                        title="SIPOC Forensic View"
                      >
                        forensic
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-rg-cream">
                      {job.manuscript_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">
                      {job.owner_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-rg-cream">
                        {job.phase || "—"}
                      </div>
                      <div className="text-xs text-rg-cream2/50">
                        {job.phase_status || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          job.attempt_count >= job.max_attempts
                            ? "font-bold text-red-400"
                            : "font-semibold text-rg-cream"
                        }
                      >
                        {job.attempt_count} / {job.max_attempts}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">
                      {formatDate(job.failed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-md truncate rounded bg-red-900/30 px-2 py-1 font-semibold text-red-300 ring-1 ring-red-400/30">
                        {job.last_error || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => retryJob(job.id, "Manual admin retry")}
                        disabled={retryingJobs.has(job.id)}
                        className="rounded bg-rg-gold px-3 py-1.5 text-xs font-bold text-rg-ink hover:bg-amber-400 disabled:bg-rg-cream2/20 disabled:text-rg-cream2/40 disabled:cursor-not-allowed"
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

        <div className="text-sm text-rg-cream2/70">
          <p>
            <strong className="text-rg-cream">Total failed jobs:</strong>{" "}
            {jobs.length}
          </p>
          <p className="mt-2">
            <strong className="text-rg-cream">Note:</strong> Retrying a job
            resets its state to{" "}
            <code className="rounded bg-rg-ink2 px-1.5 py-0.5 font-mono text-xs font-semibold text-rg-gold ring-1 ring-rg-cream2/20">
              queued
            </code>{" "}
            and clears{" "}
            <code className="rounded bg-rg-ink2 px-1.5 py-0.5 font-mono text-xs font-semibold text-rg-gold ring-1 ring-rg-cream2/20">
              failed_at
            </code>
            , but preserves{" "}
            <code className="rounded bg-rg-ink2 px-1.5 py-0.5 font-mono text-xs font-semibold text-rg-gold ring-1 ring-rg-cream2/20">
              attempt_count
            </code>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
