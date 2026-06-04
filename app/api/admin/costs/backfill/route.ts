/**
 * CostOps Backfill API
 *
 * POST /api/admin/costs/backfill
 *
 * Backfills estimated cost records for completed evaluation jobs that
 * predate the cost-tracking pipeline. Uses the average cost per tracked
 * evaluation to estimate untracked jobs. Safe to call multiple times.
 *
 * Auth: Requires admin session via requireAdmin.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { backfillHistoricalCosts } from "@/lib/admin/costops";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const result = await backfillHistoricalCosts();

    return NextResponse.json({
      success: true,
      data: result,
      meta: { backfilledAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[costops] Error during backfill:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to backfill historical costs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
