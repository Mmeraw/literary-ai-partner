import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import type { ConfirmedMode, ModeConfirmationAction } from "@/lib/evaluation/modeGate";
import { resolveModeConfirmation } from "@/lib/evaluation/modeGate";

export async function POST(req: Request, ctx: { params: { jobId: string } }) {
  try {
    const actor = getDevHeaderActor(req);
    const user = actor ? { id: actor.userId } : await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      action?: ModeConfirmationAction;
      confirmedMode?: ConfirmedMode;
    };

    const action = body.action;
    if (action !== "keep" && action !== "replace" && action !== "refine") {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const jobId = ctx.params.jobId;

    const { data: job, error: jobError } = await supabase
      .from("evaluation_jobs")
      .select("id,user_id,manuscripts(user_id)")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    const ownerUserId =
      (job as any)?.user_id ??
      ((job as any)?.manuscripts?.user_id ??
        (Array.isArray((job as any)?.manuscripts)
          ? (job as any).manuscripts[0]?.user_id
          : null));

    if (!ownerUserId || ownerUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    const { data: artifact, error: artifactError } = await supabase
      .from("evaluation_artifacts")
      .select("id, content")
      .eq("job_id", jobId)
      .eq("artifact_type", "evaluation_result_v2")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (artifactError || !artifact?.content) {
      return NextResponse.json(
        { ok: false, error: "Canonical evaluation_result_v2 artifact not found" },
        { status: 409 },
      );
    }

    const content = artifact.content as EvaluationResultV2;
    if (!content.detected_mode) {
      return NextResponse.json(
        { ok: false, error: "DetectedMode is missing from artifact" },
        { status: 409 },
      );
    }

    const resolved = resolveModeConfirmation({
      detectedMode: content.detected_mode,
      action,
      requestedMode: body.confirmedMode,
    });

    const updatedContent: EvaluationResultV2 = {
      ...content,
      confirmed_mode: resolved.confirmedMode,
      mode_telemetry: [...(content.mode_telemetry ?? []), resolved.telemetryEvent],
    };

    const { error: updateError } = await supabase
      .from("evaluation_artifacts")
      .update({ content: updatedContent })
      .eq("id", artifact.id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      job_id: jobId,
      confirmed_mode: updatedContent.confirmed_mode,
      mode_telemetry_count: updatedContent.mode_telemetry?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
