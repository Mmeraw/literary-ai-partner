/**
 * Per-Evaluation Cost Ledger
 *
 * Route: /admin/costs/evaluations
 *
 * Shows every evaluation job's LLM spend broken down by pipeline phase
 * and model. Auto-refreshes faster when running jobs are detected.
 *
 * Styled to match /admin/costs (rg-ink, rg-gold, rg-cream brand tokens).
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { EvalJobCostRow, EvalCostLedgerPayload } from "@/app/api/admin/costs/evaluations/route";

// ─── Helpers ────────────────────────────────────────────────────────

function fmtUsd(cents: number): string {
  const d = cents / 100;
  return d < 0.01 && d > 0
    ? "<$0.01"
    : `$${d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDuration(first: string | null, last: string | null): string {
  if (!first || !last) return "—";
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function statusBadge(status: string | null): string {
  switch (status) {
    case "complete":  return "bg-emerald-800/60 text-emerald-300 border-emerald-500/30";
    case "failed":    return "bg-red-800/60 text-red-300 border-red-500/30";
    case "running":   return "bg-blue-800/60 text-blue-300 border-blue-500/30";
    case "queued":    return "bg-amber-800/60 text-amber-300 border-amber-500/30";
    default:          return "bg-rg-ink2 text-rg-cream2/40 border-rg-cream2/10";
  }
}

function modelBadge(model: string): string {
  if (model.includes("5.1") || model.includes("o1"))
    return "text-amber-300";
  if (model.includes("mini") || model.includes("4o") || model.includes("cheap"))
    return "text-emerald-300";
  return "text-rg-cream2/70";
}

// ─── Phase table sub-component ───────────────────────────────────────

function PhaseTable({ phases }: { phases: EvalJobCostRow["phases"] }) {
  return (
    <div className="overflow-x-auto border-t border-rg-cream2/10 bg-rg-ink/60">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-rg-cream2/8">
            {["Phase", "Model", "Calls", "Input", "Output", "Cost", "Last call"].map((h) => (
              <th
                key={h}
                className="px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/40"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rg-cream2/5">
          {phases.map((p, i) => (
            <tr key={i} className="transition hover:bg-rg-ink2/30">
              <td className="whitespace-nowrap px-4 py-2 font-rg-mono text-[11px] text-rg-cream2/70">
                {p.phase}
              </td>
              <td className={`whitespace-nowrap px-4 py-2 font-rg-mono text-[11px] ${modelBadge(p.model)}`}>
                {p.model}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/55">{p.calls}</td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/55">{fmtTokens(p.inputTokens)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/55">{fmtTokens(p.outputTokens)}</td>
              <td className="whitespace-nowrap px-4 py-2 font-rg-mono font-semibold text-rg-gold">
                {fmtUsd(p.costCents)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/40">{fmtTime(p.lastCalledAt)}</td>
            </tr>
          ))}
          {/* Phase totals row */}
          <tr className="border-t border-rg-cream2/10 bg-rg-ink2/40">
            <td colSpan={2} className="px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/40">
              Total
            </td>
            <td className="px-4 py-2 font-semibold text-rg-cream2/70">
              {phases.reduce((s, p) => s + p.calls, 0)}
            </td>
            <td className="px-4 py-2 font-semibold text-rg-cream2/70">
              {fmtTokens(phases.reduce((s, p) => s + p.inputTokens, 0))}
            </td>
            <td className="px-4 py-2 font-semibold text-rg-cream2/70">
              {fmtTokens(phases.reduce((s, p) => s + p.outputTokens, 0))}
            </td>
            <td className="px-4 py-2 font-rg-mono font-bold text-rg-gold">
              {fmtUsd(phases.reduce((s, p) => s + p.costCents, 0))}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Job row ─────────────────────────────────────────────────────────

function JobRow({ job }: { job: EvalJobCostRow }) {
  const [expanded, setExpanded] = useState(
    job.status === "running" || job.status === "queued",
  );

  const modelsUsed = [...new Set(job.phases.map((p) => p.model))];
  const hasExpensiveModel = modelsUsed.some((m) => m.includes("5.1") || m.includes("o1"));

  return (
    <div className="overflow-hidden rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
      {/* ── Job header row ─────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-rg-ink2/90"
      >
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Status */}
          <span className={`shrink-0 rounded border px-2 py-0.5 font-rg-mono text-[10px] uppercase tracking-wider ${statusBadge(job.status)}`}>
            {job.status ?? "unknown"}
          </span>

          {/* Job ID → links to evaluate page */}
          <Link
            href={`/evaluate/${job.jobId}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 font-rg-mono text-xs text-rg-cream2/70 underline-offset-2 hover:text-rg-gold hover:underline"
          >
            {job.jobId.slice(0, 8)}…
          </Link>

          {/* Manuscript */}
          {(job.manuscriptTitle || job.manuscriptId) && (
            <span className="truncate max-w-[220px] text-xs text-rg-cream2/55">
              {job.manuscriptTitle ?? `ms#${job.manuscriptId}`}
            </span>
          )}

          {/* Phase count */}
          <span className="shrink-0 rounded bg-rg-ink2 px-2 py-0.5 font-rg-mono text-[10px] text-rg-cream2/40">
            {job.phases.length} phase{job.phases.length !== 1 ? "s" : ""}
          </span>

          {/* Models used */}
          {modelsUsed.map((m) => (
            <span
              key={m}
              className={`shrink-0 rounded border border-rg-cream2/10 px-2 py-0.5 font-rg-mono text-[10px] ${modelBadge(m)}`}
            >
              {m}
            </span>
          ))}

          {/* Expensive model warning */}
          {hasExpensiveModel && (
            <span className="shrink-0 rounded border border-amber-500/30 bg-amber-900/20 px-2 py-0.5 font-rg-mono text-[10px] text-amber-300">
              ⚠ expensive model
            </span>
          )}
        </div>

        {/* Right side: cost + timing */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-rg-mono text-base font-bold text-rg-gold">
            {fmtUsd(job.totalCostCents)}
          </span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/35">
            {job.totalCalls} calls · {fmtDuration(job.firstCalledAt, job.lastCalledAt)}
          </span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/30">
            {fmtTime(job.lastCalledAt)}
          </span>
        </div>

        {/* Chevron */}
        <span className="mt-1 shrink-0 text-rg-cream2/30 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▾
        </span>
      </button>

      {/* ── Warnings ───────────────────────────────────────────── */}
      {expanded && job.warnings.length > 0 && (
        <div className="border-t border-amber-500/20 bg-amber-900/10 px-5 py-2">
          {job.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-300">{w}</p>
          ))}
        </div>
      )}

      {/* ── Phase table ────────────────────────────────────────── */}
      {expanded && <PhaseTable phases={job.phases} />}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function EvaluationCostLedgerPage() {
  const [data, setData] = useState<EvalCostLedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/costs/evaluations", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to fetch evaluation costs");
      setData(json.data as EvalCostLedgerPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh — 10s if running jobs present, else 60s
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const runningCount = data?.runningJobCount ?? 0;
    const ms = runningCount > 0 ? 10_000 : 60_000;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchData, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchData, data?.runningJobCount]);

  // ── Loading skeleton ────────────────────────────────────────────
  if (loading && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-8 w-72 rounded bg-rg-ink2" />
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-rg-ink2" />)}
        </div>
      </main>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
  if (error && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg border border-red-500/40 bg-red-900/20 p-6">
            <h2 className="text-lg font-semibold text-red-300">Error Loading Ledger</h2>
            <p className="mt-2 text-sm text-red-300/80">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 rounded border border-rg-gold/40 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-gold hover:border-rg-gold"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const refreshLabel = data.runningJobCount > 0
    ? `Auto-refresh (10s — ${data.runningJobCount} running)`
    : "Auto-refresh (60s)";

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="space-y-2">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            CostOps · Admin Only
          </p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">
                Evaluation Cost Ledger
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-rg-cream2/60">
                Per-job, per-phase, per-model LLM spend. Click any job to expand its phase breakdown.
                Running jobs are expanded by default and refresh every 10 seconds.
              </p>
              <p className="mt-1 font-rg-mono text-[10px] text-rg-cream2/35">
                Generated {new Date(data.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-rg-cream2/60">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                {refreshLabel}
              </label>
              <button
                onClick={fetchData}
                disabled={loading}
                className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream disabled:opacity-40"
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
              <Link
                href="/admin/costs"
                className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream"
              >
                ← CostOps
              </Link>
            </div>
          </div>
        </header>

        {/* ── Warnings ───────────────────────────────────────────── */}
        {data.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-4">
            {data.warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-300">{w}</p>
            ))}
          </div>
        )}

        {/* ── Summary KPIs ────────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-rg-gold/30 bg-rg-ink2/90 p-5">
            <div className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">
              Total Cost (all tracked)
            </div>
            <div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-gold">
              {fmtUsd(data.totalCostCents)}
            </div>
          </div>
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <div className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">
              Jobs Tracked
            </div>
            <div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-cream">
              {data.jobs.length}
            </div>
          </div>
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <div className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">
              Total API Calls
            </div>
            <div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-cream">
              {data.totalCalls.toLocaleString()}
            </div>
          </div>
        </section>

        {/* ── Job list ────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-rg-serif text-xl text-rg-cream">
              Jobs
              {data.runningJobCount > 0 && (
                <span className="ml-3 rounded border border-blue-500/30 bg-blue-900/20 px-2 py-0.5 font-rg-mono text-xs text-blue-300">
                  {data.runningJobCount} running
                </span>
              )}
            </h2>
            <span className="font-rg-mono text-[10px] text-rg-cream2/35">
              Most recent activity first
            </span>
          </div>

          {data.jobs.length === 0 ? (
            <div className="rounded-lg border border-rg-cream2/10 bg-rg-ink2/50 p-12 text-center">
              <p className="text-sm text-rg-cream2/40">
                No cost data recorded yet. Run an evaluation to populate this ledger.
              </p>
              <p className="mt-2 text-xs text-rg-cream2/25">
                If you have run evaluations, check that <code className="font-rg-mono">job_costs</code> rows are being written by the pipeline.
              </p>
            </div>
          ) : (
            data.jobs.map((job) => <JobRow key={job.jobId} job={job} />)
          )}
        </section>

        {/* ── Legend ──────────────────────────────────────────────── */}
        <footer className="flex flex-wrap gap-4 border-t border-rg-cream2/10 pt-4">
          <span className="font-rg-mono text-[10px] text-rg-cream2/35">Model legend:</span>
          <span className="font-rg-mono text-[10px] text-emerald-300">green = cheap model</span>
          <span className="font-rg-mono text-[10px] text-amber-300">amber = expensive model (gpt-5.1 / o1)</span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/35">⚠ = expensive model used in a phase that should be cheap</span>
        </footer>
      </div>
    </main>
  );
}
