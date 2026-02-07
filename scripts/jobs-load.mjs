console.log("jobs-load test", new Date().toISOString());
import { getBaseUrl } from "./base-url.mjs";
const N = parseInt(process.env.JOBS_LOAD_N || "5");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function must(res, msg) {
  const r = await res;
  if (!r || typeof r.ok !== "boolean") {
    throw new Error(`must() expected a fetch Response, got: ${Object.prototype.toString.call(r)}`);
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${msg} (status=${r.status}) ${text}`);
  }
  return r;
}

async function runLoadTest() {
  const BASE = await getBaseUrl();
  const jobIds = [];

  // Create N jobs
  for (let i = 0; i < N; i++) {
    const createRes = await must(
      fetch(`${BASE}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: "evaluate_full", manuscript_id: `test-manuscript-${i}` })
      }),
      `Failed to create job ${i}`
    );
    const created = await createRes.json();
    const jobId = created.job_id;
    jobIds.push(jobId);
    console.log(`Created job ${jobId}`);
  }

  // Run Phase 1 for each
  for (const jobId of jobIds) {
    const run1Res = await must(
      fetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { method: "POST" }),
      `Failed to start phase1 for ${jobId}`
    );
    await run1Res.json().catch(() => {});
  }

  // Wait for all Phase 1 to complete
  const deadline1 = Date.now() + 120_000; // 2 min
  while (Date.now() < deadline1) {
    let allComplete = true;
    for (const jobId of jobIds) {
      const getRes = await must(
        fetch(`${BASE}/api/jobs/${jobId}`),
        `Failed to poll job ${jobId}`
      );
      const payload = await getRes.json();
      const job = payload.job;
      if (job.status !== "complete" || job.progress.phase !== "phase_1" || job.progress.phase_status !== "complete") {
        allComplete = false;
        break;
      }
    }
    if (allComplete) break;
    await sleep(2000);
  }

  if (Date.now() >= deadline1) {
    throw new Error("Phase 1 did not complete for all jobs");
  }

  console.log("All Phase 1 completed, starting Phase 2");

  // Run Phase 2 for each
  for (const jobId of jobIds) {
    const run2Res = await must(
      fetch(`${BASE}/api/jobs/${jobId}/run-phase2`, { method: "POST" }),
      `Failed to start phase2 for ${jobId}`
    );
    await run2Res.json().catch(() => {});
  }

  // Wait for all Phase 2 to complete and assert invariants
  const deadline2 = Date.now() + 120_000;
  const initialLeaseIds = new Map(jobIds.map(id => [id, null]));
  while (Date.now() < deadline2) {
    let allComplete = true;
    for (const jobId of jobIds) {
      const getRes = await must(
        fetch(`${BASE}/api/jobs/${jobId}`),
        `Failed to poll job ${jobId}`
      );
      const payload = await getRes.json();
      const job = payload.job;

      // Track lease_id
      if (job.progress.phase_status === "running" && !initialLeaseIds.get(jobId)) {
        initialLeaseIds.set(jobId, job.progress.lease_id);
      }
      if (job.progress.phase_status === "running" && initialLeaseIds.get(jobId) && job.progress.lease_id !== initialLeaseIds.get(jobId)) {
        throw new Error(`Job ${jobId} lease_id changed during running: ${initialLeaseIds.get(jobId)} -> ${job.progress.lease_id}`);
      }

      // Assert invariants
      if (job.status !== "complete") {
        allComplete = false;
        continue;
      }
      if (job.progress.phase !== "phase_2" || job.progress.phase_status !== "complete") {
        throw new Error(`Job ${jobId} phase invariant failed`);
      }
      if ((job.progress.completed_units || 0) > (job.progress.total_units || 0)) {
        throw new Error(`Job ${jobId} counter invariant failed`);
      }
    }
    if (allComplete) break;
    await sleep(2000);
  }

  if (Date.now() >= deadline2) {
    throw new Error("Phase 2 did not complete for all jobs");
  }

  console.log(`Load test passed: ${N} jobs completed successfully`);
}

runLoadTest().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});