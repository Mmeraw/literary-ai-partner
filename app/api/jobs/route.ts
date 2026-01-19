import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Basic validation (keep simple for now)
    const manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;

    if (!manuscript_id || !job_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id, job_type" },
        { status: 400 }
      );
    }

    // TODO: wire to DB insert / queue logic
    return NextResponse.json(
      {
        ok: true,
        route: "/api/jobs",
        received: { manuscript_id, job_type },
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
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
