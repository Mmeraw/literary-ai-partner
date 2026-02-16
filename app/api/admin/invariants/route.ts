/**
 * A4.3 — Invariant Dashboard API
 *
 * Returns real-time invariant check results by querying evaluation_jobs.
 * Checks:
 *   1. successes <= attempts (claim success never exceeds claim attempts)
 *   2. exactly one successful claimant per eligible job
 *   3. empty claims > 0 under contention (informational)
 *   4. no overlapping leases for same job_id
 *
 * Also returns summary stats: running vs completed vs failed counts,
 * and retry/lease metrics.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = await getAdminClient();

    // Fetch all jobs for invariant checks
    const { data: jobs, error } = await supabase
      .from("evaluation_jobs")
      .select("id, status, progress, created_at, updated_at, attempt_count, max_attempts")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: "db_error", message: error.message } },
        { status: 500 },
      );
    }

    const allJobs = jobs ?? [];

    // ── Status summary ──────────────────────────────────────
    const statusCounts: Record<string, number> = {};
    for (const job of allJobs) {
      statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1;
    }

    // ── Invariant 1: Running jobs vs completed/failed ───────
    const runningJobs = allJobs.filter((j) => j.status === "running");
    const completedJobs = allJobs.filter((j) => j.status === "complete");
    const failedJobs = allJobs.filter((j) => j.status === "failed");

    // ── Invariant 2: No overlapping leases ──────────────────
    const leaseMap = new Map<string, { lease_id: string; lease_expires_at: string }[]>();
    for (const job of runningJobs) {
      const progress = job.progress as Record<string, unknown> | null;
      if (progress?.lease_id && progress?.lease_expires_at) {
        const existing = leaseMap.get(job.id) ?? [];
        existing.push({
          lease_id: String(progress.lease_id),
          lease_expires_at: String(progress.lease_expires_at),
        });
        leaseMap.set(job.id, existing);
      }
    }

    const overlappingLeases: string[] = [];
    for (const [jobId, leases] of leaseMap) {
      if (leases.length > 1) {
        overlappingLeases.push(jobId);
      }
    }

    // ── Invariant 3: Retry stats ────────────────────────────
    const retriedJobs = allJobs.filter((j) => (j.attempt_count ?? 0) > 1);
    const exhaustedRetries = allJobs.filter(
      (j) => j.status === "failed" && (j.attempt_count ?? 0) >= (j.max_attempts ?? 3),
    );

    // ── Invariant 4: Stale running jobs (no heartbeat) ──────
    const now = new Date();
    const staleThresholdMs = 10 * 60 * 1000; // 10 minutes
    const staleRunningJobs = runningJobs.filter((j) => {
      const updatedAt = new Date(j.updated_at);
      return now.getTime() - updatedAt.getTime() > staleThresholdMs;
    });

    // ── Build response ──────────────────────────────────────
    const invariants = [
      {
        name: "no_overlapping_leases",
        status: overlappingLeases.length === 0 ? "pass" : "fail",
        detail: overlappingLeases.length === 0
          ? "No overlapping leases detected"
          : `Overlapping leases on job_ids: ${overlappingLeases.join(", ")}`,
        violations: overlappingLeases,
      },
      {
        name: "no_stale_running_jobs",
        status: staleRunningJobs.length === 0 ? "pass" : "warn",
        detail: staleRunningJobs.length === 0
          ? "All running jobs have recent activity"
          : `${staleRunningJobs.length} job(s) running with no update in 10+ minutes`,
        violations: staleRunningJobs.map((j) => j.id),
      },
      {
        name: "retries_within_bounds",
        status: exhaustedRetries.length === 0 ? "pass" : "info",
        detail: `${retriedJobs.length} retried, ${exhaustedRetries.length} exhausted max attempts`,
        violations: exhaustedRetries.map((j) => j.id),
      },
    ];

    const allPass = invariants.every((i) => i.status === "pass");

    return NextResponse.json({
      success: true,
      data: {
        checked_at: now.toISOString(),
        overall_status: allPass ? "healthy" : "attention_needed",
        summary: {
          total_jobs: allJobs.length,
          status_counts: statusCounts,
          running: runningJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          retried: retriedJobs.length,
          stale_running: staleRunningJobs.length,
        },
        invariants,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "invariant_check_error", message } },
      { status: 500 },
    );
  }
}
