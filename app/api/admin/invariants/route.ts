import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { runInvariantChecks } from "@/lib/observability/invariantChecks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const report = await runInvariantChecks(7);

    const passed = report.checks.filter((check) => check.passed).length;
    const failed = report.checks.length - passed;

    const invariants = report.checks.map((check) => ({
      id: check.id,
      name: check.id,
      status: check.passed ? "pass" : "fail",
      severity: check.passed ? "low" : "high",
      observed_count: check.passed ? 0 : 1,
      sample_job_ids: [],
    }));

    return NextResponse.json({
      success: true,
      ok: true,
      generated_at: report.generatedAt,
      invariants,
      data: {
        generatedAt: report.generatedAt,
        summary: {
          totalChecks: report.checks.length,
          passed,
          failed,
        },
        checks: report.checks,
        metrics: report.metrics,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run invariant checks",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
