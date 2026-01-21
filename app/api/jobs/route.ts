import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";

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

    const job = await createJob({ manuscript_id, job_type });

    return NextResponse.json(
      { ok: true, job_id: job.id, status: job.status },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

export async function GET() {
  const jobs = await getAllJobs();
  return NextResponse.json({ jobs }, { status: 200 });
}
