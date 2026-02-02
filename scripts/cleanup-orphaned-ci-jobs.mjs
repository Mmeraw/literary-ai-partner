#!/usr/bin/env node
/**
 * Maintenance Script: Clean Up Orphaned CI Jobs
 * 
 * Purpose: Remove jobs that are stuck in status='running' with lease_until=null
 * These are typically leftover from:
 *   - CI test failures
 *   - Interrupted test runs
 *   - Manual testing
 * 
 * Safety: Only touches jobs older than 1 hour to avoid interfering with active tests
 * 
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/cleanup-orphaned-ci-jobs.mjs
 *   
 * Options:
 *   DRY_RUN=true  - Only report what would be cleaned, don't delete
 */

import { createClient } from "@supabase/supabase-js";

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const DRY_RUN = process.env.DRY_RUN === "true";

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

async function cleanupOrphanedJobs() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Orphaned CI Jobs Cleanup");
  console.log("  Mode:", DRY_RUN ? "DRY RUN (no deletions)" : "LIVE (will delete)");
  console.log("  Timestamp:", new Date().toISOString());
  console.log("════════════════════════════════════════════════════════\n");

  // Find orphaned running jobs (older than 1 hour for safety)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: orphans, error: fetchError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, lease_until, created_at, manuscript_id")
    .eq("status", "running")
    .is("lease_until", null)
    .lt("created_at", oneHourAgo)
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.error("❌ Failed to query orphaned jobs:", fetchError.message);
    process.exitCode = 1;
    return;
  }

  if (!orphans || orphans.length === 0) {
    console.log("✅ No orphaned jobs found (all clean!)");
    return;
  }

  console.log(`Found ${orphans.length} orphaned job(s) older than 1 hour:\n`);
  
  for (const job of orphans) {
    const age = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
    console.log(`  Job ${job.id}`);
    console.log(`    Status: ${job.status}, Lease: ${job.lease_until || "null"}`);
    console.log(`    Created: ${job.created_at} (${age} minutes ago)`);
    console.log(`    Manuscript: ${job.manuscript_id}`);
  }

  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN: Would mark these jobs as 'failed' with reason 'orphaned_ci_job'");
    console.log("   Run without DRY_RUN=true to execute cleanup");
    return;
  }

  console.log("\n🔧 Marking orphaned jobs as 'failed'...\n");

  let successCount = 0;
  let failCount = 0;

  for (const job of orphans) {
    const { error: updateError } = await supabase
      .from("evaluation_jobs")
      .update({
        status: "failed",
        phase_status: "failed",
        failed_at: new Date().toISOString(),
        error: "Orphaned CI job: status=running with lease_until=null, marked failed by maintenance script",
        lease_until: null,
        lease_token: null,
        worker_id: null,
      })
      .eq("id", job.id);

    if (updateError) {
      console.error(`  ❌ Failed to update job ${job.id}: ${updateError.message}`);
      failCount++;
    } else {
      console.log(`  ✅ Marked job ${job.id} as failed`);
      successCount++;
    }
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log(`  Cleanup complete: ${successCount} updated, ${failCount} failed`);
  console.log("════════════════════════════════════════════════════════\n");

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

cleanupOrphanedJobs().catch((err) => {
  console.error("\n❌ Cleanup script failed:");
  console.error(err.message);
  if (err.stack) console.error(err.stack);
  process.exitCode = 1;
});
