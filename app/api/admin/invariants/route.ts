// app/api/admin/invariants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type InvariantStatus = "pass" | "fail" | "warn";
type Severity = "high" | "medium" | "low";

type Invariant = {
  id: "INV-001" | "INV-002" | "INV-003" | "INV-004" | "INV-005";
  name: string;
  status: InvariantStatus;
  severity: Severity;
  description: string;
  observed_count: number;
  sample_job_ids: string[];
  threshold_seconds?: number;
};

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function countAndSample(
  supabase: ReturnType<typeof createAdminClient>,
  buildQuery: () => any
): Promise<{ observed_count: number; sample_job_ids: string[] }> {
  const countRes = await buildQuery().select("id", { count: "exact", head: true });
  if (countRes.error) throw countRes.error;

  const observed_count = countRes.count ?? 0;

  const sampleRes = await buildQuery().select("id").limit(10);
  if (sampleRes.error) throw sampleRes.error;

  const sample_job_ids = Array.isArray(sampleRes.data)
    ? sampleRes.data.map((r: { id: string }) => r.id)
    : [];

  return { observed_count, sample_job_ids };
}

export async function GET(request: NextRequest) {
  // Must call requireAdmin(req) immediately; deny must preserve 401/403.
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const supabase = createAdminClient();

    const nowIso = new Date().toISOString();
    const cutoff30m = isoMinutesAgo(30);
    const cutoff24h = isoMinutesAgo(24 * 60);

    // INV-001 — No stuck processing jobs
    const inv001 = await countAndSample(supabase, () =>
      supabase
        .from("evaluation_jobs")
        .select()
        .eq("status", "processing")
        .lt("heartbeat_at", cutoff30m)
    );

    const inv001Obj: Invariant = {
      id: "INV-001",
      name: "No stuck processing jobs",
      status: inv001.observed_count > 0 ? "fail" : "pass",
      severity: "high",
      description: "Jobs should not remain in processing beyond the threshold.",
      threshold_seconds: 1800,
      observed_count: inv001.observed_count,
      sample_job_ids: inv001.sample_job_ids,
    };

    // INV-002 — No expired leases
    const inv002 = await countAndSample(supabase, () =>
      supabase
        .from("evaluation_jobs")
        .select()
        .in("status", ["queued", "processing"])
        .lt("lease_until", nowIso)
    );

    const inv002Obj: Invariant = {
      id: "INV-002",
      name: "No expired leases",
      status: inv002.observed_count > 0 ? "fail" : "pass",
      severity: "high",
      description: "Queued/processing jobs should not have an expired lease.",
      observed_count: inv002.observed_count,
      sample_job_ids: inv002.sample_job_ids,
    };

    // INV-003 — No infinite retries
    const inv003 = await countAndSample(supabase, () =>
      supabase
        .from("evaluation_jobs")
        .select()
        .gte("attempts", 10)
        .not("status", "in", '("completed","failed","cancelled")')
    );

    const inv003Obj: Invariant = {
      id: "INV-003",
      name: "No infinite retries",
      status: inv003.observed_count > 0 ? "fail" : "pass",
      severity: "medium",
      description: "Jobs should not exceed max attempts without reaching a terminal status.",
      observed_count: inv003.observed_count,
      sample_job_ids: inv003.sample_job_ids,
    };

    // INV-004 — Completed jobs must have results
    const inv004 = await countAndSample(supabase, () =>
      supabase
        .from("evaluation_jobs")
        .select()
        .eq("status", "completed")
        .is("evaluation_result", null)
    );

    const inv004Obj: Invariant = {
      id: "INV-004",
      name: "Completed jobs must have results",
      status: inv004.observed_count > 0 ? "fail" : "pass",
      severity: "high",
      description: "Completed jobs should always persist an evaluation_result.",
      observed_count: inv004.observed_count,
      sample_job_ids: inv004.sample_job_ids,
    };

    // INV-005 — Dead-letter daily volume sanity
    const inv005 = await countAndSample(supabase, () =>
      supabase
        .from("evaluation_jobs")
        .select()
        .eq("status", "dead_lettered")
        .gte("created_at", cutoff24h)
    );

    const inv005Obj: Invariant = {
      id: "INV-005",
      name: "Dead-letter daily volume sanity",
      status: inv005.observed_count > 50 ? "warn" : "pass",
      severity: "low",
      description: "Dead-letter volume in the last 24 hours should remain within normal bounds.",
      observed_count: inv005.observed_count,
      sample_job_ids: inv005.sample_job_ids,
    };

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      invariants: [inv001Obj, inv002Obj, inv003Obj, inv004Obj, inv005Obj],
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to compute invariants",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
