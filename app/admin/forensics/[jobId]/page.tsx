"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StageResult = "pass" | "inferred_pass" | "fail" | "skip" | "not_reached" | "retry_pass" | "retry_fail";

interface ForensicStage {
  id: string;
  label: string;
  authority: string;
  result: StageResult;
  duration_ms: number | null;
  error_code: string | null;
  error_detail: string | null;
  retry_attempted: boolean;
  retry_succeeded: boolean | null;
  input_summary: string | null;
  output_summary: string | null;
  logs: Array<{
    level: string;
    message: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
}

interface ForensicData {
  ok: boolean;
  job: {
    id: string;
    manuscript_id: string | null;
    job_type: string | null;
    status: string;
    phase: string | null;
    phase_status: string | null;
    failure_code: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
    word_count: number | null;
    route: string | null;
    chunks: number | null;
  };
  stages: ForensicStage[];
  artifacts: Array<{ type: string; created_at: string }>;
  timeline: Array<Record<string, unknown>>;
  selfCorrection: {
    attempts: number;
    successes: number;
    failures: number;
    quarantined: boolean;
    fail_closed: boolean;
    violation_codes: string[];
  };
  qualityGateChecks: Array<Record<string, unknown>>;
  failureDiagnosis: {
    artifact_type: "failure_diagnosis_v1";
    version: 1;
    job_id: string;
    created_at: string;
    phase: string | null;
    phase_status?: string | null;
    failure_code: string | null;
    failure_class:
      | "recoverable_exhausted"
      | "governance_blocked"
      | "system_error"
      | "artifact_write_error"
      | "forensic_write_warning"
      | "unknown";
    failure_point: {
      stage: string;
      gate?: string;
      artifact_type?: string;
      failed_check?: string;
    };
    user_safe_summary: string;
    admin_summary: string;
    developer_summary: string;
    failed_checks: string[];
    failed_criteria: string[];
    blocking_reasons: string[];
    score_caps?: Array<{
      criterion: string;
      original_score?: number;
      effective_score?: number;
      confidence?: number;
      reason?: string;
    }>;
    artifact_inventory: {
      last_successful_artifact?: string;
      first_missing_or_failed_artifact?: string;
      present_artifacts: string[];
      missing_expected_artifacts: string[];
    };
    repair_status: {
      attempted: boolean;
      mechanism?: string;
      used_source?: string;
      expected_source?: string;
      outcome?: "not_attempted" | "applied" | "failed" | "not_applicable";
    };
    backward_kick_status: {
      triggered: boolean;
      reason: string;
      retry_policy?: {
        max_retries?: number;
        retryable?: boolean;
        classification?: string;
      };
    };
    recommended_next_action: string;
    evidence_refs: Array<{
      artifact_type?: string;
      log_stage?: string;
      field_path?: string;
      excerpt?: string;
    }>;
  } | null;
  canonCompliance: Array<{
    stage: string;
    authority: string;
    enforced: boolean;
  }>;
  retryAnalytics: {
    policy_deployed: boolean;
    total_retry_attempts: number;
    retry_success_count: number;
    retry_failure_count: number;
    quarantine_count: number;
    fail_closed_count: number;
    top_violation_codes: string[];
    affected_stage: string | null;
    job_failure_code: string | null;
    retry_events: Array<{
      event: string;
      stage: string | null;
      result: string | null;
      reason: string | null;
      timestamp: string | null;
    }>;
  };
  contaminationTrace: Array<{
    criterion: string;
    index: number;
    action_preview: string;
    source_pass: number | null;
    created_stage: string;
    modified_stage: string | null;
    flagged_by: string | null;
    quarantined: boolean;
    quarantine_reason: string | null;
    integrity_tier: string | null;
    violation_codes: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resultBadge(result: StageResult) {
  switch (result) {
    case "pass":
      return "bg-green-50 text-green-900 ring-1 ring-green-400/30 font-bold";
    case "inferred_pass":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 font-semibold";
    case "fail":
      return "bg-red-50 text-red-300 ring-1 ring-red-400/30 font-bold";
    case "retry_pass":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-400/30 font-bold";
    case "retry_fail":
      return "bg-red-50 text-red-300 ring-1 ring-red-400/30 font-bold";
    case "skip":
      return "bg-rg-ink2/50 text-rg-cream2/60 ring-1 ring-slate-200";
    case "not_reached":
      return "bg-rg-ink2/50 text-rg-cream2/40 ring-1 ring-slate-200";
  }
}

function resultLabel(result: StageResult) {
  switch (result) {
    case "pass": return "✓ PASS";
    case "inferred_pass": return "⊛ INFERRED PASS";
    case "fail": return "✗ FAIL";
    case "retry_pass": return "↻ RETRY → PASS";
    case "retry_fail": return "↻ RETRY → FAIL";
    case "skip": return "— SKIP";
    case "not_reached": return "· NOT REACHED";
  }
}

function fmtMs(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function logLevelStyle(level: string) {
  if (level === "error") return "text-red-300 font-semibold";
  if (level === "warn") return "text-amber-800 font-semibold";
  return "text-rg-cream2/60";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForensicViewPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [data, setData] = useState<ForensicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/forensics/${jobId}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Unknown error");
      } else {
        setData(json as ForensicData);
        // Auto-expand failed stages
        const failedIds = (json as ForensicData).stages
          .filter((s: ForensicStage) => s.result === "fail" || s.result === "retry_fail")
          .map((s: ForensicStage) => s.id);
        setExpandedStages(new Set(failedIds));
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStage = (id: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-rg-cream2/70">Loading forensic view…</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-4">
            <p className="font-semibold text-red-300">Error: {error}</p>
          </div>
          <Link href="/admin/jobs/dead-letter" className="text-sm text-rg-gold underline">
            ← Back to Dead Letter Queue
          </Link>
        </div>
      </main>
    );
  }

  const { job, stages, artifacts, selfCorrection, retryAnalytics, qualityGateChecks, failureDiagnosis, canonCompliance, contaminationTrace } = data;
  const failedStages = stages.filter((s) => s.result === "fail" || s.result === "retry_fail");
  const passedStages = stages.filter((s) => s.result === "pass" || s.result === "inferred_pass" || s.result === "retry_pass");

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
    <section className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <Link href="/admin/pipeline-health" className="text-sm font-semibold text-rg-gold hover:text-rg-cream">
          ← Back to Pipeline Health
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-rg-cream">SIPOC Forensic View</h1>
        <p className="mt-1 text-sm font-medium text-rg-cream2/60">
          Stage-by-stage trace for job <span className="font-mono text-rg-gold">{job.id}</span>
        </p>
      </div>

      {/* Job Summary */}
      <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-rg-cream mb-3">Job Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Status</p>
            <p className={`mt-1 font-bold ${job.status === "failed" ? "text-red-300" : job.status === "complete" ? "text-green-800" : "text-blue-800"}`}>
              {job.status.toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Route</p>
            <p className="mt-1 font-semibold text-rg-cream">{job.route ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Word Count</p>
            <p className="mt-1 font-semibold text-rg-cream">{job.word_count?.toLocaleString() ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Chunks</p>
            <p className="mt-1 font-semibold text-rg-cream">{job.chunks ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Created</p>
            <p className="mt-1 font-medium text-rg-cream2/70">{fmtDate(job.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Updated</p>
            <p className="mt-1 font-medium text-rg-cream2/70">{fmtDate(job.updated_at)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Failure Code</p>
            <p className="mt-1 font-mono text-xs font-semibold text-red-300">{job.failure_code ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Stages Passed</p>
            <p className="mt-1 font-bold text-rg-cream">{passedStages.length}/{stages.length}</p>
          </div>
        </div>
        {job.last_error && (
          <div className="mt-4 rounded border border-red-400/30 bg-red-900/20 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-1">Last Error</p>
            <p className="text-sm font-semibold text-red-300 break-words">{job.last_error}</p>
          </div>
        )}
      </div>

      {failureDiagnosis && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-rg-cream">Failure Diagnosis</h2>
              <p className="mt-1 text-sm text-rg-cream2/70">{failureDiagnosis.admin_summary}</p>
            </div>
            <div className="text-right text-xs text-rg-cream2/60">
              <p>{fmtDate(failureDiagnosis.created_at)}</p>
              <p className="mt-1 font-mono text-red-300">{failureDiagnosis.failure_code ?? "—"}</p>
              <p className="mt-1 font-semibold text-amber-200">
                {failureDiagnosis.failure_class === "recoverable_exhausted"
                  ? "recoverable_exhausted"
                  : failureDiagnosis.failure_class}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Failure point</p>
                <p className="mt-1 text-sm font-semibold text-rg-cream">
                  {failureDiagnosis.failure_point.stage}
                  {failureDiagnosis.failure_point.gate ? ` · ${failureDiagnosis.failure_point.gate}` : ""}
                </p>
                {failureDiagnosis.failure_point.failed_check && (
                  <p className="mt-1 font-mono text-xs text-amber-200">{failureDiagnosis.failure_point.failed_check}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Recommended next action</p>
                <p className="mt-1 text-sm text-rg-cream">{failureDiagnosis.recommended_next_action}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Developer summary</p>
                <p className="mt-1 text-sm text-rg-cream2/80">{failureDiagnosis.developer_summary}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Checks / criteria</p>
                <p className="mt-1 text-sm text-rg-cream">
                  {(failureDiagnosis.failed_checks.length > 0 ? failureDiagnosis.failed_checks : failureDiagnosis.blocking_reasons).join(", ") || "—"}
                </p>
                {failureDiagnosis.failed_criteria.length > 0 && (
                  <p className="mt-1 text-xs text-rg-cream2/70">Criteria: {failureDiagnosis.failed_criteria.join(", ")}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Repair / backward kick</p>
                <p className="mt-1 text-sm text-rg-cream2/80">
                  Repair: {failureDiagnosis.repair_status.outcome ?? (failureDiagnosis.repair_status.attempted ? "attempted" : "not_attempted")}
                  {failureDiagnosis.repair_status.mechanism ? ` via ${failureDiagnosis.repair_status.mechanism}` : ""}
                </p>
                <p className="mt-1 text-sm text-rg-cream2/80">
                  Backward kick: {failureDiagnosis.backward_kick_status.triggered ? "triggered" : "not triggered"} — {failureDiagnosis.backward_kick_status.reason}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Artifact inventory</p>
                <p className="mt-1 text-xs text-rg-cream2/80">
                  Last successful: {failureDiagnosis.artifact_inventory.last_successful_artifact ?? "—"} · First missing/failed: {failureDiagnosis.artifact_inventory.first_missing_or_failed_artifact ?? "—"}
                </p>
                <p className="mt-1 text-xs text-rg-cream2/70">
                  Present: {failureDiagnosis.artifact_inventory.present_artifacts.join(", ") || "—"}
                </p>
              </div>
            </div>
          </div>

          {failureDiagnosis.score_caps && failureDiagnosis.score_caps.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-rg-cream2/50">Score caps</p>
              <div className="mt-2 space-y-2">
                {failureDiagnosis.score_caps.map((cap) => (
                  <div key={cap.criterion} className="rounded border border-rg-cream2/10 bg-rg-ink2/60 p-3 text-xs text-rg-cream2/80">
                    <p className="font-semibold text-rg-cream">{cap.criterion}</p>
                    <p>
                      original={cap.original_score ?? "—"} effective={cap.effective_score ?? "—"} confidence={cap.confidence ?? "—"}
                    </p>
                    {cap.reason && <p className="mt-1">{cap.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stage-by-Stage Progression */}
      <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 shadow-sm overflow-hidden">
        <div className="bg-rg-ink2 px-5 py-3 border-b border-rg-cream2/15">
          <h2 className="text-lg font-bold text-rg-cream">Stage-by-Stage Progression</h2>
          <p className="text-xs font-medium text-rg-cream2/50 mt-0.5">
            Click a stage to inspect logs, inputs, outputs, and gate results
          </p>
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap gap-1 px-5 py-3 border-b border-rg-cream2/10 bg-rg-ink2/50">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => toggleStage(stage.id)}
              className={`px-2 py-1 rounded text-xs ${resultBadge(stage.result)} cursor-pointer hover:opacity-80 transition-opacity`}
              title={`${stage.label}: ${resultLabel(stage.result)}`}
            >
              {stage.result === "pass" ? "✓" : stage.result === "inferred_pass" ? "⊛" : stage.result === "fail" ? "✗" : stage.result === "retry_pass" ? "↻✓" : stage.result === "retry_fail" ? "↻✗" : "·"}
            </button>
          ))}
        </div>

        {/* Stage details table */}
        <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
          <thead className="bg-rg-ink2">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-rg-cream">Stage</th>
              <th className="px-4 py-3 text-left font-bold text-rg-cream">Result</th>
              <th className="px-4 py-3 text-left font-bold text-rg-cream">Duration</th>
              <th className="px-4 py-3 text-left font-bold text-rg-cream">Error</th>
              <th className="px-4 py-3 text-left font-bold text-rg-cream">Authority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rg-cream2/10 bg-rg-ink2/70">
            {stages.map((stage) => (
              <>
                <tr
                  key={stage.id}
                  onClick={() => toggleStage(stage.id)}
                  className="cursor-pointer hover:bg-rg-ink2/50 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-rg-cream">
                    <span className="mr-1 text-slate-400">{expandedStages.has(stage.id) ? "▼" : "▶"}</span>
                    {stage.label}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${resultBadge(stage.result)}`}>
                      {resultLabel(stage.result)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-rg-cream2/70">
                    {fmtMs(stage.duration_ms)}
                  </td>
                  <td className="px-4 py-3">
                    {stage.error_code ? (
                      <span className="font-mono text-xs font-semibold text-red-300">{stage.error_code}</span>
                    ) : (
                      <span className="text-rg-cream2/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-rg-cream2/60">{stage.authority}</td>
                </tr>

                {/* Expanded detail */}
                {expandedStages.has(stage.id) && (
                  <tr key={`${stage.id}-detail`}>
                    <td colSpan={5} className="px-6 py-4 bg-rg-ink2/50 border-l-4 border-blue-400">
                      <div className="space-y-3">
                        {/* Six-question standard */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-bold text-rg-cream2/60 uppercase tracking-wide">What entered?</p>
                            <p className="mt-0.5 text-rg-cream">{stage.input_summary ?? "No input data captured"}</p>
                          </div>
                          <div>
                            <p className="font-bold text-rg-cream2/60 uppercase tracking-wide">What left?</p>
                            <p className="mt-0.5 text-rg-cream">{stage.output_summary ?? "No output data captured"}</p>
                          </div>
                          <div>
                            <p className="font-bold text-rg-cream2/60 uppercase tracking-wide">What validates?</p>
                            <p className="mt-0.5 text-rg-cream">{stage.authority}</p>
                          </div>
                          <div>
                            <p className="font-bold text-rg-cream2/60 uppercase tracking-wide">What repairs?</p>
                            <p className="mt-0.5 text-rg-cream">
                              {stage.retry_attempted
                                ? `Retry: ${stage.retry_succeeded ? "succeeded" : "failed"}`
                                : "Self-correction policy (if gate fails)"}
                            </p>
                          </div>
                        </div>

                        {/* Error detail */}
                        {stage.error_detail && (
                          <div className="rounded border border-red-400/30 bg-red-900/20 p-3">
                            <p className="text-xs font-bold text-red-700 uppercase">Failure Detail</p>
                            <p className="mt-1 text-sm font-semibold text-red-300 break-words">{stage.error_detail}</p>
                          </div>
                        )}

                        {/* Stage logs */}
                        {stage.logs.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-rg-cream2/60 uppercase tracking-wide mb-1">
                              Audit Log ({stage.logs.length} entries)
                            </p>
                            <div className="max-h-48 overflow-y-auto rounded border border-rg-cream2/10 bg-rg-ink2/70">
                              <table className="min-w-full text-xs">
                                <tbody className="divide-y divide-slate-100">
                                  {stage.logs.map((log, i) => (
                                    <tr key={i}>
                                      <td className="px-2 py-1 whitespace-nowrap font-medium text-rg-cream2/50">
                                        {new Date(log.created_at).toLocaleTimeString()}
                                      </td>
                                      <td className={`px-2 py-1 whitespace-nowrap ${logLevelStyle(log.level)}`}>
                                        {log.level.toUpperCase()}
                                      </td>
                                      <td className="px-2 py-1 text-rg-cream">{log.message}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Retry/Quarantine Analytics */}
      <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-rg-cream mb-3">Retry / Quarantine Analytics</h2>
        <p className="text-xs font-medium text-rg-cream2/50 mb-3">
          Self-correction telemetry: retry attempts, success/failure rates, quarantine decisions, and fail-closed status
        </p>

        {/* Three-state empty logic: Not measured / Measured: no violations / Measured: action taken */}
        {(() => {
          const hasActivity = retryAnalytics.total_retry_attempts > 0 ||
            retryAnalytics.quarantine_count > 0 ||
            retryAnalytics.fail_closed_count > 0 ||
            retryAnalytics.retry_events.length > 0;

          if (!hasActivity && !retryAnalytics.policy_deployed) {
            // State 1: Pre-policy — NOT MEASURED
            return (
              <div className="rounded border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                <p className="text-sm font-bold text-amber-900">
                  ⚠ Not measured
                </p>
                <p className="mt-1 text-xs font-medium text-amber-800">
                  No self-correction telemetry exists for this job. This job completed before the self-correction policy was deployed. Empty does not mean clean.
                </p>
              </div>
            );
          }

          if (!hasActivity && retryAnalytics.policy_deployed) {
            // State 2: Post-policy, no violations — MEASURED: CLEAN
            return (
              <div className="rounded border border-green-200 bg-green-50 px-4 py-5 text-center">
                <p className="text-sm font-bold text-green-900">
                  Measured: no retryable violations
                </p>
                <p className="mt-1 text-xs font-medium text-green-800">
                  Self-correction policy was active for this job. No gate violations triggered retry or quarantine actions.
                </p>
              </div>
            );
          }

          // State 3: Has activity — show full metrics
          return null;
        })() || (
          <>
            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50 p-3 text-center">
                <p className="text-2xl font-extrabold text-rg-cream">{retryAnalytics.total_retry_attempts}</p>
                <p className="text-xs font-bold text-rg-cream2/60 uppercase tracking-wide">Retry Attempts</p>
              </div>
              <div className="rounded-lg border border-green-400/30 bg-green-900/20 p-3 text-center">
                <p className="text-2xl font-extrabold text-green-900">{retryAnalytics.retry_success_count}</p>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Successes</p>
              </div>
              <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-3 text-center">
                <p className="text-2xl font-extrabold text-red-300">{retryAnalytics.retry_failure_count}</p>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Failures</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${retryAnalytics.quarantine_count > 0 ? "border-amber-400/30 bg-amber-900/20" : "border-rg-cream2/15 bg-rg-ink2/50"}`}>
                <p className={`text-2xl font-extrabold ${retryAnalytics.quarantine_count > 0 ? "text-amber-900" : "text-slate-400"}`}>
                  {retryAnalytics.quarantine_count}
                </p>
                <p className="text-xs font-bold text-rg-cream2/60 uppercase tracking-wide">Quarantined</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${retryAnalytics.fail_closed_count > 0 ? "border-red-400/30 bg-red-900/20" : "border-rg-cream2/15 bg-rg-ink2/50"}`}>
                <p className={`text-2xl font-extrabold ${retryAnalytics.fail_closed_count > 0 ? "text-red-300" : "text-slate-400"}`}>
                  {retryAnalytics.fail_closed_count}
                </p>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Fail Closed</p>
              </div>
            </div>

            {/* Success rate bar */}
            {retryAnalytics.total_retry_attempts > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs font-semibold text-rg-cream2/60 mb-1">
                  <span>Retry Success Rate</span>
                  <span>{Math.round((retryAnalytics.retry_success_count / retryAnalytics.total_retry_attempts) * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-green-600"
                    style={{ width: `${(retryAnalytics.retry_success_count / retryAnalytics.total_retry_attempts) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Affected stage + failure code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {retryAnalytics.affected_stage && (
                <div className="rounded border border-rg-cream2/10 bg-rg-ink2/50 p-3">
                  <p className="text-xs font-bold text-rg-cream2/50 uppercase mb-1">Affected Stage</p>
                  <p className="text-sm font-semibold text-rg-cream">{retryAnalytics.affected_stage.replace(/_/g, " ")}</p>
                </div>
              )}
              {retryAnalytics.job_failure_code && (
                <div className="rounded border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-bold text-red-700 uppercase mb-1">Failure Code</p>
                  <span className="inline-block rounded bg-red-900/30 px-2 py-1 font-mono text-xs font-bold text-red-300 ring-1 ring-red-400/30">
                    {retryAnalytics.job_failure_code}
                  </span>
                </div>
              )}
            </div>

            {/* Top violation codes */}
            {retryAnalytics.top_violation_codes.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-rg-cream2/60 uppercase mb-2">Top Violation Codes</p>
                <div className="flex flex-wrap gap-2">
                  {retryAnalytics.top_violation_codes.map((code) => (
                    <span key={code} className="rounded bg-red-50 px-2 py-1 font-mono text-xs font-semibold text-red-300 ring-1 ring-red-400/30">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Retry event log */}
            {retryAnalytics.retry_events.length > 0 && (
              <div>
                <p className="text-xs font-bold text-rg-cream2/60 uppercase mb-2">Retry Event Log</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-rg-cream2/10 text-xs">
                    <thead className="bg-rg-ink2">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-rg-cream">Event</th>
                        <th className="px-3 py-2 text-left font-bold text-rg-cream">Stage</th>
                        <th className="px-3 py-2 text-left font-bold text-rg-cream">Result</th>
                        <th className="px-3 py-2 text-left font-bold text-rg-cream">Reason</th>
                        <th className="px-3 py-2 text-left font-bold text-rg-cream">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-rg-ink2/70">
                      {retryAnalytics.retry_events.map((evt, i) => (
                        <tr key={i} className={evt.result === "failure" ? "bg-red-50" : evt.result === "success" ? "bg-green-50" : ""}>
                          <td className="px-3 py-2 font-mono font-semibold text-rg-cream">{evt.event}</td>
                          <td className="px-3 py-2 text-rg-cream2/70">{evt.stage ?? "—"}</td>
                          <td className="px-3 py-2">
                            {evt.result === "success" ? (
                              <span className="rounded bg-green-100 px-2 py-0.5 font-bold text-green-900 ring-1 ring-green-300">SUCCESS</span>
                            ) : evt.result === "failure" ? (
                              <span className="rounded bg-red-900/30 px-2 py-0.5 font-bold text-red-300 ring-1 ring-red-300">FAILURE</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-rg-cream2/70 max-w-xs truncate">{evt.reason ?? "—"}</td>
                          <td className="px-3 py-2 text-rg-cream2/50 whitespace-nowrap">
                            {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quality Gate Checks */}
      {qualityGateChecks.length > 0 && (
        <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-rg-cream mb-3">Quality Gate Checks</h2>
          <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
            <thead className="bg-rg-ink2">
              <tr>
                <th className="px-4 py-2 text-left font-bold text-rg-cream">Check</th>
                <th className="px-4 py-2 text-left font-bold text-rg-cream">Result</th>
                <th className="px-4 py-2 text-left font-bold text-rg-cream">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rg-cream2/10 bg-rg-ink2/70">
              {qualityGateChecks.map((check, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-semibold text-rg-cream">
                    {(check.name ?? check.check_id ?? `Check ${i + 1}`) as string}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ring-1 ${
                      check.passed ? "bg-green-50 text-green-900 ring-green-400/30" : "bg-red-50 text-red-300 ring-red-400/30"
                    }`}>
                      {check.passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-rg-cream2/70">
                    {(check.error_code ?? check.detail ?? check.message ?? "—") as string}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Canon Compliance */}
      <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-rg-cream mb-3">Canon Compliance</h2>
        <p className="text-xs font-medium text-rg-cream2/50 mb-3">
          Governance authority for each pipeline stage per SIPOC, Volume III, and Runtime Doctrine
        </p>
        <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
          <thead className="bg-rg-ink2">
            <tr>
              <th className="px-4 py-2 text-left font-bold text-rg-cream">Stage</th>
              <th className="px-4 py-2 text-left font-bold text-rg-cream">Authority</th>
              <th className="px-4 py-2 text-left font-bold text-rg-cream">Enforced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rg-cream2/10 bg-rg-ink2/70">
            {canonCompliance.map((c) => (
              <tr key={c.stage}>
                <td className="px-4 py-2 font-semibold text-rg-cream">{c.stage}</td>
                <td className="px-4 py-2 text-xs font-medium text-rg-cream2/60">{c.authority}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ring-1 ${
                    c.enforced
                      ? "bg-green-50 text-green-900 ring-green-400/30"
                      : "bg-rg-ink2 text-rg-cream2/50 ring-slate-200"
                  }`}>
                    {c.enforced ? "YES" : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contamination Trace */}
      {contaminationTrace && contaminationTrace.length > 0 && (
        <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-rg-cream mb-3">Contamination Trace</h2>
          <p className="text-xs font-medium text-rg-cream2/50 mb-3">
            Per-recommendation lifecycle: where each recommendation was created, modified, flagged, or quarantined
          </p>

          {/* Pre-gate disclaimer: when no quarantine metadata exists */}
          {contaminationTrace.every((r) => !r.quarantined && !r.flagged_by && r.source_pass === null) && (
            <div className="mb-4 rounded border border-amber-400/30 bg-amber-900/20 px-4 py-3">
              <p className="text-xs font-semibold text-amber-900">
                ⚠ No quarantine metadata recorded for this evaluation. This may reflect a pre-integrity-gate artifact, not proof that all recommendations met current quality standards.
              </p>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded border border-rg-cream2/10 bg-rg-ink2/50 p-3 text-center">
              <div className="text-2xl font-extrabold text-rg-cream">{contaminationTrace.length}</div>
              <div className="text-xs font-semibold text-rg-cream2/50 uppercase tracking-wide">Total Recs</div>
            </div>
            <div className="rounded border border-green-200 bg-green-50 p-3 text-center">
              <div className="text-2xl font-extrabold text-green-900">
                {contaminationTrace.filter((r) => !r.quarantined && !r.flagged_by).length}
              </div>
              <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Clean</div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-center">
              <div className="text-2xl font-extrabold text-amber-900">
                {contaminationTrace.filter((r) => r.flagged_by && !r.quarantined).length}
              </div>
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Flagged</div>
            </div>
            <div className="rounded border border-red-200 bg-red-50 p-3 text-center">
              <div className="text-2xl font-extrabold text-red-300">
                {contaminationTrace.filter((r) => r.quarantined).length}
              </div>
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Quarantined</div>
            </div>
          </div>

          {/* Trace table */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-rg-cream2/10 text-xs">
              <thead className="bg-rg-ink2 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Criterion</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Action</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Created</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Modified</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Flagged</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-rg-ink2/70">
                {contaminationTrace.map((rec, i) => (
                  <tr key={i} className={rec.quarantined ? "bg-red-50" : rec.flagged_by ? "bg-amber-50" : ""}>
                    <td className="px-3 py-2 font-mono font-semibold text-rg-cream whitespace-nowrap">
                      {rec.criterion}
                    </td>
                    <td className="px-3 py-2 text-rg-cream2/70 max-w-xs truncate" title={rec.action_preview}>
                      {rec.action_preview}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-800 ring-1 ring-blue-200">
                        {rec.created_stage.replace(/_/g, " ")}
                        {rec.source_pass && <span className="ml-1 text-blue-600">(P{rec.source_pass})</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {rec.modified_stage ? (
                        <span className="rounded bg-purple-50 px-2 py-0.5 font-semibold text-purple-800 ring-1 ring-purple-200">
                          {rec.modified_stage.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {rec.flagged_by ? (
                        <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-400/30">
                          {rec.flagged_by}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {rec.quarantined ? (
                        <span className="rounded bg-red-900/30 px-2 py-0.5 font-bold text-red-300 ring-1 ring-red-300">
                          QUARANTINED
                        </span>
                      ) : rec.flagged_by ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900 ring-1 ring-amber-300">
                          FLAGGED
                        </span>
                      ) : (
                        <span className="rounded bg-green-100 px-2 py-0.5 font-bold text-green-900 ring-1 ring-green-300">
                          CLEAN
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quarantine details (expanded for quarantined recs) */}
          {contaminationTrace.some((r) => r.quarantined) && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-bold text-red-300 mb-2">Quarantined Recommendations</h3>
              <div className="space-y-2">
                {contaminationTrace
                  .filter((r) => r.quarantined)
                  .map((rec, i) => (
                    <div key={i} className="rounded border border-red-200 bg-rg-ink2/70 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-red-300">{rec.criterion}</span>
                        {rec.integrity_tier && (
                          <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-bold text-red-300 ring-1 ring-red-400/30">
                            Tier: {rec.integrity_tier}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rg-cream2/70 truncate mb-1" title={rec.action_preview}>
                        {rec.action_preview}
                      </p>
                      {rec.quarantine_reason && (
                        <p className="text-xs font-semibold text-red-300">
                          Reason: {rec.quarantine_reason}
                        </p>
                      )}
                      {rec.violation_codes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rec.violation_codes.map((code, ci) => (
                            <span key={ci} className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-mono font-semibold text-red-300">
                              {code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Artifacts */}
      <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-rg-cream mb-3">Artifacts Produced</h2>
        {artifacts.length === 0 ? (
          <p className="text-sm font-medium text-rg-cream2/60">No artifacts found for this job.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {artifacts.map((a, i) => (
              <span
                key={i}
                className="rounded border border-rg-cream2/15 bg-rg-ink2/50 px-3 py-1.5 text-xs font-semibold text-rg-cream"
                title={`Created: ${fmtDate(a.created_at)}`}
              >
                {a.type}
                <span className="ml-2 text-rg-cream2/40">{new Date(a.created_at).toLocaleTimeString()}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-rg-cream mb-3">Pipeline Timeline</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-rg-ink2 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Time</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Event</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Stage</th>
                  <th className="px-3 py-2 text-left font-bold text-rg-cream">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.timeline.map((evt, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-medium text-rg-cream2/50 whitespace-nowrap">
                      {evt.timestamp ? new Date(evt.timestamp as string).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-rg-cream">{(evt.event ?? "—") as string}</td>
                    <td className="px-3 py-1.5 font-mono text-rg-cream2/70">{(evt.stage ?? "—") as string}</td>
                    <td className="px-3 py-1.5 text-rg-cream2/60">
                      {evt.reason ? (evt.reason as string) : evt.result ? (evt.result as string) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
    </main>
  );
}
