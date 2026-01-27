import { NextResponse } from "next/server";
import * as metrics from "@/lib/jobs/metrics";
import { PHASES } from "@/lib/jobs/types";

/**
 * POST /api/dev/metrics-smoke
 * 
 * Executes metrics hooks with edge cases to prove they never throw.
 * Used by scripts/jobs-test-metrics.mjs for audit-grade verification.
 */
export async function POST() {
  try {
    // Normal cases
    metrics.onJobCreated("test-job-1", "evaluate_full");
    metrics.onPhaseCompleted("test-job-1", PHASES.PHASE_1, 5000);
    metrics.onJobFailed("test-job-1", PHASES.PHASE_1, "Test error");
    metrics.onJobCompleted("test-job-1", "evaluate_full", 10000);
    metrics.onJobCanceled("test-job-1", PHASES.PHASE_2);
    metrics.onRetryScheduled("test-job-1", 3, PHASES.PHASE_1);

    // Edge cases - null/undefined
    metrics.onJobCreated(null as any, null as any);
    metrics.onPhaseCompleted(undefined as any, undefined as any, -1);
    metrics.onJobFailed("", "", "");

    // Edge cases - large numbers
    metrics.onPhaseCompleted("test", PHASES.PHASE_1, Number.MAX_SAFE_INTEGER);
    metrics.onPhaseCompleted("test", PHASES.PHASE_1, Number.NaN);
    metrics.onPhaseCompleted("test", PHASES.PHASE_1, Infinity);
    metrics.onRetryScheduled("test", 999999, PHASES.PHASE_1);

    // Edge cases - special characters
    metrics.onJobCreated("job-with-特殊字符-🚀", "type<>with&chars");
    metrics.onJobFailed("test", PHASES.PHASE_1, "Error\nwith\nnewlines\tand\ttabs");
    metrics.onJobFailed("test", PHASES.PHASE_1, JSON.stringify({ nested: { error: "object" } }));

    return NextResponse.json({ 
      ok: true,
      message: "All metrics hooks executed without throwing",
      tested: [
        "onJobCreated",
        "onPhaseCompleted", 
        "onJobFailed",
        "onJobCompleted",
        "onJobCanceled",
        "onRetryScheduled",
      ],
      edge_cases: [
        "null/undefined values",
        "empty strings",
        "large numbers (MAX_SAFE_INTEGER, NaN, Infinity)",
        "special characters (unicode, emojis, HTML)",
        "newlines and tabs",
        "nested JSON objects",
      ]
    });
  } catch (e: any) {
    return NextResponse.json(
      { 
        ok: false, 
        error: e?.message || String(e),
        stack: e?.stack 
      },
      { status: 500 }
    );
  }
}
