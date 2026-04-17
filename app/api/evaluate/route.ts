
// app/api/evaluate/route.ts

import { createAdminClient } from "@/lib/supabase/admin";
import { PHASES } from "@/lib/jobs/types";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // Use admin client to bypass RLS for trusted server operations
    const supabase = createAdminClient();

    // 1) Auth: dev header actor (test-mode only) OR production session
    const actor = getDevHeaderActor(req);
    let userId: string | null = null;

    if (actor) {
      // Dev-only user identity from x-user-id header
      userId = actor.userId;
    } else {
      // Production path: Supabase session cookie
      const user = await getAuthenticatedUser();
      userId = user?.id ?? null;
    }

    if (!userId) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const manuscriptIdInput = body?.manuscript_id;
    const manuscriptTextInput =
      typeof body?.manuscript_text === "string"
        ? body.manuscript_text
        : typeof body?.content === "string"
        ? body.content
        : typeof body?.text === "string"
        ? body.text
        : "";
    const manuscriptTitleInput =
      typeof body?.manuscript_title === "string"
        ? body.manuscript_title
        : typeof body?.title === "string"
        ? body.title
        : "Untitled Manuscript";

    let manuscriptId: number | null = null;

    if (manuscriptIdInput !== undefined && manuscriptIdInput !== null) {
      // Reject ambiguous input: both manuscript_id and new text together is a contract violation.
      // Caller must choose: reference an existing row (manuscript_id only) or submit fresh text
      // (manuscript_text only). Mixing the two would silently evaluate the wrong manuscript.
      const trimmedTextForConflictCheck = manuscriptTextInput.trim();
      if (trimmedTextForConflictCheck.length > 0) {
        return Response.json(
          {
            ok: false,
            error:
              "Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.",
          },
          { status: 400 }
        );
      }

      const parsed = Number.parseInt(String(manuscriptIdInput), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return Response.json(
          { ok: false, error: "Invalid manuscript_id" },
          { status: 400 }
        );
      }
      manuscriptId = parsed;

      const { data: existingManuscript, error: manuscriptLookupError } = await supabase
        .from("manuscripts")
        .select("id,user_id")
        .eq("id", manuscriptId)
        .single();

      if (manuscriptLookupError || !existingManuscript) {
        return Response.json(
          { ok: false, error: "manuscript_id not found" },
          { status: 404 }
        );
      }

      if (existingManuscript.user_id !== userId) {
        return Response.json(
          { ok: false, error: "Forbidden: manuscript does not belong to user" },
          { status: 403 }
        );
      }
    }

    const trimmedText = manuscriptTextInput.trim();
    if (!manuscriptId && trimmedText.length === 0) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing manuscript input: provide manuscript_id or manuscript_text/content",
        },
        { status: 400 }
      );
    }

    // Step 1: Create manuscript
    if (!manuscriptId) {
      const encodedText = encodeURIComponent(trimmedText);
      const fileUrl = `data:text/plain;charset=utf-8,${encodedText}`;
      const fileSize = new TextEncoder().encode(trimmedText).length;
      const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

      const { data: manuscript, error: manuscriptError } = await supabase
        .from("manuscripts")
        .insert({
          title: manuscriptTitleInput.trim() || "Untitled Manuscript",
          user_id: userId,
          created_by: userId,
          file_url: fileUrl,
          file_size: fileSize,
          work_type: "novel",
          tone_context: "neutral",
          mood_context: "calm",
          voice_mode: "balanced",
          storygate_linked: false,
          allow_industry_discovery: false,
          is_final: false,
          source: "paste",
          english_variant: "us",
          word_count: wordCount,
        })
        .select("id")
        .single();

      if (manuscriptError || !manuscript) {
        console.error("Manuscript insert error:", manuscriptError);
        return Response.json(
          { ok: false, error: `Manuscript error: ${manuscriptError?.message}` },
          { status: 500 }
        );
      }

      manuscriptId = manuscript.id;
    }

    // Step 2: Create evaluation job
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .insert({
        manuscript_id: manuscriptId,
        user_id: userId,
        job_type: "full_evaluation",
        phase: PHASES.PHASE_1,
        phase_status: "queued",
        policy_family: "standard",
        voice_preservation_level: "balanced",
        english_variant: "us",
      })
      .select()
      .single();

    if (error) {
      console.error("Evaluation job insert error:", error);
      return Response.json(
        { ok: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    const cronSecret = process.env.CRON_SECRET?.trim();
    if (cronSecret) {
      const workerTriggerUrl = new URL("/api/workers/process-evaluations", req.url);
      void fetch(workerTriggerUrl.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      }).catch((triggerError: unknown) => {
        const triggerMessage =
          triggerError instanceof Error ? triggerError.message : String(triggerError);
        console.warn(
          "[evaluate] Best-effort worker trigger failed (cron will retry):",
          triggerMessage
        );
      });
    }

    // This return MUST be inside the POST function
    return Response.json(
      {
        ok: true,
        message: "Evaluation job created",
        job: {
          id: data.id,
          manuscript_id: manuscriptId,
          status: data.status,
          phase: data.phase,
          phase_1_status: data.phase_1_status,
          policy_family: data.policy_family,
          voice_preservation_level: data.voice_preservation_level,
          english_variant: data.english_variant,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Hard fail in /api/evaluate:", err);
    return Response.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
