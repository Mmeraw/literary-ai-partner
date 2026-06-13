"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RecentJob {
  id: string;
  status: string;
  phase: string | null;
  manuscript_id: number | null;
  manuscript_word_count: number | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  last_error: string | null;
  failure_code: string | null;
  progress: { submitted_project_title?: string; submitted_author_name?: string } | null;
}

function statusDot(status: string) {
  if (status === "complete") return "🟢";
  if (status === "failed")   return "🔴";
  if (status === "running")  return "🟡";
  return "⚪";
}

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function EvalMonitorListPage() {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobIdInput, setJobIdInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams({ limit: "30" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/admin/jobs?${params}`)
      .then((r) => {
        if (r.status === 401 || r.status === 403) { router.replace("/evaluate"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const list = data.jobs ?? data.data?.jobs ?? data.data ?? [];
        setJobs(Array.isArray(list) ? list : []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [statusFilter, router]);

  const handleGoTo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = jobIdInput.trim();
    if (trimmed.length >= 10) router.push(`/admin/eval-monitor/${trimmed}`);
  };

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <header className="space-y-1">
          <p className="font-rg-mono text-[10px] uppercase tracking-[0.24em] text-rg-gold/70">Admin · Eval Monitor</p>
          <h1 className="font-rg-serif text-3xl">Evaluation Monitor</h1>
          <p className="text-sm text-rg-cream2/60">Live job tracking — artifacts, phases, quality signals, failure diagnostics.</p>
        </header>

        {/* Jump to job */}
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

        {/* Status filter */}
        <div className="flex flex-wrap gap-2 font-rg-mono text-xs">
          {["all", "queued", "running", "complete", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded border px-3 py-1 transition ${
                statusFilter === s
                  ? "border-rg-gold/60 text-rg-gold"
                  : "border-rg-cream2/15 text-rg-cream2/50 hover:border-rg-cream2/40"
              }`}
            >
              {s}
            </button>
          ))}
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
            return (
              <Link
                key={job.id}
                href={`/admin/eval-monitor/${job.id}`}
                className="group flex items-start justify-between gap-4 rounded-lg border border-rg-cream2/10 bg-rg-ink2/50 px-4 py-3 transition hover:border-rg-gold/40 hover:bg-rg-ink2"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span>{statusDot(job.status)}</span>
                    <span className="truncate font-medium text-rg-cream group-hover:text-rg-gold">{title}</span>
                    {author && <span className="text-xs text-rg-cream2/50">{author}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 font-rg-mono text-[10px] text-rg-cream2/50">
                    <span>{job.status}</span>
                    {job.phase && <span>phase: {job.phase}</span>}
                    {job.manuscript_word_count && <span>{job.manuscript_word_count.toLocaleString()} words</span>}
                    <span>attempt {job.attempt_count}</span>
                  </div>
                  {job.failure_code && (
                    <p className="font-rg-mono text-[10px] text-red-300">{job.failure_code}</p>
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
