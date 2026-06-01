import { NextResponse } from "next/server";
import { applyFinalReviewDecisions } from "@/lib/revision/finalReviewRuntime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return { manuscriptId: body?.manuscriptId, evaluationJobId: body?.evaluationJobId, wantsHtmlRedirect: false };
  }
  const form = await req.formData();
  return {
    manuscriptId: form.get("manuscriptId")?.toString(),
    evaluationJobId: form.get("evaluationJobId")?.toString(),
    wantsHtmlRedirect: true,
  };
}

export async function POST(req: Request) {
  try {
    const { manuscriptId, evaluationJobId, wantsHtmlRedirect } = await readBody(req);

    if (!manuscriptId) return NextResponse.json({ ok: false, error: "Missing manuscriptId" }, { status: 400 });
    if (!evaluationJobId) return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });

    const result = await applyFinalReviewDecisions({ manuscriptId, evaluationJobId });

    if (wantsHtmlRedirect) {
      const url = new URL(`/workbench/final-review`, req.url);
      url.searchParams.set("manuscriptId", manuscriptId);
      url.searchParams.set("evaluationJobId", evaluationJobId);
      url.searchParams.set(result.ok ? "applied" : "applyError", result.ok ? String(result.revisedVersionId ?? "true") : String(result.error ?? "Apply failed"));
      return NextResponse.redirect(url, { status: 303 });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not authenticated" ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
