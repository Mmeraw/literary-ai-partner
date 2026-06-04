import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import {
  runPass4VoiceRewrite,
  extractVoiceContext,
} from "@/lib/revision/runPass4VoiceRewrite";

/**
 * POST /api/revise/generate-rewrite
 *
 * On-demand voice-conditioned rewrite generator.
 * Takes a single revision opportunity and generates manuscript-ready
 * A/B/C candidates in the author's voice.
 *
 * Body: {
 *   evaluationJobId: string;
 *   manuscriptId: string;
 *   opportunityId: string;
 *   originalPassage: string;
 *   editorialInstruction: string;
 *   symptom: string;
 *   cause: string;
 *   mistakeProofing?: string;
 *   operation: string;
 *   location: string;
 * }
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const {
      evaluationJobId,
      manuscriptId,
      originalPassage,
      editorialInstruction,
      symptom,
      cause,
      mistakeProofing,
      operation,
      location,
    } = body;

    if (!evaluationJobId || !manuscriptId || !originalPassage) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: evaluationJobId, manuscriptId, originalPassage" },
        { status: 400 },
      );
    }

    // Word count gate — only generate for passages ≤ 1200 words
    const wordCount = originalPassage.split(/\s+/).length;
    if (wordCount > 1200) {
      return NextResponse.json(
        { ok: false, error: "Passage exceeds 1200 words. Use strategy mode for long passages." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Verify the user owns the manuscript
    const { data: manuscript, error: msError } = await supabase
      .from("manuscripts")
      .select("id, user_id")
      .eq("id", Number(manuscriptId))
      .eq("user_id", user.id)
      .maybeSingle();

    if (msError || !manuscript) {
      return NextResponse.json({ ok: false, error: "Manuscript not found" }, { status: 404 });
    }

    // Load manuscript text for voice conditioning
    const { data: versionData } = await supabase
      .from("evaluation_jobs")
      .select("manuscript_version_id")
      .eq("id", evaluationJobId)
      .maybeSingle();

    let manuscriptText = "";
    if (versionData?.manuscript_version_id) {
      const { data: version } = await supabase
        .from("manuscript_versions")
        .select("raw_text")
        .eq("id", versionData.manuscript_version_id)
        .maybeSingle();
      manuscriptText = version?.raw_text ?? "";
    }

    if (!manuscriptText) {
      // Fallback: try loading from manuscripts table directly
      const { data: msText } = await supabase
        .from("manuscripts")
        .select("content")
        .eq("id", Number(manuscriptId))
        .maybeSingle();
      manuscriptText = msText?.content ?? "";
    }

    // Extract voice context from surrounding manuscript
    const voiceContext = extractVoiceContext(manuscriptText, originalPassage, 300);

    const result = await runPass4VoiceRewrite({
      originalPassage,
      editorialInstruction: editorialInstruction || "Revise this passage to address the diagnosed issue.",
      symptom: symptom || "",
      cause: cause || "",
      mistakeProofing: mistakeProofing || "",
      operation: operation || "replace",
      voiceContext,
      location: location || "",
    });

    return NextResponse.json({
      ok: true,
      candidates: {
        a: result.a,
        b: result.b,
        c: result.c,
      },
      meta: {
        model: result.model,
        promptVersion: result.promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error generating rewrite";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
