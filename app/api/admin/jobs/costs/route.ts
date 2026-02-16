/**
 * Admin Job Costs API
 *
 * GET /api/admin/jobs/costs
 *
 * Returns cost visibility data: system-wide snapshot,
 * per-model breakdown, and backpressure status.
 *
 * **Auth:** Requires admin session (Phase A.5)
 *
 * @see docs/PHASE_A5_DAY2_BACKPRESSURE_COST.md
 */

import { NextRequest, NextResponse } from "next/server";
import { getCostSnapshot, getModelCostBreakdown } from "@/lib/jobs/cost-tracker";
import { checkBackpressure } from "@/lib/jobs/backpressure";
import { requireAdmin } from "@/lib/admin/requireAdmin";

/**
 * GET /api/admin/jobs/costs
 *
 * Returns:
 * - Cost snapshot (total, 24h, 7d, avg per job)
 * - Model breakdown (cost per model, call counts)
 * - Backpressure status (queue depth, level, thresholds)
 *
 * **Auth:** Requires admin session (Phase A.5)
 *
 * @returns {Promise<NextResponse>} JSON with cost + backpressure data
 */
export async function GET(request: NextRequest) {
  // PHASE A.5: Admin authentication
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    console.log("[costs] Fetching cost snapshot + backpressure...");

    // Fetch all data in parallel
    const [costSnapshot, modelBreakdown, backpressure] = await Promise.all([
      getCostSnapshot(),
      getModelCostBreakdown(),
      checkBackpressure(),
    ]);

    console.log("[costs] Snapshot complete:", {
      totalCostCents: costSnapshot.totalCostCents,
      jobsWithCosts: costSnapshot.jobsWithCosts,
      backpressureLevel: backpressure.level,
    });

    return NextResponse.json({
      success: true,
      data: {
        costs: costSnapshot,
        modelBreakdown,
        backpressure,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  } catch (error) {
    console.error("[costs] Error fetching cost data:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cost data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/admin/jobs/costs
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
