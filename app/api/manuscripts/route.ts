import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveManuscriptTitle } from "@/lib/manuscripts/title";
import { createInitialVersion } from "@/lib/manuscripts/versions";
import { selectChunkerConfig } from "@/lib/manuscripts/chunking";
import { getConfiguredChunkCap } from "@/lib/evaluation/pipeline/chunkCap";
import { enforceApiRateLimit } from "@/lib/security/apiRateLimit";
import { requireUser } from "@/lib/security/apiGuards";

const MAX_UPLOAD_WORDS = 250_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["txt", "docx"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);
const BLOCKED_FILENAME_EXTENSIONS = [
  "exe", "dll", "com", "msi", "bat", "cmd", "ps1", "sh", "js", "mjs", "cjs", "ts", "php", "py", "rb", "jar", "scr", "html", "svg",
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateChunkCount(text: string, wordCount: number): number {
  if (wordCount <= 0) return 0;
  const cfg = selectChunkerConfig(wordCount);
  const avgCharsPerWord = Math.max(1, text.length / wordCount);
  const targetWordsPerChunk = Math.max(1, Math.floor(cfg.targetChars / avgCharsPerWord));
  return Math.ceil(wordCount / targetWordsPerChunk);
}

function getSafeFileName(rawName: string): string {
  const normalized = rawName.replace(/[\\/\0]/g, "").trim();
  return normalized.slice(0, 120) || "upload";
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

function isBlockedFilename(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return BLOCKED_FILENAME_EXTENSIONS.some((ext) => lower.includes(`.${ext}`));
}

async function extractTextFromUpload(file: File): Promise<string> {
  const safeName = getSafeFileName(file.name);
  const lowerName = safeName.toLowerCase();
  const extension = getFileExtension(lowerName);
  const normalizedMime = (file.type || "").toLowerCase();

  if (isBlockedFilename(lowerName)) {
    throw new Error("Unsupported file type. Please upload .txt or .docx files.");
  }

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file extension. Please upload .txt or .docx files.");
  }

  if (normalizedMime && !ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new Error("Unsupported file content type. Please upload .txt or .docx files.");
  }

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
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .select("id,title,updated_at,word_count,file_size,source")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to list manuscripts" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, manuscripts: data ?? [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to list manuscripts",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const rateLimitDenied = enforceApiRateLimit(req, {
      bucket: "manuscript_upload",
      limit: 25,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimitDenied) return rateLimitDenied;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid upload request. Please use the file upload control and try again.",
        },
        { status: 415 },
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "We couldn't read that DOCX file. Please try again or upload a .txt/.docx file.",
        },
        { status: 400 },
      );
    }
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

    const chunkCap = getConfiguredChunkCap();
    const estimatedChunkCount = estimateChunkCount(extractedText, wordCount);
    if (estimatedChunkCount > chunkCap) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your manuscript is currently above our long-form evaluation ceiling. Please contact us about long-form processing.",
          code: "MANUSCRIPT_CHUNK_CEILING_EXCEEDED",
          details: {
            estimated_chunk_count: estimatedChunkCount,
            chunk_cap: chunkCap,
            word_count: wordCount,
          },
        },
        { status: 413 },
      );
    }

    const safeFileName = getSafeFileName(fileEntry.name);
    const fileUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(extractedText)}`;
    const titleFromUpload = resolveManuscriptTitle({
      explicitTitle: titleEntry,
      text: extractedText,
      fileName: safeFileName,
      fallback: "Imported Manuscript",
    });
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
        { ok: false, error: "Failed to create manuscript" },
        { status: 500 },
      );
    }

    try {
      await createInitialVersion({
        manuscript_id: Number(data.id),
        raw_text: extractedText,
        word_count: wordCount,
        created_by: user.id,
      });
    } catch (versionError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to create manuscript source snapshot",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, manuscript: data, deduped: false }, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const looksLikeParseIssue = error instanceof SyntaxError || /json|unexpected token/i.test(details);

    return NextResponse.json(
      {
        ok: false,
        error: looksLikeParseIssue
          ? "We couldn't read that DOCX file. Please try again or upload a .txt/.docx file."
          : "Failed to upload manuscript",
      },
      { status: looksLikeParseIssue ? 400 : 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const manuscriptIdParam = new URL(req.url).searchParams.get("id");
    const manuscriptId = Number(manuscriptIdParam);

    if (!manuscriptIdParam || !Number.isInteger(manuscriptId) || manuscriptId <= 0) {
      return NextResponse.json({ ok: false, error: "Valid manuscript id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .delete()
      .eq("user_id", user.id)
      .eq("id", manuscriptId)
      .select("id");

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to delete manuscript" },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: "Manuscript not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted: data[0]?.id ?? manuscriptId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to delete manuscript",
      },
      { status: 500 },
    );
  }
}
