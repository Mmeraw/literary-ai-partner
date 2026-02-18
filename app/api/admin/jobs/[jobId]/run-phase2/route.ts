// app/api/admin/jobs/[jobId]/run-phase2/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhase2Aggregation, isPhase2Err } from "@/lib/evaluation/phase2";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

type Ok = { ok: true; job_id: string; phase2: "persisted" };
type Err = { ok: false; error: string; details?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: { jobId: string } }
) {
  // 1) Admin gate: dev header actor (test-mode only) OR production auth
  const actor = getDevHeaderActor(req);
  if (actor?.isAdmin) {
    // Dev-only admin bypass: TEST_MODE + ALLOW_HEADER_USER_ID are both true
    // and actor has admin signal — continue to phase2 logic
  } else {
    // Production path: require real Supabase session + admin role
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const supabase = createAdminClient();
    const jobId = ctx.params.jobId;

    const result = await runPhase2Aggregation(supabase, jobId);

    if (isPhase2Err(result)) {
      // Type guard narrows result to Phase2Err
      const payload: Err = {
        ok: false,
        error: "Failed to run phase2",
        details: result.details ?? result.error,
      };
      return NextResponse.json(payload, { status: 500 });
    }

    const payload: Ok = { ok: true, job_id: jobId, phase2: "persisted" };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const payload: Err = {
      ok: false,
      error: "Failed to run phase2",
      details: err instanceof Error ? err.message : "Unknown error",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
