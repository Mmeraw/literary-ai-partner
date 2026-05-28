import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as metrics from "@/lib/jobs/metrics";
import { PHASES } from "@/lib/jobs/types";

/**
 * POST /api/dev/metrics-smoke
 * 
 * Executes metrics hooks with edge cases to prove they never throw.
 * Used by scripts/jobs-test-metrics.mjs for audit-grade verification.
 * 
 * **Auth:** Requires CRON_SECRET Bearer token. Blocked in production.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available in production" }, { status: 404 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!cronSecret || !bearer) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const aHash = crypto.createHash("sha256").update(bearer, "utf8").digest();
  const bHash = crypto.createHash("sha256").update(cronSecret, "utf8").digest();
  if (!crypto.timingSafeEqual(aHash, bHash)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Normal cases
    metrics.onJobCreated("test-job-1", "evaluate_full");
    metrics.onPhaseCompleted("test-job-1", PHASES.PHASE_1A, 5000);
    metrics.onJobFailed("test-job-1", PHASES.PHASE_1A, "Test error");
    metrics.onJobCompleted("test-job-1", "evaluate_full", 10000);
    metrics.onJobCanceled("test-job-1", PHASES.PHASE_2);
    metrics.onRetryScheduled("test-job-1", 3, PHASES.PHASE_1A);

    // Edge cases - null/undefined
    metrics.onJobCreated(null as any, null as any);
    metrics.onPhaseCompleted(undefined as any, undefined as any, -1);
    metrics.onJobFailed("", "", "");

    // Edge cases - large numbers
    metrics.onPhaseCompleted("test", PHASES.PHASE_1A, Number.MAX_SAFE_INTEGER);
    metrics.onPhaseCompleted("test", PHASES.PHASE_1A, Number.NaN);
    metrics.onPhaseCompleted("test", PHASES.PHASE_1A, Infinity);
    metrics.onRetryScheduled("test", 999999, PHASES.PHASE_1A);

    // Edge cases - special characters
    metrics.onJobCreated("job-with-特殊字符-🚀", "type<>with&chars");
    metrics.onJobFailed("test", PHASES.PHASE_1A, "Error\nwith\nnewlines\tand\ttabs");
    metrics.onJobFailed("test", PHASES.PHASE_1A, JSON.stringify({ nested: { error: "object" } }));

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
  } catch (e: unknown) {
    return NextResponse.json(
      { 
        ok: false, 
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
