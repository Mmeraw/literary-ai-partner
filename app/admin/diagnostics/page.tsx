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
      const interval = setInterval(fetchDiagnostics, 10000); // Refresh every 10s
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
        return "text-green-800 bg-green-100 border border-green-200";
      case "failed":
        return "text-red-800 bg-red-100 border border-red-200";
      case "running":
        return "text-blue-800 bg-blue-100 border border-blue-200";
      case "queued":
        return "text-yellow-800 bg-yellow-100 border border-yellow-200";
      default:
        return "text-gray-800 bg-gray-100 border border-gray-200";
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 text-lg font-semibold mb-2">Error Loading Diagnostics</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchDiagnostics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { snapshot, statusDetails, phaseMetrics, recentFailures } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">System Diagnostics</h1>
            <p className="text-gray-700 font-medium">
              Last updated: {formatTimestamp(snapshot.snapshotAt)}
            </p>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-900 font-medium">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh (10s)
            </label>
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/admin/jobs/dead-letter"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
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
            color="purple"
          />
          <MetricCard
            title="Retry Success Rate"
            value={snapshot.retrySuccessRate !== null ? `${snapshot.retrySuccessRate}%` : "N/A"}
            color={
              snapshot.retrySuccessRate === null
                ? "gray"
                : snapshot.retrySuccessRate >= 80
                ? "green"
                : snapshot.retrySuccessRate >= 50
                ? "yellow"
                : "red"
            }
          />
        </div>

        {/* Jobs by Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Jobs by Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(snapshot.jobsByStatus).map(([status, count]) => (
              <div key={status} className={`p-4 rounded-lg ${getStatusColor(status)}`}>
                <div className="text-3xl font-bold mb-1">{count}</div>
                <div className="text-sm font-medium capitalize">{status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase Timing Metrics */}
        {phaseMetrics.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Phase Timing Metrics</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Avg Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      P50
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      P95
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {phaseMetrics.map((metric) => (
                    <tr key={metric.phase}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {metric.phase}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                        {metric.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                        {formatDuration(metric.avgDurationMs)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                        {formatDuration(metric.p50DurationMs)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Failures</h2>
            <div className="space-y-4">
              {recentFailures.map((failure) => (
                <div key={failure.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-bold text-gray-900">Job ID:</span>
                      <span className="text-sm text-gray-800 ml-2 font-mono">{failure.id}</span>
                    </div>
                    <span className="text-xs text-gray-700 font-medium">{formatTimestamp(failure.failed_at)}</span>
                  </div>
                  <div className="text-sm text-gray-900 font-medium mb-2">
                    <span className="font-bold">Phase:</span> {failure.phase} | 
                    <span className="font-bold ml-2">Manuscript:</span> {failure.manuscript_id}
                  </div>
                  {failure.last_error && (
                    <pre className="text-xs text-red-700 bg-red-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(failure.last_error, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
            <Link
              href="/admin/jobs/dead-letter"
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View all failed jobs →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  color: "blue" | "red" | "green" | "yellow" | "purple" | "gray";
}

function MetricCard({ title, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-950 border-blue-300",
    red: "bg-red-100 text-red-950 border-red-300",
    green: "bg-green-100 text-green-950 border-green-300",
    yellow: "bg-yellow-100 text-yellow-950 border-yellow-300",
    purple: "bg-purple-100 text-purple-950 border-purple-300",
    gray: "bg-gray-100 text-gray-950 border-gray-300",
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="text-sm font-bold mb-2 uppercase tracking-wide opacity-90">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
