console.log("jobs-smoke fingerprint v2", new Date().toISOString());
import { getBaseUrl } from "./base-url.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function must(res, msg) {
  const r = await res; // works whether res is Promise<Response> or Response
  if (!r || typeof r.ok !== "boolean") {
    throw new Error(`must() expected a fetch Response, got: ${Object.prototype.toString.call(r)}`);
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${msg} (status=${r.status}) ${text}`);
  }
  return r;
}

async function main() {
  const BASE = await getBaseUrl();
  // 1) Create job (using numeric manuscript_id for validation)
  const createRes = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": "smoke-test-user" // Bypass auth for smoke test
      },
      body: JSON.stringify({ job_type: "evaluate_full", manuscript_id: 1 })
    }),
    "Failed to create job"
  );
  const created = await createRes.json();
  const jobId = created.job_id;
  if (!jobId) throw new Error("Could not find job id in create response");

  // 2) Start Phase 1
  const runRes = await must(
    fetch(`${BASE}/api/jobs/${jobId}/run-phase1`, { method: "POST" }),
    "Failed to start phase1"
  );
  await runRes.json().catch(() => ({}));

  // Allow worker to initialize
  await sleep(500);

  // 3) Poll until complete/failed
  const PHASE1_COUNTER_GRACE_MS = 3000;
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
    if (phase_status === "completed") {
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