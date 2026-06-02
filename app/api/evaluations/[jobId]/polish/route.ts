/**
 * POST /api/evaluations/[jobId]/polish
 *
 * Triggers the Polish Pass for a completed evaluation.
 * No charge — lightweight surface scan for grammar, passive voice, adverbs,
 * punctuation, repetition, spelling.
 *
 * Prerequisites:
 * - Evaluation must be complete (status = 'complete')
 * - User must own the manuscript
 *
 * Returns: { ok: true, findings_count: number, opportunities: [...] }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import {
  runPolishPass,
  polishFindingsToOpportunities,
} from "@/lib/evaluation/polishPass";
import { upsertEvaluationArtifact } from "@/lib/evaluation/artifactPersistence";

export const maxDuration = 300; // 5 minutes — Polish Pass may need time for long manuscripts

export async function POST(
  req: Request,
  ctx: { params: { jobId: string } },
) {
  try {
    const { jobId } = ctx.params;
    const supabase = createAdminClient();

    // Auth
    const actor = getDevHeaderActor(req);
    let userId: string | null = null;
    if (actor) {
      userId = actor.userId;
    } else {
      const authUser = await getAuthenticatedUser();
      if (!authUser) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      userId = authUser.id;
    }

    // Fetch job and verify ownership + completion
    const { data: job, error: jobErr } = await supabase
      .from("evaluation_jobs")
      .select("id, status, manuscript_id, user_id")
      .eq("id", jobId)
      .single();

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

    // Fetch manuscript text
    const { data: manuscript, error: msErr } = await supabase
      .from("manuscripts")
      .select("id, title, content, work_type, word_count, user_id")
      .eq("id", job.manuscript_id)
      .single();

    if (msErr || !manuscript || !manuscript.content) {
      return NextResponse.json(
        { ok: false, error: "Manuscript text not available" },
        { status: 404 },
      );
    }

    // Run Polish Pass
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { ok: false, error: "OpenAI API key not configured" },
        { status: 500 },
      );
    }

    const result = await runPolishPass({
      manuscriptText: manuscript.content,
      title: manuscript.title || "Untitled",
      genre: manuscript.work_type || "fiction",
      wordCount: manuscript.word_count || manuscript.content.split(/\s+/).length,
      openaiApiKey,
    });

    // Convert findings to revision opportunities
    const opportunities = polishFindingsToOpportunities(result.findings);

    // Persist as artifact (append to existing ledger or create new)
    if (opportunities.length > 0) {
      await upsertEvaluationArtifact({
        supabase,
        jobId,
        manuscriptId: Number(manuscript.id),
        artifactType: "polish_pass_v1",
        artifactVersion: "polish_pass_v1",
        sourceHash: `polish:${jobId}:${result.prompt_version}`,
        content: {
          findings: result.findings,
          opportunities,
          chunks_processed: result.chunks_processed,
          duration_ms: result.duration_ms,
          prompt_version: result.prompt_version,
          generated_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      findings_count: result.findings.length,
      opportunities_count: opportunities.length,
      chunks_processed: result.chunks_processed,
      duration_ms: result.duration_ms,
      opportunities,
    });
  } catch (err) {
    console.error("[polish-pass-api] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
