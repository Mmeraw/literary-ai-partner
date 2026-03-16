import { NextResponse } from "next/server";
import { startRevisionEngine } from "@/lib/revision/engine";

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

export async function POST(req: Request) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const evaluation_run_id = body?.evaluation_run_id;

    if (!evaluation_run_id || typeof evaluation_run_id !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing required field: evaluation_run_id (uuid string)" },
        { status: 400 },
      );
    }

    const result = await startRevisionEngine({ evaluation_run_id });

    return NextResponse.json(
      {
        ok: true,
        revision_session: result.revision_session,
        proposals: result.proposals,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to start revision engine",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
