#!/usr/bin/env tsx
/**
 * Resets jobs that are stuck in 'running' status with expired leases
 * 
 * Usage: tsx scripts/reset-stuck-jobs.ts [jobId]
 * 
 * Without jobId: Resets all stuck jobs
 * With jobId: Resets specific job only
 */

import { createAdminClient } from "../lib/supabase/admin";

async function resetStuckJobs(specificJobId?: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  console.log(`[ResetStuckJobs] Checking for stuck jobs...`);

  // Find jobs that are "running" but have expired leases
  let query = supabase
    .from("evaluation_jobs")
    .select("id, status, progress, updated_at")
    .eq("status", "running");

  if (specificJobId) {
    query = query.eq("id", specificJobId);
  }

  const { data: jobs, error: fetchError } = await query;

  if (fetchError) {
    console.error("Failed to fetch jobs:", fetchError);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("No running jobs found");
    return;
  }

  console.log(`Found ${jobs.length} running job(s)`);

  const stuckJobs = jobs.filter((job) => {
    const leaseExpiresAt = job.progress?.lease_expires_at;
    if (!leaseExpiresAt) return false;
    
    const expiresDate = new Date(leaseExpiresAt);
    return expiresDate <= new Date();
  });

  if (stuckJobs.length === 0) {
    console.log("No stuck jobs with expired leases found");
    return;
  }

  console.log(`\nFound ${stuckJobs.length} stuck job(s) with expired leases:`);
  stuckJobs.forEach((job) => {
    const expired = job.progress?.lease_expires_at;
    console.log(`  - ${job.id} (lease expired: ${expired})`);
  });

  console.log(`\nResetting to 'queued' status...`);

  for (const job of stuckJobs) {
    const resetProgress = {
      ...job.progress,
      lease_id: null,
      lease_expires_at: null,
      phase_status: "queued",
      message: job.progress?.message || "Retrying after lease expiration",
    };

    const { error: updateError } = await supabase
      .from("evaluation_jobs")
      .update({
        status: "queued",
        progress: resetProgress,
        updated_at: now,
      })
      .eq("id", job.id);

    if (updateError) {
      console.error(`  ✗ Failed to reset ${job.id}:`, updateError);
    } else {
      console.log(`  ✓ Reset ${job.id} to queued status`);
    }
  }

  console.log("\nDone!");
}

// Get jobId from command line args
const specificJobId = process.argv[2];

resetStuckJobs(specificJobId).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
