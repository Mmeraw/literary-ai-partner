import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createInitialVersion } from "@/lib/manuscripts/versions";

function decodeDataText(fileUrl: string | null | undefined): string {
  if (!fileUrl?.startsWith("data:")) return "";
  const comma = fileUrl.indexOf(",");
  if (comma === -1) return "";

  try {
    return decodeURIComponent(fileUrl.slice(comma + 1));
  } catch {
    return "";
  }
}

export async function POST(
  req: Request,
  ctx: { params: { manuscriptId: string } },
) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    const userId =
      authenticatedUser?.id ??
      (process.env.ALLOW_HEADER_USER_ID === "true"
        ? req.headers.get("x-user-id")
        : null);

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const manuscriptId = Number(ctx.params.manuscriptId);
    if (!Number.isInteger(manuscriptId) || manuscriptId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid manuscript id" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: manuscript, error: manuscriptError } = await supabase
      .from("manuscripts")
      .select("id,user_id,file_url,word_count")
      .eq("id", manuscriptId)
      .eq("user_id", userId)
      .maybeSingle();

    if (manuscriptError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load manuscript", details: manuscriptError.message },
        { status: 500 },
      );
    }

    if (!manuscript) {
      return NextResponse.json({ ok: false, error: "Manuscript not found" }, { status: 404 });
    }

    const sourceText = decodeDataText(manuscript.file_url);
    if (!sourceText.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Source snapshot missing. Please repair before evaluating.",
          details: "No source text payload found in manuscript file_url.",
        },
        { status: 422 },
      );
    }

    const sourceVersion = await createInitialVersion({
      manuscript_id: manuscriptId,
      raw_text: sourceText,
      word_count:
        typeof manuscript.word_count === "number"
          ? manuscript.word_count
          : sourceText.split(/\s+/).filter(Boolean).length,
      created_by: userId,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Source snapshot is available for evaluation.",
        manuscript_id: manuscriptId,
        manuscript_version_id: sourceVersion.id,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to repair manuscript source snapshot",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
