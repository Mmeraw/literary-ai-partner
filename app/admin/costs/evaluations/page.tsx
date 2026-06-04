"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatUsdFromCents } from "@/lib/admin/formatMoney";
import type { EvalJobCostRow, EvalCostLedgerPayload } from "@/app/api/admin/costs/evaluations/route";

type CostRange = "24h" | "5d" | "30d" | "all";

const RANGE_OPTIONS: Array<{ value: CostRange; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "5d", label: "Last 5 days" },
  { value: "30d", label: "Last month" },
  { value: "all", label: "All time" },
];

const fmtUsd = formatUsdFromCents;

function normalizeRange(value: string | null): CostRange {
  if (value === "24h" || value === "5d" || value === "30d" || value === "all") return value;
  return "24h";
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDuration(first: string | null, last: string | null): string {
  if (!first || !last) return "-";
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function statusBadge(status: string | null): string {
  switch (status) {
    case "complete": return "bg-emerald-800/60 text-emerald-300 border-emerald-500/30";
    case "failed": return "bg-red-800/60 text-red-300 border-red-500/30";
    case "running": return "bg-blue-800/60 text-blue-300 border-blue-500/30";
    case "queued": return "bg-amber-800/60 text-amber-300 border-amber-500/30";
    default: return "bg-rg-ink2 text-rg-cream2/40 border-rg-cream2/10";
  }
}

function modelBadge(model: string): string {
  if (model.includes("5.1") || model.includes("o1")) return "text-amber-300";
  if (model.includes("mini") || model.includes("4o") || model.includes("cheap")) return "text-emerald-300";
  return "text-rg-cream2/70";
}

function PhaseTable({ phases }: { phases: EvalJobCostRow["phases"] }) {
  return (
    <div className="overflow-x-auto border-t border-rg-cream2/10 bg-rg-ink/60">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-rg-cream2/8">
            {["Phase", "Model", "Calls", "Input", "Output", "LLM Cost", "Last call"].map((h) => <th key={h} className="px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/40">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-rg-cream2/5">
          {phases.map((phase, i) => (
            <tr key={i} className="transition hover:bg-rg-ink2/30">
              <td className="whitespace-nowrap px-4 py-2 font-rg-mono text-[11px] text-rg-cream2/70">{phase.phase}</td>
              <td className={`whitespace-nowrap px-4 py-2 font-rg-mono text-[11px] ${modelBadge(phase.model)}`}>{phase.model}</td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/55">{phase.calls}</td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/55">{fmtTokens(phase.inputTokens)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/55">{fmtTokens(phase.outputTokens)}</td>
              <td className="whitespace-nowrap px-4 py-2 font-rg-mono font-semibold text-rg-gold">{fmtUsd(phase.costCents)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-rg-cream2/40">{fmtTime(phase.lastCalledAt)}</td>
            </tr>
          ))}
          <tr className="border-t border-rg-cream2/10 bg-rg-ink2/40">
            <td colSpan={2} className="px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/40">Total</td>
            <td className="px-4 py-2 font-semibold text-rg-cream2/70">{phases.reduce((s, p) => s + p.calls, 0)}</td>
            <td className="px-4 py-2 font-semibold text-rg-cream2/70">{fmtTokens(phases.reduce((s, p) => s + p.inputTokens, 0))}</td>
            <td className="px-4 py-2 font-semibold text-rg-cream2/70">{fmtTokens(phases.reduce((s, p) => s + p.outputTokens, 0))}</td>
            <td className="px-4 py-2 font-rg-mono font-bold text-rg-gold">{fmtUsd(phases.reduce((s, p) => s + p.costCents, 0))}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function JobRow({ job }: { job: EvalJobCostRow }) {
  const [expanded, setExpanded] = useState(job.status === "running" || job.status === "queued");
  const modelsUsed = [...new Set(job.phases.map((p) => p.model))];
  const hasExpensiveModel = modelsUsed.some((m) => m.includes("5.1") || m.includes("o1"));

  return (
    <div className="overflow-hidden rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-rg-ink2/90">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className={`shrink-0 rounded border px-2 py-0.5 font-rg-mono text-[10px] uppercase tracking-wider ${statusBadge(job.status)}`}>{job.status ?? "unknown"}</span>
          <Link href={`/evaluate/${job.jobId}`} onClick={(e) => e.stopPropagation()} className="shrink-0 font-rg-mono text-xs text-rg-cream2/70 underline-offset-2 hover:text-rg-gold hover:underline">{job.jobId.slice(0, 8)}...</Link>
          {(job.manuscriptTitle || job.manuscriptId) && <span className="max-w-[220px] truncate text-xs text-rg-cream2/55">{job.manuscriptTitle ?? `ms#${job.manuscriptId}`}</span>}
          <span className="shrink-0 rounded bg-rg-ink2 px-2 py-0.5 font-rg-mono text-[10px] text-rg-cream2/40">{job.phases.length} phase{job.phases.length !== 1 ? "s" : ""}</span>
          {modelsUsed.map((model) => <span key={model} className={`shrink-0 rounded border border-rg-cream2/10 px-2 py-0.5 font-rg-mono text-[10px] ${modelBadge(model)}`}>{model}</span>)}
          {hasExpensiveModel && <span className="shrink-0 rounded border border-amber-500/30 bg-amber-900/20 px-2 py-0.5 font-rg-mono text-[10px] text-amber-300">expensive model</span>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-rg-mono text-base font-bold text-rg-gold">{fmtUsd(job.totalCostCents)}</span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/45">LLM {fmtUsd(job.llmCostCents)} · overhead {fmtUsd(job.allocatedOverheadCents)}</span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/35">{job.totalCalls} calls · {fmtDuration(job.firstCalledAt, job.lastCalledAt)}</span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/30">{fmtTime(job.lastCalledAt)}</span>
        </div>
        <span className="mt-1 shrink-0 text-rg-cream2/30 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>v</span>
      </button>

      {expanded && job.warnings.length > 0 && <div className="border-t border-amber-500/20 bg-amber-900/10 px-5 py-2">{job.warnings.map((warning, i) => <p key={i} className="text-[11px] text-amber-300">{warning}</p>)}</div>}
      {expanded && <PhaseTable phases={job.phases} />}
    </div>
  );
}

export default function EvaluationCostLedgerPage() {
  const searchParams = useSearchParams();
  const [range, setRange] = useState<CostRange>(() => normalizeRange(searchParams.get("range")));
  const [data, setData] = useState<EvalCostLedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/costs/evaluations?range=${range}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to fetch evaluation costs");
      setData(json.data as EvalCostLedgerPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const ms = data?.runningJobCount && data.runningJobCount > 0 ? 10_000 : 60_000;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchData, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchData, data?.runningJobCount]);

  if (loading && !data) return <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream"><div className="mx-auto max-w-5xl animate-pulse">Loading evaluation costs...</div></main>;

  if (error && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream">
        <div className="mx-auto max-w-5xl rounded-lg border border-red-500/40 bg-red-900/20 p-6">
          <h2 className="text-lg font-semibold text-red-300">Error Loading Ledger</h2>
          <p className="mt-2 text-sm text-red-300/80">{error}</p>
          <button onClick={fetchData} className="mt-4 rounded border border-rg-gold/40 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Retry</button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const refreshLabel = data.runningJobCount > 0 ? `Auto-refresh (10s - ${data.runningJobCount} running)` : "Auto-refresh (60s)";

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">CostOps · Admin Only</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">Evaluation Cost Ledger</h1>
              <p className="mt-1 max-w-2xl text-sm text-rg-cream2/60">Per-evaluation total cost with tracked LLM spend plus configured overhead allocation.</p>
              <p className="mt-1 font-rg-mono text-[10px] text-rg-cream2/35">Generated {new Date(data.generatedAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-rg-cream2/60"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />{refreshLabel}</label>
              <button onClick={fetchData} disabled={loading} className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream disabled:opacity-40">{loading ? "Loading..." : "Refresh"}</button>
              <Link href={`/admin/costs?range=${range}`} className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream">← CostOps</Link>
            </div>
          </div>
        </header>

        <section className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => <button key={option.value} onClick={() => setRange(option.value)} className={`rounded border px-4 py-2 font-rg-mono text-xs uppercase tracking-wider transition ${range === option.value ? "border-rg-gold bg-rg-gold/15 text-rg-gold" : "border-rg-cream2/20 text-rg-cream2 hover:border-rg-gold/60"}`}>{option.label}</button>)}
        </section>

        {data.warnings.map((warning, i) => <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-4"><p className="text-sm text-amber-300">{warning}</p></div>)}

        <section className="grid gap-4 sm:grid-cols-4">
          <Kpi label={`${data.rangeLabel} Total`} value={fmtUsd(data.totalCostCents)} highlight />
          <Kpi label="Tracked LLM" value={fmtUsd(data.llmCostCents)} />
          <Kpi label="Allocated Overhead" value={fmtUsd(data.allocatedOverheadCents)} />
          <Kpi label="API Calls" value={data.totalCalls.toLocaleString()} />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.providerCosts.map((row) => <div key={row.provider} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4"><div className="flex items-center justify-between"><span className="font-semibold text-rg-cream">{row.provider}</span><span className="font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(row.totalCents)}</span></div><p className="mt-2 text-xs text-rg-cream2/50">{row.detail}</p></div>)}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-rg-serif text-xl text-rg-cream">Jobs {data.runningJobCount > 0 && <span className="ml-3 rounded border border-blue-500/30 bg-blue-900/20 px-2 py-0.5 font-rg-mono text-xs text-blue-300">{data.runningJobCount} running</span>}</h2>
            <span className="font-rg-mono text-[10px] text-rg-cream2/35">Most recent activity first</span>
          </div>
          {data.jobs.length === 0 ? <div className="rounded-lg border border-rg-cream2/10 bg-rg-ink2/50 p-12 text-center"><p className="text-sm text-rg-cream2/40">No costs in this range.</p></div> : data.jobs.map((job) => <JobRow key={job.jobId} job={job} />)}
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-rg-cream2/10 pt-4">
          <span className="font-rg-mono text-[10px] text-rg-cream2/35">Total = tracked LLM + allocated configured overhead.</span>
          <span className="font-rg-mono text-[10px] text-rg-cream2/35">Overhead is allocated by each job's share of tracked LLM spend.</span>
        </footer>
      </div>
    </main>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-lg border p-5 ${highlight ? "border-rg-gold/30 bg-rg-ink2/90" : "border-rg-cream2/15 bg-rg-ink2/70"}`}><div className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">{label}</div><div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-gold">{value}</div></div>;
}
