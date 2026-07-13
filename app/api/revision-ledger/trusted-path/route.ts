import { NextResponse } from "next/server";
import { applyTrustedPath } from "@/lib/revision/trustedPath";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/revision-ledger/trusted-path
 *
 * Canonical TrustedPath apply for the workbench-v2 button.
 * Delegates to lib/revision/trustedPath so the legacy /api/revise/trusted-path
 * and this endpoint share identical eligibility, ledger entry shape, and
 * final-review handoff.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const manuscriptId = body?.manuscriptId;
    const evaluationJobId = body?.evaluationJobId;

    if (!manuscriptId) {
      return NextResponse.json({ ok: false, error: "Missing manuscriptId" }, { status: 400 });
    }
    if (!evaluationJobId) {
      return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });
    }

    const result = await applyTrustedPath({ manuscriptId, evaluationJobId });

    if (!result.ok) {
      return NextResponse.json(result, { status: result.statusCode ?? 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not authenticated" ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
