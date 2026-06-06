"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EvaluationModelRoutingPanel from "@/components/admin/EvaluationModelRoutingPanel";
import { formatUsdFromCents } from "@/lib/admin/formatMoney";

type CostRange = "24h" | "5d" | "30d" | "all";

interface CostOpsMoneyBreakdown {
  usageCents: number;
  fixedAllocatedCents: number;
  totalCents: number;
}

interface CostOpsSummary {
  range: CostRange;
  rangeLabel: string;
  rangeStart: string | null;
  rangeEnd: string;
  selectedRange: CostOpsMoneyBreakdown;
  monthToDate: CostOpsMoneyBreakdown;
  today: CostOpsMoneyBreakdown;
  projectedMonthEndCents: number;
  monthlyBudgetCents: number | null;
  budgetRemainingCents: number | null;
  budgetUsedPct: number | null;
  allTimeTotalCents: number;
  last7dUsageCents: number;
  jobsWithCosts: number;
  totalEvaluationJobs: number;
  untrackedJobs: number;
  callCount: number;
  avgUsageCostPerJobCents: number;
  failedJobUsageCents: number;
  lowestCostJobId: string | null;
  lowestCostJobCostCents: number;
  mostExpensiveJobId: string | null;
  mostExpensiveJobCostCents: number;
  grossRevenueCents: number;
  stripeFeesCents: number;
  refundCents: number;
  netRevenueCents: number;
  grossProfitCents: number;
  grossMarginPct: number | null;
  avgRevenuePerEvaluationCents: number;
  documentGenerationCents: number;
  topModel: string | null;
  topPhase: string | null;
  completeness: "complete_if_overheads_configured" | "llm_only";
  generatedAt: string;
}

interface CostOpsProviderCostRow {
  provider: string;
  usageCents: number;
  fixedAllocatedCents: number;
  totalCents: number;
  source: "tracked" | "configured_monthly" | "manual_required";
  detail: string;
}

interface CostOpsBreakdownRow {
  key: string;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  avgCostPerCallCents: number;
}

interface CostOpsJobRow {
  jobId: string;
  status: string | null;
  phase: string | null;
  usageCents: number;
  allocatedOverheadCents: number;
  totalCostCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
}

interface CostOpsAlert {
  code: string;
  severity: string;
  title: string;
  detail: string;
}

interface CostOpsProviderStatus {
  provider: string;
  status: string;
  detail: string;
}

interface CostOpsDashboardData {
  summary: CostOpsSummary;
  providerCosts: CostOpsProviderCostRow[];
  modelBreakdown: CostOpsBreakdownRow[];
  phaseBreakdown: CostOpsBreakdownRow[];
  recentJobs: CostOpsJobRow[];
  providerStatus: CostOpsProviderStatus[];
  alerts: CostOpsAlert[];
  warnings: string[];
  nonEvalSpend?: {
    agentReadinessCents: number;
    reviseQueueCents: number;
    totalNonEvalCents: number;
  };
  costComponentsIncluded?: string[];
  costComponentsMissing?: string[];
}

const RANGE_OPTIONS: Array<{ value: CostRange; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "5d", label: "Last 5 days" },
  { value: "30d", label: "Last month" },
  { value: "all", label: "All time" },
];

const fmtUsd = formatUsdFromCents;

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function alertColor(severity: string): string {
  switch (severity) {
    case "danger": return "border-red-500/40 bg-red-900/20 text-red-300";
    case "watch": return "border-amber-500/40 bg-amber-900/20 text-amber-300";
    case "ok": return "border-emerald-500/40 bg-emerald-900/20 text-emerald-300";
    default: return "border-rg-cream2/20 bg-rg-ink2/50 text-rg-cream2/70";
  }
}

function providerBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "configured": return { label: "LIVE", cls: "bg-emerald-800/60 text-emerald-300 border-emerald-500/30" };
    case "missing_env": return { label: "MISSING", cls: "bg-red-800/60 text-red-300 border-red-500/30" };
    default: return { label: "MANUAL", cls: "bg-amber-800/60 text-amber-300 border-amber-500/30" };
  }
}

function statusBadge(status: string | null): string {
  switch (status) {
    case "complete": return "bg-emerald-800/60 text-emerald-300";
    case "failed": return "bg-red-800/60 text-red-300";
    case "running": return "bg-blue-800/60 text-blue-300";
    case "queued": return "bg-amber-800/60 text-amber-300";
    default: return "bg-rg-ink2 text-rg-cream2/50";
  }
}

export default function CostOpsDashboardPage() {
  const [range, setRange] = useState<CostRange>("24h");
  const [data, setData] = useState<CostOpsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/costs?range=${range}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to fetch CostOps data");
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 120_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  if (loading && !data) {
    return <main className="min-h-screen bg-rg-ink px-6 py-10 text-rg-cream"><div className="mx-auto max-w-7xl animate-pulse">Loading CostOps...</div></main>;
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-6 py-10 text-rg-cream">
        <div className="mx-auto max-w-7xl rounded-lg border border-red-500/40 bg-red-900/20 p-6">
          <h2 className="text-lg font-semibold text-red-300">Error Loading CostOps</h2>
          <p className="mt-2 text-sm text-red-300/80">{error}</p>
          <button onClick={fetchData} className="mt-4 rounded border border-rg-gold/40 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Retry</button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { summary, providerCosts, modelBreakdown, phaseBreakdown, recentJobs, alerts, providerStatus, warnings, nonEvalSpend } = data;

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">CostOps · Admin Only</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">CostOps Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-rg-cream2/70">
                All-cost view for tracked LLM usage plus configured provider overhead. Time-bounded ranges allocate monthly Vercel, Supabase, and Other costs when env vars are set.
              </p>
              <p className="mt-1 font-rg-mono text-[10px] text-rg-cream2/40">Generated {fmtTime(summary.generatedAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-rg-cream2/60">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
                Auto-refresh (2 min)
              </label>
              <button onClick={fetchData} disabled={loading} className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream disabled:opacity-40">
                {loading ? "Loading..." : "Refresh"}
              </button>
              {summary.untrackedJobs > 0 && (
                <button
                  onClick={async () => {
                    setBackfilling(true);
                    setBackfillResult(null);
                    try {
                      const res = await fetch("/api/admin/costs/backfill", { method: "POST", cache: "no-store" });
                      const json = await res.json();
                      if (json.success) {
                        setBackfillResult(`Backfilled ${json.data.backfilledCount} jobs (~${fmtUsd(json.data.estimatedTotalCents)} estimated)`);
                        fetchData();
                      } else {
                        setBackfillResult(`Error: ${json.message}`);
                      }
                    } catch (err) {
                      setBackfillResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
                    } finally {
                      setBackfilling(false);
                    }
                  }}
                  disabled={backfilling}
                  className="rounded border border-amber-500/40 bg-amber-900/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-amber-300 transition hover:border-amber-400 hover:text-amber-200 disabled:opacity-40"
                >
                  {backfilling ? "Backfilling..." : `Backfill ${summary.untrackedJobs} Untracked`}
                </button>
              )}
              <Link href="/admin" className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream">← Admin</Link>
              <Link href={`/admin/costs/evaluations?range=${range}`} className="rounded border border-rg-gold/30 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-gold transition hover:border-rg-gold hover:text-rg-gold">Job Ledger →</Link>
            </div>
          </div>
        </header>

        <section className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
              className={`rounded border px-4 py-2 font-rg-mono text-xs uppercase tracking-wider transition ${range === option.value ? "border-rg-gold bg-rg-gold/15 text-rg-gold" : "border-rg-cream2/20 text-rg-cream2 hover:border-rg-gold/60"}`}
            >
              {option.label}
            </button>
          ))}
        </section>

        {backfillResult && <Notice text={backfillResult} kind="ok" />}
        {warnings.map((warning, i) => <Notice key={i} text={warning} kind="watch" />)}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Cost" value={fmtUsd(summary.selectedRange.totalCents)} highlight />
          <KpiCard label="Average Cost / Evaluation" value={fmtUsd(summary.avgUsageCostPerJobCents)} />
          <KpiCard label="Evaluation Count" value={summary.jobsWithCosts.toLocaleString()} />
          <KpiCard label="Revenue" value={fmtUsd(summary.netRevenueCents)} />
          <KpiCard label="Gross Profit" value={fmtUsd(summary.grossProfitCents)} />
          <KpiCard label="Gross Margin" value={summary.grossMarginPct === null ? "N/A" : `${summary.grossMarginPct.toFixed(1)}%`} />
          <KpiCard
            label="Highest Cost Evaluation"
            value={summary.mostExpensiveJobId ? `${summary.mostExpensiveJobId.slice(0, 8)}… · ${fmtUsd(summary.mostExpensiveJobCostCents)}` : "-"}
          />
          <KpiCard
            label="Lowest Cost Evaluation"
            value={summary.lowestCostJobId ? `${summary.lowestCostJobId.slice(0, 8)}… · ${fmtUsd(summary.lowestCostJobCostCents)}` : "-"}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MiniKpi label="Today Total" value={fmtUsd(summary.today.totalCents)} />
          <MiniKpi label="Month-to-Date" value={fmtUsd(summary.monthToDate.totalCents)} />
          <MiniKpi label="Total Calls" value={summary.callCount.toLocaleString()} />
          <MiniKpi label="Jobs Tracked" value={`${summary.jobsWithCosts} / ${summary.totalEvaluationJobs}`} />
          <MiniKpi label="Top Model" value={summary.topModel ?? "-"} />
          <MiniKpi label="Coverage" value={summary.completeness === "complete_if_overheads_configured" ? "Configured" : "LLM only"} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <h2 className="mb-3 font-rg-serif text-lg text-rg-cream">Cost Components Included</h2>
            <ul className="space-y-2 text-sm text-rg-cream2/80">
              {(data.costComponentsIncluded ?? []).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-5">
            <h2 className="mb-3 font-rg-serif text-lg text-amber-200">Cost Components Not Yet Included</h2>
            {(data.costComponentsMissing ?? []).length > 0 ? (
              <ul className="space-y-2 text-sm text-amber-200/90">
                {(data.costComponentsMissing ?? []).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-amber-100/80">All configured categories are currently included.</p>
            )}
          </div>
        </section>

        <EvaluationModelRoutingPanel />

        {/* ── Non-evaluation spend rollup ── */}
        {nonEvalSpend && nonEvalSpend.totalNonEvalCents >= 0 && (
          <section>
            <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Non-Evaluation LLM Spend</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-rg-cream">Agent Readiness</h3>
                  <span className="font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(nonEvalSpend.agentReadinessCents)}</span>
                </div>
                <p className="mt-2 text-xs text-rg-cream2/55">Query letters, synopses, comparables, bio, pitch auto-generation.</p>
                <Link href="/admin/costs/agent-readiness" className="mt-3 inline-block font-rg-mono text-xs uppercase tracking-wider text-rg-gold hover:underline">View Ledger →</Link>
              </div>
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-rg-cream">Revise Queue</h3>
                  <span className="font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(nonEvalSpend.reviseQueueCents)}</span>
                </div>
                <p className="mt-2 text-xs text-rg-cream2/55">Pass 4 voice-conditioned rewrites: A/B/C candidates and TrustedPath™.</p>
                <Link href="/admin/costs/revise-queue" className="mt-3 inline-block font-rg-mono text-xs uppercase tracking-wider text-rg-gold hover:underline">View Ledger →</Link>
              </div>
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/90 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-rg-cream">Combined Non-Eval</h3>
                  <span className="font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(nonEvalSpend.totalNonEvalCents)}</span>
                </div>
                <p className="mt-2 text-xs text-rg-cream2/55">
                  Evaluation pipeline spend: {fmtUsd(summary.selectedRange.usageCents)}
                  {nonEvalSpend.totalNonEvalCents > 0 && (
                    <> · Total including non-eval: {fmtUsd(summary.selectedRange.usageCents + nonEvalSpend.totalNonEvalCents)}</>
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Cost Sources</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {providerCosts.map((row) => (
              <div key={row.provider} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-rg-cream">{row.provider}</h3>
                  <span className="font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(row.totalCents)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-rg-cream2/60">
                  <span>Usage {fmtUsd(row.usageCents)}</span>
                  <span>Overhead {fmtUsd(row.fixedAllocatedCents)}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-rg-cream2/50">{row.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {summary.monthlyBudgetCents !== null && (
          <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-rg-serif text-lg text-rg-cream">Monthly Budget</h2>
              <span className="font-rg-mono text-xs text-rg-cream2/50">{fmtUsd(summary.monthToDate.totalCents)} / {fmtUsd(summary.monthlyBudgetCents)}{summary.budgetUsedPct !== null && ` · ${summary.budgetUsedPct}%`}</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-rg-ink2">
              <div className={`h-full rounded-full transition-all ${(summary.budgetUsedPct ?? 0) > 100 ? "bg-red-500" : (summary.budgetUsedPct ?? 0) > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(summary.budgetUsedPct ?? 0, 100)}%` }} />
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Alerts</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((alert) => (
              <div key={alert.code} className={`rounded-lg border p-4 ${alertColor(alert.severity)}`}>
                <div className="flex items-center gap-2"><span className="font-rg-mono text-[10px] uppercase tracking-wider opacity-60">{alert.severity}</span><span className="font-semibold">{alert.title}</span></div>
                <p className="mt-1 text-sm opacity-80">{alert.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Provider Status</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {providerStatus.map((provider) => {
              const badge = providerBadge(provider.status);
              return (
                <div key={provider.provider} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                  <div className="flex items-center justify-between"><span className="font-semibold text-rg-cream">{provider.provider}</span><span className={`rounded border px-2 py-0.5 font-rg-mono text-[10px] uppercase ${badge.cls}`}>{badge.label}</span></div>
                  <p className="mt-2 text-xs text-rg-cream2/55">{provider.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <BreakdownTable title="Tracked LLM Spend by Model" rows={modelBreakdown} />
          <BreakdownTable title="Tracked LLM Spend by Pipeline Phase" rows={phaseBreakdown} />
        </section>

        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Most Expensive Evaluations</h2>
          <div className="overflow-x-auto rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-rg-cream2/10">{["Job ID", "Status", "LLM", "Overhead", "Total", "Calls", "Input", "Output", "Last Call"].map((h) => <th key={h} className="px-4 py-3 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-rg-cream2/5">
                {recentJobs.map((job) => (
                  <tr key={job.jobId} className="transition hover:bg-rg-ink2/50">
                    <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-xs text-rg-cream2/70">{job.jobId.slice(0, 8)}...</td>
                    <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 font-rg-mono text-[10px] uppercase ${statusBadge(job.status)}`}>{job.status ?? "-"}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-xs text-rg-gold">{fmtUsd(job.usageCents)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-xs text-rg-cream2/60">{fmtUsd(job.allocatedOverheadCents)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(job.totalCostCents)}</td>
                    <td className="px-4 py-3 text-xs text-rg-cream2/55">{job.callCount}</td>
                    <td className="px-4 py-3 text-xs text-rg-cream2/55">{fmtTokens(job.inputTokens)}</td>
                    <td className="px-4 py-3 text-xs text-rg-cream2/55">{fmtTokens(job.outputTokens)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-rg-cream2/40">{fmtTime(job.lastCalledAt)}</td>
                  </tr>
                ))}
                {recentJobs.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-rg-cream2/40">No costs in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Notice({ text, kind }: { text: string; kind: "ok" | "watch" }) {
  return <div className={`rounded-lg border p-4 ${kind === "ok" ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-300" : "border-amber-500/30 bg-amber-900/20 text-amber-300"}`}><p className="text-sm">{text}</p></div>;
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-lg border p-5 ${highlight ? "border-rg-gold/30 bg-rg-ink2/90" : "border-rg-cream2/15 bg-rg-ink2/70"}`}><div className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/50">{label}</div><div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-gold">{value}</div></div>;
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-rg-cream2/10 bg-rg-ink2/50 px-4 py-3"><div className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/40">{label}</div><div className="mt-1 text-sm font-semibold text-rg-cream">{value}</div></div>;
}

function BreakdownTable({ title, rows }: { title: string; rows: CostOpsBreakdownRow[] }) {
  return (
    <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
      <h2 className="mb-3 font-rg-serif text-lg text-rg-cream">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead><tr className="border-b border-rg-cream2/10">{["Name", "Spend", "Calls", "Input", "Output", "Avg / Call"].map((h) => <th key={h} className="px-3 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-rg-cream2/5">
            {rows.map((row) => <tr key={row.key} className="transition hover:bg-rg-ink2/50"><td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-rg-cream">{row.key}</td><td className="whitespace-nowrap px-3 py-2 font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(row.usageCents)}</td><td className="px-3 py-2 text-xs text-rg-cream2/55">{row.callCount.toLocaleString()}</td><td className="px-3 py-2 text-xs text-rg-cream2/55">{fmtTokens(row.inputTokens)}</td><td className="px-3 py-2 text-xs text-rg-cream2/55">{fmtTokens(row.outputTokens)}</td><td className="px-3 py-2 font-rg-mono text-xs text-rg-cream2/55">{fmtUsd(row.avgCostPerCallCents)}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-rg-cream2/40">No tracked LLM data for this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
