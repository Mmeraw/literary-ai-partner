import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";

type Params = Promise<{ jobId: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { jobId } = await ctx.params;
  
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, job });
}
