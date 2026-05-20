import { NextResponse } from "next/server";

/**
 * POST /api/jobs/[jobId]/run-phase1
 *
 * RETIRED — This route is no longer operational.
 * The legacy phase_1 execution path was removed when the pipeline was
 * migrated to the atomic worker-relay model (phase_1a → phase_2 → phase_3).
 *
 * Workers claim jobs via the process-evaluations relay; no external caller
 * should be hitting this endpoint.
 *
 * Returns 410 Gone permanently.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Legacy phase_1 route retired; use worker relay phase_1a",
    },
    { status: 410 }
  );
}

