#!/usr/bin/env node
import { getBaseUrl } from "./base-url.mjs";
import { jfetch, must, sleep } from "./_http.mjs";
import { skipIfMemoryMode } from "./_skip.mjs";
import { createClient } from "@supabase/supabase-js";

console.log("jobs-smoke fingerprint v3", new Date().toISOString());

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

  // Generate ~5k words (small but realistic for smoke test)
  const body_text = Array(200).fill(PARAGRAPH).join('\n\n');
  const word_count = body_text.split(/\s+/).length;

  console.log(`Creating test manuscript (${word_count} words)...`);

  const { data, error } = await supabase
    .from("manuscripts")
    .insert({
      title: "CI Phase 1 Smoke Test",
      body_text,
      word_count,
      work_type: "novel",
      is_test: true,
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

  // In memory mode (USE_SUPABASE_JOBS=false), Phase 1 jobs stay queued forever
  // because there's no background worker to process them. This is expected.
  skipIfMemoryMode("Phase 1 smoke test", "Supabase + background worker to complete Phase 1");

  // Create test manuscript if using Supabase, otherwise use placeholder
  const manuscript_id = useSupabase
    ? await createTestManuscript()
    : 999001;

  // 1) Create job
  const createRes = await must(
    jfetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job_type: "evaluate_full", manuscript_id })
    }),
    "Failed to create job"
  );
  const created = await createRes.json();
  const jobId = created.job_id;
  if (!jobId) throw new Error("Could not find job id in create response");

  // 2) Start Phase 1
  const runRes = await must(
      jfetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { 
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }),
    "Failed to start phase1"
  );
  await runRes.json().catch(() => ({}));

  // Allow worker to initialize
  await sleep(500);

  // 3) Poll until complete/failed
  const PHASE1_COUNTER_GRACE_MS = 10000;
  const phase1Start = Date.now();
  
  function hasCounters(p) {
    return Number.isFinite(p?.total_units) && p.total_units > 0
        && Number.isFinite(p?.completed_units) && p.completed_units >= 0;
  }
  
  function shouldEnforceCounters(job) {
    const p = job?.progress;
    const elapsed = Date.now() - phase1Start;

    // If we already started completing units, counters must exist.
    if (Number.isFinite(p?.completed_units) && p.completed_units > 0) return true;

    // After grace window, counters must exist if phase is running.
    if (elapsed >= PHASE1_COUNTER_GRACE_MS && p?.phase_status === "running") return true;

    // If stage indicates active processing, enforce counters.
    if (p?.stage === "processing") return true;

    return false;
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const getRes = await must(
      fetch(`${BASE}/api/jobs/${jobId}`),
      "Failed to poll job"
    );
    const payload = await getRes.json();
    const job = payload.job;

    const status = job.status;
    const progress = job.progress || {};
    const completed_units = progress.completed_units ?? 0;
    const total_units = progress.total_units ?? 0;
    const phase_status = progress.phase_status;

    // Validate counters only after grace period
    if (shouldEnforceCounters(job) && !hasCounters(progress)) {
      throw new Error(
        `Progress counters missing or invalid after ${PHASE1_COUNTER_GRACE_MS}ms: total_units must be present and > 0 when running`
      );
    }

    console.log(`[${status}] ${progress.stage ?? ""} ${progress.message ?? ""} (${completed_units}/${total_units})`);

    // Phase 1 leaves status=running but phase_status=completed when done
    if (phase_status === "complete") {
      console.log("OK: Phase 1 completed");
      process.exit(0);
    }
    if (status === "failed") {
      console.error("FAIL: Phase 1 failed");
      process.exit(1);
    }

    await sleep(1000);
  }

  console.error("TIMEOUT: job did not complete in 60s");
  process.exit(1);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});