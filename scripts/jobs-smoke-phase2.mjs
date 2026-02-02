#!/usr/bin/env node
import { getBaseUrl } from "./base-url.mjs";
import { jfetch, must, sleep } from "./_http.mjs";
import { skipIfMemoryMode } from "./_skip.mjs";
import { createClient } from "@supabase/supabase-js";

console.log("jobs-smoke-phase2 fingerprint v2", new Date().toISOString());

function assertInvariant(condition, message) {
  if (!condition) {
    throw new Error(`INVARIANT VIOLATION: ${message}`);
  }
}

// Sample realistic prose for manuscript generation
const PARAGRAPH = `The morning sun broke through the eastern windows, casting long shadows across the marble floors. Eleanor stood at the threshold of her ancestral home, feeling the weight of centuries pressing down upon her shoulders.`;

/**
 * Create a test manuscript in Supabase for smoke testing
 * Returns the numeric manuscript ID
 */
async function createTestManuscript() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for Supabase mode");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`Creating test manuscript...`);

  // Create minimal manuscript record (file_url/storage setup happens separately)
  const { data, error } = await supabase
    .from("manuscripts")
    .insert({
      title: "CI Phase 2 Smoke Test",
      word_count: 5000,
      work_type: "novel",
      created_by: '00000000-0000-0000-0000-000000000000',
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create test manuscript: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("No manuscript ID returned");
  }

  console.log(`✅ Test manuscript created: ${data.id}`);
  return data.id;
}

async function main() {
  const BASE = await getBaseUrl();
  const useSupabase = process.env.USE_SUPABASE_JOBS === "true";

  // Check if we're in memory mode (no Supabase worker)
  skipIfMemoryMode("Phase 2 smoke test", "Supabase + background worker to complete Phase 1→2 transition");

  // Create test manuscript if using Supabase
  const manuscript_id = useSupabase
    ? await createTestManuscript()
    : "test-manuscript-123";

  // 1) Create job
  const createRes = await must(
    jfetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        job_type: "evaluate_full",
        manuscript_id,
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
    jfetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { method: "POST" }),
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
    jfetch(`${BASE}/api/jobs/${jobId}/run-phase2`, { method: "POST" }),
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
