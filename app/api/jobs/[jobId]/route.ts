import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";

type Params = Promise<{ jobId: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { jobId } = await ctx.params;

  // 1) Extract caller identity from header (Flow 1 contract)
  const ownerId = req.headers.get("x-user-id");
  if (!ownerId) {
    return NextResponse.json(
      { ok: false, error: "Missing x-user-id" },
      { status: 401 }
    );
  }

  const job = await getJob(jobId);

  // 2) Not found
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  // 3) Ownership enforcement: non-owner gets 404 (do NOT reveal existence)
  if (job.user_id !== ownerId) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  // 4) Owner: return canonical envelope
  return NextResponse.json({ ok: true, job });
}
