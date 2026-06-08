"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CountRow = { key: string; count: number };
type ModelPromptRow = { model: string; prompt_version: string; count: number };

type Payload = {
  success: boolean;
  data?: {
    total_rejected_events: number;
    reason_code_counts: CountRow[];
    criterion_counts: CountRow[];
    revision_operation_counts: CountRow[];
    model_prompt_version_counts: ModelPromptRow[];
    overlap_score_buckets: CountRow[];
    candidate_word_count_buckets: CountRow[];
    hydration_result_counts: CountRow[];
    candidate_generation_status_counts: CountRow[];
  };
  meta?: {
    range: string;
    since: string | null;
    generated_at: string;
  };
  error?: string;
  message?: string;
};

function SimpleTable({
  title,
  rows,
}: {
  title: string;
  rows: CountRow[];
}) {
  return (
    <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
      <h2 className="font-rg-serif text-xl text-rg-cream">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-rg-cream2/10 text-left font-rg-mono text-[10px] uppercase tracking-[0.14em] text-rg-cream2/45">
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rg-cream2/10">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-rg-cream2/45" colSpan={2}>No data yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="text-rg-cream2/70">
                  <td className="px-3 py-2">{row.key}</td>
                  <td className="px-3 py-2 font-rg-mono text-rg-gold">{row.count.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModelPromptTable({ rows }: { rows: ModelPromptRow[] }) {
  return (
    <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
      <h2 className="font-rg-serif text-xl text-rg-cream">Model + Prompt Version Counts</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-rg-cream2/10 text-left font-rg-mono text-[10px] uppercase tracking-[0.14em] text-rg-cream2/45">
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Prompt Version</th>
              <th className="px-3 py-2">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rg-cream2/10">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-rg-cream2/45" colSpan={3}>No data yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.model}::${row.prompt_version}`} className="text-rg-cream2/70">
                  <td className="px-3 py-2">{row.model}</td>
                  <td className="px-3 py-2">{row.prompt_version}</td>
                  <td className="px-3 py-2 font-rg-mono text-rg-gold">{row.count.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RejectedReviseCandidateAnalyticsClient() {
  const router = useRouter();
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/rejected-revise-candidates?range=${range}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/evaluate");
          return null;
        }
        return res.json();
      })
      .then((json) => setPayload(json))
      .catch((error) => setPayload({ success: false, message: String(error) }))
      .finally(() => setLoading(false));
  }, [range, router]);

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link href="/admin" className="text-sm text-rg-gold underline">← Back to Admin</Link>
            <p className="mt-4 font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
              Admin · Aggregate Telemetry Only
            </p>
            <h1 className="mt-2 font-rg-serif text-3xl font-semibold sm:text-4xl">
              Rejected Revise Candidate Analytics
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-rg-cream2/65">
              Aggregate-only telemetry view for rejected revise candidates. This report intentionally excludes manuscript text,
              anchor text, candidate prose, rationale text, and per-card drill-down.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["24h", "7d", "30d", "all"].map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded border px-3 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] ${
                  range === item
                    ? "border-rg-gold bg-rg-gold/15 text-rg-gold"
                    : "border-rg-cream2/15 text-rg-cream2/70"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50 p-5 text-sm text-rg-cream2/65">
          <p>
            <strong className="text-rg-cream">Hard privacy rules:</strong> no manuscript text, no anchor text, no candidate A/B/C prose,
            no rationale, no manuscript context, and no character/location/dialogue snippets.
          </p>
        </section>

        {loading && <section className="text-rg-cream2/65">Loading aggregate telemetry…</section>}

        {!loading && !payload?.success && (
          <section className="rounded-lg border border-red-500/30 bg-red-900/20 p-5 text-red-200">
            Failed to load analytics: {payload?.message ?? payload?.error ?? "Unknown error"}
          </section>
        )}

        {!loading && payload?.success && payload.data && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-rg-gold/30 bg-rg-ink2/90 p-5">
                <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/55">Total Rejected Events</p>
                <p className="mt-2 font-rg-serif text-3xl text-rg-gold">{payload.data.total_rejected_events.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
                <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/55">Reason Codes</p>
                <p className="mt-2 font-rg-serif text-3xl text-rg-cream">{payload.data.reason_code_counts.length}</p>
              </div>
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
                <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/55">Criteria</p>
                <p className="mt-2 font-rg-serif text-3xl text-rg-cream">{payload.data.criterion_counts.length}</p>
              </div>
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
                <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/55">Hydration Results</p>
                <p className="mt-2 font-rg-serif text-3xl text-rg-cream">{payload.data.hydration_result_counts.length}</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <SimpleTable title="Reason Code Counts" rows={payload.data.reason_code_counts} />
              <SimpleTable title="Criterion Counts" rows={payload.data.criterion_counts} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <SimpleTable title="Revision Operation Counts" rows={payload.data.revision_operation_counts} />
              <SimpleTable title="Hydration Result Counts" rows={payload.data.hydration_result_counts} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <SimpleTable title="Candidate Generation Status Counts" rows={payload.data.candidate_generation_status_counts} />
              <ModelPromptTable rows={payload.data.model_prompt_version_counts} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <SimpleTable title="Overlap Score Buckets" rows={payload.data.overlap_score_buckets} />
              <SimpleTable title="Candidate Word Count Buckets" rows={payload.data.candidate_word_count_buckets} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
