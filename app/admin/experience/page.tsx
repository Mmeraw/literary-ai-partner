"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Payload = {
  ok: boolean;
  setupRequired?: boolean;
  error?: string;
  generatedAt?: string;
  overview?: Record<string, number>;
  topPages?: any[];
  topClicks?: any[];
  geography?: any[];
  recentEvents?: any[];
  reviseSteps?: Array<{ eventName: string; count: number }>;
  conversionSteps?: Array<{ eventName: string; count: number }>;
};

function n(value: unknown) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function eventLabel(value: string) {
  return value.replaceAll("_", " ");
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
      <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/55">{label}</p>
      <p className="mt-2 font-rg-serif text-3xl text-rg-cream">{value}</p>
      {sub && <p className="mt-1 text-xs text-rg-cream2/50">{sub}</p>}
    </div>
  );
}

function Funnel({ title, steps }: { title: string; steps: Array<{ eventName: string; count: number }> }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
      <h2 className="font-rg-serif text-xl text-rg-cream">{title}</h2>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={step.eventName}>
            <div className="flex justify-between gap-4 text-xs text-rg-cream2/70">
              <span>{index + 1}. {eventLabel(step.eventName)}</span>
              <span className="font-rg-mono text-rg-gold">{step.count}</span>
            </div>
            <div className="mt-1 h-2 rounded bg-rg-cream2/10">
              <div className="h-2 rounded bg-rg-gold/70" style={{ width: `${Math.max(3, (step.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SimpleTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
      <h2 className="font-rg-serif text-xl text-rg-cream">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-rg-cream2/10 text-left font-rg-mono text-[10px] uppercase tracking-[0.14em] text-rg-cream2/45">
              {columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-rg-cream2/10">
            {rows.length === 0 ? <tr><td className="px-3 py-4 text-rg-cream2/45" colSpan={columns.length}>No data yet.</td></tr> : rows.map((row, i) => (
              <tr key={i} className="text-rg-cream2/70">
                {columns.map((c) => <td key={c} className="max-w-md px-3 py-2 align-top">{String(row[c] ?? row[c.replaceAll(" ", "")] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminExperiencePage() {
  const router = useRouter();
  const [range, setRange] = useState("7d");
  const [includeAdmin, setIncludeAdmin] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/overview?range=${range}${includeAdmin ? "&include_admin=1" : ""}`, { cache: "no-store", credentials: "include" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/evaluate");
          return null;
        }
        return res.json();
      })
      .then((json) => setData(json))
      .catch((error) => setData({ ok: false, setupRequired: true, error: String(error) }))
      .finally(() => setLoading(false));
  }, [range, includeAdmin, router]);

  const overview = data?.overview ?? {};

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link href="/admin" className="text-sm text-rg-gold underline">← Back to Admin</Link>
            <p className="mt-4 font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Admin · Site Experience</p>
            <h1 className="mt-2 font-rg-serif text-3xl font-semibold sm:text-4xl">Site Experience Analytics</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-rg-cream2/65">Visitor behavior, page interest, click activity, geography, and Revise example funnel tracking. Manuscript and editor text are not stored.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["24h", "7d", "30d"].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded border px-3 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] ${range === item ? "border-rg-gold bg-rg-gold/15 text-rg-gold" : "border-rg-cream2/15 text-rg-cream2/70"}`}>{item}</button>)}
            <label className="ml-2 flex items-center gap-2 text-xs text-rg-cream2/55"><input type="checkbox" checked={includeAdmin} onChange={(e) => setIncludeAdmin(e.target.checked)} /> Include admin/test</label>
          </div>
        </header>

        {loading && <p className="rounded border border-rg-cream2/15 bg-rg-ink2/60 p-5 text-rg-cream2/65">Loading analytics…</p>}

        {!loading && data?.setupRequired && <section className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-5 text-amber-100"><h2 className="font-rg-serif text-xl">Analytics storage not ready yet</h2><p className="mt-2 text-sm leading-6">Apply the production Supabase migration <code className="rounded bg-black/30 px-1">20260603020000_site_experience_analytics.sql</code>, then reload.</p>{data.error && <p className="mt-2 font-rg-mono text-xs">{data.error}</p>}</section>}

        {!loading && !data?.setupRequired && <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Visitors" value={n(overview.uniqueVisitors)} sub={range} />
            <Card label="Sessions" value={n(overview.sessions)} sub={`Bounce ${n(overview.bounceRate)}%`} />
            <Card label="Page views" value={n(overview.pageViews)} />
            <Card label="Revise starts" value={n(overview.reviseStarts)} sub={`${n(overview.reviseCompletionRate)}% complete`} />
            <Card label="Revise completions" value={n(overview.reviseCompletions)} />
            <Card label="Evaluation starts" value={n(overview.evaluationStarts)} />
            <Card label="Report views" value={n(overview.reportViews)} />
            <Card label="Admin included" value={includeAdmin ? "Yes" : "No"} />
          </section>
          <div className="grid gap-6 lg:grid-cols-2"><Funnel title="Revise Example Funnel" steps={data?.reviseSteps ?? []} /><Funnel title="Evaluation / Conversion Funnel" steps={data?.conversionSteps ?? []} /></div>
          <SimpleTable title="Top Pages" rows={data?.topPages ?? []} columns={["path", "views", "uniqueVisitors", "avgDurationMs"]} />
          <SimpleTable title="Top Clicks" rows={data?.topClicks ?? []} columns={["path", "target", "clicks", "uniqueSessions"]} />
          <SimpleTable title="Geography" rows={data?.geography ?? []} columns={["location", "sessions", "pageViews", "conversions"]} />
          <SimpleTable title="Recent Activity" rows={data?.recentEvents ?? []} columns={["occurred_at", "event_name", "path", "target"]} />
        </>}
      </div>
    </main>
  );
}
