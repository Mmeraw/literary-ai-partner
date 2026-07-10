#!/usr/bin/env node
/**
 * Real Manuscript Smoke Test (Phase 1 + Phase 2)
 *
 * This test uses a real manuscript ID from the database, unlike
 * jobs-smoke.mjs and jobs-smoke-phase2.mjs which use synthetic fixtures.
 *
 * Usage:
 *   MANUSCRIPT_ID=<real-uuid> npm run jobs:smoke:real
 *   MANUSCRIPT_ID=<real-uuid> USE_SUPABASE_JOBS=true npm run jobs:smoke:real
 *
 * Purpose: Validate that real payloads from the database flow correctly
 * through Phase 1 and Phase 2 without breaking evaluation logic.
 */
import { getBaseUrl } from "./base-url.mjs";
import { jfetch, must, sleep } from "./_http.mjs";

function workerAuthHeaders() {
  const bearer = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return bearer ? { Authorization: `Bearer ${bearer}` } : {};
}

async function createJobWithSnapshotRepair(BASE, MANUSCRIPT_ID) {
  const createRequest = () =>
    jfetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...workerAuthHeaders(),
      },
      body: JSON.stringify({
        job_type: "evaluate_full",
        manuscript_id: MANUSCRIPT_ID,
        processing_terms_accepted: true,
      }),
    });

  let createRes = await createRequest();
  if (createRes.ok) {
    return createRes;
  }

  const createError = await createRes.clone().json().catch(() => null);
  const snapshotMissing =
    createRes.status === 422 &&
    (createError?.code === "MANUSCRIPT_SOURCE_SNAPSHOT_MISSING" ||
      /Source snapshot missing/i.test(createError?.error || ""));

  if (!snapshotMissing) {
    return createRes;
  }

  console.log("Source snapshot missing; attempting one-time repair-source");
  await must(
    jfetch(`${BASE}/api/manuscripts/${MANUSCRIPT_ID}/repair-source`, {
      method: "POST",
      headers: workerAuthHeaders(),
    }),
    "Failed to repair source snapshot",
  );

  console.log("repair-source succeeded; retrying job creation once");
  createRes = await createRequest();
  return createRes;
}

async function main() {
  const BASE = await getBaseUrl();
  const MANUSCRIPT_ID = process.env.MANUSCRIPT_ID?.trim();
  if (!MANUSCRIPT_ID) {
    console.error("ERROR: MANUSCRIPT_ID environment variable required");
    console.error("Usage: MANUSCRIPT_ID=<uuid> npm run jobs:smoke:real");
    process.exit(1);
  }

  console.log(`jobs-smoke-real using manuscript: ${MANUSCRIPT_ID}`);
  console.log(`Running at ${new Date().toISOString()}`);

  // 1) Create job with real manuscript
  const createRes = await must(
    createJobWithSnapshotRepair(BASE, MANUSCRIPT_ID),
    "Failed to create job",
  );
  const created = await createRes.json();
  const jobId = created.job_id;
  if (!jobId) {
    throw new Error("Could not find job id in create response");
  }
  console.log(`Created job: ${jobId}`);

  // 2) Start Phase 1
  const run1Res = await must(
    jfetch(`${BASE}/api/jobs/${jobId}/run-phase1`, {
      method: "POST",
      headers: workerAuthHeaders(),
    }),
    "Failed to start phase1",
  );
  await run1Res.json().catch(() => ({}));

  // Wait for Phase 1 to complete
  const deadline1 = Date.now() + 120_000; // 2 min for real manuscripts
  while (Date.now() < deadline1) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId}`),
      "Failed to poll job for Phase 1",
    );
    const payload = await getRes.json();
    const job = payload.job;

    const status = job.status;
    const progress = job.progress || {};
    const completed_units = progress.completed_units ?? 0;
    const total_units = progress.total_units ?? 0;
    const phase_status = progress.phase_status;

    if (status === "running") {
      if (!progress.total_units || progress.total_units === 0) {
        console.log("[Phase1 waiting] counters not ready yet");
        await sleep(500);
        continue;
      }
    }

    console.log(
      `[Phase1 ${status}] ${progress.phase_status ?? ""} ${
        progress.message ?? ""
      } (${completed_units}/${total_units})`,
    );

    // Phase 1 leaves status=complete, phase_status=complete when done
    if (phase_status === "complete") {
      if (progress.phase !== "phase_1" || progress.phase_status !== "complete") {
        throw new Error(
          `Phase 1 not properly completed: phase=${progress.phase}, phase_status=${progress.phase_status}`,
        );
      }
      console.log("OK: Phase 1 completed, starting Phase 2");
      break;
    }

    if (status === "failed") {
      console.error("FAIL: Phase 1 failed");
      process.exit(1);
    }

    await sleep(2000); // Poll less frequently for real data
  }

  if (Date.now() >= deadline1) {
    console.error("TIMEOUT: Phase 1 did not complete in 2 minutes");
    process.exit(1);
  }

  // 3) Start Phase 2
  const run2Res = await must(
    jfetch(`${BASE}/api/jobs/${jobId}/run-phase2`, {
      method: "POST",
      headers: workerAuthHeaders(),
    }),
    "Failed to start phase2",
  );
  await run2Res.json().catch(() => ({}));

  // 4) Poll Phase 2 until complete/failed
  const deadline2 = Date.now() + 120_000; // 2 min for real manuscripts
  while (Date.now() < deadline2) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId}`),
      "Failed to poll job for Phase 2",
    );
    const payload = await getRes.json();
    const job = payload.job;

    const status = job.status;
    const progress = job.progress || {};
    const completed_units = progress.completed_units ?? 0;
    const total_units = progress.total_units ?? 0;

    // Tolerate brief window before Phase 2 counters are written
    if (status === "running" && progress.phase === "phase_2") {
      if (!progress.total_units || progress.total_units === 0) {
        console.log("[Phase2 waiting] counters not ready yet");
        await sleep(500);
        continue;
      }
    }

    console.log(
      `[Phase2 ${status}] ${progress.phase_status ?? ""} ${
        progress.message ?? ""
      } (${completed_units}/${total_units})`,
    );

    if (status === "complete") {
      if (progress.phase !== "phase_2" || progress.phase_status !== "complete") {
        throw new Error(
          `Phase 2 not properly completed: phase=${progress.phase}, phase_status=${progress.phase_status}`,
        );
      }
      console.log("OK: Phase 2 completed");
      console.log(`\nFinal snapshot:`);
      console.log(
        JSON.stringify(
          {
            status,
            phase: progress.phase,
            phase_status: progress.phase_status,
            total_units,
            completed_units,
            lease_cleared: !progress.lease_id && !progress.lease_expires_at,
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    if (status === "failed") {
      console.error("FAIL: Phase 2 failed");
      process.exit(1);
    }

    await sleep(2000); // Poll less frequently for real data
  }

  console.error("TIMEOUT: Phase 2 did not complete in 2 minutes");
  process.exit(1);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
