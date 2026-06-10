"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EvaluationJob {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  manuscript_id: number;
  phase: string | null;
  phase_status: string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<EvaluationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("limit", "50");

    fetch(`/api/admin/jobs?${params}`)
      .then((res) => {
        if (res.status === 403 || res.status === 401) {
          router.replace("/evaluate");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.ok && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        } else if (data.success && data.data) {
          setJobs(Array.isArray(data.data) ? data.data : data.data.jobs ?? []);
        } else if (data.error) {
          setError(data.error?.message ?? JSON.stringify(data.error));
        } else {
          setJobs([]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-rg-cream2/70">Loading jobs...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-4">
            <p className="font-semibold text-red-300">Error: {error}</p>
          </div>
          <Link
            href="/admin"
            className="inline-block text-sm text-rg-gold underline"
          >
            ← Back to Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link
            href="/admin"
            className="text-sm text-rg-gold underline"
          >
            ← Back to Admin
          </Link>
          <p className="mt-4 font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            Admin · Evaluation Jobs
          </p>
          <h1 className="mt-2 font-rg-serif text-3xl font-semibold">
            Evaluation Jobs
          </h1>
        </header>

        <div className="flex gap-2 flex-wrap">
          {["all", "queued", "running", "complete", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setLoading(true);
                setStatusFilter(s);
              }}
              className={`rounded px-3 py-1.5 text-sm font-semibold border ${
                statusFilter === s
                  ? "bg-rg-gold text-rg-ink border-rg-gold"
                  : "bg-rg-ink2/70 text-rg-cream2/70 border-rg-cream2/20 hover:border-rg-gold/60 hover:text-rg-cream"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <p className="text-sm text-rg-cream2/70">
          {jobs.length} job(s) found
        </p>

        {jobs.length === 0 ? (
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-8 text-center">
            <p className="font-semibold text-rg-cream2/70">
              No jobs found for this filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
            <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
              <thead className="bg-rg-ink2">
                <tr>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Phase
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Last Error
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
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                          job.status === "complete"
                            ? "bg-green-900/30 text-green-300 ring-1 ring-green-400/30"
                            : job.status === "failed"
                              ? "bg-red-900/30 text-red-300 ring-1 ring-red-400/30"
                              : job.status === "running"
                                ? "bg-blue-900/30 text-blue-300 ring-1 ring-blue-400/30"
                                : "bg-rg-ink2 text-rg-cream2/70 ring-1 ring-rg-cream2/20"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-rg-cream">
                      {job.phase ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-rg-cream">
                      {job.attempt_count}/{job.max_attempts}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-rg-cream2/70">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {job.last_error ? (
                        <span className="block max-w-md truncate rounded bg-red-900/30 px-2 py-1 font-semibold text-red-300 ring-1 ring-red-400/30">
                          {job.last_error}
                        </span>
                      ) : (
                        <span className="text-rg-cream2/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
