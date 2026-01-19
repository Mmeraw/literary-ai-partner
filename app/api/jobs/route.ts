import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;

    if (!manuscript_id || !job_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id, job_type" },
        { status: 400 }
      );
    }

    // TODO: Replace this stub with DB insert / queue logic.
    // For now, generate a job_id so the client has a stable handle.
    const job_id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "00000000-0000-0000-0000-000000000000";

    return NextResponse.json(
      {
        ok: true,
        job_id,
        status: "queued",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, route: "/api/jobs", message: "Use POST to create a job." },
    { status: 200 }
  );
}
