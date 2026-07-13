import { NextResponse } from "next/server";
import { applyTrustedPath, previewTrustedPath } from "@/lib/revision/trustedPath";

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function serverError(error: unknown) {
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : String(error) },
    { status: 500 },
  );
}

/**
 * GET /api/revise/trusted-path?manuscriptId=...&evaluationJobId=...
 *
 * Preview how many findings are eligible for TrustedPath.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const manuscriptId = url.searchParams.get("manuscriptId");
    const evaluationJobId = url.searchParams.get("evaluationJobId");

    if (!manuscriptId) return badRequest("Missing manuscriptId");
    if (!evaluationJobId) return badRequest("Missing evaluationJobId");

    const preview = await previewTrustedPath({ manuscriptId, evaluationJobId });
    return NextResponse.json({ ok: true, ...preview });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/revise/trusted-path
 *
 * Apply TrustedPath: auto-accept all eligible copy-paste repairs and return
 * a `finalReviewUrl` the legacy workbench can redirect to.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const manuscriptId = body?.manuscriptId;
    const evaluationJobId = body?.evaluationJobId;

    if (!manuscriptId) return badRequest("Missing manuscriptId");
    if (!evaluationJobId) return badRequest("Missing evaluationJobId");

    const result = await applyTrustedPath({ manuscriptId, evaluationJobId });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return serverError(error);
  }
}
