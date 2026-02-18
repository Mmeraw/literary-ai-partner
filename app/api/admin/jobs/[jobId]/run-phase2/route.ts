// app/api/admin/jobs/[jobId]/run-phase2/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhase2Aggregation } from "@/lib/evaluation/phase2";

type Ok = { ok: true; job_id: string; phase2: "persisted" };
type Err = { ok: false; error: string; details?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: { jobId: string } }
) {
  // 1) Admin gate must be first
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const supabase = createAdminClient();
    const jobId = ctx.params.jobId;

    const result = await runPhase2Aggregation(supabase, jobId);

    if (!result.ok) {
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
