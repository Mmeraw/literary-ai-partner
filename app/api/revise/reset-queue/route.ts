import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * POST /api/revise/reset-queue
 *
 * Deletes the cached revision_opportunity_ledger_v1 artifact for a given
 * evaluation job, forcing the workbench to rebuild it from raw evaluation
 * data on next page load.
 *
 * Body: { evaluationJobId: string }
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const evaluationJobId = typeof body.evaluationJobId === "string" ? body.evaluationJobId.trim() : "";
    if (!evaluationJobId) {
      return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify the user owns this evaluation
    const { data: job, error: jobError } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, manuscripts!inner(user_id)")
      .eq("id", evaluationJobId)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json({ ok: false, error: "Evaluation job not found" }, { status: 404 });
    }

    const manuscripts = job.manuscripts as unknown;
    const ownerUserId = Array.isArray(manuscripts)
      ? (manuscripts[0] as Record<string, unknown>)?.user_id
      : (manuscripts as Record<string, unknown>)?.user_id;
    if (ownerUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // Delete the cached ledger artifact
    const { data: deleted, error: deleteError } = await supabase
      .from("evaluation_artifacts")
      .delete()
      .eq("job_id", evaluationJobId)
      .eq("artifact_type", "revision_opportunity_ledger_v1")
      .select("id");

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: `Failed to reset queue: ${deleteError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: deleted?.length ?? 0,
      message: deleted?.length
        ? "Queue cache cleared. Reload the workbench to rebuild from evaluation data."
        : "No cached queue found — the workbench will build fresh on next load.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
