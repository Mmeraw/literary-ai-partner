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
  ctx: { params: { manuscriptId: string; versionId: string } },
) {
  try {
    const manuscriptId = Number(ctx.params.manuscriptId);
    const versionId = (ctx.params.versionId ?? "").trim();

    const actor = getDevHeaderActor(req);
    let userId: string | null = actor?.userId ?? null;

    if (!userId) {
      const authUser = await getAuthenticatedUser();
      if (!authUser) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      userId = authUser.id;
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const result = await runSurfacePolishForManuscriptVersion({
      supabase: createAdminClient(),
      userId,
      manuscriptId,
      versionId,
      openaiApiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[surface-polish-api] Error:", error);

    if (error instanceof SurfacePolishPathwayError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
