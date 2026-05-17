"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SipocStage {
  stageId: string;
  label: string;
  health: "green" | "red" | "gray";
  okCount: number;
  warningCount: number;
  failedCount: number;
  lastFailureCode: string | null;
  diagnosticGap: boolean;
}

interface HeatmapEntry {
  stageId: string;
  failureCode: string;
  count: number;
  lastSeenAt: string;
}

interface RecentJob {
  jobId: string;
  manuscriptId: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  phase: string | null;
  phaseStatus: string | null;
  manuscriptWords: number | null;
  route: string | null;
  chunkCount: number | null;
  errorCode: string | null;
  lastError: string | null;
  pipelineStage: string;
  durationMs: number | null;
  diagnosticStatus: "available" | "missing" | "blocked_by_307" | "not_applicable";
  // Section A — Pass 4
  crossCheckStatus: string | null;
  crossCheckError: string | null;
  crossCheckCompletedAt: string | null;
  // Section C — artifact coverage
  hasEvalV2: boolean;
  hasDream: boolean;
  hasPassDiag: boolean;
}

interface DreamPendingJob {
  jobId: string;
  title: string;
  wordCount: number;
  updatedAt: string;
}

interface DreamSynthesisData {
  pendingCount: number;
  coveredCount: number;
  lastSynthesizedAt: string | null;
  pendingJobs: DreamPendingJob[];
}

interface Summary {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  failureRate: number;
  avgRuntimeMs: number | null;
}

interface Diagnostics {
  allFailedJobsDiagnosticsAuditable: boolean;
  missingDiagnosticArtifactCount: number;
  missingProviderTraceCount: number | null;
  missingIntermediateOutputCount: number | null;
  note: string;
}

interface PipelineHealthFilters {
  showTestManuscripts: boolean;
  testManuscriptIdMin: number;
}

interface PipelineHealthData {
  generatedAt: string;
  window: string;
  summary: Summary;
  sipoc: SipocStage[];
  failureHeatmap: HeatmapEntry[];
  recentJobs: RecentJob[];
  dreamSynthesis?: DreamSynthesisData;
  diagnostics: Diagnostics;
  filters?: PipelineHealthFilters;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const base = "inline-block px-2 py-0.5 rounded text-xs font-medium";
  if (status === "complete") return `${base} bg-green-100 text-green-800`;
  if (status === "failed") return `${base} bg-red-100 text-red-800`;
  if (status === "running") return `${base} bg-blue-100 text-blue-800`;
  if (status === "queued") return `${base} bg-yellow-100 text-yellow-800`;
  return `${base} bg-gray-100 text-gray-800`;
}

function diagBadge(ds: RecentJob["diagnosticStatus"]) {
  const base = "inline-block px-2 py-0.5 rounded text-xs font-medium";
  if (ds === "available") return `${base} bg-green-100 text-green-800`;
  if (ds === "blocked_by_307") return `${base} bg-orange-100 text-orange-800`;
  if (ds === "missing") return `${base} bg-red-100 text-red-800`;
  return `${base} bg-gray-100 text-gray-500`;
}

function crossCheckBadge(status: string | null) {
  const base = "inline-block px-2 py-0.5 rounded text-xs font-medium";
  if (status === "completed") return `${base} bg-green-100 text-green-800`;
  if (status === "skipped") return `${base} bg-gray-100 text-gray-600`;
  if (status === "failed_soft") return `${base} bg-orange-100 text-orange-800`;
  if (status === null) return `${base} bg-red-100 text-red-700`;
  return `${base} bg-gray-100 text-gray-600`;
}

function artifactDot(has: boolean, isLongForm?: boolean) {
  if (isLongForm === false) return <span className="text-gray-300 text-xs">n/a</span>;
  return has ? (
    <span className="text-green-600 font-bold text-sm">✓</span>
  ) : (
    <span className="text-red-500 font-bold text-sm">✗</span>
  );
}

function healthDot(health: SipocStage["health"]) {
  if (health === "green") return "bg-green-500";
  if (health === "red") return "bg-red-500";
  return "bg-gray-300";
}

function fmtMs(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function truncateStr(s: string | null, maxLen: number = 50): string {
  if (!s) return "—";
  return s.length > maxLen ? s.substring(0, maxLen) + "…" : s;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PipelineHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<PipelineHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowParam, setWindowParam] = useState("24h");
  const [showTestManuscripts, setShowTestManuscripts] = useState(false);

  const fetchData = useCallback(
    (win: string, showTest: boolean) => {
      setLoading(true);
      setError(null);
      const showTestQs = showTest ? "&show_test=1" : "";
      fetch(`/api/admin/pipeline-health?window=${win}&limit=100${showTestQs}`)
        .then((res) => {
          if (res.status === 401 || res.status === 403) {
            router.replace("/evaluate");
            return null;
          }
          return res.json();
        })
        .then((json) => {
          if (!json) return;
          if (json.ok === false) {
            setError(json.error ?? "Unknown error");
            return;
          }
          setData(json as PipelineHealthData);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [router]
  );

  useEffect(() => {
    fetchData(windowParam, showTestManuscripts);
  }, [windowParam, showTestManuscripts, fetchData]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-gray-500">Loading pipeline health…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <p className="text-red-600 mb-2">Error: {error}</p>
        <Link href="/admin" className="text-blue-600 underline text-sm">
          ← Back to Admin
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const { summary, sipoc, failureHeatmap, recentJobs, diagnostics, dreamSynthesis } = data;
  const failedJobs = recentJobs.filter((j) => j.status === "failed");

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="mb-1">
            <Link href="/admin" className="text-blue-600 underline text-sm">
              ← Back to Admin
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">Pipeline Health</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Generated {fmtDate(data.generatedAt)} · Source: evaluation_jobs · Read-only
          </p>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {(["1h", "24h", "7d"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindowParam(w)}
                className={`px-3 py-1 rounded text-sm border ${
                  windowParam === w
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTestManuscripts}
              onChange={(e) => setShowTestManuscripts(e.target.checked)}
            />
            Show test manuscripts
            <span className="text-xs text-gray-400">
              (id ≥ {data.filters?.testManuscriptIdMin ?? 9000})
            </span>
          </label>
        </div>
      </div>

      {/* Summary bar */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: summary.totalJobs },
            { label: "Completed", value: summary.completedJobs },
            { label: "Failed", value: summary.failedJobs },
            { label: "In-flight", value: summary.runningJobs },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 p-4 text-center"
            >
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Failure rate:{" "}
          <span className={summary.failureRate > 0.1 ? "text-red-600 font-medium" : ""}>
            {(summary.failureRate * 100).toFixed(1)}%
          </span>
          {" "}over last {windowParam}
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section B — DREAM Synthesis Queue                                  */}
      {/* ------------------------------------------------------------------ */}
      {dreamSynthesis && (
        <section className="rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">DREAM Synthesis Queue</h2>
            <div className="flex gap-6 text-sm">
              <span>
                <span className="font-semibold text-gray-800">{dreamSynthesis.coveredCount}</span>
                <span className="text-gray-500 ml-1">long-form jobs with DREAM artifact</span>
              </span>
              <span>
                <span
                  className={`font-semibold ${
                    dreamSynthesis.pendingCount > 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {dreamSynthesis.pendingCount}
                </span>
                <span className="text-gray-500 ml-1">pending (no artifact yet)</span>
              </span>
            </div>
          </div>

          {dreamSynthesis.pendingCount > 0 && (
            <div className="rounded bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
              <strong>⚠ {dreamSynthesis.pendingCount} long-form job{dreamSynthesis.pendingCount !== 1 ? "s" : ""} complete but missing DREAM artifact</strong>
              {" "}— check <code className="font-mono text-xs bg-amber-100 px-1 rounded">process-dream</code> cron.
              If this count is stuck, the cron may be silently skipping jobs (see post-mortem{" "}
              <a
                href="https://github.com/Mmeraw/literary-ai-partner/issues/561"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                #561
              </a>
              ).
            </div>
          )}

          {dreamSynthesis.pendingCount === 0 && dreamSynthesis.coveredCount > 0 && (
            <div className="rounded bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              ✓ All complete long-form jobs have DREAM artifacts. Last synthesized:{" "}
              {dreamSynthesis.lastSynthesizedAt ? fmtDate(dreamSynthesis.lastSynthesizedAt) : "—"}
            </div>
          )}

          <div className="text-xs text-gray-500">
            Last DREAM synthesis:{" "}
            <span className="font-medium text-gray-700">
              {dreamSynthesis.lastSynthesizedAt ? fmtDate(dreamSynthesis.lastSynthesizedAt) : "Never"}
            </span>
            {" "}· Threshold: ≥25,000 words
          </div>

          {dreamSynthesis.pendingJobs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Job ID", "Title", "Word Count", "Completed At", "Report"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dreamSynthesis.pendingJobs.map((j) => (
                    <tr key={j.jobId} className="hover:bg-amber-50">
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {j.jobId.slice(0, 8)}…
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">{j.title}</td>
                      <td className="px-3 py-2 text-xs">
                        {j.wordCount.toLocaleString()} words
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(j.updatedAt)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Link
                          href={`/reports/${j.jobId}`}
                          className="text-blue-600 underline"
                          target="_blank"
                        >
                          /reports/{j.jobId.slice(0, 8)}…
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* SIPOC strip */}
      <section>
        <h2 className="text-lg font-semibold mb-3">SIPOC Pipeline Strip</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {sipoc.map((stage, idx) => (
              <div key={stage.stageId} className="flex items-stretch">
                <div
                  className={`border rounded-lg p-4 w-44 flex flex-col gap-1 ${
                    stage.health === "red"
                      ? "border-red-300 bg-red-50"
                      : stage.health === "green"
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthDot(
                        stage.health
                      )}`}
                    />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {stage.stageId}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>✓ {stage.okCount}</p>
                    <p className={stage.failedCount > 0 ? "text-red-600 font-medium" : ""}>
                      ✗ {stage.failedCount}
                    </p>
                    {stage.lastFailureCode && (
                      <p
                        className="truncate font-mono text-red-700"
                        title={stage.lastFailureCode}
                      >
                        {stage.lastFailureCode}
                      </p>
                    )}
                    {stage.diagnosticGap && (
                      <p className="text-orange-600 font-semibold">⚠ blocked_by_307</p>
                    )}
                  </div>
                </div>
                {idx < sipoc.length - 1 && (
                  <div className="flex items-center px-1 text-gray-400">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Failure heatmap */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Failure Heatmap{" "}
          <span className="text-sm font-normal text-gray-500">
            (stage × error_code)
          </span>
        </h2>
        {failureHeatmap.length === 0 ? (
          <p className="text-sm text-gray-500">No failures in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Stage</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Error Code</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Count</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failureHeatmap
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((entry) => (
                    <tr
                      key={`${entry.stageId}:${entry.failureCode}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{entry.stageId}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`font-mono text-xs ${
                            entry.failureCode.startsWith("QG_")
                              ? "text-orange-700 font-semibold"
                              : "text-red-700"
                          }`}
                        >
                          {entry.failureCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold">{entry.count}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {entry.lastSeenAt ? fmtDate(entry.lastSeenAt) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent failed jobs */}
      {failedJobs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Recent Failed Jobs{" "}
            <span className="text-sm font-normal text-gray-500">
              ({failedJobs.length})
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Job ID",
                    "Manuscript",
                    "Created",
                    "Updated",
                    "Stage",
                    "Error Code",
                    "Failure Detail",
                    "Phase",
                    "Phase Status",
                    "Words",
                    "Route",
                    "Chunks",
                    "Duration",
                    "Diagnostics",
                    "Pass 4",
                    "P4 Error",
                    "Artifacts",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failedJobs.map((job) => {
                  const isLongForm =
                    job.manuscriptWords !== null && job.manuscriptWords >= 25000;
                  return (
                    <tr key={job.jobId} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/evaluate/${job.jobId}`}
                          className="text-blue-600 underline"
                        >
                          {job.jobId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {job.manuscriptId ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(job.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(job.updatedAt)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{job.pipelineStage}</td>
                      <td className="px-3 py-2">
                        {job.errorCode ? (
                          <span
                            className={`font-mono text-xs ${
                              job.errorCode.startsWith("QG_")
                                ? "text-orange-700 font-semibold"
                                : "text-red-700"
                            }`}
                          >
                            {job.errorCode}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span title={job.lastError ?? "No detail available"}>
                          {truncateStr(job.lastError)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{job.phase ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{job.phaseStatus ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {job.manuscriptWords !== null ? job.manuscriptWords.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{job.route ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {job.chunkCount !== null ? job.chunkCount : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{fmtMs(job.durationMs)}</td>
                      <td className="px-3 py-2">
                        <span className={diagBadge(job.diagnosticStatus)}>
                          {job.diagnosticStatus}
                        </span>
                      </td>
                      {/* Section A — Pass 4 */}
                      <td className="px-3 py-2">
                        <span className={crossCheckBadge(job.crossCheckStatus)}>
                          {job.crossCheckStatus ?? "null"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-red-700">
                        {truncateStr(job.crossCheckError, 40)}
                      </td>
                      {/* Section C — artifacts */}
                      <td className="px-3 py-2 text-xs">
                        <div className="flex gap-1 items-center">
                          <span title="eval_v2">{artifactDot(job.hasEvalV2)}</span>
                          <span className="text-gray-300">|</span>
                          <span title="dream">{artifactDot(job.hasDream, isLongForm)}</span>
                          <span className="text-gray-300">|</span>
                          <span title="pass_diag">{artifactDot(job.hasPassDiag)}</span>
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">v2|drm|diag</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* All recent jobs — with Pass 4 + artifact coverage columns */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Recent Jobs{" "}
          <span className="text-sm font-normal text-gray-500">
            (last {recentJobs.length}, sorted by updated_at desc)
          </span>
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Job ID",
                  "Status",
                  "Created",
                  "Updated",
                  "Stage",
                  "Error Code",
                  "Failure Detail",
                  "Diagnostics",
                  "Duration",
                  "Pass 4",
                  "Artifacts",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentJobs.map((job) => {
                const isLongForm =
                  job.manuscriptWords !== null && job.manuscriptWords >= 25000;
                return (
                  <tr key={job.jobId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/evaluate/${job.jobId}`}
                        className="text-blue-600 underline"
                      >
                        {job.jobId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={statusBadge(String(job.status ?? ""))}>
                        {String(job.status ?? "")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(job.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(job.updatedAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{job.pipelineStage}</td>
                    <td className="px-3 py-2">
                      {job.errorCode ? (
                        <span
                          className={`font-mono text-xs ${
                            job.errorCode.startsWith("QG_")
                              ? "text-orange-700 font-semibold"
                              : "text-red-700"
                          }`}
                        >
                          {job.errorCode}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span title={job.lastError ?? "No detail available"}>
                        {truncateStr(job.lastError)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={diagBadge(job.diagnosticStatus)}>
                        {job.diagnosticStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{fmtMs(job.durationMs)}</td>
                    {/* Section A — Pass 4 status */}
                    <td className="px-3 py-2">
                      <span className={crossCheckBadge(job.crossCheckStatus)}>
                        {job.crossCheckStatus ?? "—"}
                      </span>
                    </td>
                    {/* Section C — artifact coverage */}
                    <td className="px-3 py-2 text-xs">
                      <div className="flex gap-1 items-center">
                        <span title="eval_v2">{artifactDot(job.hasEvalV2)}</span>
                        <span className="text-gray-300">|</span>
                        <span title="dream">{artifactDot(job.hasDream, isLongForm)}</span>
                        <span className="text-gray-300">|</span>
                        <span title="pass_diag">{artifactDot(job.hasPassDiag)}</span>
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">v2|drm|diag</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Diagnostics status */}
      <section className="rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-3">Diagnostics Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 font-medium">All failed jobs diagnostics auditable?</p>
            <p
              className={`text-sm font-semibold mt-0.5 ${
                diagnostics.allFailedJobsDiagnosticsAuditable ? "text-green-700" : "text-red-700"
              }`}
            >
              {diagnostics.allFailedJobsDiagnosticsAuditable ? "✓ Yes — all structured" : "✗ No — missing artifacts"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Jobs blocked_by_307</p>
            <p
              className={`text-sm font-semibold mt-0.5 ${
                diagnostics.missingDiagnosticArtifactCount > 0
                  ? "text-orange-700"
                  : "text-gray-700"
              }`}
            >
              {diagnostics.missingDiagnosticArtifactCount}
            </p>
          </div>
        </div>
        {diagnostics.missingDiagnosticArtifactCount > 0 && (
          <div className="mt-3 rounded bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
            <strong>Detailed diagnostics unavailable</strong> — blocked by{" "}
            <a
              href="https://github.com/Mmeraw/literary-ai-partner/issues/307"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Mmeraw/literary-ai-partner#307
            </a>
            . Criterion-level reconstruction and per-pair QG diagnostics are pending that
            issue&apos;s diagnostic persistence work.
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">{diagnostics.note}</p>
      </section>
    </main>
  );
}
