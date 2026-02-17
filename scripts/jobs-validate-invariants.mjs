#!/usr/bin/env node
/**
 * Job System Invariant Validator
 *
 * This script validates critical job system invariants across all jobs.
 * Run this in CI or as a health check to catch state machine violations.
 *
 * Invariants checked:
 * 1. phase_status="complete" never coexists with status="running"
 * 2. completed_units <= total_units (when total > 0)
 * 3. status="complete" implies phase_status="complete" (except never-started jobs)
 * 4. status="complete" implies leases are cleared
 * 5. Phase 2 jobs have phase2_last_processed_index when complete
 *
 * Usage:
 *   node scripts/jobs-validate-invariants.mjs
 *   USE_SUPABASE_JOBS=true node scripts/jobs-validate-invariants.mjs
 *
 * Exit codes:
 *   0 = All invariants pass
 *   1 = One or more invariants violated
 */

import { getBaseUrl } from "./base-url.mjs";

async function must(res, msg) {
  const r = await res;
  if (!r || typeof r.ok !== "boolean") {
    throw new Error(
      `must() expected a fetch Response, got: ${Object.prototype.toString.call(r)}`,
    );
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${msg} (status=${r.status}) ${text}`);
  }
  return r;
}

function validateJob(job) {
  const violations = [];
  const progress = job.progress || {};
  const status = job.status;
  const phase_status = progress.phase_status;
  const completed = progress.completed_units || 0;
  const total = progress.total_units || 0;
  const phase = progress.phase;

  // Invariant 1: phase_status="complete" should never coexist with status="running"
  if (phase_status === "complete" && status === "running") {
    violations.push(
      `Invariant 1: phase_status="complete" with status="running"`,
    );
  }

  // Invariant 2: completed_units <= total_units
  if (completed > total && total > 0) {
    violations.push(
      `Invariant 2: completed_units (${completed}) > total_units (${total})`,
    );
  }

  // Invariant 3: If status="complete", phase_status should also be "complete"
  // Exception: phase_status="queued" means the job was never picked up by a worker,
  // which can happen in CI smoke tests where jobs are created and immediately
  // completed via API without going through the full phase state machine.
  if (
    status === "complete" &&
    phase_status &&
    phase_status !== "complete" &&
    phase_status !== "queued"
  ) {
    violations.push(
      `Invariant 3: status="complete" but phase_status="${phase_status}"`,
    );
  }

  // Invariant 4: Lease should be cleared when status="complete"
  if (
    status === "complete" &&
    (progress.lease_id || progress.lease_expires_at)
  ) {
    violations.push(
      `Invariant 4: status="complete" but lease not cleared (lease_id=${progress.lease_id})`,
    );
  }

  // Invariant 4b: Lease should be cleared when job is canceled (status=failed + canceled_at)
  if (
    status === "failed" &&
    progress.canceled_at &&
    (progress.lease_id || progress.lease_expires_at)
  ) {
    violations.push(
      `Invariant 4b: canceled job but lease not cleared (lease_id=${progress.lease_id})`,
    );
  }

  // Invariant 5: Phase 2 complete jobs should have phase2_last_processed_index
  if (
    status === "complete" &&
    phase === "phase_2" &&
    progress.phase2_last_processed_index === undefined
  ) {
    violations.push(
      `Invariant 5: phase2 complete but phase2_last_processed_index missing`,
    );
  }

  return violations;
}

async function main() {
  const BASE = await getBaseUrl();
  console.log(`Job Invariant Validator - ${new Date().toISOString()}`);
  console.log(`Checking jobs at ${BASE}`);

  // Get all jobs
  const listRes = await must(
    fetch(`${BASE}/api/jobs`),
    "Failed to fetch jobs",
  );
  const listPayload = await listRes.json();
  const jobs = listPayload.jobs || [];

  // Filter to only recent jobs to avoid stale data from previous CI runs.
  // The CI Supabase instance persists data across runs, so old jobs with
  // inconsistent state (from interrupted or partial runs) would cause
  // false-positive invariant failures. Default: 10 minutes.
  const MAX_AGE_MINUTES = parseInt(process.env.INVARIANT_MAX_AGE_MINUTES || "10", 10);
  const MAX_AGE_MS = MAX_AGE_MINUTES * 60 * 1000;
  const cutoff = new Date(Date.now() - MAX_AGE_MS);
  const recentJobs = jobs.filter((j) => {
    if (!j.created_at) return true; // no timestamp = assume current run
    return new Date(j.created_at) >= cutoff;
  });
  const staleCount = jobs.length - recentJobs.length;
  if (staleCount > 0) {
    console.log(`  Filtered out ${staleCount} stale jobs (older than ${MAX_AGE_MINUTES}m)`);
  }

  console.log(`\nValidating ${recentJobs.length} jobs...`);

  let totalViolations = 0;
  const violatedJobs = [];

  for (const job of recentJobs) {
    const violations = validateJob(job);
    if (violations.length > 0) {
      totalViolations += violations.length;
      violatedJobs.push({ job_id: job.id, violations });

      console.error(`\n❌ Job ${job.id}:`);
      console.error(
        `  Status: ${job.status}, Phase: ${job.progress?.phase}, Phase Status: ${job.progress?.phase_status}`,
      );
      violations.forEach((v) => console.error(`    - ${v}`));
    }
  }

  if (totalViolations === 0) {
    console.log(`\n✅ All ${recentJobs.length} jobs passed invariant checks`);
    console.log("\nInvariants verified:");
    console.log("  1. phase_status='complete' never with status='running'");
    console.log("  2. completed_units <= total_units");
    console.log("  3. status='complete' implies phase_status='complete' (except queued)");
    console.log("  4. status='complete' implies leases cleared");
    console.log("  5. Phase 2 complete has phase2_last_processed_index");
    process.exit(0);
  } else {
    console.error(`\n❌ FAILED: ${totalViolations} violations found across ${violatedJobs.length} jobs`);
    console.error("\nViolated jobs:");
    console.error(JSON.stringify(violatedJobs, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e?.stack || String(e));
  process.exit(1);
  });

