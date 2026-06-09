/**
 * Admin Diagnostics Dashboard
 * 
 * Route: /admin/diagnostics
 * 
 * Provides real-time observability metrics:
 * - Jobs by status
 * - Failed jobs (last 24h)
 * - Average processing time
 * - Retry success rate
 * - Phase timing metrics
 * - Recent failures
 * 
 * Part of Phase A.4: Observability & Operator Confidence
 * 
 * @see docs/PHASE_A4_OBSERVABILITY.md
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DiagnosticsSnapshot {
  jobsByStatus: {
    queued: number;
    running: number;
    complete: number;
    failed: number;
  };
  failedJobsLast24h: number;
  avgProcessingTimeMs: number | null;
  retrySuccessRate: number | null;
  totalJobs: number;
  snapshotAt: string;
}

interface JobStatusDetail {
  status: string;
  count: number;
  oldestJobCreatedAt: string | null;
  newestJobCreatedAt: string | null;
}

interface PhaseTimingMetrics {
  phase: string;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  count: number;
}

interface RecentFailure {
  id: string;
  manuscript_id: string;
  phase: string;
  last_error: unknown;
  failed_at: string;
}

interface DiagnosticsData {
  snapshot: DiagnosticsSnapshot;
  statusDetails: JobStatusDetail[];
  phaseMetrics: PhaseTimingMetrics[];
  recentFailures: RecentFailure[];
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/diagnostics");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch diagnostics");
      }

      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchDiagnostics, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "N/A";
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (totalMinutes < 60) return `${totalMinutes}m ${remainingSeconds}s`;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (hours < 24) return `${hours}h ${remainingMinutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h ${remainingMinutes}m`;
  };

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-50 text-green-900 border border-green-300 ring-1 ring-green-200";
      case "failed":
        return "bg-red-50 text-red-900 border border-red-300 ring-1 ring-red-200";
      case "running":
        return "bg-blue-50 text-blue-900 border border-blue-300 ring-1 ring-blue-200";
      case "queued":
        return "bg-amber-50 text-amber-900 border border-amber-300 ring-1 ring-amber-200";
      default:
        return "bg-slate-50 text-slate-900 border border-slate-300 ring-1 ring-slate-200";
    }
  };

  if (loading && !data) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <h2 className="text-lg font-bold text-red-900 mb-2">
            Error Loading Diagnostics
          </h2>
          <p className="font-semibold text-red-800">{error}</p>
          <button
            onClick={fetchDiagnostics}
            className="mt-4 rounded bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { snapshot, phaseMetrics, recentFailures } = data;

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
      {/* Header */}
      <div className="mb-8 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            System Diagnostics
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Last updated: {formatTimestamp(snapshot.snapshotAt)}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-400"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/admin/jobs/dead-letter"
            className="rounded bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900"
          >
            Dead Letter Queue
          </Link>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Jobs"
          value={snapshot.totalJobs.toString()}
          color="blue"
        />
        <MetricCard
          title="Failed (24h)"
          value={snapshot.failedJobsLast24h.toString()}
          color={snapshot.failedJobsLast24h > 0 ? "red" : "green"}
        />
        <MetricCard
          title="Avg Processing Time"
          value={formatDuration(snapshot.avgProcessingTimeMs)}
          color="slate"
        />
        <MetricCard
          title="Retry Success Rate"
          value={
            snapshot.retrySuccessRate !== null
              ? `${snapshot.retrySuccessRate}%`
              : "N/A"
          }
          color={
            snapshot.retrySuccessRate === null
              ? "slate"
              : snapshot.retrySuccessRate >= 80
                ? "green"
                : snapshot.retrySuccessRate >= 50
                  ? "amber"
                  : "red"
          }
        />
      </div>

      {/* Jobs by Status */}
      <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm mb-8">
        <h2 className="text-xl font-bold text-slate-950 mb-4">
          Jobs by Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(snapshot.jobsByStatus).map(([status, count]) => (
            <div
              key={status}
              className={`rounded-lg p-4 ${getStatusColor(status)}`}
            >
              <div className="text-3xl font-extrabold mb-1">{count}</div>
              <div className="text-sm font-bold uppercase tracking-wide capitalize">
                {status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Timing Metrics */}
      {phaseMetrics.length > 0 && (
        <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-slate-950 mb-4">
            Phase Timing Metrics
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="min-w-full divide-y divide-slate-300 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-900 uppercase tracking-wide text-xs">
                    Phase
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-slate-900 uppercase tracking-wide text-xs">
                    Count
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-slate-900 uppercase tracking-wide text-xs">
                    Avg Duration
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-slate-900 uppercase tracking-wide text-xs">
                    P50
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-slate-900 uppercase tracking-wide text-xs">
                    P95
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {phaseMetrics.map((metric) => (
                  <tr key={metric.phase} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                      {metric.phase}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {metric.count}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {formatDuration(metric.avgDurationMs)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {formatDuration(metric.p50DurationMs)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {formatDuration(metric.p95DurationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Failures */}
      {recentFailures.length > 0 && (
        <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950 mb-4">
            Recent Failures
          </h2>
          <div className="space-y-4">
            {recentFailures.map((failure) => (
              <div
                key={failure.id}
                className="rounded-lg border border-red-300 bg-red-50 p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-bold text-slate-900">
                      Job ID:
                    </span>
                    <span className="ml-2 font-mono text-sm font-semibold text-blue-700">
                      {failure.id}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {formatTimestamp(failure.failed_at)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 mb-2">
                  <span className="font-bold">Phase:</span>{" "}
                  <span className="text-slate-800">{failure.phase}</span>
                  <span className="mx-2">|</span>
                  <span className="font-bold">Manuscript:</span>{" "}
                  <span className="text-slate-800">{failure.manuscript_id}</span>
                </div>
                {failure.last_error && (
                  <pre className="rounded bg-red-100 p-2 text-xs font-semibold text-red-800 ring-1 ring-red-200 overflow-x-auto">
                    {JSON.stringify(failure.last_error, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/admin/jobs/dead-letter"
            className="mt-4 inline-block text-sm font-bold text-blue-700 hover:text-blue-900"
          >
            View all failed jobs →
          </Link>
        </div>
      )}
    </section>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  color: "blue" | "red" | "green" | "amber" | "slate";
}

function MetricCard({ title, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-900 border-blue-300 ring-1 ring-blue-200",
    red: "bg-red-50 text-red-900 border-red-300 ring-1 ring-red-200",
    green: "bg-green-50 text-green-900 border-green-300 ring-1 ring-green-200",
    amber: "bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200",
    slate: "bg-slate-50 text-slate-900 border-slate-300 ring-1 ring-slate-200",
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="text-xs font-bold uppercase tracking-wide mb-2">
        {title}
      </div>
      <div className="text-4xl font-extrabold">{value}</div>
    </div>
  );
}
