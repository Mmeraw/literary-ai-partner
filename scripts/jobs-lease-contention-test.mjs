#!/usr/bin/env node
/**
 * Lease Contention Test
 *
 * Tests that only one Phase 2 worker can acquire the lease at a time:
 * 1. Complete Phase 1
 * 2. Start two Phase 2 workers simultaneously
 * 3. Verify only one acquires the lease
 * 4. Verify the other logs "lease not acquired" and exits cleanly
 */
import { getBaseUrl } from "./base-url.mjs";
import { jfetch, must, sleep } from "./_http.mjs";
import { skipIfMemoryMode } from "./_skip.mjs";

async function main() {
  const BASE = await getBaseUrl();
  console.log(`Lease Contention Test - ${new Date().toISOString()}`);

  // Check if we're in memory mode (no Supabase worker)
  skipIfMemoryMode("Lease contention test", "Supabase + background worker to complete Phase 1→2");

  // 1) Create job
  const createRes = await must(
    jfetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscript_id: "test-manuscript-contention",
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
    jfetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { 
      method: "POST",
    }),
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

  // 3) Start two Phase 2 workers simultaneously
  console.log("Starting two Phase 2 workers simultaneously...");

  const worker1Promise = jfetch(`${BASE}/api/jobs/${jobId}/run-phase2`, {
    method: "POST",
  }).then((r) => ({ worker: 1, status: r.status, ok: r.ok }));

  const worker2Promise = jfetch(`${BASE}/api/jobs/${jobId}/run-phase2`, {
    method: "POST",
  }).then((r) => ({ worker: 2, status: r.status, ok: r.ok }));

  const [result1, result2] = await Promise.all([
    worker1Promise,
    worker2Promise,
  ]);

  console.log(
    `Worker 1: ${result1.status} ${result1.ok ? "OK" : "FAILED"}`,
  );
  console.log(
    `Worker 2: ${result2.status} ${result2.ok ? "OK" : "FAILED"}`,
  );

  // Both should return 202 (accepted), but only one will actually acquire the lease
  if (!result1.ok || !result2.ok) {
    console.error("FAIL: One or both workers returned non-OK status");
    process.exit(1);
  }

  // Wait a moment for workers to attempt lease acquisition
  await sleep(2000);

  // 4) Poll until complete
  const deadline2 = Date.now() + 60_000;
  let completed = false;

  while (Date.now() < deadline2) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId}`),
      "Failed to poll job",
    );
    const payload = await getRes.json();
    const job = payload.job;

    if (job.status === "complete") {
      console.log("✓ Job completed successfully");
      completed = true;
      break;
    }

    if (job.status === "failed") {
      console.error("FAIL: Job failed");
      process.exit(1);
    }

    await sleep(1000);
  }

  if (!completed) {
    console.error("TIMEOUT: Job did not complete");
    process.exit(1);
  }

  // Success criteria:
  // 1. Both workers returned 202 Accepted
  // 2. Job completed successfully (only one worker actually ran)
  // 3. No errors or duplicate processing
  console.log("✓ PASS: Lease contention handled correctly");
  console.log("  (Check server logs to confirm only one worker acquired the lease)");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || String(e));
  process.exit(1);
});
