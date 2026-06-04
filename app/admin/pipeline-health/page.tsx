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
  // Section D — restart tracking
  attemptCount: number;
  maxAttempts: number;
  restartedFrom: string | null;
  restartReason: string | null;
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
  // Restart metrics
  totalRestarts: number;
  restartedJobCount: number;
  restartRate: number;
  restartsByStage: Record<string, number>;
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
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const fetchData = useCallback(
    (win: string, showTest: boolean, isAutoRefresh = false) => {
      if (!isAutoRefresh) {
        setLoading(true);
      }
      if (!isAutoRefresh) setError(null);
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
            if (!isAutoRefresh) setError(json.error ?? "Unknown error");
            setRefreshFailed(true);
            return;
          }
          setData(json as PipelineHealthData);
          setLastRefreshedAt(new Date());
          setRefreshFailed(false);
        })
        .catch((err: Error) => {
          if (!isAutoRefresh) setError(err.message);
          setRefreshFailed(true);
        })
        .finally(() => {
          if (!isAutoRefresh) setLoading(false);
        });
    },
    [router]
  );

  useEffect(() => {
    fetchData(windowParam, showTestManuscripts);
  }, [windowParam, showTestManuscripts, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(windowParam, showTestManuscripts, true);
    }, 30_000);
    return () => clearInterval(interval);
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Pipeline Health</h1>
            {/* Big pulsing status light */}
            <div className="relative flex items-center gap-2">
              <span className="relative flex h-5 w-5">
                {!refreshFailed && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-5 w-5 rounded-full ${
                    refreshFailed ? "bg-red-500" : "bg-green-500"
                  }`}
                />
              </span>
              <span className={`text-sm font-semibold ${refreshFailed ? "text-red-600" : "text-green-600"}`}>
                {refreshFailed ? "STALLED" : "LIVE"}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Generated {fmtDate(data.generatedAt)} · Source: evaluation_jobs · Read-only
            {lastRefreshedAt && (
              <span> · Auto-refreshing every 30s (last: {lastRefreshedAt.toLocaleTimeString()})</span>
            )}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Total", value: summary.totalJobs },
            { label: "Completed", value: summary.completedJobs },
            { label: "Failed", value: summary.failedJobs },
            { label: "In-flight", value: summary.runningJobs },
            { label: "Restarted", value: summary.restartedJobCount ?? 0 },
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
          {" | "}Restart rate:{" "}
          <span className={(summary.restartRate ?? 0) > 0.2 ? "text-orange-600 font-medium" : ""}>
            {((summary.restartRate ?? 0) * 100).toFixed(1)}%
          </span>
          {" | "}Total restarts: {summary.totalRestarts ?? 0}
          {" "}over last {windowParam}
        </p>

        {/* Restarts by Stage breakdown — only show when restarts exist */}
        {(summary.totalRestarts ?? 0) > 0 && summary.restartsByStage && (
          <div className="mt-3 p-3 bg-orange-50 rounded-md border border-orange-200">
            <p className="text-xs font-semibold text-orange-800 mb-1">Restarts by Stage</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(summary.restartsByStage)
                .sort(([, a], [, b]) => b - a)
                .map(([stage, count]) => (
                  <span key={stage} className="inline-flex items-center gap-1 text-orange-700">
                    <span className="font-mono">{stage}</span>
                    <span className="font-bold">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section B — Narrative Synthesis Queue                              */}
      {/* ------------------------------------------------------------------ */}
      {dreamSynthesis && (
        <section className="rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Narrative Synthesis Queue</h2>
            <div className="flex gap-6 text-sm">
              <span>
                <span className="font-semibold text-gray-800">{dreamSynthesis.coveredCount}</span>
                <span className="text-gray-500 ml-1">long-form jobs with synthesis artifact</span>
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
              <strong>⚠ {dreamSynthesis.pendingCount} long-form job{dreamSynthesis.pendingCount !== 1 ? "s" : ""} complete but missing Narrative Synthesis artifact</strong>
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
              ✓ All complete long-form jobs have Narrative Synthesis artifacts. Last synthesized:{" "}
              {dreamSynthesis.lastSynthesizedAt ? fmtDate(dreamSynthesis.lastSynthesizedAt) : "—"}
            </div>
          )}

          <div className="text-xs text-gray-500">
            Last Narrative Synthesis:{" "}
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
                  "Restarts",
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
                    {/* Section D — restart tracking */}
                    <td className="px-3 py-2 text-xs">
                      {job.attemptCount > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            job.attemptCount >= 3 ? "text-red-700" : "text-orange-600"
                          }`}
                          title={`Restarted from: ${job.restartedFrom ?? "unknown"}\nReason: ${job.restartReason ?? "unknown"}\nAttempt ${job.attemptCount}/${job.maxAttempts}`}
                        >
                          ↻ {job.attemptCount}/{job.maxAttempts}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
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

      {/* Legend */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Legend</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          {/* Job Statuses */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Job Status</h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">complete</span>
                <span className="text-gray-600 dark:text-gray-300">Evaluation finished successfully</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">running</span>
                <span className="text-gray-600 dark:text-gray-300">Job actively executing in pipeline</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">queued</span>
                <span className="text-gray-600 dark:text-gray-300">Waiting for execution slot</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">failed</span>
                <span className="text-gray-600 dark:text-gray-300">Pipeline errored — see Error Code</span>
              </li>
            </ul>
          </div>

          {/* SIPOC Pipeline Stages */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">SIPOC Pipeline Stages</h3>
            <ul className="space-y-1.5 text-gray-600 dark:text-gray-300">
              <li><strong>intake</strong> — manuscript received, validated</li>
              <li><strong>routing_chunking</strong> — word count routing + chunk splitting</li>
              <li><strong>phase_0_5a_seed</strong> — Phase 0.5a: story map seed generation (full-context story ledger)</li>
              <li><strong>phase_0_5b_seed</strong> — Phase 0.5b: DREAM editorial seed (editorial calibration baseline)</li>
              <li><strong>pass1a_validation</strong> — Phase 1a: seed guard validation (seed integrity + completeness gate)</li>
              <li><strong>pass1_craft</strong> — Pass 1: criteria analysis per chunk</li>
              <li><strong>pass2_editorial</strong> — Pass 2: cross-chunk editorial synthesis</li>
              <li><strong>pass3_synthesis</strong> — Pass 3: final scores + recommendations</li>
              <li><strong>quality_gate</strong> — Pass 4: validation + cross-check adjudication</li>
              <li><strong>persistence_report</strong> — results written to database</li>
            </ul>
          </div>

          {/* SIPOC Stage Health */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">SIPOC Stage Health</h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600 dark:text-gray-300">All jobs passed this stage</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-600 dark:text-gray-300">One or more jobs failed at this stage</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-gray-300" />
                <span className="text-gray-600 dark:text-gray-300">No jobs reached this stage in window</span>
              </li>
              <li className="flex items-center gap-2 mt-1">
                <span className="text-green-600 font-bold text-sm">✓</span>
                <span className="text-gray-600 dark:text-gray-300">OK count (passed)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500 font-bold text-sm">✗</span>
                <span className="text-gray-600 dark:text-gray-300">Failed count</span>
              </li>
            </ul>
          </div>

          {/* Artifacts */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Artifacts (v2 | drm | diag)</h3>
            <ul className="space-y-1.5 text-gray-600 dark:text-gray-300">
              <li><strong>v2</strong> — EvaluationResultV2 (structured scores, criteria, recommendations)</li>
              <li><strong>drm</strong> — DREAM long-form narrative synthesis document (n/a for short-form)</li>
              <li><strong>diag</strong> — Pass diagnostics (internal quality/governance traces)</li>
              <li className="flex items-center gap-2 mt-1">
                <span className="text-green-600 font-bold text-sm">✓</span>
                <span>Artifact persisted</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500 font-bold text-sm">✗</span>
                <span>Artifact missing (expected after completion)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300 text-xs">n/a</span>
                <span>Not applicable (e.g. DREAM for short-form)</span>
              </li>
            </ul>
          </div>

          {/* Diagnostics */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Diagnostics Status</h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">available</span>
                <span className="text-gray-600 dark:text-gray-300">Full diagnostic trace present</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">blocked_by_307</span>
                <span className="text-gray-600 dark:text-gray-300">Blocked by issue #307 persistence work</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">missing</span>
                <span className="text-gray-600 dark:text-gray-300">Diagnostic artifact not found</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">not_applicable</span>
                <span className="text-gray-600 dark:text-gray-300">Job type does not produce diagnostics</span>
              </li>
            </ul>
          </div>

          {/* Pass 4 (Cross-Check) */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Pass 4 (Cross-Check)</h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">completed</span>
                <span className="text-gray-600 dark:text-gray-300">External adjudication verified scores</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">skipped</span>
                <span className="text-gray-600 dark:text-gray-300">Cross-check not required for this mode</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">failed_soft</span>
                <span className="text-gray-600 dark:text-gray-300">Cross-check failed but non-blocking</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">—</span>
                <span className="text-gray-600 dark:text-gray-300">Not yet reached or data unavailable</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Restart Tracking */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Restart Tracking</h3>
          <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <span className="text-orange-600 font-medium">↻ 1/11</span>
              <span>Job restarted 1 time out of max 11 attempts (orange = 1–2 restarts)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-700 font-medium">↻ 3/11</span>
              <span>3+ restarts — possible pipeline instability at that stage (red = 3+ restarts)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-400">—</span>
              <span>No restarts — ran successfully on first attempt</span>
            </li>
            <li className="mt-2 text-gray-500 dark:text-gray-400 text-xs">Hover the restart badge for: restarted-from stage, reason, and attempt number. Common reasons: orphan_rescue (timeout), self-chain resume, crash recovery.</li>
          </ul>
        </div>

        {/* Live indicator legend */}
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Status Indicator</h3>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500" />
              </span>
              <span className="text-gray-600 dark:text-gray-300"><strong>LIVE</strong> — page auto-refreshes every 30 seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 rounded-full bg-red-500" />
              <span className="text-gray-600 dark:text-gray-300"><strong>STALLED</strong> — refresh failed, data may be stale</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
