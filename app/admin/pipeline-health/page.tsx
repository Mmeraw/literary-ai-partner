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
  pipelineStage: string;
  durationMs: number | null;
  diagnosticStatus: "available" | "missing" | "blocked_by_307" | "not_applicable";
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
  phase27FailuresAuditable: boolean;
  missingDiagnosticArtifactCount: number;
  missingProviderTraceCount: number | null;
  missingIntermediateOutputCount: number | null;
  note: string;
}

interface PipelineHealthData {
  generatedAt: string;
  window: string;
  summary: Summary;
  sipoc: SipocStage[];
  failureHeatmap: HeatmapEntry[];
  recentJobs: RecentJob[];
  diagnostics: Diagnostics;
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
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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

  const fetchData = useCallback(
    (win: string) => {
      setLoading(true);
      setError(null);
      fetch(`/api/admin/pipeline-health?window=${win}&limit=100`)
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
    fetchData(windowParam);
  }, [windowParam, fetchData]);

  // --- Loading ---
  if (loading) {
    return (
      <main className="p-6">
        <p className="text-gray-500">Loading pipeline health…</p>
      </main>
    );
  }

  // --- Error ---
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

  const { summary, sipoc, failureHeatmap, recentJobs, diagnostics } = data;
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

        {/* Window selector */}
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
                    "Stage",
                    "Error Code",
                    "Phase",
                    "Phase Status",
                    "Words",
                    "Route",
                    "Chunks",
                    "Duration",
                    "Diagnostics",
                    "Updated",
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
                {failedJobs.map((job) => (
                  <tr key={job.jobId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/admin/jobs/${job.jobId}`}
                        className="text-blue-600 underline"
                      >
                        {job.jobId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {job.manuscriptId ?? "—"}
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
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(job.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* All recent jobs */}
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
                {["Job ID", "Status", "Stage", "Error Code", "Diagnostics", "Duration", "Updated"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentJobs.map((job) => (
                <tr key={job.jobId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/admin/jobs/${job.jobId}`}
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
                  <td className="px-3 py-2">
                    <span className={diagBadge(job.diagnosticStatus)}>
                      {job.diagnosticStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtMs(job.durationMs)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(job.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Diagnostics status */}
      <section className="rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-3">Diagnostics Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 font-medium">Phase-27 failures auditable?</p>
            <p
              className={`text-sm font-semibold mt-0.5 ${
                diagnostics.phase27FailuresAuditable ? "text-green-700" : "text-red-700"
              }`}
            >
              {diagnostics.phase27FailuresAuditable ? "✓ Yes — all structured" : "✗ No — missing artifacts"}
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
