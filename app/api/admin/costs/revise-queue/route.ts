/**
 * GET /api/admin/costs/revise-queue?range=24h|5d|30d|all
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getLlmEventDashboardData } from "@/lib/admin/costopsLlmEvents";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const range = request.nextUrl.searchParams.get("range");
    const data = await getLlmEventDashboardData("revise_queue", range);

    return NextResponse.json({
      success: true,
      data,
      meta: { fetchedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[costops/revise-queue] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Revise Queue cost data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
