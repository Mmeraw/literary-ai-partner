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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function must(res, msg) {
  const r = await res;
  if (!r || typeof r.ok !== "boolean") {
    throw new Error(
      `must() expected a fetch Response, got: ${Object.prototype.toString.call(
        r,
      )}`,
    );
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${msg} (status=${r.status}) ${text}`);
  }
  return r;
}

async function main() {
  const BASE = await getBaseUrl();
  const MANUSCRIPT_ID = process.env.MANUSCRIPT_ID;

  if (!MANUSCRIPT_ID) {
    console.error("ERROR: MANUSCRIPT_ID environment variable required");
    console.error("Usage: MANUSCRIPT_ID=<uuid> npm run jobs:smoke:real");
    process.exit(1);
  }

  console.log(`jobs-smoke-real using manuscript: ${MANUSCRIPT_ID}`);
  console.log(`Running at ${new Date().toISOString()}`);

  // 1) Create job with real manuscript
  const createRes = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_type: "evaluate_full",
        manuscript_id: MANUSCRIPT_ID,
      }),
    }),
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
    fetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { method: "POST" }),
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
      `[Phase1 ${status}] ${progress.stage ?? ""} ${
        progress.message ?? ""
      } (${completed_units}/${total_units})`,
    );

    // Phase 1 leaves status=complete, phase_status=complete when done
    if (phase_status === "complete") {
      if (progress.phase !== "phase1" || progress.phase_status !== "complete") {
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
    fetch(`${BASE}/api/jobs/${jobId}/run-phase2`, { method: "POST" }),
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
    if (status === "running" && progress.phase === "phase2") {
      if (!progress.total_units || progress.total_units === 0) {
        console.log("[Phase2 waiting] counters not ready yet");
        await sleep(500);
        continue;
      }
    }

    console.log(
      `[Phase2 ${status}] ${progress.stage ?? ""} ${
        progress.message ?? ""
      } (${completed_units}/${total_units})`,
    );

    if (status === "complete") {
      if (progress.phase !== "phase2" || progress.phase_status !== "complete") {
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
