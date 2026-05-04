import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_UPLOAD_WORDS = 250_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function extractTextFromUpload(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  const isTxt = lowerName.endsWith(".txt") || file.type === "text/plain";
  const isDocx =
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (!isTxt && !isDocx) {
    throw new Error("Unsupported file type. Please upload .txt or .docx files.");
  }

  if (isTxt) {
    return await file.text();
  }

  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
  return result.value ?? "";
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .select("id,title,updated_at,word_count,file_size,source")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to list manuscripts", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, manuscripts: data ?? [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to list manuscripts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const fileEntry = form.get("file");
    const titleEntry = form.get("title");
    const englishVariantEntry = form.get("english_variant");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
    }

    if (fileEntry.size <= 0) {
      return NextResponse.json({ ok: false, error: "Uploaded file is empty" }, { status: 400 });
    }

    if (fileEntry.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Uploaded file exceeds ${MAX_UPLOAD_BYTES} bytes limit` },
        { status: 413 },
      );
    }

    const extractedText = (await extractTextFromUpload(fileEntry)).trim();
    if (!extractedText) {
      return NextResponse.json(
        { ok: false, error: "Unable to extract manuscript text from upload" },
        { status: 400 },
      );
    }

    const wordCount = countWords(extractedText);
    if (wordCount > MAX_UPLOAD_WORDS) {
      return NextResponse.json(
        { ok: false, error: `Uploaded manuscript exceeds ${MAX_UPLOAD_WORDS} words` },
        { status: 413 },
      );
    }

    const fileUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(extractedText)}`;
    const titleFromUpload =
      typeof titleEntry === "string" && titleEntry.trim().length > 0
        ? titleEntry.trim()
        : fileEntry.name.replace(/\.[^.]+$/, "") || "Untitled Manuscript";
    const englishVariant =
      typeof englishVariantEntry === "string" && englishVariantEntry.trim().length > 0
        ? englishVariantEntry.trim().toLowerCase()
        : "us";

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .insert({
        title: titleFromUpload,
        user_id: user.id,
        created_by: user.id,
        file_url: fileUrl,
        file_size: fileEntry.size,
        work_type: "novel",
        tone_context: "neutral",
        mood_context: "calm",
        voice_mode: "balanced",
        storygate_linked: false,
        allow_industry_discovery: false,
        is_final: false,
        source: "upload",
        english_variant: englishVariant,
        word_count: wordCount,
      })
      .select("id,title,updated_at,word_count,file_size,source")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "Failed to create manuscript", details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, manuscript: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to upload manuscript",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
