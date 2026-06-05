"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatUsdFromCents } from "@/lib/admin/formatMoney";
import type { EvalJobCostRow, EvalCostLedgerPayload } from "@/app/api/admin/costs/evaluations/route";

type CostRange = "24h" | "5d" | "30d" | "all";

const RANGE_OPTIONS: Array<{ value: CostRange; label: string; short: string }> = [
  { value: "24h", label: "Last 24h", short: "24H" },
  { value: "5d", label: "Last 5 days", short: "5D" },
  { value: "30d", label: "Last month", short: "30D" },
  { value: "all", label: "All time", short: "ALL" },
];

const IDLE_REFRESH_MS = 120_000;
const ACTIVE_REFRESH_MS = 30_000;
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

function fmtPct(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    case "complete": return "bg-emerald-800/70 text-emerald-200 border-emerald-400/40";
    case "failed": return "bg-red-800/70 text-red-200 border-red-400/40";
    case "running": return "bg-blue-800/70 text-blue-200 border-blue-400/40";
    case "queued": return "bg-amber-800/70 text-amber-200 border-amber-400/40";
    default: return "bg-rg-ink2 text-rg-cream2/70 border-rg-cream2/20";
  }
}

function modelBadge(model: string): string {
  if (model.includes("5.1") || model.includes("o1")) return "text-amber-200";
  if (model.includes("mini") || model.includes("4o") || model.includes("cheap")) return "text-emerald-200";
  return "text-rg-cream2/85";
}

function coverageBadge(status: EvalJobCostRow["phaseCoverage"][number]["status"]): string {
  if (status === "tracked") return "border-emerald-400/40 bg-emerald-900/25 text-emerald-200";
  if (status === "not_applicable") return "border-rg-cream2/20 bg-rg-ink2 text-rg-cream2/65";
  return "border-amber-400/45 bg-amber-900/25 text-amber-200";
}

function statusLabel(status: EvalJobCostRow["phaseCoverage"][number]["status"]): string {
  if (status === "tracked") return "Tracked";
  if (status === "not_applicable") return "No LLM";
  return "Missing / Not Run";
}

function PhaseCoverageTable({ coverage }: { coverage: EvalJobCostRow["phaseCoverage"] }) {
  return (
    <div className="border-t border-rg-cream2/15 bg-rg-ink/80 px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-rg-serif text-xl text-rg-cream">Phase Coverage</h3>
        <span className="font-rg-mono text-sm text-rg-cream2/70">Tracked spend vs. missing/not-run phases</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {coverage.map((row) => (
          <div key={row.key} className="border border-rg-cream2/15 bg-rg-ink2/65 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-rg-cream">{row.label}</div>
                <p className="mt-1 text-base leading-6 text-rg-cream2/75">{row.description}</p>
              </div>
              <span className={`shrink-0 border px-2 py-1 font-rg-mono text-sm uppercase ${coverageBadge(row.status)}`}>{statusLabel(row.status)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 font-rg-mono text-sm">
              <div><span className="block text-rg-cream2/55">Cost</span><span className="text-rg-gold">{fmtUsd(row.costCents)}</span></div>
              <div><span className="block text-rg-cream2/55">Calls</span><span className="text-rg-cream">{row.calls}</span></div>
              <div><span className="block text-rg-cream2/55">Tokens</span><span className="text-rg-cream">{fmtTokens(row.inputTokens + row.outputTokens)}</span></div>
            </div>
            <p className="mt-2 text-base leading-6 text-rg-cream2/70">{row.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseTable({ phases }: { phases: EvalJobCostRow["phases"] }) {
  return (
    <div className="overflow-x-auto border-t border-rg-cream2/10 bg-rg-ink/70">
      <table className="min-w-full text-left text-base">
        <thead>
          <tr className="border-b border-rg-cream2/10">
            {["Raw phase row", "Model", "Calls", "Input", "Output", "LLM cost", "Last call"].map((h) => <th key={h} className="px-4 py-3 font-rg-mono text-sm uppercase text-rg-cream2/70">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-rg-cream2/8">
          {phases.map((phase, i) => (
            <tr key={i} className="transition hover:bg-rg-ink2/40">
              <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-sm text-rg-cream2/85">{phase.phase}</td>
              <td className={`whitespace-nowrap px-4 py-3 font-rg-mono text-sm ${modelBadge(phase.model)}`}>{phase.model}</td>
              <td className="whitespace-nowrap px-4 py-3 text-rg-cream2/80">{phase.calls}</td>
              <td className="whitespace-nowrap px-4 py-3 text-rg-cream2/80">{fmtTokens(phase.inputTokens)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-rg-cream2/80">{fmtTokens(phase.outputTokens)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-rg-mono font-semibold text-rg-gold">{fmtUsd(phase.costCents)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-rg-cream2/65">{fmtTime(phase.lastCalledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobRow({ job }: { job: EvalJobCostRow }) {
  const [expanded, setExpanded] = useState(job.status === "running" || job.status === "queued" || job.missingPhaseCount > 0);
  const modelsUsed = [...new Set(job.phases.map((p) => p.model))];

  return (
    <div className="overflow-hidden border border-rg-cream2/18 bg-rg-ink2/75">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full flex-col gap-4 px-4 py-5 text-left transition hover:bg-rg-ink2/95 lg:flex-row lg:items-start lg:justify-between lg:px-5">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className={`shrink-0 border px-2 py-1 font-rg-mono text-sm uppercase ${statusBadge(job.status)}`}>{job.status ?? "unknown"}</span>
          <Link href={`/evaluate/${job.jobId}`} onClick={(e) => e.stopPropagation()} className="shrink-0 font-rg-mono text-base text-rg-cream2/90 underline-offset-2 hover:text-rg-gold hover:underline">{job.jobId.slice(0, 8)}...</Link>
          {(job.manuscriptTitle || job.manuscriptId) && <span className="max-w-[300px] truncate text-base text-rg-cream2/85">{job.manuscriptTitle ?? `ms#${job.manuscriptId}`}</span>}
          <span className="shrink-0 bg-rg-ink px-2 py-1 font-rg-mono text-sm text-rg-cream2/70">{job.phases.length} raw row{job.phases.length !== 1 ? "s" : ""}</span>
          {job.missingPhaseCount > 0 && <span className="shrink-0 border border-amber-400/45 bg-amber-900/25 px-2 py-1 font-rg-mono text-sm text-amber-200">{job.missingPhaseCount} missing/not-run</span>}
          {!job.hasLinkedRevenue && <span className="shrink-0 border border-rg-cream2/20 px-2 py-1 font-rg-mono text-sm text-rg-cream2/70">No linked revenue</span>}
          {modelsUsed.map((model) => <span key={model} className={`shrink-0 border border-rg-cream2/15 px-2 py-1 font-rg-mono text-sm ${modelBadge(model)}`}>{model}</span>)}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 text-left lg:min-w-[360px] lg:text-right">
          <MiniMetric label="Cost" value={fmtUsd(job.totalCostCents)} highlight />
          <MiniMetric label="Revenue" value={fmtUsd(job.netRevenueCents)} />
          <MiniMetric label="Profit" value={fmtUsd(job.grossProfitCents)} />
          <MiniMetric label="Margin" value={fmtPct(job.grossMarginPct)} />
          <div className="col-span-2 font-rg-mono text-sm text-rg-cream2/65">LLM {fmtUsd(job.llmCostCents)} · overhead {fmtUsd(job.allocatedOverheadCents)} · docs {fmtUsd(job.documentGenerationCents)}</div>
          <div className="col-span-2 font-rg-mono text-sm text-rg-cream2/55">{job.totalCalls} calls · {fmtDuration(job.firstCalledAt, job.lastCalledAt)} · {fmtTime(job.lastCalledAt)}</div>
        </div>
      </button>
      {expanded && job.warnings.length > 0 && <div className="border-t border-amber-400/25 bg-amber-900/12 px-5 py-3">{job.warnings.map((warning, i) => <p key={i} className="text-base leading-6 text-amber-200">{warning}</p>)}</div>}
      {expanded && <PhaseCoverageTable coverage={job.phaseCoverage} />}
      {expanded && <PhaseTable phases={job.phases} />}
    </div>
  );
}

function EvaluationCostLedgerPageContent() {
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
    if (!autoRefresh) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    const ms = data?.runningJobCount && data.runningJobCount > 0 ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchData, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchData, data?.runningJobCount]);

  if (loading && !data) return <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream"><div className="mx-auto max-w-6xl animate-pulse text-lg">Loading evaluation costs...</div></main>;
  if (error && !data) return <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream"><div className="mx-auto max-w-6xl border border-red-500/40 bg-red-900/20 p-6"><h2 className="text-xl font-semibold text-red-200">Error Loading Ledger</h2><p className="mt-2 text-base text-red-200/85">{error}</p><button onClick={fetchData} className="mt-4 border border-rg-gold/45 px-4 py-2 font-rg-mono text-base uppercase text-rg-gold">Retry</button></div></main>;
  if (!data) return null;

  const refreshLabel = data.runningJobCount > 0 ? `Auto-refresh (30s - ${data.runningJobCount} running)` : "Auto-refresh";

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-5 text-base text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="space-y-3">
          <p className="font-rg-mono text-sm uppercase tracking-[0.16em] text-rg-gold">CostOps · Admin Only</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-5xl">Cost Ledger</h1>
              <p className="mt-2 max-w-3xl text-base leading-7 text-rg-cream2/80 sm:text-lg">Per-evaluation LLM spend, overhead, document-generation cost, revenue, gross profit, and phase coverage.</p>
              <p className="mt-2 font-rg-mono text-sm text-rg-cream2/60">Generated {new Date(data.generatedAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label className="flex items-center gap-2 text-base text-rg-cream2/80"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />{refreshLabel}</label>
              <button onClick={fetchData} disabled={loading} className="border border-rg-cream2/25 px-3 py-2 font-rg-mono text-sm uppercase text-rg-cream2 transition hover:border-rg-gold/70 hover:text-rg-cream disabled:opacity-40">{loading ? "Loading..." : "Refresh"}</button>
              <Link href={`/admin/costs?range=${range}`} className="border border-rg-cream2/25 px-3 py-2 font-rg-mono text-sm uppercase text-rg-cream2 transition hover:border-rg-gold/70 hover:text-rg-cream">← CostOps</Link>
            </div>
          </div>
        </header>

        <section className="sticky top-0 z-20 grid grid-cols-4 gap-2 border border-rg-gold/25 bg-rg-ink/95 p-2 shadow-lg backdrop-blur">
          <StickyMetric label="Cost" value={fmtUsd(data.totalCostCents)} />
          <StickyMetric label="Avg" value={fmtUsd(data.avgCostPerEvaluationCents)} />
          <StickyMetric label="Revenue" value={fmtUsd(data.netRevenueCents)} />
          <StickyMetric label="Profit" value={fmtUsd(data.grossProfitCents)} />
        </section>

        <section className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          {RANGE_OPTIONS.map((option) => <button key={option.value} onClick={() => setRange(option.value)} title={option.label} className={`border px-3 py-2 font-rg-mono text-sm uppercase transition sm:text-base ${range === option.value ? "border-rg-gold bg-rg-gold/15 text-rg-gold" : "border-rg-cream2/25 text-rg-cream2 hover:border-rg-gold/70"}`}>{option.short}</button>)}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={`${data.rangeLabel} Total Cost`} value={fmtUsd(data.totalCostCents)} highlight />
          <Kpi label="Net Revenue" value={fmtUsd(data.netRevenueCents)} />
          <Kpi label="Gross Profit" value={fmtUsd(data.grossProfitCents)} />
          <Kpi label="Gross Margin" value={fmtPct(data.grossMarginPct)} />
          <Kpi label="Avg Cost / Eval" value={fmtUsd(data.avgCostPerEvaluationCents)} />
          <Kpi label="Avg Revenue / Eval" value={fmtUsd(data.avgRevenuePerEvaluationCents)} />
          <Kpi label="Highest Cost" value={fmtUsd(data.highestCostCents)} />
          <Kpi label="Lowest Cost" value={fmtUsd(data.lowestCostCents)} />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.providerCosts.map((row) => <div key={row.provider} className="border border-rg-cream2/15 bg-rg-ink2/70 p-4"><div className="flex items-center justify-between gap-3"><span className="text-lg font-semibold text-rg-cream">{row.provider}</span><span className="font-rg-mono text-base font-semibold text-rg-gold">{fmtUsd(row.totalCents)}</span></div><p className="mt-2 text-base leading-6 text-rg-cream2/70">{row.detail}</p></div>)}
        </section>

        {data.warnings.map((warning, i) => <div key={i} className="border border-amber-400/35 bg-amber-900/20 p-4"><p className="text-base leading-6 text-amber-200">{warning}</p></div>)}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-rg-serif text-2xl text-rg-cream">Jobs {data.runningJobCount > 0 && <span className="ml-3 border border-blue-400/35 bg-blue-900/25 px-2 py-1 font-rg-mono text-base text-blue-200">{data.runningJobCount} running</span>}</h2>
            <span className="font-rg-mono text-sm text-rg-cream2/60">Most recent activity first</span>
          </div>
          {data.jobs.length === 0 ? <div className="border border-rg-cream2/10 bg-rg-ink2/50 p-12 text-center"><p className="text-base text-rg-cream2/65">No costs in this range.</p></div> : data.jobs.map((job) => <JobRow key={job.jobId} job={job} />)}
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-rg-cream2/10 pt-4">
          <span className="font-rg-mono text-sm text-rg-cream2/60">Total cost = tracked LLM + allocated overhead + document generation.</span>
          <span className="font-rg-mono text-sm text-rg-cream2/60">Revenue = revenue_events; Stripe fees/refunds reduce net revenue before gross profit.</span>
        </footer>
      </div>
    </main>
  );
}

export default function EvaluationCostLedgerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream"><div className="mx-auto max-w-6xl animate-pulse text-lg">Loading evaluation costs...</div></main>}>
      <EvaluationCostLedgerPageContent />
    </Suspense>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`border p-4 sm:p-5 ${highlight ? "border-rg-gold/35 bg-rg-ink2/90" : "border-rg-cream2/15 bg-rg-ink2/70"}`}><div className="font-rg-mono text-sm uppercase text-rg-cream2/70">{label}</div><div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-gold sm:text-3xl">{value}</div></div>;
}

function MiniMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div><span className="block font-rg-mono text-xs uppercase text-rg-cream2/55">{label}</span><span className={`font-rg-mono text-base font-semibold ${highlight ? "text-rg-gold" : "text-rg-cream"}`}>{value}</span></div>;
}

function StickyMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="truncate font-rg-mono text-[10px] uppercase text-rg-cream2/65 sm:text-xs">{label}</div><div className="truncate font-rg-mono text-sm font-bold text-rg-gold sm:text-lg">{value}</div></div>;
}
