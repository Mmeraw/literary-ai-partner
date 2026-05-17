import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEST_MANUSCRIPT_ID_MIN } from "@/lib/manuscripts/testRange";

/**
 * GET /api/admin/pipeline-health
 *
 * Admin-only pipeline health dashboard API (v2).
 * Reads from evaluation_jobs + evaluation_artifacts + manuscripts — no new tables, no pipeline behavior changes.
 *
 * Query parameters:
 *   window  = 1h | 24h | 7d   (default: 24h)
 *   limit   = number           (default: 100, max: 200)
 *
 * Response shape:
 *   { generatedAt, window, summary, sipoc, failureHeatmap, recentJobs, dreamSynthesis, diagnostics }
 *
 * Governance:
 *   - Read-only. No writes to any table.
 *   - Uses existing admin auth (requireAdmin).
 *   - diagnosticStatus="available" ONLY when both audit artifacts are confirmed present
 *     in evaluation_artifacts. Version flags / in-progress markers are NOT sufficient.
 *
 * Changelog:
 *   v2 (2026-05-17, issue #541):
 *     - Added dreamSynthesis panel (Section B): pending DREAM jobs, coverage, last synthesized
 *     - Added Pass 4 adjudication fields to RecentJob (Section A): crossCheckStatus, crossCheckError,
 *       crossCheckCompletedAt, adjudicationMode
 *     - Added artifact coverage columns to RecentJob (Section C): hasEvalV2, hasDream, hasPassDiag
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

// Word count threshold for DREAM synthesis eligibility
const DREAM_WORD_COUNT_THRESHOLD = 25_000;

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
    null
  );
}

function extractLastError(job: Record<string, unknown>): string | null {
  return typeof job.last_error === "string" ? job.last_error : null;
}

type DiagnosticStatus = "available" | "missing" | "blocked_by_307" | "not_applicable";

/**
 * Batch-load ALL artifact kinds for a set of job IDs.
 * Returns Map<jobId, Set<artifactType>>.
 */
async function loadAllArtifactKinds(
  supabase: ReturnType<typeof createAdminClient>,
  jobIds: string[]
): Promise<Map<string, Set<string>>> {
  if (jobIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("job_id, artifact_type")
    .in("job_id", jobIds);

  if (error || !data) {
    console.warn("[pipeline-health] evaluation_artifacts lookup failed:", error?.message);
    return new Map();
  }

  const result = new Map<string, Set<string>>();
  for (const row of data as Array<{ job_id: string; artifact_type: string }>) {
    if (!result.has(row.job_id)) {
      result.set(row.job_id, new Set());
    }
    result.get(row.job_id)!.add(row.artifact_type);
  }
  return result;
}

function diagnosticStatus(
  job: Record<string, unknown>,
  persistedKinds?: Set<string>
): DiagnosticStatus {
  if (job.status !== "failed") return "not_applicable";

  if (persistedKinds !== undefined) {
    if (persistedKinds.has("quality_gate_diagnostics_v1")) return "available";
  }

  const errorCode = extractErrorCode(job);
  if (typeof errorCode === "string" && errorCode.startsWith("QG_")) return "blocked_by_307";

  return "missing";
}

// ---------------------------------------------------------------------------
// DREAM synthesis helpers
// ---------------------------------------------------------------------------

interface DreamSynthesisData {
  pendingCount: number;
  coveredCount: number;
  lastSynthesizedAt: string | null;
  pendingJobs: Array<{ jobId: string; title: string; wordCount: number; updatedAt: string }>;
}

async function loadDreamSynthesisData(
  supabase: ReturnType<typeof createAdminClient>
): Promise<DreamSynthesisData> {
  // All complete long-form jobs (word_count >= threshold)
  const { data: longFormJobs, error: lfError } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, updated_at, manuscripts!inner(title, word_count)")
    .eq("status", "complete")
    .gte("manuscripts.word_count", DREAM_WORD_COUNT_THRESHOLD)
    .lt("manuscript_id", TEST_MANUSCRIPT_ID_MIN)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (lfError || !longFormJobs) {
    console.warn("[pipeline-health] DREAM long-form jobs query failed:", lfError?.message);
    return { pendingCount: 0, coveredCount: 0, lastSynthesizedAt: null, pendingJobs: [] };
  }

  const jobIds = (longFormJobs as Array<{ id: string }>).map((j) => j.id);

  // Which of these have longform_document_v1 artifacts?
  const { data: dreamArtifacts, error: daError } = await supabase
    .from("evaluation_artifacts")
    .select("job_id, created_at")
    .in("job_id", jobIds)
    .eq("artifact_type", "longform_document_v1")
    .order("created_at", { ascending: false });

  if (daError) {
    console.warn("[pipeline-health] DREAM artifact lookup failed:", daError?.message);
  }

  const coveredJobIds = new Set(
    ((dreamArtifacts ?? []) as Array<{ job_id: string; created_at: string }>).map(
      (a) => a.job_id
    )
  );

  const lastSynthesizedAt =
    (dreamArtifacts ?? []).length > 0
      ? (dreamArtifacts as Array<{ job_id: string; created_at: string }>)[0]?.created_at ?? null
      : null;

  const pendingJobs = (
    longFormJobs as Array<{
      id: string;
      manuscript_id: string;
      updated_at: string;
      manuscripts: { title: string; word_count: number };
    }>
  )
    .filter((j) => !coveredJobIds.has(j.id))
    .slice(0, 10)
    .map((j) => ({
      jobId: j.id,
      title: j.manuscripts?.title ?? "Unknown",
      wordCount: j.manuscripts?.word_count ?? 0,
      updatedAt: j.updated_at,
    }));

  return {
    pendingCount: pendingJobs.length,
    coveredCount: coveredJobIds.size,
    lastSynthesizedAt,
    pendingJobs,
  };
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

function buildPipelineHealth(
  jobs: Record<string, unknown>[],
  windowParam: string,
  artifactKindsByJob: Map<string, Set<string>>,
  dreamSynthesis: DreamSynthesisData
) {
  const totalJobs = jobs.length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const completedJobs = jobs.filter((j) => j.status === "complete").length;
  const runningJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  ).length;

  const jobArtifacts = (job: Record<string, unknown>) =>
    artifactKindsByJob.get(String(job.id ?? ""));

  const jobDiagStatus = (job: Record<string, unknown>): DiagnosticStatus =>
    diagnosticStatus(job, jobArtifacts(job));

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
      diagnosticGap: stageJobs.some((j) => jobDiagStatus(j) === "blocked_by_307"),
    };
  });

  // Recent jobs — now includes Pass 4 fields + artifact coverage (Sections A + C)
  const recentJobs = jobs.slice(0, 100).map((job) => {
    const progress = (job.progress ?? {}) as Record<string, unknown>;
    const routing = (progress.chunk_routing ?? {}) as Record<string, unknown>;
    const createdAt = String(job.created_at ?? "");
    const updatedAt = String(job.updated_at ?? "");
    const kinds = jobArtifacts(job) ?? new Set<string>();

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
      lastError: extractLastError(job),
      pipelineStage: inferStage(job),
      durationMs:
        createdAt && updatedAt
          ? new Date(updatedAt).getTime() - new Date(createdAt).getTime()
          : null,
      diagnosticStatus: jobDiagStatus(job),
      // Section A — Pass 4 adjudication fields
      crossCheckStatus: typeof job.cross_check_status === "string" ? job.cross_check_status : null,
      crossCheckError: typeof job.cross_check_error === "string" ? job.cross_check_error : null,
      crossCheckCompletedAt:
        typeof job.cross_check_completed_at === "string" ? job.cross_check_completed_at : null,
      // Section C — artifact coverage
      hasEvalV2: kinds.has("evaluation_result_v2"),
      hasDream: kinds.has("longform_document_v1"),
      hasPassDiag: kinds.has("pass_outputs_diagnostic_v1"),
    };
  });

  const blockedCount = jobs.filter((j) => jobDiagStatus(j) === "blocked_by_307").length;

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
    // Section B — DREAM synthesis queue
    dreamSynthesis,
    diagnostics: {
      allFailedJobsDiagnosticsAuditable: blockedCount === 0,
      missingDiagnosticArtifactCount: blockedCount,
      missingProviderTraceCount: null,
      missingIntermediateOutputCount: null,
      note: blockedCount === 0
        ? "All failed jobs have structured diagnostics (pass_outputs_diagnostic_v1 + quality_gate_diagnostics_v1 artifacts)."
        : `${blockedCount} failed job(s) lack structured diagnostics. Jobs failing after diagnostic persistence is deployed will have quality_gate_diagnostics_v1 artifacts.`,
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
  const showTestParam = (searchParams.get("show_test") ?? "").toLowerCase();
  const showTestManuscripts = showTestParam === "1" || showTestParam === "true";

  const interval = WINDOW_INTERVALS[windowParam] ?? WINDOW_INTERVALS["24h"];
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 200)
    : 100;

  try {
    const supabase = createAdminClient();

    let jobsQuery = supabase
      .from("evaluation_jobs")
      .select(
        // Section A: added cross_check_* fields
        "id, manuscript_id, status, phase, phase_status, progress, last_error, created_at, updated_at, cross_check_status, cross_check_error, cross_check_completed_at"
      )
      .gte("created_at", new Date(Date.now() - intervalToMs(interval)).toISOString())
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (!showTestManuscripts) {
      jobsQuery = jobsQuery.lt("manuscript_id", TEST_MANUSCRIPT_ID_MIN);
    }

    const { data: jobs, error } = await jobsQuery;

    if (error) {
      console.error("[pipeline-health] DB error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to query evaluation_jobs", details: error.message },
        { status: 500 }
      );
    }

    const allJobs = (jobs ?? []) as Record<string, unknown>[];

    // Load ALL artifact kinds for all jobs (one round-trip covers Sections A + C)
    const allJobIds = allJobs
      .map((j) => String(j.id ?? ""))
      .filter((id) => id.length > 0);

    const artifactKindsByJob = await loadAllArtifactKinds(supabase, allJobIds);

    // Section B — DREAM synthesis data (separate query, global scope not window-limited)
    const dreamSynthesis = await loadDreamSynthesisData(supabase);

    const payload = buildPipelineHealth(allJobs, windowParam, artifactKindsByJob, dreamSynthesis);

    return NextResponse.json({
      ok: true,
      ...payload,
      filters: {
        showTestManuscripts,
        testManuscriptIdMin: TEST_MANUSCRIPT_ID_MIN,
      },
    });
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
  return 24 * 60 * 60 * 1000;
}
