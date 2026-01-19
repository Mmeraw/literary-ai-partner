import { NextResponse } from "next/server";
import {
  getJob,
  isValidTransition,
  updateJobStatus,
  type JobStatus,
} from "../../../../../lib/jobs/memoryStore";

type Params = { id: string };

function transitionOr409(id: string, from: JobStatus, to: JobStatus) {
  if (!isValidTransition(from, to)) {
    return NextResponse.json(
      { ok: false, error: `Invalid status transition: ${from} -> ${to}` },
      { status: 409 }
    );
  }

  const updated = updateJobStatus(id, to);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  return updated;
}

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const current = getJob(id);
  if (!current) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  if (current.status === "complete") {
    return NextResponse.json({ ok: true, job: current }, { status: 200 });
  }

  if (current.status === "queued") {
    const running = transitionOr409(id, current.status, "running");
    if (running instanceof NextResponse) return running;

    const complete = transitionOr409(id, running.status, "complete");
    if (complete instanceof NextResponse) return complete;

    return NextResponse.json({ ok: true, job: complete }, { status: 200 });
  }

  if (current.status === "running") {
    const complete = transitionOr409(id, current.status, "complete");
    if (complete instanceof NextResponse) return complete;

    return NextResponse.json({ ok: true, job: complete }, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, error: `Job not runnable from status: ${current.status}` },
    { status: 409 }
  );
}
