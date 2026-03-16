import { NextResponse } from "next/server";
import { finalizeRevisionEngine } from "@/lib/revision/engine";

function checkServiceRole(req: Request): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const serviceRoleHeader = req.headers.get("x-service-role");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const expectedServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return authHeader === expectedKey || serviceRoleHeader === expectedServiceRole;
}

type RouteParams = {
  params: Promise<{
    revisionSessionId: string;
  }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 },
    );
  }

  try {
    const { revisionSessionId } = await params;

    if (!revisionSessionId || typeof revisionSessionId !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing route param: revisionSessionId" },
        { status: 400 },
      );
    }

    const result = await finalizeRevisionEngine(revisionSessionId);

    return NextResponse.json(
      {
        ok: true,
        revision_session: result.revision_session,
        apply_result: result.apply_result,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to finalize revision session",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
