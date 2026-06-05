/**
 * GET /api/admin/costs/agent-readiness?range=24h|5d|30d|all
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getLlmEventDashboardData } from "@/lib/admin/costopsLlmEvents";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const range = request.nextUrl.searchParams.get("range");
    const data = await getLlmEventDashboardData("agent_readiness", range);

    return NextResponse.json({
      success: true,
      data,
      meta: { fetchedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[costops/agent-readiness] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Agent Readiness cost data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
