"use client";

import { useEffect, useState } from "react";

/**
 * A4.3 — Basic Invariant Dashboard
 *
 * Displays real-time invariant check results:
 *   - Claim attempts vs successes vs empty claims
 *   - Retry attempts vs retry-changed
 *   - Lease expired total over time
 *   - Running jobs vs completed/failed
 *   - Displayed invariants (pass/fail/warn)
 *
 * No advanced alerting or SLOs — just a consumable operator view.
 */

interface InvariantCheck {
  name: string;
  status: "pass" | "fail" | "warn" | "info";
  detail: string;
  violations: string[];
}

interface InvariantData {
  checked_at: string;
  overall_status: string;
  summary: {
    total_jobs: number;
    status_counts: Record<string, number>;
    running: number;
    completed: number;
    failed: number;
    retried: number;
    stale_running: number;
  };
  invariants: InvariantCheck[];
}

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-green-100 text-green-800 border-green-300",
  fail: "bg-red-100 text-red-800 border-red-300",
  warn: "bg-yellow-100 text-yellow-800 border-yellow-300",
  info: "bg-blue-100 text-blue-800 border-blue-300",
};

export default function InvariantDashboardPage() {
  const [data, setData] = useState<InvariantData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchInvariants() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invariants");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error?.message ?? "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvariants();
    const interval = setInterval(fetchInvariants, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Invariant Dashboard</h1>
        <button
          onClick={fetchInvariants}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {loading && !data && <p className="text-slate-500">Loading invariant checks...</p>}
      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {data && (
        <>
          <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.overall_status === "healthy"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}>
                {data.overall_status === "healthy" ? "Healthy" : "Attention Needed"}
              </span>
              <span className="text-sm text-slate-500">
                Checked: {new Date(data.checked_at).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{data.summary.total_jobs}</div>
                <div className="text-sm text-slate-600">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data.summary.running}</div>
                <div className="text-sm text-slate-600">Running</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.summary.completed}</div>
                <div className="text-sm text-slate-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{data.summary.failed}</div>
                <div className="text-sm text-slate-600">Failed</div>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-3">Invariant Checks</h2>
          <div className="space-y-3 mb-6">
            {data.invariants.map((inv) => (
              <div
                key={inv.name}
                className={`p-4 rounded-lg border ${STATUS_COLORS[inv.status] ?? "bg-slate-100"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{inv.name.replace(/_/g, " ")}</span>
                  <span className="text-xs font-mono uppercase">{inv.status}</span>
                </div>
                <p className="text-sm mt-1">{inv.detail}</p>
                {inv.violations.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer">
                      {inv.violations.length} violation(s)
                    </summary>
                    <ul className="text-xs mt-1 space-y-1 font-mono">
                      {inv.violations.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold mb-3">Additional Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-sm text-slate-600">Retried Jobs</div>
              <div className="text-xl font-bold">{data.summary.retried}</div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-sm text-slate-600">Stale Running</div>
              <div className="text-xl font-bold">{data.summary.stale_running}</div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
