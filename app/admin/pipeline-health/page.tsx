"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAccess";

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
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function validateAccess() {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) {
            setAuthorized(false);
            router.replace("/dashboard");
          }
          return;
        }

        const payload = await response.json();
        const email = payload?.user?.email ?? null;
        const allowed = isPipelineHealthAdminEmail(email);

        if (active) {
          setAuthorized(allowed);
        }

        if (!allowed) {
          router.replace("/dashboard");
        }
      } catch {
        if (active) {
          setAuthorized(false);
          router.replace("/dashboard");
        }
      }
    }

    validateAccess();

    return () => {
      active = false;
    };
  }, [router]);

  const fetchData = useCallback(
    (win: string) => {
      setLoading(true);
      setError(null);
      fetch(`/api/admin/pipeline-health?window=${win}&limit=100`)
        .then((res) => {
          if (res.status === 401 || res.status === 403) {
            router.replace("/dashboard");
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
    if (authorized) {
      fetchData(windowParam);
    }
  }, [authorized, windowParam, fetchData]);

  if (authorized === null) {
    return (
      <main className="p-6">
        <p className="text-gray-500">Validating administrator access…</p>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

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
    </main>
  );
}
