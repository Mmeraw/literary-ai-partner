import { NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/jobs/store";
import { JobStatus } from "@/lib/jobs/types";

type Params = { id: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job }, { status: 200 });
}

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const current = getJob(id);
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "Job not found" },
      { status: 404 }
    );
  }

  if (current.status === "complete") {
    return NextResponse.json({ ok: true, job: current }, { status: 200 });
  }

  try {
    if (current.status === "queued") {
      updateJob(id, { status: "running" });
      const complete = updateJob(id, { status: "complete" });
      return NextResponse.json({ ok: true, job: complete }, { status: 200 });
    }

    if (current.status === "running") {
      const complete = updateJob(id, { status: "complete" });
      return NextResponse.json({ ok: true, job: complete }, { status: 200 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  try {
    const updates = await req.json();
    const updated = updateJob(id, updates);
    return NextResponse.json({ job: updated }, { status: 200 });
  } catch (e) {
    if (e.message === "Job not found") {
      return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
  }
}
  