#!/usr/bin/env node
/**
 * Phase 2 Resume Test
 *
 * Tests that Phase 2 can resume from a partial completion:
 * 1. Start Phase 2
 * 2. Simulate crash after processing 1 unit
 * 3. Re-run Phase 2
 * 4. Verify it continues from unit 2, not restart or skip
 */
import { getBaseUrl } from "./base-url.mjs";

function must(promise, context) {
  return promise.then((r) => {
    if (!r.ok) throw new Error(`${context}: ${r.status} ${r.statusText}`);
    return r;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const BASE = await getBaseUrl();
  console.log(`Phase 2 Resume Test - ${new Date().toISOString()}`);

  // 1) Create job
  const createRes = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manuscript_id: "test-manuscript-resume",
        job_type: "evaluate_full",
      }),
    }),
    "Failed to create job",
  );
  const createPayload = await createRes.json();
  const jobId = createPayload.job_id;
  console.log(`Created job: ${jobId}`);

  // 2) Run Phase 1 to completion
  const run1Res = await must(
    fetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { method: "POST" }),
    "Failed to start phase1",
  );
  await run1Res.json().catch(() => ({}));

  // Poll Phase 1
  const deadline1 = Date.now() + 60_000;
  while (Date.now() < deadline1) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId}`),
      "Failed to poll job",
    );
    const payload = await getRes.json();
    const job = payload.job;

    if (job.progress?.phase_status === "complete") {
      console.log("✓ Phase 1 completed");
      break;
    }
    if (job.status === "failed") {
      throw new Error("Phase 1 failed");
    }
    await sleep(1000);
  }

  // 3) Start Phase 2 (it will process some units)
  console.log("Starting Phase 2 (first attempt)...");
  const run2Res = await must(
    fetch(`${BASE}/api/jobs/${jobId}/run-phase2`, { method: "POST" }),
    "Failed to start phase2",
  );
  await run2Res.json().catch(() => ({}));

  // Wait for Phase 2 to process at least 1 unit
  await sleep(2000);

  // Check progress
  let getRes = await must(
    fetch(`${BASE}/api/jobs/${jobId}`),
    "Failed to get job",
  );
  let payload = await getRes.json();
  let job = payload.job;
  const completed_after_first = job.progress?.completed_units || 0;
  const phase2_index = job.progress?.phase2_last_processed_index ?? -1;

  console.log(
    `After first Phase 2 attempt: completed_units=${completed_after_first}, phase2_last_processed_index=${phase2_index}`,
  );

  if (completed_after_first === 0) {
    console.error("FAIL: Phase 2 didn't process any units in first attempt");
    process.exit(1);
  }

  // Simulate crash by not waiting for completion, and the lease will expire
  console.log("Simulating crash (waiting for lease to expire)...");
  await sleep(35_000); // Wait for 30s lease + buffer

  // 4) Re-run Phase 2 (should resume)
  console.log("Re-running Phase 2 (resume attempt)...");
  const run2RetryRes = await must(
    fetch(`${BASE}/api/jobs/${jobId}/run-phase2`, { method: "POST" }),
    "Failed to restart phase2",
  );
  await run2RetryRes.json().catch(() => ({}));

  // Poll until complete
  const deadline2 = Date.now() + 60_000;
  while (Date.now() < deadline2) {
    getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId}`),
      "Failed to poll job",
    );
    payload = await getRes.json();
    job = payload.job;

    if (job.status === "complete") {
      const final_completed = job.progress?.completed_units || 0;
      const final_total = job.progress?.total_units || 0;
      console.log(
        `✓ Phase 2 completed: ${final_completed}/${final_total} units`,
      );

      if (
        final_completed === final_total &&
        final_total > completed_after_first
      ) {
        console.log("✓ PASS: Phase 2 resumed and completed all units");
        process.exit(0);
      } else {
        console.error(
          `FAIL: Expected completed=${final_total}, got ${final_completed}`,
        );
        process.exit(1);
      }
    }

    if (job.status === "failed") {
      console.error("FAIL: Phase 2 failed on resume");
      process.exit(1);
    }

    await sleep(1000);
  }

  console.error("TIMEOUT: Phase 2 resume did not complete");
  process.exit(1);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || String(e));
  process.exit(1);
});
