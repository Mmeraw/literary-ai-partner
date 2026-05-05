import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/pipeline-health
 *
 * Admin-only pipeline health dashboard API (v1).
 * Reads from evaluation_jobs only — no new tables, no pipeline behavior changes.
 *
 * Query parameters:
 *   window  = 1h | 24h | 7d   (default: 24h)
 *   limit   = number           (default: 100, max: 200)
 *
 * Response shape:
 *   { generatedAt, window, summary, sipoc, failureHeatmap, recentJobs, diagnostics }
 *
 * Governance:
 *   - Read-only. No writes to any table.
 *   - Uses existing admin auth (requireAdmin).
 *   - Diagnostics blockedBy307 flag surfaces when structured diagnostics are absent.
 */

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Canonical SIPOC stages (spec-locked — do not reorder or rename)
// ---------------------------------------------------------------------------
const STAGES = [
  "intake",
  "routing_chunking",
  "pass1_craft",
  "pass2_editorial",
  "pass3_synthesis",
  "quality_gate",
  "persistence_report",
] as const;

type SipocStage = (typeof STAGES)[number];

// ---------------------------------------------------------------------------
// Helpers — pure functions (no DB calls, no side-effects)
// ---------------------------------------------------------------------------

function inferStage(job: Record<string, unknown>): SipocStage {
  const progress = (job.progress ?? {}) as Record<string, unknown>;
  const envelope = (progress.pipeline_failure_envelope ?? {}) as Record<string, unknown>;

  const raw: unknown =
    envelope.pipeline_stage ??
    envelope.failed_at ??
    job.phase_status ??
    job.phase ??
    "unknown";

  const stage = typeof raw === "string" ? raw : "unknown";

  if (stage.includes("pass1") || stage.includes("phase_1")) return "pass1_craft";
  if (stage.includes("pass2")) return "pass2_editorial";
  if (stage.includes("pass3")) return "pass3_synthesis";
  if (stage.includes("pass4") || stage.includes("quality")) return "quality_gate";
  if (stage.includes("persist") || stage.includes("report")) return "persistence_report";

  const routing = (progress.chunk_routing ?? {}) as Record<string, unknown>;
  if (routing.route) return "routing_chunking";

  return "intake";
}

function extractErrorCode(job: Record<string, unknown>): string | null {
  const progress = (job.progress ?? {}) as Record<string, unknown>;
  const envelope = (progress.pipeline_failure_envelope ?? {}) as Record<string, unknown>;
  const diagnostics = (progress.pipeline_failure_diagnostics ?? {}) as Record<string, unknown>;
  const checks = diagnostics.quality_gate_checks;
  const firstCheck =
    Array.isArray(checks) && checks.length > 0
      ? (checks[0] as Record<string, unknown>)
      : null;

  return (
    (typeof envelope.error_code === "string" ? envelope.error_code : null) ??
    (firstCheck && typeof firstCheck.error_code === "string" ? firstCheck.error_code : null) ??
    (typeof job.error_code === "string" ? job.error_code : null) ??
    null
  );
}

type DiagnosticStatus = "available" | "missing" | "blocked_by_307" | "not_applicable";

function diagnosticStatus(job: Record<string, unknown>): DiagnosticStatus {
  if (job.status !== "failed") return "not_applicable";

  const progress = (job.progress ?? {}) as Record<string, unknown>;
  const diagnostics = (progress.pipeline_failure_diagnostics ?? {}) as Record<string, unknown>;
  const checks = diagnostics.quality_gate_checks;

  const hasStructured =
    Array.isArray(checks) &&
    checks.some(
      (c: unknown) =>
        Array.isArray((c as Record<string, unknown>).per_criterion_diagnostic)
    );

  if (hasStructured) return "available";

  const errorCode = extractErrorCode(job);
  if (typeof errorCode === "string" && errorCode.startsWith("QG_")) return "blocked_by_307";

  return "missing";
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

function buildPipelineHealth(jobs: Record<string, unknown>[], windowParam: string) {
  const totalJobs = jobs.length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const completedJobs = jobs.filter((j) => j.status === "complete").length;
  const runningJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  ).length;

  // Failure heatmap: stage × error_code
  const heatmapAcc: Record<
    string,
    { stageId: string; failureCode: string; count: number; lastSeenAt: string }
  > = {};

  for (const job of jobs.filter((j) => j.status === "failed")) {
    const stage = inferStage(job);
    const code = extractErrorCode(job) ?? "UNKNOWN_FAILURE";
    const key = `${stage}:${code}`;

    if (!heatmapAcc[key]) {
      heatmapAcc[key] = {
        stageId: stage,
        failureCode: code,
        count: 0,
        lastSeenAt: String(job.updated_at ?? ""),
      };
    }
    heatmapAcc[key].count += 1;
    const existing = heatmapAcc[key].lastSeenAt;
    const candidate = String(job.updated_at ?? "");
    if (candidate && new Date(candidate) > new Date(existing)) {
      heatmapAcc[key].lastSeenAt = candidate;
    }
  }

  const failureHeatmap = Object.values(heatmapAcc);

  // SIPOC strip
  const sipoc = STAGES.map((stageId) => {
    const stageJobs = jobs.filter((j) => inferStage(j) === stageId);
    const failedCount = stageJobs.filter((j) => j.status === "failed").length;
    const firstFailed = stageJobs.find((j) => j.status === "failed");

    return {
      stageId,
      label: stageId,
      health:
        stageJobs.length === 0
          ? "gray"
          : failedCount > 0
          ? "red"
          : "green",
      okCount: stageJobs.filter((j) => j.status === "complete").length,
      warningCount: 0,
      failedCount,
      lastFailureCode: firstFailed ? extractErrorCode(firstFailed) : null,
      avgDurationMs: null,
      p95DurationMs: null,
      qualityDelta: null,
      fakeZeroDelta: null,
      traceabilityCompletenessDelta: null,
      diagnosticGap: stageJobs.some((j) => diagnosticStatus(j) === "blocked_by_307"),
    };
  });

  // Recent jobs (up to 100 rows already returned from DB, already sorted by updated_at desc)
  const recentJobs = jobs.slice(0, 100).map((job) => {
    const progress = (job.progress ?? {}) as Record<string, unknown>;
    const routing = (progress.chunk_routing ?? {}) as Record<string, unknown>;
    const createdAt = String(job.created_at ?? "");
    const updatedAt = String(job.updated_at ?? "");

    return {
      jobId: job.id,
      manuscriptId: job.manuscript_id,
      createdAt,
      updatedAt,
      status: job.status,
      phase: job.phase,
      phaseStatus: job.phase_status,
      manuscriptWords:
        typeof routing.manuscript_words === "number" ? routing.manuscript_words : null,
      route: typeof routing.route === "string" ? routing.route : null,
      chunkCount:
        typeof routing.chunk_count === "number" ? routing.chunk_count : null,
      errorCode: extractErrorCode(job),
      pipelineStage: inferStage(job),
      durationMs:
        createdAt && updatedAt
          ? new Date(updatedAt).getTime() - new Date(createdAt).getTime()
          : null,
      diagnosticStatus: diagnosticStatus(job),
    };
  });

  const blockedCount = jobs.filter((j) => diagnosticStatus(j) === "blocked_by_307").length;

  return {
    generatedAt: new Date().toISOString(),
    window: windowParam,
    summary: {
      totalJobs,
      completedJobs,
      failedJobs,
      runningJobs,
      failureRate: totalJobs > 0 ? failedJobs / totalJobs : 0,
      avgRuntimeMs: null,
    },
    sipoc,
    failureHeatmap,
    recentJobs,
    diagnostics: {
      allFailedJobsDiagnosticsAuditable: blockedCount === 0,
      missingDiagnosticArtifactCount: blockedCount,
      missingProviderTraceCount: null,
      missingIntermediateOutputCount: null,
      note: "Full criterion-level reconstruction depends on Mmeraw/literary-ai-partner#307 diagnostic persistence.",
    },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const WINDOW_INTERVALS: Record<string, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
};

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = req.nextUrl;
  const windowParam = searchParams.get("window") ?? "24h";
  const limitParam = searchParams.get("limit");

  const interval = WINDOW_INTERVALS[windowParam] ?? WINDOW_INTERVALS["24h"];
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 200)
    : 100;

  try {
    const supabase = createAdminClient();

    // Parameterized query — no string interpolation of user input.
    // interval is validated against a fixed allowlist above.
    const { data: jobs, error } = await supabase
      .from("evaluation_jobs")
      .select(
        "id, manuscript_id, status, phase, phase_status, progress, error_code, created_at, updated_at"
      )
      .gte("created_at", new Date(Date.now() - intervalToMs(interval)).toISOString())
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[pipeline-health] DB error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to query evaluation_jobs", details: error.message },
        { status: 500 }
      );
    }

    const payload = buildPipelineHealth(
      (jobs ?? []) as Record<string, unknown>[],
      windowParam
    );

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    console.error("[pipeline-health] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function intervalToMs(interval: string): number {
  if (interval === "1 hour") return 60 * 60 * 1000;
  if (interval === "7 days") return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000; // default: 24 hours
}
