import { NextResponse } from "next/server";
import { getJob, updateJob, canRunPhase } from "@/lib/jobs/store";
import { runPhase1 } from "@/lib/jobs/phase1";
import { JobStatus } from "@/lib/jobs/types";

type Params = { id: string };

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const eligibility = canRunPhase(job, "phase_1");
  if (!eligibility.ok) {
    return NextResponse.json({ ok: false, error: eligibility.reason }, { status: 409 });
  }

  console.log("Phase1Started", { job_id: id });

  // Fire-and-forget - worker will atomically transition queued→running via lease acquisition
  setTimeout(async () => { 
    try {
      await runPhase1(id);
    } catch (err) {
      console.error(`[Phase1Route] FATAL ERROR for job ${id}:`, err);
      console.error(`[Phase1Route] Error stack:`, err instanceof Error ? err.stack : 'no stack');
    }
  }, 0);

  return NextResponse.json(
    { ok: true, job_id: id, status: "queued" },
    { status: 202 }
  );
}
