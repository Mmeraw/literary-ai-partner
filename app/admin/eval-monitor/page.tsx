"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JobStatus = "queued" | "running" | "complete" | "failed";

type EvaluationJob = {
  id: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  phase: string | null;
  phase_status: string | null;
  manuscript_id: number | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
};

type StatusFilter = "all" | JobStatus;

const FILTERS: StatusFilter[] = ["all", "queued", "running", "complete", "failed"];

export default function AdminEvalMonitorPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<EvaluationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("running");
  const [jobIdInput, setJobIdInput] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  async function loadJobs(nextStatusFilter = statusFilter) {
    setError(null);

    const params = new URLSearchParams();
    if (nextStatusFilter !== "all") params.set("status", nextStatusFilter);
    params.set("show_test", "1");
    params.set("limit", "500");

    try {
      const res = await fetch(`/api/admin/jobs?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        router.replace("/evaluate");
        return;
      }

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load jobs");
      }

      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setLastRefreshAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadJobs(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadJobs(statusFilter);
    }, 10000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredJobs = useMemo(() => {
    const q = jobIdInput.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => job.id.toLowerCase().includes(q));
  }, [jobs, jobIdInput]);

  const monitorExactJob = () => {
    const normalized = jobIdInput.trim();
    if (!normalized) return;
    router.push(`/admin/forensics/${encodeURIComponent(normalized)}`);
  };

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Admin · Eval Monitor</p>
          <h1 className="mt-2 font-rg-serif text-5xl">Evaluation Monitor</h1>
          <p className="mt-3 max-w-4xl text-3xl leading-relaxed text-rg-cream2/80">
            Live job tracking — artifacts, phases, quality signals, failure diagnostics.
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={jobIdInput}
            onChange={(event) => setJobIdInput(event.target.value)}
            placeholder="Paste job ID…"
            className="h-14 border border-rg-cream2/20 bg-rg-ink2 px-4 font-rg-mono text-lg text-rg-cream outline-none placeholder:text-rg-cream2/45 focus:border-rg-gold"
          />
          <button
            type="button"
            onClick={monitorExactJob}
            className="h-14 border border-rg-gold/50 px-6 font-rg-mono text-xl text-rg-gold hover:bg-rg-gold/10"
          >
            Monitor →
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {FILTERS.map((filter) => {
            const active = statusFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded border px-4 py-2 font-rg-mono text-2xl ${
                  active
                    ? "border-rg-gold/60 bg-rg-gold/10 text-rg-gold"
                    : "border-rg-cream2/20 text-rg-cream hover:border-rg-gold/40"
                }`}
              >
                {filter}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void loadJobs(statusFilter)}
            className="rounded border border-rg-cream2/30 px-4 py-2 font-rg-mono text-sm text-rg-cream2 hover:border-rg-gold/60 hover:text-rg-cream"
          >
            Refresh now
          </button>
        </div>

        {lastRefreshAt && (
          <p className="text-sm text-rg-cream2/60">
            Last refresh: {new Date(lastRefreshAt).toLocaleTimeString()}
          </p>
        )}

        {loading ? (
          <p className="text-rg-cream2/70">Loading jobs…</p>
        ) : error ? (
          <div className="rounded border border-red-500/40 bg-red-900/20 p-4 text-red-200">{error}</div>
        ) : filteredJobs.length === 0 ? (
          <p className="text-4xl text-rg-cream2/75">No jobs found.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-rg-cream2/15 bg-rg-ink2/60">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-rg-cream2/10 text-rg-gold">
                <tr>
                  <th className="px-4 py-3 font-rg-mono text-xs uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3 font-rg-mono text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-rg-mono text-xs uppercase tracking-wider">Phase</th>
                  <th className="px-4 py-3 font-rg-mono text-xs uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3 font-rg-mono text-xs uppercase tracking-wider">Attempts</th>
                  <th className="px-4 py-3 font-rg-mono text-xs uppercase tracking-wider">Last error</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b border-rg-cream2/10 align-top">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/admin/forensics/${job.id}`} className="text-rg-gold underline hover:text-rg-cream">
                        {job.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-rg-cream2/20 px-2 py-1 font-rg-mono text-xs">{job.status}</span>
                    </td>
                    <td className="px-4 py-3 text-rg-cream2/90">
                      {job.phase ?? "—"} / {job.phase_status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-rg-cream2/70">{new Date(job.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-rg-cream2/80">{job.attempt_count}/{job.max_attempts}</td>
                    <td className="px-4 py-3 text-rg-cream2/70">{job.last_error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Link href="/admin" className="inline-block font-rg-mono text-xl text-rg-gold hover:text-rg-cream">
          ← Admin
        </Link>
      </div>
    </main>
  );
}
