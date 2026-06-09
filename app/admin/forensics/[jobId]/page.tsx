"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StageResult = "pass" | "fail" | "skip" | "not_reached" | "retry_pass" | "retry_fail";

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
  canonCompliance: Array<{
    stage: string;
    authority: string;
    enforced: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resultBadge(result: StageResult) {
  switch (result) {
    case "pass":
      return "bg-green-50 text-green-900 ring-1 ring-green-200 font-bold";
    case "fail":
      return "bg-red-50 text-red-900 ring-1 ring-red-200 font-bold";
    case "retry_pass":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200 font-bold";
    case "retry_fail":
      return "bg-red-50 text-red-900 ring-1 ring-red-200 font-bold";
    case "skip":
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
    case "not_reached":
      return "bg-slate-50 text-slate-500 ring-1 ring-slate-200";
  }
}

function resultLabel(result: StageResult) {
  switch (result) {
    case "pass": return "✓ PASS";
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
  if (level === "error") return "text-red-800 font-semibold";
  if (level === "warn") return "text-amber-800 font-semibold";
  return "text-slate-700";
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
      <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
        <p className="font-medium text-slate-700">Loading forensic view…</p>
      </section>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4">
          <p className="font-semibold text-red-800">Error: {error}</p>
        </div>
        <Link href="/admin/jobs/dead-letter" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          ← Back to Dead Letter Queue
        </Link>
      </section>
    );
  }

  const { job, stages, artifacts, selfCorrection, qualityGateChecks, canonCompliance } = data;
  const failedStages = stages.filter((s) => s.result === "fail" || s.result === "retry_fail");
  const passedStages = stages.filter((s) => s.result === "pass" || s.result === "retry_pass");

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950 space-y-8">
      {/* Header */}
      <div>
        <Link href="/admin/pipeline-health" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          ← Back to Pipeline Health
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">SIPOC Forensic View</h1>
        <p className="mt-1 text-sm font-medium text-slate-700">
          Stage-by-stage trace for job <span className="font-mono text-blue-700">{job.id}</span>
        </p>
      </div>

      {/* Job Summary */}
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950 mb-3">Job Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Status</p>
            <p className={`mt-1 font-bold ${job.status === "failed" ? "text-red-800" : job.status === "complete" ? "text-green-800" : "text-blue-800"}`}>
              {job.status.toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Route</p>
            <p className="mt-1 font-semibold text-slate-900">{job.route ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Word Count</p>
            <p className="mt-1 font-semibold text-slate-900">{job.word_count?.toLocaleString() ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Chunks</p>
            <p className="mt-1 font-semibold text-slate-900">{job.chunks ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Created</p>
            <p className="mt-1 font-medium text-slate-800">{fmtDate(job.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Updated</p>
            <p className="mt-1 font-medium text-slate-800">{fmtDate(job.updated_at)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Failure Code</p>
            <p className="mt-1 font-mono text-xs font-semibold text-red-800">{job.failure_code ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Stages Passed</p>
            <p className="mt-1 font-bold text-slate-900">{passedStages.length}/{stages.length}</p>
          </div>
        </div>
        {job.last_error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-1">Last Error</p>
            <p className="text-sm font-semibold text-red-800 break-words">{job.last_error}</p>
          </div>
        )}
      </div>

      {/* Stage-by-Stage Progression */}
      <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-100 px-5 py-3 border-b border-slate-300">
          <h2 className="text-lg font-bold text-slate-950">Stage-by-Stage Progression</h2>
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            Click a stage to inspect logs, inputs, outputs, and gate results
          </p>
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap gap-1 px-5 py-3 border-b border-slate-200 bg-slate-50">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => toggleStage(stage.id)}
              className={`px-2 py-1 rounded text-xs ${resultBadge(stage.result)} cursor-pointer hover:opacity-80 transition-opacity`}
              title={`${stage.label}: ${resultLabel(stage.result)}`}
            >
              {stage.result === "pass" ? "✓" : stage.result === "fail" ? "✗" : stage.result === "retry_pass" ? "↻✓" : stage.result === "retry_fail" ? "↻✗" : "·"}
            </button>
          ))}
        </div>

        {/* Stage details table */}
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-slate-900">Stage</th>
              <th className="px-4 py-3 text-left font-bold text-slate-900">Result</th>
              <th className="px-4 py-3 text-left font-bold text-slate-900">Duration</th>
              <th className="px-4 py-3 text-left font-bold text-slate-900">Error</th>
              <th className="px-4 py-3 text-left font-bold text-slate-900">Authority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {stages.map((stage) => (
              <>
                <tr
                  key={stage.id}
                  onClick={() => toggleStage(stage.id)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <span className="mr-1 text-slate-400">{expandedStages.has(stage.id) ? "▼" : "▶"}</span>
                    {stage.label}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${resultBadge(stage.result)}`}>
                      {resultLabel(stage.result)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                    {fmtMs(stage.duration_ms)}
                  </td>
                  <td className="px-4 py-3">
                    {stage.error_code ? (
                      <span className="font-mono text-xs font-semibold text-red-800">{stage.error_code}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">{stage.authority}</td>
                </tr>

                {/* Expanded detail */}
                {expandedStages.has(stage.id) && (
                  <tr key={`${stage.id}-detail`}>
                    <td colSpan={5} className="px-6 py-4 bg-slate-50 border-l-4 border-blue-400">
                      <div className="space-y-3">
                        {/* Six-question standard */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-bold text-slate-700 uppercase tracking-wide">What entered?</p>
                            <p className="mt-0.5 text-slate-900">{stage.input_summary ?? "No input data captured"}</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-700 uppercase tracking-wide">What left?</p>
                            <p className="mt-0.5 text-slate-900">{stage.output_summary ?? "No output data captured"}</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-700 uppercase tracking-wide">What validates?</p>
                            <p className="mt-0.5 text-slate-900">{stage.authority}</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-700 uppercase tracking-wide">What repairs?</p>
                            <p className="mt-0.5 text-slate-900">
                              {stage.retry_attempted
                                ? `Retry: ${stage.retry_succeeded ? "succeeded" : "failed"}`
                                : "Self-correction policy (if gate fails)"}
                            </p>
                          </div>
                        </div>

                        {/* Error detail */}
                        {stage.error_detail && (
                          <div className="rounded border border-red-300 bg-red-50 p-3">
                            <p className="text-xs font-bold text-red-700 uppercase">Failure Detail</p>
                            <p className="mt-1 text-sm font-semibold text-red-800 break-words">{stage.error_detail}</p>
                          </div>
                        )}

                        {/* Stage logs */}
                        {stage.logs.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Audit Log ({stage.logs.length} entries)
                            </p>
                            <div className="max-h-48 overflow-y-auto rounded border border-slate-200 bg-white">
                              <table className="min-w-full text-xs">
                                <tbody className="divide-y divide-slate-100">
                                  {stage.logs.map((log, i) => (
                                    <tr key={i}>
                                      <td className="px-2 py-1 whitespace-nowrap font-medium text-slate-600">
                                        {new Date(log.created_at).toLocaleTimeString()}
                                      </td>
                                      <td className={`px-2 py-1 whitespace-nowrap ${logLevelStyle(log.level)}`}>
                                        {log.level.toUpperCase()}
                                      </td>
                                      <td className="px-2 py-1 text-slate-900">{log.message}</td>
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

      {/* Self-Correction Summary */}
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950 mb-3">Self-Correction Policy</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-center">
            <p className="text-2xl font-extrabold text-slate-950">{selfCorrection.attempts}</p>
            <p className="text-xs font-bold text-slate-700 uppercase">Attempts</p>
          </div>
          <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-center">
            <p className="text-2xl font-extrabold text-green-900">{selfCorrection.successes}</p>
            <p className="text-xs font-bold text-green-700 uppercase">Successes</p>
          </div>
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-center">
            <p className="text-2xl font-extrabold text-red-900">{selfCorrection.failures}</p>
            <p className="text-xs font-bold text-red-700 uppercase">Failures</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${selfCorrection.quarantined ? "border-amber-300 bg-amber-50" : "border-slate-300 bg-slate-50"}`}>
            <p className={`text-2xl font-extrabold ${selfCorrection.quarantined ? "text-amber-900" : "text-slate-400"}`}>
              {selfCorrection.quarantined ? "YES" : "NO"}
            </p>
            <p className="text-xs font-bold text-slate-700 uppercase">Quarantined</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${selfCorrection.fail_closed ? "border-red-300 bg-red-50" : "border-slate-300 bg-slate-50"}`}>
            <p className={`text-2xl font-extrabold ${selfCorrection.fail_closed ? "text-red-900" : "text-slate-400"}`}>
              {selfCorrection.fail_closed ? "YES" : "NO"}
            </p>
            <p className="text-xs font-bold text-slate-700 uppercase">Fail Closed</p>
          </div>
        </div>
        {selfCorrection.violation_codes.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold text-slate-700 uppercase mb-1">Violation Codes</p>
            <div className="flex flex-wrap gap-2">
              {selfCorrection.violation_codes.map((code) => (
                <span key={code} className="rounded bg-red-50 px-2 py-1 font-mono text-xs font-semibold text-red-800 ring-1 ring-red-200">
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quality Gate Checks */}
      {qualityGateChecks.length > 0 && (
        <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950 mb-3">Quality Gate Checks</h2>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-2 text-left font-bold text-slate-900">Check</th>
                <th className="px-4 py-2 text-left font-bold text-slate-900">Result</th>
                <th className="px-4 py-2 text-left font-bold text-slate-900">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {qualityGateChecks.map((check, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {(check.name ?? check.check_id ?? `Check ${i + 1}`) as string}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ring-1 ${
                      check.passed ? "bg-green-50 text-green-900 ring-green-200" : "bg-red-50 text-red-900 ring-red-200"
                    }`}>
                      {check.passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-800">
                    {(check.error_code ?? check.detail ?? check.message ?? "—") as string}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Canon Compliance */}
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950 mb-3">Canon Compliance</h2>
        <p className="text-xs font-medium text-slate-600 mb-3">
          Governance authority for each pipeline stage per SIPOC, Volume III, and Runtime Doctrine
        </p>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left font-bold text-slate-900">Stage</th>
              <th className="px-4 py-2 text-left font-bold text-slate-900">Authority</th>
              <th className="px-4 py-2 text-left font-bold text-slate-900">Enforced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {canonCompliance.map((c) => (
              <tr key={c.stage}>
                <td className="px-4 py-2 font-semibold text-slate-900">{c.stage}</td>
                <td className="px-4 py-2 text-xs font-medium text-slate-700">{c.authority}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ring-1 ${
                    c.enforced
                      ? "bg-green-50 text-green-900 ring-green-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}>
                    {c.enforced ? "YES" : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Artifacts */}
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950 mb-3">Artifacts Produced</h2>
        {artifacts.length === 0 ? (
          <p className="text-sm font-medium text-slate-700">No artifacts found for this job.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {artifacts.map((a, i) => (
              <span
                key={i}
                className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900"
                title={`Created: ${fmtDate(a.created_at)}`}
              >
                {a.type}
                <span className="ml-2 text-slate-500">{new Date(a.created_at).toLocaleTimeString()}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950 mb-3">Pipeline Timeline</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-900">Time</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-900">Event</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-900">Stage</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-900">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.timeline.map((evt, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-medium text-slate-600 whitespace-nowrap">
                      {evt.timestamp ? new Date(evt.timestamp as string).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-slate-900">{(evt.event ?? "—") as string}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-800">{(evt.stage ?? "—") as string}</td>
                    <td className="px-3 py-1.5 text-slate-700">
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
  );
}
