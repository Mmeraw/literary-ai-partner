/**
 * Admin Diagnostics API
 * 
 * GET /api/admin/diagnostics
 * 
 * Returns system-wide diagnostic metrics for observability dashboard.
 * Requires service role authentication.
 * 
 * @see docs/PHASE_A4_OBSERVABILITY.md
 */

import { NextRequest, NextResponse } from "next/server";
import { getDiagnosticsSnapshot, getJobStatusDetails, getPhaseTimingMetrics, getRecentFailedJobs } from "@/lib/jobs/diagnostics";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { checkBackpressure } from "@/lib/jobs/backpressure";
import { getCostSnapshot } from "@/lib/jobs/cost";

/**
 * GET /api/admin/diagnostics
 * 
 * Returns comprehensive diagnostics snapshot including:
 * - Jobs by status (queued/running/complete/failed)
 * - Failed jobs count (last 24h)
 * - Average processing time
 * - Retry success rate
 * - Phase timing metrics
 * - Recent failed jobs
 * - Backpressure status (Day 2 A5)
 * - Cost snapshot (Day 2 A5)
 * 
 * **Auth:** Requires admin session (Phase A.5)
 * 
 * @returns {Promise<NextResponse>} JSON with diagnostics data
 */
export async function GET(request: NextRequest) {
  // PHASE A.5: Admin authentication
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {

    console.log("[diagnostics] Fetching diagnostics snapshot...");

    // Fetch all diagnostic data in parallel
    const [snapshot, statusDetails, phaseMetrics, recentFailures, backpressure, costSnapshot] = await Promise.all([
      getDiagnosticsSnapshot(),
      getJobStatusDetails(),
      getPhaseTimingMetrics(),
      getRecentFailedJobs(10),
      checkBackpressure(),
      getCostSnapshot(),
    ]);

    console.log("[diagnostics] Snapshot complete:", {
      totalJobs: snapshot.totalJobs,
      failedLast24h: snapshot.failedJobsLast24h,
      avgProcessingTimeMs: snapshot.avgProcessingTimeMs,
      backpressureLevel: backpressure.level,
      queueDepth: backpressure.queueDepth,
    });

    return NextResponse.json({
      success: true,
      data: {
        snapshot,
        statusDetails,
        phaseMetrics,
        recentFailures,
        backpressure,
        cost: costSnapshot,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  } catch (error) {
    console.error("[diagnostics] Error fetching diagnostics:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch diagnostics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/admin/diagnostics
 * 
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
