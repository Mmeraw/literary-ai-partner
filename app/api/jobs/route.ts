import { NextResponse } from "next/server";
import { createJob } from "../../../lib/jobs/memoryStore";

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

    const job = createJob({ manuscript_id, job_type });

    return NextResponse.json(
      { ok: true, job_id: job.id, status: job.status },
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
