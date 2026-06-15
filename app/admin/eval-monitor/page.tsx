"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RecentJob {
  id: string;
  status: string;
  phase: string | null;
  phase_status?: string | null;
  raw_status?: string | null;
  manuscript_id: number | null;
  manuscript_word_count: number | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  last_error: string | Record<string, unknown> | null;
  failure_code: string | null;
  error_code?: string | null;
  progress: { submitted_project_title?: string; submitted_author_name?: string; phase_status?: string } | null;
}

const JOB_LIST_LIMIT = 30;

function statusDot(status: string) {
  if (status === "complete") return "🟢";
  if (status === "failed")   return "🔴";
  if (status === "running")  return "🟡";
  if (status === "queued")   return "⚪";
  return "⚫";
}

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function errorText(lastError: RecentJob["last_error"]): string | null {
  if (!lastError) return null;
  if (typeof lastError === "string") return lastError;
  const message = lastError.message ?? lastError.error ?? lastError.details;
  return typeof message === "string" ? message : JSON.stringify(lastError);
}

export default function EvalMonitorListPage() {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobIdInput, setJobIdInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("failed");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const router = useRouter();

  function load(isRefresh = false) {
    const params = new URLSearchParams({ limit: String(JOB_LIST_LIMIT), show_test: "1" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    fetch(`/api/admin/jobs?${params}`, { cache: "no-store" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { router.replace("/evaluate"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const list = data.jobs ?? data.data?.jobs ?? data.data ?? [];
        setJobs(Array.isArray(list) ? list : []);
        setLastRefresh(new Date());
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    load(false);
    // Deliberately no automatic polling: admin data refreshes only by button click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleGoTo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = jobIdInput.trim();
    if (trimmed.length >= 10) router.push(`/admin/eval-monitor/${trimmed}`);
  };

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">

        <header className="space-y-1">
          <p className="font-rg-mono text-[10px] uppercase tracking-[0.24em] text-rg-gold/70">Admin · Eval Monitor</p>
          <h1 className="font-rg-serif text-3xl">Evaluation Monitor</h1>
          <p className="text-sm text-rg-cream2/60">
            Manual job tracking — defaults to latest failures and is capped at {JOB_LIST_LIMIT} records.
            {lastRefresh && <span> Last refresh: {lastRefresh.toLocaleTimeString()}.</span>}
          </p>
        </header>

        <form onSubmit={handleGoTo} className="flex gap-2">
          <input
            type="text"
            value={jobIdInput}
            onChange={(e) => setJobIdInput(e.target.value)}
            placeholder="Paste job ID…"
            className="flex-1 rounded border border-rg-cream2/20 bg-rg-ink2 px-3 py-2 font-rg-mono text-sm text-rg-cream placeholder-rg-cream2/30 focus:border-rg-gold/50 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded border border-rg-gold/40 px-4 py-2 font-rg-mono text-sm text-rg-gold transition hover:border-rg-gold/70 hover:text-rg-cream"
          >
            Monitor →
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 font-rg-mono text-xs">
          {[
            ["failed", "Failed"],
            ["queued", "Queued"],
            ["running", "Running"],
            ["complete", "Complete"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded border px-3 py-1 transition ${
                statusFilter === value
                  ? "border-rg-gold/60 text-rg-gold"
                  : "border-rg-cream2/15 text-rg-cream2/50 hover:border-rg-cream2/40"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="rounded border border-rg-gold/40 px-3 py-1 text-rg-gold transition hover:border-rg-gold/70 hover:text-rg-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <span className="ml-auto text-rg-cream2/45">{jobs.length} job(s)</span>
        </div>

        {loading && <p className="animate-pulse font-rg-mono text-xs text-rg-cream2/50">Loading…</p>}
        {error && <p className="text-sm text-red-300">Error: {error}</p>}

        {!loading && jobs.length === 0 && (
          <p className="font-rg-mono text-sm text-rg-cream2/50">No jobs found.</p>
        )}

        <div className="space-y-2">
          {jobs.map((job) => {
            const title = job.progress?.submitted_project_title ?? `Manuscript #${job.manuscript_id}`;
            const author = job.progress?.submitted_author_name ?? "";
            const failureCode = job.failure_code ?? job.error_code;
            const detail = errorText(job.last_error);
            return (
              <Link
                key={job.id}
                href={`/admin/eval-monitor/${job.id}`}
                className="group flex items-start justify-between gap-4 rounded-lg border border-rg-cream2/10 bg-rg-ink2/50 px-4 py-3 transition hover:border-rg-gold/40 hover:bg-rg-ink2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{statusDot(job.status)}</span>
                    <span className="font-medium text-rg-cream group-hover:text-rg-gold">{title}</span>
                    {author && <span className="text-xs text-rg-cream2/50">{author}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 font-rg-mono text-[10px] text-rg-cream2/50">
                    <span>status: {job.status}</span>
                    {job.raw_status && job.raw_status !== job.status && <span>raw: {job.raw_status}</span>}
                    {job.phase && <span>phase: {job.phase}</span>}
                    {job.phase_status && <span>phase status: {job.phase_status}</span>}
                    {job.manuscript_word_count && <span>{job.manuscript_word_count.toLocaleString()} words</span>}
                    <span>attempt {job.attempt_count}</span>
                    <span>created {ago(job.created_at)}</span>
                  </div>
                  {failureCode && (
                    <p className="font-rg-mono text-[10px] text-red-300">{failureCode}</p>
                  )}
                  {detail && (
                    <p className="line-clamp-2 text-xs text-rg-cream2/55">{detail}</p>
                  )}
                </div>
                <div className="shrink-0 text-right font-rg-mono text-[10px] text-rg-cream2/40">
                  <p>{ago(job.updated_at)}</p>
                  <p className="text-[9px]">{job.id.slice(0, 8)}…</p>
                </div>
              </Link>
            );
          })}
        </div>

        <Link href="/admin" className="inline-block font-rg-mono text-xs text-rg-gold hover:underline">← Admin</Link>
      </div>
    </main>
  );
}
