/**
 * CostOps Dashboard
 *
 * Route: /admin/costs
 *
 * Admin-only dashboard showing LLM spend, model/phase breakdowns,
 * budget tracking, alerts, and provider status.
 *
 * Styled with RevisionGrade brand tokens (rg-ink, rg-gold, rg-cream).
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types (mirroring lib/admin/costops.ts) ─────────────────────────

interface CostOpsMoneyBreakdown {
  usageCents: number;
  fixedAllocatedCents: number;
  totalCents: number;
}

interface CostOpsSummary {
  currency: string;
  today: CostOpsMoneyBreakdown;
  monthToDate: CostOpsMoneyBreakdown;
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
  retriedUsageCents: number;
  topModel: string | null;
  topPhase: string | null;
  mostExpensiveJobId: string | null;
  mostExpensiveJobCostCents: number;
  generatedAt: string;
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
  manuscriptId: string | null;
  status: string | null;
  phase: string | null;
  usageCents: number;
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
  modelBreakdown: CostOpsBreakdownRow[];
  phaseBreakdown: CostOpsBreakdownRow[];
  recentJobs: CostOpsJobRow[];
  providerStatus: CostOpsProviderStatus[];
  alerts: CostOpsAlert[];
  warnings: string[];
}

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
  return new Date(iso).toLocaleString();
}

function alertColor(severity: string): string {
  switch (severity) {
    case "danger":
      return "border-red-500/40 bg-red-900/20 text-red-300";
    case "watch":
      return "border-amber-500/40 bg-amber-900/20 text-amber-300";
    case "ok":
      return "border-emerald-500/40 bg-emerald-900/20 text-emerald-300";
    default:
      return "border-rg-cream2/20 bg-rg-ink2/50 text-rg-cream2/70";
  }
}

function providerBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "configured":
      return { label: "LIVE", cls: "bg-emerald-800/60 text-emerald-300 border-emerald-500/30" };
    case "missing_env":
      return { label: "MISSING", cls: "bg-red-800/60 text-red-300 border-red-500/30" };
    default:
      return { label: "MANUAL", cls: "bg-amber-800/60 text-amber-300 border-amber-500/30" };
  }
}

function statusBadge(status: string | null): string {
  switch (status) {
    case "complete":
      return "bg-emerald-800/60 text-emerald-300";
    case "failed":
      return "bg-red-800/60 text-red-300";
    case "running":
      return "bg-blue-800/60 text-blue-300";
    case "queued":
      return "bg-amber-800/60 text-amber-300";
    default:
      return "bg-rg-ink2 text-rg-cream2/50";
  }
}

// ─── Component ──────────────────────────────────────────────────────

export default function CostOpsDashboardPage() {
  const [data, setData] = useState<CostOpsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/costs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to fetch CostOps data");
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 120_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  // ── Loading skeleton ──────────────────────────────────────────────
  if (loading && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded bg-rg-ink2" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-lg bg-rg-ink2" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Error state ───────────────────────────────────────────────────
  if (error && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-500/40 bg-red-900/20 p-6">
            <h2 className="text-lg font-semibold text-red-300">Error Loading CostOps</h2>
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

  const { summary, modelBreakdown, phaseBreakdown, recentJobs, alerts, providerStatus, warnings } = data;

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="space-y-3">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            CostOps · Admin Only
          </p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">
                CostOps Dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-rg-cream2/70">
                LLM spend telemetry, job economics, model routing costs, and budget alerts.
              </p>
              <p className="mt-1 font-rg-mono text-[10px] text-rg-cream2/40">
                Generated {fmtTime(summary.generatedAt)}
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
                Auto-refresh (2 min)
              </label>
              <button
                onClick={fetchData}
                disabled={loading}
                className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream disabled:opacity-40"
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
              {summary.untrackedJobs > 0 && (
                <button
                  onClick={async () => {
                    setBackfilling(true);
                    setBackfillResult(null);
                    try {
                      const res = await fetch("/api/admin/costs/backfill", { method: "POST" });
                      const json = await res.json();
                      if (json.success) {
                        setBackfillResult(
                          `Backfilled ${json.data.backfilledCount} jobs (~${fmtUsd(json.data.estimatedTotalCents)} estimated)`,
                        );
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
                  {backfilling ? "Backfilling…" : `Backfill ${summary.untrackedJobs} Untracked`}
                </button>
              )}
              <Link
                href="/admin"
                className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream"
              >
                ← Admin
              </Link>
              <Link
                href="/admin/costs/evaluations"
                className="rounded border border-rg-gold/30 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-gold transition hover:border-rg-gold hover:text-rg-gold"
              >
                Job Ledger →
              </Link>
            </div>
          </div>
        </header>

        {/* ── Backfill result ─────────────────────────────────────── */}
        {backfillResult && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-4">
            <p className="text-sm text-emerald-300">{backfillResult}</p>
          </div>
        )}

        {/* ── Warnings ────────────────────────────────────────────── */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-4">
            {warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-300">{w}</p>
            ))}
          </div>
        )}

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="All-Time Total" value={fmtUsd(summary.allTimeTotalCents)} highlight />
          <KpiCard label="Month-to-Date" value={fmtUsd(summary.monthToDate.totalCents)} />
          <KpiCard label="Today's Spend" value={fmtUsd(summary.today.totalCents)} />
          <KpiCard label="Projected Month-End" value={fmtUsd(summary.projectedMonthEndCents)} />
          <KpiCard label="Avg Cost / Evaluation" value={fmtUsd(summary.avgUsageCostPerJobCents)} />
        </section>

        {/* ── Budget bar (if configured) ──────────────────────────── */}
        {summary.monthlyBudgetCents !== null && (
          <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-rg-serif text-lg text-rg-cream">Monthly Budget</h2>
              <span className="font-rg-mono text-xs text-rg-cream2/50">
                {fmtUsd(summary.monthToDate.totalCents)} / {fmtUsd(summary.monthlyBudgetCents)}
                {summary.budgetUsedPct !== null && ` · ${summary.budgetUsedPct}%`}
              </span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-rg-ink2">
              <div
                className={`h-full rounded-full transition-all ${
                  (summary.budgetUsedPct ?? 0) > 100
                    ? "bg-red-500"
                    : (summary.budgetUsedPct ?? 0) > 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(summary.budgetUsedPct ?? 0, 100)}%` }}
              />
            </div>
            {summary.budgetRemainingCents !== null && (
              <p className="mt-2 text-xs text-rg-cream2/50">
                {summary.budgetRemainingCents >= 0
                  ? `${fmtUsd(summary.budgetRemainingCents)} remaining`
                  : `${fmtUsd(Math.abs(summary.budgetRemainingCents))} over budget`}
              </p>
            )}
          </section>
        )}

        {/* ── Secondary KPIs ──────────────────────────────────────── */}
        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MiniKpi label="Last 7 Days" value={fmtUsd(summary.last7dUsageCents)} />
          <MiniKpi label="Total Calls" value={summary.callCount.toLocaleString()} />
          <MiniKpi label="Jobs Tracked" value={`${summary.jobsWithCosts} / ${summary.totalEvaluationJobs}`} />
          <MiniKpi label="Failed Spend (MTD)" value={fmtUsd(summary.failedJobUsageCents)} />
          <MiniKpi label="Top Model" value={summary.topModel ?? "—"} />
          <MiniKpi label="Top Phase" value={summary.topPhase ?? "—"} />
        </section>

        {/* ── Alerts ──────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Alerts</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((a) => (
              <div
                key={a.code}
                className={`rounded-lg border p-4 ${alertColor(a.severity)}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-rg-mono text-[10px] uppercase tracking-wider opacity-60">
                    {a.severity}
                  </span>
                  <span className="font-semibold">{a.title}</span>
                </div>
                <p className="mt-1 text-sm opacity-80">{a.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Provider Status ─────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Provider Status</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {providerStatus.map((p) => {
              const badge = providerBadge(p.status);
              return (
                <div
                  key={p.provider}
                  className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rg-cream">{p.provider}</span>
                    <span className={`rounded border px-2 py-0.5 font-rg-mono text-[10px] uppercase ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-rg-cream2/55">{p.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Breakdowns ──────────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          <BreakdownTable title="Spend by Model" rows={modelBreakdown} />
          <BreakdownTable title="Spend by Pipeline Phase" rows={phaseBreakdown} />
        </section>

        {/* ── Recent Jobs ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">
            Most Expensive Jobs
          </h2>
          <div className="overflow-x-auto rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rg-cream2/10">
                  {["Job ID", "Status", "Phases", "Spend", "Calls", "Input Tok", "Output Tok", "First Call", "Last Call"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-rg-cream2/5">
                {recentJobs.map((j) => (
                  <tr key={j.jobId} className="transition hover:bg-rg-ink2/50">
                    <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-xs text-rg-cream2/70">
                      {j.jobId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 font-rg-mono text-[10px] uppercase ${statusBadge(j.status)}`}>
                        {j.status ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs text-rg-cream2/55">
                      {j.phase ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-rg-mono text-xs font-semibold text-rg-gold">
                      {fmtUsd(j.usageCents)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-rg-cream2/55">
                      {j.callCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-rg-cream2/55">
                      {fmtTokens(j.inputTokens)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-rg-cream2/55">
                      {fmtTokens(j.outputTokens)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-rg-cream2/40">
                      {fmtTime(j.firstCalledAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-rg-cream2/40">
                      {fmtTime(j.lastCalledAt)}
                    </td>
                  </tr>
                ))}
                {recentJobs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-rg-cream2/40">
                      No cost data recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${highlight ? "border-rg-gold/30 bg-rg-ink2/90" : "border-rg-cream2/15 bg-rg-ink2/70"}`}>
      <div className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/50">
        {label}
      </div>
      <div className={`mt-2 font-rg-serif text-2xl font-semibold ${highlight ? "text-rg-gold" : "text-rg-gold"}`}>
        {value}
      </div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rg-cream2/10 bg-rg-ink2/50 px-4 py-3">
      <div className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/40">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-rg-cream">{value}</div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: CostOpsBreakdownRow[] }) {
  return (
    <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
      <h2 className="mb-3 font-rg-serif text-lg text-rg-cream">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rg-cream2/10">
              {["Name", "Spend", "Calls", "Input Tok", "Output Tok", "Avg / Call"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rg-cream2/5">
            {rows.map((r) => (
              <tr key={r.key} className="transition hover:bg-rg-ink2/50">
                <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-rg-cream">
                  {r.key}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-rg-mono text-xs font-semibold text-rg-gold">
                  {fmtUsd(r.usageCents)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-rg-cream2/55">
                  {r.callCount.toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-rg-cream2/55">
                  {fmtTokens(r.inputTokens)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-rg-cream2/55">
                  {fmtTokens(r.outputTokens)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-rg-mono text-xs text-rg-cream2/55">
                  {fmtUsd(r.avgCostPerCallCents)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-rg-cream2/40">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
