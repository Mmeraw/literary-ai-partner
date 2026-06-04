/**
 * CostOps Dashboard API
 *
 * GET /api/admin/costs?range=24h|5d|30d|all
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getCostOpsDashboardData } from "@/lib/admin/costops";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const range = request.nextUrl.searchParams.get("range");
    const data = await getCostOpsDashboardData(range);

    return NextResponse.json({
      success: true,
      data,
      meta: { fetchedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[costops] Error fetching CostOps data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch CostOps data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
