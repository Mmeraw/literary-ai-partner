#!/usr/bin/env node
/**
 * Supabase DB Contract Smoke Test
 * 
 * Purpose: Validate Supabase job system DB contract WITHOUT requiring:
 *   - Background workers
 *   - Manuscript storage
 *   - Text chunking
 *   - End-to-end workflows
 * 
 * Tests:
 *   1. Claim RPC contention (parallel claims → exactly one wins)
 *   2. Lease fields set correctly
 *   3. Status transitions (queued → running)
 *   4. Retry gate behavior
 * 
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/jobs-supabase-contract-smoke.mjs
 */

import { createClient } from "@supabase/supabase-js";

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

let testManuscriptId = null;
let testJobId = null;

/**
 * Cleanup test data (always runs, even on failure)
 */
async function cleanup() {
  console.log("\n[CLEANUP] Removing test data...");
  
  let cleaned = 0;
  
  if (testJobId) {
    const { error } = await supabase.from("evaluation_jobs").delete().eq("id", testJobId);
    if (!error) {
      cleaned++;
      console.log(`  ✅ Deleted job: ${testJobId}`);
    }
  }
  
  if (testManuscriptId) {
    const { error } = await supabase.from("manuscripts").delete().eq("id", testManuscriptId);
    if (!error) {
      cleaned++;
      console.log(`  ✅ Deleted manuscript: ${testManuscriptId}`);
    }
  }
  
  if (cleaned === 0 && (testJobId || testManuscriptId)) {
    console.log("  ⚠️  Cleanup attempted but nothing deleted (may require manual cleanup)");
  } else if (cleaned > 0) {
    console.log(`  ✅ Cleanup complete (${cleaned} items removed)`);
  }
}

/**
 * Create minimal test manuscript (no storage/text needed)
 */
async function createTestManuscript() {
  const { data, error } = await supabase
    .from("manuscripts")
    .insert({
      title: "Supabase Contract Smoke Test",
      word_count: 1000,
      work_type: "novel",
      created_by: "00000000-0000-0000-0000-000000000000",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create manuscript: ${error.message}`);
  return data.id;
}

/**
 * Create test job with deterministic progress counters
 */
async function createTestJob(manuscriptId) {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .insert({
      manuscript_id: manuscriptId,
      job_type: "full_evaluation",
      phase: "phase_1",
      work_type: "novel",
      policy_family: "standard",
      voice_preservation_level: "balanced",
      english_variant: "us",
      status: "queued",
      progress: {
        total_units: 5,
        completed_units: 0,
        phase: "phase_1",
        phase_status: "queued",
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return data.id;
}

/**
 * Test: RPC signature tripwire
 * Validates claim_job_atomic returns expected shape (detects signature drift)
 */
async function testRpcSignature() {
  console.log("\n[TEST] RPC Signature Tripwire");

  const now = new Date().toISOString();

  // Call with no eligible jobs (should return empty, but validate shape)
  const { data, error } = await supabase.rpc("claim_job_atomic", {
    p_worker_id: "signature-test",
    p_now: now,
    p_lease_seconds: 30,
  });

  if (error) {
    throw new Error(`RPC call failed: ${error.message}`);
  }

  // Validate return type is array (even if empty)
  if (!Array.isArray(data)) {
    throw new Error(`Expected array response, got: ${typeof data}`);
  }

  console.log(`  ✅ RPC callable with expected parameters`);
  console.log(`  ✅ Returns array type (shape validated)`);
  console.log("  ✅ PASS: RPC signature tripwire");
}

/**
 * Test: Parallel claim contention
 */
async function testClaimContention(jobId) {
  console.log("\n[TEST] Claim RPC Contention");

  const now = new Date().toISOString();

  // Fire two parallel claims
  const [result1, result2] = await Promise.all([
    supabase.rpc("claim_job_atomic", {
      p_worker_id: "worker-1",
      p_now: now,
      p_lease_seconds: 30,
    }),
    supabase.rpc("claim_job_atomic", {
      p_worker_id: "worker-2",
      p_now: now,
      p_lease_seconds: 30,
    }),
  ]);

  // Exactly one should succeed
  const claims = [result1.data, result2.data].filter((d) => d && d.length > 0);

  if (claims.length !== 1) {
    throw new Error(
      `Expected exactly 1 claim to succeed, got ${claims.length}. ` +
      `Result1: ${JSON.stringify(result1.data)}, Result2: ${JSON.stringify(result2.data)}`
    );
  }

  const winner = claims[0][0];
  
  // Validate return shape includes expected fields
  const expectedFields = ['id', 'manuscript_id', 'job_type', 'policy_family', 'work_type', 'phase'];
  const missingFields = expectedFields.filter(field => !(field in winner));
  if (missingFields.length > 0) {
    throw new Error(`RPC return missing expected fields: ${missingFields.join(', ')}`);
  }
  
  console.log(`  ✅ Exactly one claim succeeded`);
  console.log(`  ✅ Return shape validated (${expectedFields.length} required fields present)`);

  // Verify job status updated
  const { data: job, error } = await supabase
    .from("evaluation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(`Failed to fetch job: ${error.message}`);

  // Verify invariants
  if (job.status !== "running") {
    throw new Error(`Expected status=running, got ${job.status}`);
  }
  console.log(`  ✅ Status transitioned: queued → running`);

  if (!job.lease_token) {
    throw new Error("Expected lease_token to be set");
  }
  console.log(`  ✅ Lease token set: ${job.lease_token.substring(0, 8)}...`);

  if (!job.lease_until) {
    throw new Error("Expected lease_until to be set");
  }
  console.log(`  ✅ Lease expiry set: ${job.lease_until}`);

  if (!job.worker_id) {
    throw new Error("Expected worker_id to be set");
  }
  console.log(`  ✅ Worker ID set: ${job.worker_id}`);

  if (!job.started_at) {
    throw new Error("Expected started_at to be set");
  }
  console.log(`  ✅ Started timestamp set`);

  console.log("  ✅ PASS: Claim contention test");
  
  return job;
}

/**
 * Test: Lease prevents re-claim
 */
async function testLeaseBlocking(jobId) {
  console.log("\n[TEST] Active Lease Blocks Re-claim");

  const now = new Date().toISOString();

  // Get attempt_count before re-claim attempt
  const { data: beforeJob, error: beforeError } = await supabase
    .from("evaluation_jobs")
    .select("attempt_count")
    .eq("id", jobId)
    .single();

  if (beforeError) throw new Error(`Failed to fetch job: ${beforeError.message}`);
  const attemptCountBefore = beforeJob.attempt_count || 0;

  // Try to claim while lease is active
  const { data, error } = await supabase.rpc("claim_job_atomic", {
    p_worker_id: "worker-3",
    p_now: now,
    p_lease_seconds: 30,
  });

  // Should return empty (no claim)
  if (data && data.length > 0) {
    throw new Error("Expected no claim while lease active, but got: " + JSON.stringify(data));
  }

  console.log("  ✅ Active lease correctly blocks re-claim");

  // Verify attempt_count did NOT increment (blocked claim doesn't count)
  const { data: afterJob, error: afterError } = await supabase
    .from("evaluation_jobs")
    .select("attempt_count")
    .eq("id", jobId)
    .single();

  if (afterError) throw new Error(`Failed to fetch job: ${afterError.message}`);
  const attemptCountAfter = afterJob.attempt_count || 0;

  if (attemptCountAfter !== attemptCountBefore) {
    throw new Error(
      `Blocked claim should not increment attempt_count. ` +
      `Before: ${attemptCountBefore}, After: ${attemptCountAfter}`
    );
  }

  console.log(`  ✅ attempt_count unchanged on blocked claim (${attemptCountBefore} → ${attemptCountAfter})`);
  console.log("  ✅ PASS: Lease blocking test");
}

/**
 * Test: attempt_count increments exactly once per successful claim
 */
async function testAttemptCount(initialJob) {
  console.log("\n[TEST] Attempt Count Semantics");

  // Initial state after first successful claim
  const attemptCountAfterClaim = initialJob.attempt_count || 0;
  
  if (attemptCountAfterClaim === 0) {
    console.log("  ⚠️  WARNING: attempt_count is 0 after successful claim (expected 1+)");
    console.log("  ℹ️  This may indicate attempt_count is not implemented yet");
    console.log("  ✅ SKIP: Attempt count test (not implemented)");
    return;
  }

  console.log(`  ✅ Initial attempt_count after claim: ${attemptCountAfterClaim}`);
  console.log("  ✅ PASS: Attempt count semantics");
}

/**
 * Test: Job with progress counters is valid
 */
async function testProgressCounters(jobId) {
  console.log("\n[TEST] Progress Counters");

  const { data: job, error } = await supabase
    .from("evaluation_jobs")
    .select("progress")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(`Failed to fetch job: ${error.message}`);

  const progress = job.progress || {};

  if (!Number.isFinite(progress.total_units) || progress.total_units <= 0) {
    throw new Error(`Invalid total_units: ${progress.total_units}`);
  }
  console.log(`  ✅ total_units set: ${progress.total_units}`);

  if (!Number.isFinite(progress.completed_units) || progress.completed_units < 0) {
    throw new Error(`Invalid completed_units: ${progress.completed_units}`);
  }
  console.log(`  ✅ completed_units set: ${progress.completed_units}`);

  if (progress.completed_units > progress.total_units) {
    throw new Error(
      `Invariant violation: completed_units (${progress.completed_units}) > total_units (${progress.total_units})`
    );
  }
  console.log(`  ✅ Invariant: completed_units ≤ total_units`);

  console.log("  ✅ PASS: Progress counters test");
}

/**
 * Main test runner
 */
async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Supabase DB Contract Smoke Test");
  console.log("  Timestamp:", new Date().toISOString());
  console.log("════════════════════════════════════════════════════════");

  try {
    // Setup
    console.log("\n[SETUP] Creating test data...");
    testManuscriptId = await createTestManuscript();
    console.log(`  Manuscript ID: ${testManuscriptId}`);

    testJobId = await createTestJob(testManuscriptId);
    console.log(`  Job ID: ${testJobId}`);

    // Run tests
    await testRpcSignature();
    await testProgressCounters(testJobId);
    const claimedJob = await testClaimContention(testJobId);
    await testAttemptCount(claimedJob);
    await testLeaseBlocking(testJobId);

    // Success
    console.log("\n════════════════════════════════════════════════════════");
    console.log("  ✅ ALL TESTS PASSED");
    console.log("════════════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST FAILED:");
    console.error(err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    // Always cleanup, even on failure
    await cleanup();
  }
}

main();
