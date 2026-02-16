/**
 * Job Cost Dashboard
 *
 * Client-side component for cost visibility and backpressure monitoring.
 * Fetches data from /api/admin/jobs/costs and auto-refreshes.
 *
 * Part of Phase A.5 Day 2: Backpressure & Cost Visibility
 *
 * @see docs/PHASE_A5_DAY2_BACKPRESSURE_COST.md
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Types (mirror server types for client) ─────────────────────────

interface CostSnapshot {
  totalCostCents: number;
  costLast24hCents: number;
  costLast7dCents: number;
  avgCostPerJobCents: number;
  jobsWithCosts: number;
  topModel: string | null;
  snapshotAt: string;
}

interface ModelCostBreakdown {
  model: string;
  totalCostCents: number;
  callCount: number;
  avgCostPerCallCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface BackpressureStatus {
  level: "ok" | "warn" | "critical";
  queueDepth: number;
  runningCount: number;
  oldestQueuedAgeMs: number | null;
  acceptingNewJobs: boolean;
  reason: string | null;
  thresholds: {
    queueWarnThreshold: number;
    queueHardLimit: number;
    oldestAgeAlertMs: number;
  };
  checkedAt: string;
}

interface CostDashboardData {
  costs: CostSnapshot;
  modelBreakdown: ModelCostBreakdown[];
  backpressure: BackpressureStatus;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function levelColor(level: "ok" | "warn" | "critical"): string {
  switch (level) {
    case "ok":
      return "text-green-400";
    case "warn":
      return "text-yellow-400";
    case "critical":
      return "text-red-400";
  }
}

function levelBg(level: "ok" | "warn" | "critical"): string {
  switch (level) {
    case "ok":
      return "bg-green-900/30 border-green-700";
    case "warn":
      return "bg-yellow-900/30 border-yellow-700";
    case "critical":
      return "bg-red-900/30 border-red-700";
  }
}

// ─── Component ──────────────────────────────────────────────────────

export default function JobCostDashboard() {
  const [data, setData] = useState<CostDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/jobs/costs");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Unknown error");
      }
      setData(json.data);
      setError(null);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="p-6 text-gray-400">
        Loading cost dashboard...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-red-400">
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const { costs, modelBreakdown, backpressure } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          Cost &amp; Backpressure Dashboard
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">
            Last refresh: {lastRefresh}
          </span>
          <button
            onClick={fetchData}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Refresh
          </button>
          <Link
            href="/admin/diagnostics"
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Diagnostics
          </Link>
        </div>
      </div>

      {/* Backpressure Banner */}
      <div
        className={`p-4 rounded-lg border ${levelBg(backpressure.level)}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className={`font-bold uppercase ${levelColor(backpressure.level)}`}>
              {backpressure.level}
            </span>
            <span className="ml-2 text-sm text-gray-300">
              Queue: {backpressure.queueDepth} queued / {backpressure.runningCount} running
            </span>
          </div>
          <div className="text-sm text-gray-400">
            {backpressure.acceptingNewJobs ? "Accepting jobs" : "REJECTING new jobs"}
          </div>
        </div>
        {backpressure.reason && (
          <p className="mt-1 text-xs text-gray-400">{backpressure.reason}</p>
        )}
        <div className="mt-2 text-xs text-gray-500">
          Thresholds: warn={backpressure.thresholds.queueWarnThreshold} /
          hard={backpressure.thresholds.queueHardLimit} /
          age={Math.round(backpressure.thresholds.oldestAgeAlertMs / 60_000)}min
        </div>
      </div>

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase">Total Cost</div>
          <div className="text-2xl font-bold text-white">
            {formatCents(costs.totalCostCents)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase">Last 24h</div>
          <div className="text-2xl font-bold text-white">
            {formatCents(costs.costLast24hCents)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase">Last 7 Days</div>
          <div className="text-2xl font-bold text-white">
            {formatCents(costs.costLast7dCents)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase">Avg/Job</div>
          <div className="text-2xl font-bold text-white">
            {formatCents(costs.avgCostPerJobCents)}
          </div>
          <div className="text-xs text-gray-500">
            {costs.jobsWithCosts} jobs tracked
          </div>
        </div>
      </div>

      {/* Model Breakdown Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-300">
            Cost by Model
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 uppercase">
              <th className="px-4 py-2 text-left">Model</th>
              <th className="px-4 py-2 text-right">Total Cost</th>
              <th className="px-4 py-2 text-right">Calls</th>
              <th className="px-4 py-2 text-right">Avg/Call</th>
              <th className="px-4 py-2 text-right">Input Tokens</th>
              <th className="px-4 py-2 text-right">Output Tokens</th>
            </tr>
          </thead>
          <tbody>
            {modelBreakdown.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                  No cost data yet
                </td>
              </tr>
            ) : (
              modelBreakdown.map((m) => (
                <tr
                  key={m.model}
                  className="border-t border-gray-700 hover:bg-gray-750"
                >
                  <td className="px-4 py-2 text-sm text-gray-300 font-mono">
                    {m.model}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-white">
                    {formatCents(m.totalCostCents)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-400">
                    {m.callCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-400">
                    {formatCents(m.avgCostPerCallCents)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-400">
                    {formatTokens(m.totalInputTokens)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-400">
                    {formatTokens(m.totalOutputTokens)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {error && (
        <div className="text-xs text-red-400">
          Refresh error: {error}
        </div>
      )}
    </div>
  );
}
