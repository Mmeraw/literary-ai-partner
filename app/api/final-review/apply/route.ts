import { NextResponse } from "next/server";
import { applyFinalReviewDecisions } from "@/lib/revision/finalReviewRuntime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const manuscriptId = body?.manuscriptId;
    const evaluationJobId = body?.evaluationJobId;

    if (!manuscriptId) return NextResponse.json({ ok: false, error: "Missing manuscriptId" }, { status: 400 });
    if (!evaluationJobId) return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });

    const result = await applyFinalReviewDecisions({ manuscriptId, evaluationJobId });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not authenticated" ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
