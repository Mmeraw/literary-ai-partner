/**
 * POST /api/evaluations/[jobId]/polish
 *
 * Compatibility endpoint for legacy report pages. It no longer runs the full
 * evaluation pipeline. It resolves the completed job's manuscript version and
 * delegates to the manuscript-version Surface Polish pathway.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import {
  SurfacePolishPathwayError,
  runSurfacePolishForManuscriptVersion,
} from "@/lib/evaluation/polishPathway";

export const maxDuration = 300;

export async function POST(
  req: Request,
  ctx: { params: { jobId: string } },
) {
  try {
    const { jobId } = ctx.params;
    const supabase = createAdminClient();

    const actor = getDevHeaderActor(req);
    let userId: string | null = actor?.userId ?? null;

    if (!userId) {
      const authUser = await getAuthenticatedUser();
      if (!authUser) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      userId = authUser.id;
    }

    const { data: job, error: jobErr } = await supabase
      .from("evaluation_jobs")
      .select("id, status, manuscript_id, manuscript_version_id, user_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json({ ok: false, error: "Evaluation not found" }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    if (job.status !== "complete") {
      return NextResponse.json(
        { ok: false, error: "Evaluation must be complete before running Polish Pass" },
        { status: 400 },
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const result = await runSurfacePolishForManuscriptVersion({
      supabase,
      userId,
      manuscriptId: Number(job.manuscript_id),
      versionId: job.manuscript_version_id ?? "latest",
      openaiApiKey,
      requiredEvaluationJobId: jobId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[polish-pass-api] Error:", err);

    if (err instanceof SurfacePolishPathwayError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
