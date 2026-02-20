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

    // Step 1: Create manuscript
    const { data: manuscript, error: manuscriptError } = await supabase
      .from("manuscripts")
      .insert({ title: "Test Manuscript" })
      .select()
      .single();

    if (manuscriptError) {
      console.error("Manuscript insert error:", manuscriptError);
      return Response.json(
        { ok: false, error: `Manuscript error: ${manuscriptError.message}` },
        { status: 500 }
      );
    }

    // Step 2: Create evaluation job
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .insert({
        manuscript_id: manuscript.id,
        job_type: "full_evaluation",
        phase: PHASES.PHASE_1,
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

    // This return MUST be inside the POST function
    return Response.json(
      {
        ok: true,
        message: "Evaluation job created",
        job: {
          id: data.id,
          manuscript_id: manuscript.id,
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
