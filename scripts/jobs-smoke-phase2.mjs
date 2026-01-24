#!/usr/bin/env node
import { getBaseUrl } from "./base-url.mjs";

console.log("jobs-smoke-phase2 fingerprint v1", new Date().toISOString());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertInvariant(condition, message) {
  if (!condition) {
    throw new Error(`INVARIANT VIOLATION: ${message}`);
  }
}

async function must(res, msg) {
  const r = await res; // works whether res is Promise<Response> or Response
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

  // Check if we're in memory mode (no Supabase worker)
  const useSupabase = process.env.USE_SUPABASE_JOBS !== "false";
  if (!useSupabase) {
    console.log("⚠️  Memory mode detected (USE_SUPABASE_JOBS=false)");
    console.log("   Phase 2 requires Supabase + background worker to complete");
    console.log("   Skipping Phase 2 smoke test - this is expected behavior");
    console.log("OK: Memory mode smoke check passed (skipped Phase 2 completion)");
    process.exit(0);
  }

  // 1) Create job
  const createRes = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": "smoke-test-user" // Bypass auth for smoke test
      },
      body: JSON.stringify({
        job_type: "evaluate_full",
        manuscript_id: "test-manuscript-123",
      }),
    }),
    "Failed to create job",
  );
  const created = await createRes.json();
  const jobId = created.job_id;
  if (!jobId) {
    throw new Error("Could not find job id in create response");
  }

  // 2) Start Phase 1
  const run1Res = await must(
    fetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { method: "POST" }),
    "Failed to start phase1",
  );
  await run1Res.json().catch(() => ({}));

  // Wait for Phase 1 to complete
  const deadline1 = Date.now() + 60_000;
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

    // Phase 1 leaves status=running but phase_status=complete when done
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

    await sleep(1000);
  }

  if (Date.now() >= deadline1) {
    console.error("TIMEOUT: Phase 1 did not complete in 60s");
    process.exit(1);
  }

  // 3) Start Phase 2
  const run2Res = await must(
    fetch(`${BASE}/api/jobs/${jobId}/run-phase2`, { method: "POST" }),
    "Failed to start phase2",
  );
  await run2Res.json().catch(() => ({}));

  // 4) Poll Phase 2 until complete/failed
  const deadline2 = Date.now() + 60_000;
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
    const phase_status = progress.phase_status;

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

      // Validate all invariants on completion
      assertInvariant(
        phase_status !== "complete" || status !== "running",
        "phase_status='complete' must not coexist with status='running'",
      );
      assertInvariant(
        completed_units <= total_units,
        `completed_units (${completed_units}) must be <= total_units (${total_units})`,
      );
      assertInvariant(
        !progress.lease_id && !progress.lease_expires_at,
        "Lease must be cleared when status='complete'",
      );
      assertInvariant(
        progress.phase2_last_processed_index !== undefined,
        "phase2_last_processed_index must be set for completed Phase 2",
      );

      console.log("OK: Phase 2 completed");
      console.log("✅ All invariants validated");
      process.exit(0);
    }

    if (status === "failed") {
      console.error("FAIL: Phase 2 failed");
      process.exit(1);
    }

    await sleep(1000);
  }

  console.error("TIMEOUT: Phase 2 did not complete in 60s");
  process.exit(1);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
