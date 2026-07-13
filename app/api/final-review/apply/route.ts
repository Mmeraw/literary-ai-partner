import { NextResponse } from "next/server";
import { applyFinalReviewDecisions } from "@/lib/revision/finalReviewRuntime";
import { getFinalReviewPayload } from "@/lib/revision/finalReview";
import { buildAnchoredMarkedPreview } from "@/lib/revision/finalReviewPresentation";

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

function redirectResult(req: Request, manuscriptId: string, evaluationJobId: string, result: { ok: boolean; revisedVersionId?: string | null; appliedCount?: number; error?: string | null }) {
  const url = new URL("/workbench/final-review", req.url);
  url.searchParams.set("manuscriptId", manuscriptId);
  url.searchParams.set("evaluationJobId", evaluationJobId);
  if (result.ok) {
    url.searchParams.set("applied", String(result.revisedVersionId ?? "true"));
    url.searchParams.set("appliedCount", String(result.appliedCount ?? 0));
  } else {
    url.searchParams.set("applyError", String(result.error ?? "Apply failed"));
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: Request) {
  try {
    const { manuscriptId, evaluationJobId, wantsHtmlRedirect } = await readBody(req);

    if (!manuscriptId) return NextResponse.json({ ok: false, error: "Missing manuscriptId" }, { status: 400 });
    if (!evaluationJobId) return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });

    const payload = await getFinalReviewPayload({ manuscriptId, evaluationJobId });
    if (!payload.ok) {
      const result = { ok: false, error: payload.error ?? "Final Review is not ready." };
      return wantsHtmlRedirect ? redirectResult(req, manuscriptId, evaluationJobId, result) : NextResponse.json(result, { status: 409 });
    }

    const applicableCount = payload.acceptedCount + payload.customCount;
    const anchored = buildAnchoredMarkedPreview(payload.sourceText, payload.decisions);
    const preflightError = !payload.sourceAvailable
      ? "Apply is unavailable because the full manuscript source text is not connected."
      : applicableCount === 0
        ? "No accepted or custom decisions are staged for application."
        : anchored.unmatchedDecisionCount > 0
          ? `${anchored.unmatchedDecisionCount} accepted or custom decision${anchored.unmatchedDecisionCount === 1 ? " lacks" : "s lack"} a unique exact source match.`
          : null;

    if (preflightError) {
      const result = { ok: false, error: preflightError };
      return wantsHtmlRedirect ? redirectResult(req, manuscriptId, evaluationJobId, result) : NextResponse.json(result, { status: 409 });
    }

    const result = await applyFinalReviewDecisions({ manuscriptId, evaluationJobId });

    if (wantsHtmlRedirect) return redirectResult(req, manuscriptId, evaluationJobId, result);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not authenticated" ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
