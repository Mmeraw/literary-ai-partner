"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUsdFromCents } from "@/lib/admin/formatMoney";

type CostRange = "24h" | "5d" | "30d" | "all";

interface ActivityRow {
  activity: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  avgCostPerCallCents: number;
  lastCalledAt: string | null;
}

interface ModelRow {
  model: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  avgCostPerCallCents: number;
}

interface EventRow {
  id: string;
  createdAt: string;
  activity: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  userId: string | null;
  evaluationJobId: string | null;
  manuscriptId: number | null;
  metadata: Record<string, unknown>;
}

interface Summary {
  range: CostRange;
  rangeLabel: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCallCount: number;
  uniqueActivities: number;
  mostExpensiveActivity: string | null;
  topModel: string | null;
  generatedAt: string;
}

interface DashboardData {
  summary: Summary;
  activityBreakdown: ActivityRow[];
  modelBreakdown: ModelRow[];
  recentEvents: EventRow[];
  warnings: string[];
}

const RANGE_OPTIONS: Array<{ value: CostRange; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "5d", label: "Last 5 days" },
  { value: "30d", label: "Last month" },
  { value: "all", label: "All time" },
];

const ACTIVITIES = [
  { key: "pass4_rewrite", label: "Voice Rewrite (Pass 4)" },
  { key: "pass4_trusted_path", label: "TrustedPath™ Rewrite" },
  { key: "pass4_voice_rewrite", label: "Pass 4 Voice Rewrite" },
  { key: "pass4_voice_rewrite_trusted_path", label: "Pass 4 TrustedPath" },
];

const fmtUsd = formatUsdFromCents;

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function activityLabel(key: string): string {
  const match = ACTIVITIES.find((a) => a.key === key);
  if (match) return match.label;
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function trustedBadge(metadata: Record<string, unknown>): boolean {
  return metadata?.trusted_path === true;
}

export default function ReviseQueueCostPage() {
  const [range, setRange] = useState<CostRange>("24h");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/costs/revise-queue?range=${range}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to fetch data");
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
    return <main className="min-h-screen bg-rg-ink px-6 py-10 text-rg-cream"><div className="mx-auto max-w-6xl animate-pulse">Loading Revise Queue costs…</div></main>;
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-6 py-10 text-rg-cream">
        <div className="mx-auto max-w-6xl rounded-lg border border-red-500/40 bg-red-900/20 p-6">
          <h2 className="text-lg font-semibold text-red-300">Error</h2>
          <p className="mt-2 text-sm text-red-300/80">{error}</p>
          <button onClick={fetchData} className="mt-4 rounded border border-rg-gold/40 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Retry</button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { summary, activityBreakdown, modelBreakdown, recentEvents, warnings } = data;

  const pass4Total = activityBreakdown.reduce((sum, r) => sum + r.costCents, 0);
  const trustedPathCount = recentEvents.filter((ev) => trustedBadge(ev.metadata)).length;
  const standardCount = recentEvents.filter((ev) => !trustedBadge(ev.metadata)).length;

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        <header className="space-y-3">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">CostOps · Admin Only</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">Revise Queue Costs</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-rg-cream2/70">
                LLM spend for Pass 4 voice-conditioned rewrites: standard A/B/C candidates and TrustedPath™ single-candidate rewrites. No manuscript text or passage content is stored here.
              </p>
              <p className="mt-1 font-rg-mono text-[10px] text-rg-cream2/40">Generated {fmtTime(summary.generatedAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-rg-cream2/60">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
                Auto-refresh
              </label>
              <button onClick={fetchData} disabled={loading} className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 disabled:opacity-40">
                {loading ? "Loading…" : "Refresh"}
              </button>
              <Link href="/admin/costs" className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60">← CostOps</Link>
              <Link href="/admin" className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60">Admin</Link>
            </div>
          </div>
        </header>

        <section className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setRange(opt.value)}
              className={`rounded border px-4 py-2 font-rg-mono text-xs uppercase tracking-wider transition ${range === opt.value ? "border-rg-gold bg-rg-gold/15 text-rg-gold" : "border-rg-cream2/20 text-rg-cream2 hover:border-rg-gold/60"}`}>
              {opt.label}
            </button>
          ))}
        </section>

        {warnings.length > 0 && warnings.map((w, i) => (
          <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-4 text-sm text-amber-300">{w}</div>
        ))}

        {summary.totalCallCount === 0 && (
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-6 text-center">
            <p className="text-sm text-rg-cream2/60">No Revise Queue cost events recorded for this range.</p>
            <p className="mt-2 text-xs text-rg-cream2/40">
              Costs are captured from <code className="font-rg-mono">/api/revise/generate-rewrite</code> via <code className="font-rg-mono">recordLlmCostEvent</code>.
            </p>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label={`${summary.rangeLabel} Total`} value={fmtUsd(pass4Total)} highlight />
          <KpiCard label="Total Rewrites" value={summary.totalCallCount.toLocaleString()} />
          <KpiCard label="TrustedPath™" value={trustedPathCount.toLocaleString()} />
          <KpiCard label="Standard (A/B/C)" value={standardCount.toLocaleString()} />
          <KpiCard label="Top Model" value={summary.topModel ?? "—"} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <h2 className="mb-3 font-rg-serif text-lg text-rg-cream">Spend by Rewrite Mode</h2>
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-rg-cream2/10">{["Mode", "Calls", "Input", "Output", "Total", "Avg"].map((h) => <th key={h} className="px-3 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-rg-cream2/5">
                {activityBreakdown.map((row) => (
                  <tr key={row.activity} className="hover:bg-rg-ink2/50">
                    <td className="px-3 py-2 text-xs font-medium text-rg-cream">{activityLabel(row.activity)}</td>
                    <td className="px-3 py-2 text-xs text-rg-cream2/60">{row.callCount}</td>
                    <td className="px-3 py-2 text-xs text-rg-cream2/60">{fmtTokens(row.inputTokens)}</td>
                    <td className="px-3 py-2 text-xs text-rg-cream2/60">{fmtTokens(row.outputTokens)}</td>
                    <td className="px-3 py-2 font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(row.costCents)}</td>
                    <td className="px-3 py-2 font-rg-mono text-xs text-rg-cream2/55">{fmtUsd(row.avgCostPerCallCents)}</td>
                  </tr>
                ))}
                {activityBreakdown.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-rg-cream2/40">No data.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <h2 className="mb-3 font-rg-serif text-lg text-rg-cream">Spend by Model</h2>
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-rg-cream2/10">{["Model", "Calls", "Input", "Output", "Total", "Avg"].map((h) => <th key={h} className="px-3 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-rg-cream2/5">
                {modelBreakdown.map((row) => (
                  <tr key={row.model} className="hover:bg-rg-ink2/50">
                    <td className="px-3 py-2 font-rg-mono text-xs font-medium text-rg-cream">{row.model}</td>
                    <td className="px-3 py-2 text-xs text-rg-cream2/60">{row.callCount}</td>
                    <td className="px-3 py-2 text-xs text-rg-cream2/60">{fmtTokens(row.inputTokens)}</td>
                    <td className="px-3 py-2 text-xs text-rg-cream2/60">{fmtTokens(row.outputTokens)}</td>
                    <td className="px-3 py-2 font-rg-mono text-xs font-semibold text-rg-gold">{fmtUsd(row.costCents)}</td>
                    <td className="px-3 py-2 font-rg-mono text-xs text-rg-cream2/55">{fmtUsd(row.avgCostPerCallCents)}</td>
                  </tr>
                ))}
                {modelBreakdown.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-rg-cream2/40">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {recentEvents.length > 0 && (
          <section>
            <h2 className="mb-3 font-rg-serif text-xl text-rg-cream">Recent Rewrites</h2>
            <div className="overflow-x-auto rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
              <table className="min-w-full text-left text-sm">
                <thead><tr className="border-b border-rg-cream2/10">{["Mode", "Model", "Input", "Output", "Cost", "Eval Job", "Op", "Time"].map((h) => <th key={h} className="px-4 py-3 font-rg-mono text-[10px] uppercase tracking-wider text-rg-cream2/50">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-rg-cream2/5">
                  {recentEvents.slice(0, 50).map((ev) => (
                    <tr key={ev.id} className="hover:bg-rg-ink2/50">
                      <td className="px-4 py-3 text-xs text-rg-cream">
                        {trustedBadge(ev.metadata)
                          ? <span className="rounded border border-rg-gold/30 px-2 py-0.5 font-rg-mono text-[10px] text-rg-gold">TrustedPath™</span>
                          : <span className="text-rg-cream2/80">A/B/C</span>}
                      </td>
                      <td className="px-4 py-3 font-rg-mono text-xs text-rg-cream2/70">{ev.model}</td>
                      <td className="px-4 py-3 text-xs text-rg-cream2/55">{fmtTokens(ev.inputTokens)}</td>
                      <td className="px-4 py-3 text-xs text-rg-cream2/55">{fmtTokens(ev.outputTokens)}</td>
                      <td className="px-4 py-3 font-rg-mono text-xs text-rg-gold">{fmtUsd(ev.costCents)}</td>
                      <td className="px-4 py-3 font-rg-mono text-xs text-rg-cream2/40">{ev.evaluationJobId ? ev.evaluationJobId.slice(0, 8) + "…" : "—"}</td>
                      <td className="px-4 py-3 text-xs text-rg-cream2/50">{String(ev.metadata?.operation ?? "—")}</td>
                      <td className="px-4 py-3 text-xs text-rg-cream2/40">{fmtTime(ev.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${highlight ? "border-rg-gold/30 bg-rg-ink2/90" : "border-rg-cream2/15 bg-rg-ink2/70"}`}>
      <div className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/50">{label}</div>
      <div className="mt-2 font-rg-serif text-2xl font-semibold text-rg-gold">{value}</div>
    </div>
  );
}
