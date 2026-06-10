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
        return "bg-green-900/30 text-green-300 border border-green-400/30 ring-1 ring-green-400/20";
      case "failed":
        return "bg-red-900/30 text-red-300 border border-red-400/30 ring-1 ring-red-400/20";
      case "running":
        return "bg-blue-900/30 text-blue-300 border border-blue-400/30 ring-1 ring-blue-400/20";
      case "queued":
        return "bg-amber-900/30 text-amber-300 border border-amber-400/30 ring-1 ring-amber-400/20";
      default:
        return "bg-rg-ink2 text-rg-cream2/70 border border-rg-cream2/20 ring-1 ring-rg-cream2/10";
    }
  };

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-8 bg-rg-ink2 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-rg-ink2 rounded"></div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-400/30 bg-red-900/20 p-6">
            <h2 className="text-lg font-bold text-red-300 mb-2">
              Error Loading Diagnostics
            </h2>
            <p className="font-semibold text-red-300/80">{error}</p>
            <button
              onClick={fetchDiagnostics}
              className="mt-4 rounded bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { snapshot, phaseMetrics, recentFailures } = data;

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <Link href="/admin" className="text-sm text-rg-gold underline">← Back to Admin</Link>
          <p className="mt-4 font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Admin · System Diagnostics</p>
          <h1 className="mt-2 font-rg-serif text-3xl font-semibold">
            System Diagnostics
          </h1>
          <p className="mt-2 text-sm text-rg-cream2/70">
            Last updated: {formatTimestamp(snapshot.snapshotAt)}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-rg-cream2/70">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-rg-cream2/30"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="rounded bg-rg-gold px-4 py-2 text-sm font-bold text-rg-ink hover:bg-amber-400 disabled:bg-rg-cream2/20 disabled:text-rg-cream2/40"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/admin/jobs/dead-letter"
            className="rounded border border-rg-cream2/20 bg-rg-ink2/70 px-4 py-2 text-sm font-bold text-rg-cream hover:border-rg-gold/60"
          >
            Dead Letter Queue
          </Link>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-6">
        <h2 className="text-xl font-bold text-rg-cream mb-4">
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
        <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-6">
          <h2 className="text-xl font-bold text-rg-cream mb-4">
            Phase Timing Metrics
          </h2>
          <div className="overflow-x-auto rounded-lg border border-rg-cream2/10">
            <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
              <thead className="bg-rg-ink2">
                <tr>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Phase
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Count
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    Avg Duration
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    P50
                  </th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">
                    P95
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rg-cream2/10">
                {phaseMetrics.map((metric) => (
                  <tr key={metric.phase} className="transition hover:bg-rg-ink2/50">
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-rg-cream">
                      {metric.phase}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">
                      {metric.count}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">
                      {formatDuration(metric.avgDurationMs)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">
                      {formatDuration(metric.p50DurationMs)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">
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
        <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-6">
          <h2 className="text-xl font-bold text-rg-cream mb-4">
            Recent Failures
          </h2>
          <div className="space-y-4">
            {recentFailures.map((failure) => (
              <div
                key={failure.id}
                className="rounded-lg border border-red-400/30 bg-red-900/20 p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-bold text-rg-cream">
                      Job ID:
                    </span>
                    <span className="ml-2 font-mono text-sm font-semibold text-rg-gold">
                      {failure.id}
                    </span>
                  </div>
                  <span className="text-xs text-rg-cream2/70">
                    {formatTimestamp(failure.failed_at)}
                  </span>
                </div>
                <div className="text-sm text-rg-cream2/70 mb-2">
                  <span className="font-bold text-rg-cream">Phase:</span>{" "}
                  <span>{failure.phase}</span>
                  <span className="mx-2 text-rg-cream2/30">|</span>
                  <span className="font-bold text-rg-cream">Manuscript:</span>{" "}
                  <span>{failure.manuscript_id}</span>
                </div>
                {failure.last_error && (
                  <pre className="rounded bg-red-900/30 p-2 text-xs font-semibold text-red-300 ring-1 ring-red-400/30 overflow-x-auto">
                    {JSON.stringify(failure.last_error, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/admin/jobs/dead-letter"
            className="mt-4 inline-block text-sm font-bold text-rg-gold hover:text-rg-cream"
          >
            View all failed jobs →
          </Link>
        </div>
      )}
      </div>
    </main>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  color: "blue" | "red" | "green" | "amber" | "slate";
}

function MetricCard({ title, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-900/30 text-blue-300 border-blue-400/30 ring-1 ring-blue-400/20",
    red: "bg-red-900/30 text-red-300 border-red-400/30 ring-1 ring-red-400/20",
    green: "bg-green-900/30 text-green-300 border-green-400/30 ring-1 ring-green-400/20",
    amber: "bg-amber-900/30 text-amber-300 border-amber-400/30 ring-1 ring-amber-400/20",
    slate: "bg-rg-ink2 text-rg-cream2/70 border-rg-cream2/20 ring-1 ring-rg-cream2/10",
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-cream2/50 mb-2">
        {title}
      </div>
      <div className="text-4xl font-extrabold text-rg-cream">{value}</div>
    </div>
  );
}
