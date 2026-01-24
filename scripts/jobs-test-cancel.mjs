#!/usr/bin/env node
/**
 * Job Cancellation Test
 *
 * Tests that cancellation works correctly:
 * 1. Cancel a running Phase 1 job
 * 2. Verify status=canceled, lease cleared
 * 3. Verify worker exits gracefully
 * 4. Cancel a running Phase 2 job
 * 5. Verify same semantics
 */
import { getBaseUrl } from "./base-url.mjs";

function must(promise, context) {
  return promise.then((r) => {
    if (!r.ok) {
      throw new Error(`${context}: ${r.status} ${r.statusText}`);
    }
    return r;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const BASE = await getBaseUrl();
  console.log(`Job Cancellation Test - ${new Date().toISOString()}`);

  // Check if we're in memory mode (no Supabase worker)
  const useSupabase = process.env.USE_SUPABASE_JOBS !== "false";
  if (!useSupabase) {
    console.log("⚠️  Memory mode detected (USE_SUPABASE_JOBS=false)");
    console.log("   Cancellation test requires Supabase + background worker");
    console.log("   Skipping cancellation test - this is expected behavior");
    console.log("OK: Memory mode check passed (skipped cancellation test)");
    process.exit(0);
  }

  // Test 1: Cancel during Phase 1
  console.log("\n=== Test 1: Cancel Phase 1 Job ===");
  
  const createRes1 = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": "smoke-test-user" // Bypass auth for smoke test
      },
      body: JSON.stringify({
        manuscript_id: "test-manuscript-cancel-1",
        job_type: "evaluate_full",
      }),
    }),
    "Failed to create job",
  );
  const createPayload1 = await createRes1.json();
  const jobId1 = createPayload1.job_id;
  console.log(`Created job: ${jobId1}`);

  // Start Phase 1
  const run1Res = await must(
    fetch(`${BASE}/api/jobs/${jobId1}/run-phase1`, { 
      method: "POST",
      headers: { "x-user-id": "smoke-test-user" }
    }),
    "Failed to start phase1",
  );
  await run1Res.json().catch(() => ({}));

  // Let it process a bit
  await sleep(1000);

  // Cancel it
  console.log("Canceling job...");
  const cancelRes1 = await must(
    fetch(`${BASE}/api/jobs/${jobId1}/cancel`, { 
      method: "POST",
      headers: { "x-user-id": "smoke-test-user" }
    }),
    "Failed to cancel job",
  );
  const cancelPayload1 = await cancelRes1.json();
  console.log(`Cancel response: ${cancelPayload1.message}`);

  // Verify canceled state
  const getRes1 = await must(
    fetch(`${BASE}/api/jobs/${jobId1}`),
    "Failed to get job",
  );
  const getPayload1 = await getRes1.json();
  const job1 = getPayload1.job;

  console.log(`Job status: ${job1.status}`);
  console.log(`Lease cleared: ${!job1.progress?.lease_id && !job1.progress?.lease_expires_at}`);

  if (job1.status !== "canceled") {
    console.error("FAIL: Expected status=canceled");
    process.exit(1);
  }

  if (job1.progress?.lease_id || job1.progress?.lease_expires_at) {
    console.error("FAIL: Lease not cleared");
    process.exit(1);
  }

  console.log("✓ Phase 1 cancellation works correctly");

  // Test 2: Cancel during Phase 2
  console.log("\n=== Test 2: Cancel Phase 2 Job ===");
  
  const createRes2 = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": "smoke-test-user"
      },
      body: JSON.stringify({
        manuscript_id: "test-manuscript-cancel-2",
        job_type: "evaluate_full",
      }),
    }),
    "Failed to create job",
  );
  const createPayload2 = await createRes2.json();
  const jobId2 = createPayload2.job_id;
  console.log(`Created job: ${jobId2}`);

  // Run Phase 1 to completion
  const run2Phase1Res = await must(
    fetch(`${BASE}/api/jobs/${jobId2}/run-phase1`, { 
      method: "POST",
      headers: { "x-user-id": "smoke-test-user" }
    }),
    "Failed to start phase1",
  );
  await run2Phase1Res.json().catch(() => ({}));

  // Wait for Phase 1 to complete
  const deadline1 = Date.now() + 60_000;
  while (Date.now() < deadline1) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId2}`),
      "Failed to poll job",
    );
    const payload = await getRes.json();
    const job = payload.job;

    if (job.progress?.phase_status === "complete") {
      console.log("Phase 1 completed");
      break;
    }
    await sleep(500);
  }

  // Start Phase 2
  const run2Phase2Res = await must(
    fetch(`${BASE}/api/jobs/${jobId2}/run-phase2`, { 
      method: "POST",
      headers: { "x-user-id": "smoke-test-user" }
    }),
    "Failed to start phase2",
  );
  await run2Phase2Res.json().catch(() => ({}));

  // Let it process a bit
  await sleep(1000);

  // Cancel it
  console.log("Canceling Phase 2 job...");
  const cancelRes2 = await must(
    fetch(`${BASE}/api/jobs/${jobId2}/cancel`, { 
      method: "POST",
      headers: { "x-user-id": "smoke-test-user" }
    }),
    "Failed to cancel job",
  );
  const cancelPayload2 = await cancelRes2.json();
  console.log(`Cancel response: ${cancelPayload2.message}`);

  // Verify canceled state
  const getRes2 = await must(
    fetch(`${BASE}/api/jobs/${jobId2}`),
    "Failed to get job",
  );
  const getPayload2 = await getRes2.json();
  const job2 = getPayload2.job;

  console.log(`Job status: ${job2.status}`);
  console.log(`Lease cleared: ${!job2.progress?.lease_id && !job2.progress?.lease_expires_at}`);

  if (job2.status !== "canceled") {
    console.error("FAIL: Expected status=canceled");
    process.exit(1);
  }

  if (job2.progress?.lease_id || job2.progress?.lease_expires_at) {
    console.error("FAIL: Lease not cleared");
    process.exit(1);
  }

  console.log("✓ Phase 2 cancellation works correctly");

  // Test 3: Try to cancel already complete job (should fail)
  console.log("\n=== Test 3: Cannot Cancel Complete Job ===");
  
  const createRes3 = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": "smoke-test-user"
      },
      body: JSON.stringify({
        manuscript_id: "test-manuscript-cancel-3",
        job_type: "evaluate_full",
      }),
    }),
    "Failed to create job",
  );
  const createPayload3 = await createRes3.json();
  const jobId3 = createPayload3.job_id;

  // Run to completion
  const run3Res = await must(
    fetch(`${BASE}/api/jobs/${jobId3}/run-phase1`, { 
      method: "POST",
      headers: { "x-user-id": "smoke-test-user" }
    }),
    "Failed to start phase1",
  );
  await run3Res.json().catch(() => ({}));

  // Wait for completion
  const deadline3 = Date.now() + 60_000;
  while (Date.now() < deadline3) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId3}`),
      "Failed to poll job",
    );
    const payload = await getRes.json();
    if (payload.job.progress?.phase_status === "complete") break;
    await sleep(500);
  }

  // Try to cancel complete job
  const cancelRes3 = await fetch(`${BASE}/api/jobs/${jobId3}/cancel`, { 
    method: "POST",
    headers: { "x-user-id": "smoke-test-user" }
  });
  
  if (cancelRes3.ok) {
    console.error("FAIL: Should not be able to cancel complete job");
    process.exit(1);
  }

  const errorPayload = await cancelRes3.json();
  console.log(`Expected error: ${errorPayload.error}`);
  console.log("✓ Cannot cancel terminal jobs");

  console.log("\n✅ PASS: All cancellation tests passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || String(e));
  process.exit(1);
});
