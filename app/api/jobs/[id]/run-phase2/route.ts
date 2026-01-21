import { NextResponse } from "next/server";
import { runPhase2 } from "@/lib/jobs/phase2";
import { getJob, canRunPhase } from "@/lib/jobs/store";

type Params = { id: string };

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const eligibility = canRunPhase(job, "phase2");
  if (!eligibility.ok) {
    return NextResponse.json({ ok: false, error: eligibility.reason }, { status: 409 });
  }

  console.log("Phase2Started", { job_id: id });

  // Fire-and-forget - worker will atomically handle the running state via lease acquisition
  setTimeout(() => { void runPhase2(id); }, 0);

  return NextResponse.json(
    { ok: true, job_id: id, status: "running" },
    { status: 202 }
  );
}
