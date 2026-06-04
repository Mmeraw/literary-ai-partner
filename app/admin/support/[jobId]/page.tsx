"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Finding = {
  id: string;
  criterion_key: string;
  finding_type: string;
  severity: string;
  location_ref: string | null;
  diagnosis: string;
  recommendation: string | null;
  evidence_excerpt: string | null;
  original_text: string | null;
  action_hint: string | null;
  status: string;
  created_at: string;
};

type Decision = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: string;
  selected_option: string | null;
  custom_text: string | null;
  selected_text: string | null;
  source_excerpt: string | null;
  source_location: string | null;
  created_at: string;
  is_undo: boolean;
};

type Session = {
  id: string;
  status: string;
  findings_count: number | null;
  actionable_findings_count: number | null;
  proposals_created_count: number | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  last_transition_at: string | null;
};

type JobMeta = {
  id: string;
  status: string;
  phase: string | null;
  jobType: string | null;
  manuscriptId: number;
  manuscriptTitle: string;
  createdAt: string;
  completedAt: string | null;
  lastError: string | null;
};

type SupportData = {
  ok: boolean;
  error?: string;
  grant: { scope: string; expiresAt: string };
  job: JobMeta;
  findings: Finding[];
  decisions: Decision[];
  sessions: Session[];
  totals: { findings: number; decisions: number; sessions: number };
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-blue-100 text-blue-800",
};

const DECISION_COLORS: Record<string, string> = {
  accept: "bg-emerald-100 text-emerald-800",
  reject: "bg-red-100 text-red-800",
  defer: "bg-gray-100 text-gray-600",
  keep_original: "bg-gray-100 text-gray-600",
};

export default function AdminSupportViewPage() {
  const params = useParams();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const [data, setData] = useState<SupportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/support/${jobId}`);
        const json = await res.json();
        if (!json.ok) {
          setError(json.error ?? "Failed to load support data");
        } else {
          setData(json);
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-rg-cream2/60">Loading support data…</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream">
        <div className="mx-auto max-w-6xl space-y-4">
          <Link href="/admin" className="text-xs text-rg-gold hover:underline">← Admin</Link>
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-6">
            <h1 className="font-rg-serif text-xl">Support Access Denied</h1>
            <p className="mt-2 text-sm text-rg-cream2/70">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const { job, findings, decisions, sessions, grant, totals } = data;

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-rg-mono text-xs text-rg-gold hover:underline">← Admin</Link>
            <span className="text-rg-cream2/30">|</span>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
              Support View
            </p>
          </div>
          <h1 className="font-rg-serif text-3xl font-semibold">
            {job.manuscriptTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-rg-cream2/60">
            <span>Job: {job.id.slice(0, 8)}…</span>
            <span>Status: <span className="text-rg-cream">{job.status}</span></span>
            {job.phase && <span>Phase: <span className="text-rg-cream">{job.phase}</span></span>}
            <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5 text-emerald-400">
              Grant: {grant.scope} · expires {new Date(grant.expiresAt).toLocaleDateString()}
            </span>
          </div>
        </header>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Diagnostic Findings", value: totals.findings },
            { label: "Revision Decisions", value: totals.decisions },
            { label: "Revision Sessions", value: totals.sessions },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
              <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-gold/80">{label}</p>
              <p className="mt-2 font-rg-serif text-3xl">{value}</p>
            </div>
          ))}
        </div>

        {/* Diagnostic Findings */}
        <section className="space-y-4">
          <h2 className="font-rg-serif text-xl">Diagnostic Findings</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-rg-cream2/50">No diagnostic findings recorded.</p>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_COLORS[f.severity] ?? "bg-gray-100 text-gray-600"}`}>
                        {f.severity}
                      </span>
                      <span className="font-rg-mono text-xs text-rg-gold">{f.criterion_key}</span>
                      {f.location_ref && (
                        <span className="text-xs text-rg-cream2/50">{f.location_ref}</span>
                      )}
                    </div>
                    <span className="font-rg-mono text-[10px] text-rg-cream2/40">{f.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-rg-cream2/80">{f.diagnosis}</p>
                  {f.original_text && (
                    <div className="mt-2 rounded border border-rg-cream2/10 bg-rg-ink/50 p-3">
                      <p className="font-rg-mono text-[10px] uppercase text-rg-cream2/40">Original Text</p>
                      <p className="mt-1 text-xs italic text-rg-cream2/60">&ldquo;{f.original_text}&rdquo;</p>
                    </div>
                  )}
                  {f.recommendation && (
                    <p className="mt-2 text-xs text-rg-cream2/60">
                      <span className="font-bold text-rg-gold/70">Recommendation:</span> {f.recommendation}
                    </p>
                  )}
                  {f.action_hint && (
                    <span className="mt-1 inline-block rounded border border-rg-cream2/15 px-2 py-0.5 font-rg-mono text-[10px] uppercase text-rg-cream2/50">
                      {f.action_hint}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Revision Decisions */}
        <section className="space-y-4">
          <h2 className="font-rg-serif text-xl">Revision Decisions</h2>
          {decisions.length === 0 ? (
            <p className="text-sm text-rg-cream2/50">No revision decisions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-rg-cream">{d.opportunity_title}</p>
                      <p className="mt-0.5 font-rg-mono text-[10px] text-rg-cream2/40">
                        {new Date(d.created_at).toLocaleString()}
                        {d.is_undo && " · UNDONE"}
                      </p>
                    </div>
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${DECISION_COLORS[d.decision] ?? "bg-gray-100 text-gray-600"}`}>
                      {d.decision}
                    </span>
                  </div>
                  {d.selected_option && (
                    <p className="mt-1 text-xs text-rg-cream2/60">
                      Selected: <span className="text-rg-cream">{d.selected_option}</span>
                    </p>
                  )}
                  {d.selected_text && (
                    <div className="mt-2 rounded border border-rg-cream2/10 bg-rg-ink/50 p-3">
                      <p className="font-rg-mono text-[10px] uppercase text-rg-cream2/40">Selected Revision</p>
                      <p className="mt-1 text-xs text-rg-cream2/70">{d.selected_text}</p>
                    </div>
                  )}
                  {d.custom_text && (
                    <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-950/10 p-3">
                      <p className="font-rg-mono text-[10px] uppercase text-emerald-400/60">Custom Revision</p>
                      <p className="mt-1 text-xs text-rg-cream2/70">{d.custom_text}</p>
                    </div>
                  )}
                  {d.source_excerpt && (
                    <div className="mt-2 rounded border border-rg-cream2/10 bg-rg-ink/50 p-3">
                      <p className="font-rg-mono text-[10px] uppercase text-rg-cream2/40">
                        Source {d.source_location ? `· ${d.source_location}` : ""}
                      </p>
                      <p className="mt-1 text-xs italic text-rg-cream2/50">&ldquo;{d.source_excerpt}&rdquo;</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Revision Sessions */}
        <section className="space-y-4">
          <h2 className="font-rg-serif text-xl">Revision Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-rg-cream2/50">No revision sessions recorded.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-rg-mono text-xs text-rg-cream2/60">{s.id.slice(0, 8)}…</span>
                      <span className="rounded border border-rg-cream2/15 px-2 py-0.5 font-rg-mono text-[10px] uppercase text-rg-cream">
                        {s.status}
                      </span>
                    </div>
                    <span className="text-xs text-rg-cream2/40">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-rg-cream2/60">
                    {s.findings_count != null && <span>Findings: {s.findings_count}</span>}
                    {s.actionable_findings_count != null && <span>Actionable: {s.actionable_findings_count}</span>}
                    {s.proposals_created_count != null && <span>Proposals: {s.proposals_created_count}</span>}
                  </div>
                  {s.failure_code && (
                    <p className="mt-2 text-xs text-red-400">
                      {s.failure_code}: {s.failure_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
