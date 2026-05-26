import { NextResponse } from "next/server";
import { buildFinalReviewExport, type FinalReviewExportFormat } from "@/lib/revision/finalReviewRuntime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFormat(value: string | null): value is FinalReviewExportFormat {
  return value === "clean" || value === "marked" || value === "changelog";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const manuscriptId = url.searchParams.get("manuscriptId");
    const evaluationJobId = url.searchParams.get("evaluationJobId");
    const format = url.searchParams.get("format");

    if (!manuscriptId) return NextResponse.json({ ok: false, error: "Missing manuscriptId" }, { status: 400 });
    if (!evaluationJobId) return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });
    if (!isFormat(format)) return NextResponse.json({ ok: false, error: "Invalid or missing format" }, { status: 400 });

    const exportResult = await buildFinalReviewExport({ manuscriptId, evaluationJobId, format });
    return new NextResponse(exportResult.content, {
      headers: {
        "Content-Type": exportResult.contentType,
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not authenticated" ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
