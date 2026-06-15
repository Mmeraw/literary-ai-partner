"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = "queued" | "running" | "complete" | "failed";

interface Phase {
  phase: string;
  label: string;
  started: string | null;
  completed: string | null;
  duration_ms: number | null;
  status: "complete" | "running" | "not_started";
}

interface ArtifactSummary {
  id: string;
  artifact_type: string;
  created_at: string;
  present: boolean;
  summary?: Record<string, unknown>;
}

interface MonitorData {
  ok: boolean;
  job: {
    id: string;
    status: JobStatus;
    phase: string | null;
    phase_status: string | null;
    manuscript_id: number | null;
    manuscript_word_count: number | null;
    work_type: string | null;
    english_variant: string | null;
    total_units: number;
    completed_units: number;
    failed_units: number;
    attempt_count: number;
    max_attempts: number;
    retry_count: number;
    next_attempt_at: string | null;
    last_error: string | null;
    failure_code: string | null;
    lease_until: string | null;
    heartbeat_at: string | null;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
  };
  phases: Phase[];
  artifacts: ArtifactSummary[];
  phase_log: Array<Record<string, unknown>>;
  chunk_routing: Record<string, unknown> | null;
  narrative_preflight: { classifier_flagged: boolean; detected_type: string | null };
  artifact_types_present: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;

const PHASE_ORDER = ["phase_0", "phase_1a", "phase_2", "phase_3"];

const EXPECTED_ARTIFACTS = [
  { type: "story_map_seed_v1",                  label: "Story Map Seed",          phase: "phase_0"  },
  { type: "evaluation_seed_v1",                  label: "Evaluation Seed",         phase: "phase_0"  },
  { type: "full_context_story_ledger_v1",         label: "Story Ledger",            phase: "phase_0"  },
  { type: "phase1a_chunk_routing_manifest_v1",    label: "Chunk Manifest",          phase: "phase_1a" },
  { type: "pass1a_chunk_cache_v1",               label: "Pass 1A Chunk Cache",     phase: "phase_1a" },
  { type: "pass3_preflight_draft_v1",            label: "Pass 3A Preflight",       phase: "phase_1a" },
  { type: "seed_contradiction_report_v1",         label: "Seed Contradiction Rpt",  phase: "phase_1a" },
  { type: "pass1a_character_ledger_v1",           label: "Character Ledger V1",     phase: "phase_1a" },
  { type: "pass1a_story_layer_v1",               label: "Story Layer V1",          phase: "phase_1a" },
  { type: "ledger_quality_report_v1",            label: "Ledger Quality Report",   phase: "phase_1a" },
  { type: "failure_diagnosis_v1",                label: "Failure Diagnosis",       phase: "any"      },
  { type: "quality_gate_result_v1",              label: "Quality Gate Result",     phase: "phase_2"  },
  { type: "evaluation_result_v2",                label: "Evaluation Result V2",    phase: "phase_2"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: JobStatus) {
  if (status === "complete")
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />;
  if (status === "failed")
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />;
  if (status === "running")
    return <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />;
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-rg-cream2/30" />;
}

function phaseStatusColor(status: Phase["status"]) {
  if (status === "complete") return "border-green-500/50 bg-green-900/20";
  if (status === "running")  return "border-amber-400/50 bg-amber-900/20 animate-pulse";
  return "border-rg-cream2/10 bg-rg-ink2/40";
}

function phaseStatusBadge(status: Phase["status"]) {
  if (status === "complete") return <span className="rounded bg-green-700/30 px-1.5 py-0.5 text-green-300">done</span>;
  if (status === "running")  return <span className="rounded bg-amber-700/30 px-1.5 py-0.5 text-amber-300">running</span>;
  return <span className="rounded bg-rg-cream2/10 px-1.5 py-0.5 text-rg-cream2/40">pending</span>;
}

function fmtDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function progressPct(total: number, completed: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function scoreColor(score: number) {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-amber-400";
  return "text-red-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArtifactCard({ artifact, expected }: { artifact: ArtifactSummary | undefined; expected: typeof EXPECTED_ARTIFACTS[number] }) {
  const present = !!artifact;
  const s = artifact?.summary;

  return (
    <div className={`rounded-lg border p-3 text-xs transition ${
      present ? "border-green-500/30 bg-green-900/10" : "border-rg-cream2/10 bg-rg-ink2/30 opacity-50"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-rg-mono text-[10px] uppercase tracking-widest text-rg-gold/70">
          {expected.label}
        </span>
        {present
          ? <span className="shrink-0 rounded bg-green-700/30 px-1.5 py-0.5 text-green-300">✓ present</span>
          : <span className="shrink-0 rounded bg-rg-cream2/10 px-1.5 py-0.5 text-rg-cream2/40">missing</span>
        }
      </div>

      {present && artifact.created_at && (
        <p className="mt-1 text-rg-cream2/50">{fmtTime(artifact.created_at)}</p>
      )}

      {/* Per-artifact quality summary */}
      {s && artifact?.artifact_type === "pass3_preflight_draft_v1" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-rg-cream2/60">reducer: <span className="text-rg-cream">{String(s.reducer_status)}</span></p>
          <p className="text-rg-cream2/60">criteria: <span className="text-rg-cream">{String(s.criterion_count)}</span></p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {((s.scores as Array<{ criterion: string; score: number; confidence: string }>) ?? []).slice(0, 9).map((sc) => (
              <span key={sc.criterion} className={`font-rg-mono text-[10px] ${scoreColor(sc.score)}`}>
                {sc.criterion.slice(0, 6)} {sc.score}
              </span>
            ))}
          </div>
        </div>
      )}

      {s && artifact?.artifact_type === "ledger_quality_report_v1" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-rg-cream2/60">gate: <span className={
            String(s.gate_ready_status) === "ready" ? "text-green-300" :
            String(s.gate_ready_status) === "repair_required" ? "text-amber-300" : "text-red-300"
          }>{String(s.gate_ready_status)}</span></p>
          <p className="text-rg-cream2/60">hard_fail: <span className={s.hard_fail_present ? "text-red-300" : "text-green-300"}>{String(s.hard_fail_present)}</span></p>
          {(s.blocking_reasons as string[])?.length > 0 && (
            <p className="text-red-300">⚠ {(s.blocking_reasons as string[]).join(", ")}</p>
          )}
        </div>
      )}

      {s && artifact?.artifact_type === "failure_diagnosis_v1" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-red-300 font-rg-mono text-[10px]">{String(s.failure_code)}</p>
          <p className="text-rg-cream2/70 leading-snug">{String(s.admin_summary).slice(0, 120)}</p>
        </div>
      )}

      {s && artifact?.artifact_type === "seed_contradiction_report_v1" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-rg-cream2/60">verdict: <span className={
            s.verdict === "clean" ? "text-green-300" : s.verdict === "minor_drift" ? "text-amber-300" : "text-red-300"
          }>{String(s.verdict)}</span></p>
          <p className="text-rg-cream2/60">drift: <span className="text-rg-cream">{Number(s.drift_ratio).toFixed(2)}</span> · missed: <span className="text-rg-cream">{String(s.missed_count)}</span></p>
        </div>
      )}

      {s && artifact?.artifact_type === "pass1a_story_layer_v1" && (
        <div className="mt-2 space-y-0.5">
          {Object.entries((s.layers as Record<string, { status: string; truth_status: string }>) ?? {}).map(([k, v]) => (
            <p key={k} className="text-rg-cream2/60 text-[10px]">
              {k.replace(/_layer$/, "")}: <span className={
                v.truth_status === "verified" ? "text-green-300" :
                v.truth_status === "degraded" ? "text-amber-300" : "text-rg-cream"
              }>{v.truth_status}</span>
            </p>
          ))}
        </div>
      )}

      {s && artifact?.artifact_type === "pass1a_character_ledger_v1" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-rg-cream2/60">entries: <span className="text-rg-cream">{String(s.entry_count)}</span></p>
          {(s.protagonists as string[])?.length > 0 && (
            <p className="text-rg-cream2/60">protagonists: <span className="text-rg-cream">{(s.protagonists as string[]).join(", ")}</span></p>
          )}
          {(s.hard_fail_triggers as unknown[])?.length > 0 && (
            <p className="text-red-300">⚠ hard_fail triggers present</p>
          )}
        </div>
      )}

      {s && artifact?.artifact_type === "evaluation_result_v2" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-rg-cream2/60">overall: <span className={scoreColor(Number(s.overall_score) / 10)}>{String(s.overall_score)}/100</span></p>
          <p className="text-rg-cream2/60">readiness: <span className="text-rg-cream">{String(s.submission_readiness)}</span></p>
        </div>
      )}

      {s && artifact?.artifact_type === "quality_gate_result_v1" && (
        <div className="mt-2 space-y-0.5">
          <p className="text-rg-cream2/60">pass: <span className={s.pass ? "text-green-300" : "text-red-300"}>{String(s.pass)}</span></p>
          {(s.failed_checks as string[])?.length > 0 && (
            <p className="text-red-300 text-[10px]">failed: {(s.failed_checks as string[]).join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EvalMonitorPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    const res = await globalThis.fetch(`/api/admin/eval-monitor/${jobId}`);
    if (res.status === 401 || res.status === 403) { router.replace("/evaluate"); return; }
    const json = await res.json();
    if (!json.ok) { setError(json.error ?? "Unknown error"); return; }
    setData(json as MonitorData);
    setLastFetched(new Date());
    setError(null);
  }, [jobId, router]);

  useEffect(() => { void fetch(); }, [fetch]);

  useEffect(() => {
    if (!autoRefresh) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      // Stop polling once terminal
      if (data?.job.status === "complete" || data?.job.status === "failed") {
        setAutoRefresh(false);
        return;
      }
      void fetch();
    }, POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetch, data?.job.status]);

  if (!data && !error) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream">
        <div className="mx-auto max-w-7xl">
          <p className="animate-pulse text-rg-cream2/60 font-rg-mono text-sm">Loading job monitor…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-4">
            <p className="font-semibold text-red-300">Error: {error}</p>
          </div>
          <Link href="/admin/eval-monitor" className="text-sm text-rg-gold underline">← Back</Link>
        </div>
      </main>
    );
  }

  const { job, phases, artifacts, phase_log, chunk_routing, narrative_preflight } = data!;
  const pct = progressPct(job.total_units, job.completed_units);
  const artifactMap = new Map(artifacts.map((a) => [a.artifact_type, a]));

  const createdMs = new Date(job.created_at).getTime();
  const nowMs = Date.now();
  const elapsedS = Math.round((nowMs - createdMs) / 1000);

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-rg-mono text-[10px] uppercase tracking-[0.24em] text-rg-gold/70">
              Admin · Eval Monitor
            </p>
            <h1 className="mt-1 font-rg-serif text-2xl sm:text-3xl">Evaluation Live View</h1>
            <p className="mt-1 font-rg-mono text-xs text-rg-cream2/50 break-all">{job.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`rounded border px-3 py-1.5 font-rg-mono text-xs transition ${
                autoRefresh
                  ? "border-amber-400/40 text-amber-300 hover:border-amber-400/70"
                  : "border-rg-cream2/20 text-rg-cream2/50 hover:border-rg-cream2/40"
              }`}
            >
              {autoRefresh ? "⏸ Pause" : "▶ Resume"} auto-refresh
            </button>
            <button
              onClick={() => void fetch()}
              className="rounded border border-rg-cream2/20 px-3 py-1.5 font-rg-mono text-xs text-rg-cream2 hover:border-rg-gold/50 hover:text-rg-cream"
            >
              ↻ Refresh now
            </button>
            <Link href="/admin/eval-monitor" className="font-rg-mono text-xs text-rg-gold hover:underline">
              ← Back
            </Link>
          </div>
        </header>

        {lastFetched && (
          <p className="font-rg-mono text-[10px] text-rg-cream2/40">
            Last fetched {lastFetched.toLocaleTimeString()} · polling every {POLL_INTERVAL_MS / 1000}s
            {(job.status === "complete" || job.status === "failed") && " · terminal state, polling stopped"}
          </p>
        )}

        {/* ── Status banner ── */}
        <section className="rounded-xl border border-rg-cream2/10 bg-rg-ink2/60 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {statusDot(job.status)}
              <span className="font-rg-mono text-sm uppercase tracking-widest">
                {job.status}
              </span>
            </div>
            <span className="text-rg-cream2/40">·</span>
            <span className="font-rg-mono text-xs text-rg-cream2/60">phase: <span className="text-rg-cream">{job.phase ?? "—"}</span></span>
            <span className="font-rg-mono text-xs text-rg-cream2/60">phase_status: <span className="text-rg-cream">{job.phase_status ?? "—"}</span></span>
            <span className="font-rg-mono text-xs text-rg-cream2/60">attempt: <span className="text-rg-cream">{job.attempt_count}/{job.max_attempts}</span></span>
            <span className="font-rg-mono text-xs text-rg-cream2/60">elapsed: <span className="text-rg-cream">{elapsedS}s</span></span>
            {job.manuscript_word_count && (
              <span className="font-rg-mono text-xs text-rg-cream2/60">words: <span className="text-rg-cream">{job.manuscript_word_count.toLocaleString()}</span></span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between font-rg-mono text-[10px] text-rg-cream2/50">
              <span>{job.completed_units} / {job.total_units} units</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-rg-cream2/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  job.status === "complete" ? "bg-green-400" :
                  job.status === "failed" ? "bg-red-400" : "bg-amber-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Failure */}
          {(job.failure_code || job.last_error) && (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-900/20 p-3 space-y-1">
              {job.failure_code && (
                <p className="font-rg-mono text-xs font-bold text-red-300">{job.failure_code}</p>
              )}
              {job.last_error && (
                <p className="text-xs text-red-200/80 leading-snug">{job.last_error}</p>
              )}
            </div>
          )}

          {/* Narrative preflight flag */}
          {narrative_preflight.classifier_flagged && (
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-900/15 px-3 py-2 font-rg-mono text-xs text-amber-300">
              ⚠ Narrative preflight flagged: <span className="text-rg-cream">{narrative_preflight.detected_type ?? "unknown type"}</span>
            </div>
          )}
        </section>

        {/* ── Phase timeline ── */}
        <section className="space-y-2">
          <h2 className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold/70">Phase Timeline</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {phases.map((p, i) => (
              <div key={p.phase} className={`rounded-lg border p-3 ${phaseStatusColor(p.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-rg-mono text-[10px] uppercase tracking-wider text-rg-gold/70">
                    P{i}
                  </span>
                  <span className="font-rg-mono text-[10px]">{phaseStatusBadge(p.status)}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-rg-cream leading-snug">{p.label}</p>
                <div className="mt-2 space-y-0.5 font-rg-mono text-[10px] text-rg-cream2/50">
                  <p>start: {fmtTime(p.started)}</p>
                  <p>end: {fmtTime(p.completed)}</p>
                  <p>dur: {fmtDuration(p.duration_ms)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Chunk routing ── */}
        {chunk_routing && (
          <section className="space-y-2">
            <h2 className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold/70">Chunk Routing</h2>
            <div className="rounded-lg border border-rg-cream2/10 bg-rg-ink2/40 px-4 py-3">
              <div className="flex flex-wrap gap-4 font-rg-mono text-xs text-rg-cream2/70">
                <span>route: <span className="text-rg-cream">{String(chunk_routing.route)}</span></span>
                <span>chunks: <span className="text-rg-cream">{String(chunk_routing.chunk_count)}</span></span>
                <span>words: <span className="text-rg-cream">{Number(chunk_routing.manuscript_words).toLocaleString()}</span></span>
                <span>bracket: <span className="text-rg-cream">{String(chunk_routing.bracket)}</span></span>
                <span>max_chunk_chars: <span className="text-rg-cream">{String(chunk_routing.max_chunk_chars)}</span></span>
              </div>
            </div>
          </section>
        )}

        {/* ── Artifacts ── */}
        <section className="space-y-2">
          <h2 className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold/70">
            Artifacts ({artifacts.length} / {EXPECTED_ARTIFACTS.length} expected types)
          </h2>
          {PHASE_ORDER.map((phaseKey) => {
            const forPhase = EXPECTED_ARTIFACTS.filter(
              (e) => e.phase === phaseKey || (e.phase === "any" && artifactMap.has(e.type))
            );
            if (forPhase.length === 0) return null;
            const phaseMeta = phases.find((p) => p.phase === phaseKey);
            return (
              <div key={phaseKey} className="space-y-2">
                <p className="font-rg-mono text-[10px] uppercase tracking-widest text-rg-cream2/40">
                  {phaseMeta?.label ?? phaseKey}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {forPhase.map((expected) => (
                    <ArtifactCard
                      key={expected.type}
                      expected={expected}
                      artifact={artifactMap.get(expected.type)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {/* Any artifacts present that aren't in EXPECTED_ARTIFACTS */}
          {artifacts
            .filter((a) => !EXPECTED_ARTIFACTS.some((e) => e.type === a.artifact_type))
            .length > 0 && (
            <div className="space-y-2">
              <p className="font-rg-mono text-[10px] uppercase tracking-widest text-rg-cream2/40">Other</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {artifacts
                  .filter((a) => !EXPECTED_ARTIFACTS.some((e) => e.type === a.artifact_type))
                  .map((a) => (
                    <div key={a.id} className="rounded-lg border border-rg-cream2/10 bg-rg-ink2/30 p-3">
                      <p className="font-rg-mono text-[10px] uppercase tracking-widest text-rg-gold/60">
                        {a.artifact_type}
                      </p>
                      <p className="mt-1 font-rg-mono text-[10px] text-rg-cream2/40">{fmtTime(a.created_at)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Phase log tail ── */}
        {phase_log.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold/70">Phase Log (last 30 events)</h2>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-rg-cream2/10 bg-rg-ink2/40 p-3">
              <table className="w-full font-rg-mono text-[10px] text-rg-cream2/70">
                <thead>
                  <tr className="border-b border-rg-cream2/10 text-left">
                    <th className="pb-1 pr-4 font-medium text-rg-gold/60">Time</th>
                    <th className="pb-1 pr-4 font-medium text-rg-gold/60">Stage</th>
                    <th className="pb-1 pr-4 font-medium text-rg-gold/60">Event</th>
                    <th className="pb-1 font-medium text-rg-gold/60">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {phase_log.map((entry, i) => (
                    <tr key={i} className="border-b border-rg-cream2/5">
                      <td className="py-0.5 pr-4 text-rg-cream2/40">{fmtTime(String(entry.at ?? ""))}</td>
                      <td className="py-0.5 pr-4 text-rg-gold/60">{String(entry.stage ?? "—")}</td>
                      <td className="py-0.5 pr-4 text-rg-cream">{String(entry.event ?? entry.label ?? "—")}</td>
                      <td className="py-0.5 text-rg-cream2/50">
                        {entry.artifact ? String(entry.artifact) : entry.duration_ms ? `${entry.duration_ms}ms` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between border-t border-rg-cream2/10 pt-4">
          <Link href="/admin" className="font-rg-mono text-xs text-rg-gold hover:underline">← Admin</Link>
          <Link href="/admin/eval-monitor" className="font-rg-mono text-xs text-rg-gold hover:underline">All jobs</Link>
          <Link href={`/admin/forensics/${job.id}`} className="font-rg-mono text-xs text-rg-cream2/50 hover:text-rg-gold">
            Forensics →
          </Link>
        </footer>

      </div>
    </main>
  );
}
