"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type JsonRecord = Record<string, unknown>;

interface ReviseForensicsData {
  ok: boolean;
  job: {
    id: string;
    manuscript_id: string | null;
    status: string;
    phase: string | null;
    phase_status: string | null;
    failure_code: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  };
  ledger: null | {
    artifact_id: string;
    artifact_type: string;
    created_at: string;
    opportunity_count: number;
    source_hash: string | null;
    source_completeness_status: unknown;
    missing_required_sources: unknown;
    degraded_sources: unknown;
    evaluation_result_artifact_type: unknown;
    evaluation_result_artifact_id: unknown;
    legacy_fallback: unknown;
    revision_opportunity_ledger: unknown;
    field_source_ownership: JsonRecord;
    field_source_of_truth: JsonRecord;
    source_manifest: JsonRecord;
  };
  summary: {
    readiness_counts: Record<string, number>;
    grounding_counts: Record<string, number>;
    preflight_counts: Record<string, number>;
    ownership_counts: Record<string, number>;
    candidate_ownership_counts: Record<string, number>;
    reasons: string[];
  };
  opportunities: Array<{
    opportunity_id: unknown;
    criterion: unknown;
    readiness: unknown;
    grounding_status: unknown;
    preflight_status: unknown;
    revision_operation: unknown;
    ownership_status: unknown;
    violations: unknown;
    reasons: string[];
  }>;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function stringify(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function statusClass(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("pass") || text.includes("ready") || text.includes("supported") || text === "false") {
    return "border-green-400/30 bg-green-900/20 text-green-300";
  }
  if (text.includes("block") || text.includes("fail") || text.includes("legacy") || text === "true") {
    return "border-red-400/30 bg-red-900/20 text-red-300";
  }
  if (text.includes("target") || text.includes("limited") || text.includes("prepar")) {
    return "border-amber-400/30 bg-amber-900/20 text-amber-200";
  }
  return "border-rg-cream2/15 bg-rg-ink2/60 text-rg-cream2/70";
}

function Badge({ value }: { value: unknown }) {
  return (
    <span className={`inline-flex rounded border px-2 py-1 font-mono text-[11px] ${statusClass(value)}`}>
      {stringify(value)}
    </span>
  );
}

function CountGrid({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts ?? {});
  return (
    <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50 p-4">
      <h3 className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-gold/80">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-rg-cream2/45">No data captured.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-sm">
              <Badge value={key} />
              <span className="font-mono font-bold text-rg-cream">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-gold/80">{title}</span>
        <span className="text-xs text-rg-cream2/55">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-rg-cream2/10 bg-rg-ink p-4 text-xs leading-5 text-rg-cream2/75">
          {stringify(value)}
        </pre>
      )}
    </div>
  );
}

export default function ReviseForensicsJobPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [data, setData] = useState<ReviseForensicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/revise-forensics/${jobId}`);
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to load Revise forensics");
      }
      setData(json as ReviseForensicsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ledger = data?.ledger ?? null;
  const summary = data?.summary;
  const sourceRows = useMemo(() => {
    if (!ledger?.source_manifest) return [] as Array<[string, unknown]>;
    return [
      ["evaluation_result_artifact_type", ledger.evaluation_result_artifact_type],
      ["evaluation_result_artifact_id", ledger.evaluation_result_artifact_id],
      ["legacy_fallback", ledger.legacy_fallback],
      ["source_completeness_status", ledger.source_completeness_status],
      ["missing_required_sources", ledger.missing_required_sources],
      ["degraded_sources", ledger.degraded_sources],
      ["source_hash", ledger.source_hash],
    ];
  }, [ledger]);

  if (loading) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-rg-cream2/70">Loading Revise forensics…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <Link href="/admin/revise-forensics" className="text-sm font-semibold text-rg-gold hover:text-rg-cream">
            ← Back to Revise Forensics
          </Link>
          <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-5 text-red-300">
            {error ?? "No data returned"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/revise-forensics" className="text-sm font-semibold text-rg-gold hover:text-rg-cream">
              ← Back to Revise Forensics
            </Link>
            <Link href={`/admin/forensics/${jobId}`} className="text-sm font-semibold text-rg-gold hover:text-rg-cream">
              Open SIPOC Forensic View →
            </Link>
          </div>
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            Admin · Revise Workbench Audit
          </p>
          <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">
            Revise Workbench Forensics
          </h1>
          <p className="text-sm leading-6 text-rg-cream2/70">
            Job <span className="font-mono text-rg-gold">{data.job.id}</span> · created {fmtDate(data.job.created_at)}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <p className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2/50">Ledger</p>
            <p className="mt-3 text-2xl font-bold text-rg-cream">{ledger ? "Present" : "Missing"}</p>
            <p className="mt-1 text-xs text-rg-cream2/50">revision_opportunity_ledger_v1</p>
          </div>
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <p className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2/50">Opportunities</p>
            <p className="mt-3 text-2xl font-bold text-rg-cream">{ledger?.opportunity_count ?? 0}</p>
            <p className="mt-1 text-xs text-rg-cream2/50">sample shows first 12</p>
          </div>
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <p className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2/50">Canonical source</p>
            <p className="mt-3"><Badge value={ledger?.evaluation_result_artifact_type ?? "—"} /></p>
            <p className="mt-1 text-xs text-rg-cream2/50">evaluation result input</p>
          </div>
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
            <p className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2/50">Legacy fallback</p>
            <p className="mt-3"><Badge value={ledger?.legacy_fallback ?? "—"} /></p>
            <p className="mt-1 text-xs text-rg-cream2/50">must never be Ready</p>
          </div>
        </section>

        {!ledger && (
          <section className="rounded-lg border border-amber-400/30 bg-amber-900/20 p-5">
            <h2 className="font-rg-serif text-xl text-amber-100">No Revise ledger found</h2>
            <p className="mt-2 text-sm text-amber-100/80">
              This job has no revision_opportunity_ledger_v1 artifact yet. Workbench cards should not be admitted from raw evaluation artifacts.
            </p>
          </section>
        )}

        {ledger && summary && (
          <>
            <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
              <h2 className="font-rg-serif text-xl text-rg-cream">Source Manifest Summary</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {sourceRows.map(([label, value]) => (
                  <div key={label} className="rounded border border-rg-cream2/10 bg-rg-ink2/50 p-3">
                    <p className="font-rg-mono text-[11px] uppercase tracking-[0.14em] text-rg-cream2/45">{label}</p>
                    <p className="mt-1 break-words font-mono text-xs text-rg-cream2/80">{stringify(value)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <CountGrid title="Readiness" counts={summary.readiness_counts} />
              <CountGrid title="Grounding" counts={summary.grounding_counts} />
              <CountGrid title="Preflight" counts={summary.preflight_counts} />
              <CountGrid title="Ownership" counts={summary.ownership_counts} />
              <CountGrid title="Candidate owner" counts={summary.candidate_ownership_counts} />
            </section>

            <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
              <h2 className="font-rg-serif text-xl text-rg-cream">Admission / Withholding Reasons</h2>
              {summary.reasons.length === 0 ? (
                <p className="mt-3 text-sm text-rg-cream2/55">No blocking or targeting reasons captured.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.reasons.map((reason) => <Badge key={reason} value={reason} />)}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5">
              <h2 className="font-rg-serif text-xl text-rg-cream">Opportunity Sample</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
                  <thead>
                    <tr className="text-left font-rg-mono text-xs uppercase tracking-[0.12em] text-rg-cream2/50">
                      <th className="py-2 pr-4">ID</th>
                      <th className="py-2 pr-4">Criterion</th>
                      <th className="py-2 pr-4">Readiness</th>
                      <th className="py-2 pr-4">Grounding</th>
                      <th className="py-2 pr-4">Preflight</th>
                      <th className="py-2 pr-4">Ownership</th>
                      <th className="py-2 pr-4">Reasons</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rg-cream2/10">
                    {data.opportunities.map((opportunity, index) => (
                      <tr key={`${opportunity.opportunity_id ?? index}`}>
                        <td className="max-w-xs break-words py-3 pr-4 font-mono text-xs text-rg-cream2/65">{stringify(opportunity.opportunity_id)}</td>
                        <td className="py-3 pr-4 text-rg-cream2/80">{stringify(opportunity.criterion)}</td>
                        <td className="py-3 pr-4"><Badge value={opportunity.readiness} /></td>
                        <td className="py-3 pr-4"><Badge value={opportunity.grounding_status} /></td>
                        <td className="py-3 pr-4"><Badge value={opportunity.preflight_status} /></td>
                        <td className="py-3 pr-4"><Badge value={opportunity.ownership_status} /></td>
                        <td className="py-3 pr-4">
                          <div className="flex max-w-md flex-wrap gap-1">
                            {(opportunity.reasons ?? []).length === 0 ? "—" : opportunity.reasons.map((reason) => <Badge key={reason} value={reason} />)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <JsonPanel title="Raw source_manifest" value={ledger.source_manifest} />
              <JsonPanel title="Field source ownership" value={ledger.field_source_ownership} />
              <JsonPanel title="Field source-of-truth map" value={ledger.field_source_of_truth} />
              <JsonPanel title="Revision opportunity ledger manifest" value={ledger.revision_opportunity_ledger} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
