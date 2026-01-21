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
  // 1) Create job
  const createRes = await must(
    fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_type: "evaluate_full", manuscript_id: "test-manuscript-123" })
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

    // Fail fast if progress counters are missing or invalid
    if (status === "running") {
      if (!progress.total_units || progress.total_units === 0) {
        throw new Error("Progress counters missing or invalid: total_units must be present and > 0 when running");
      }
    }

    console.log(`[${status}] ${progress.stage ?? ""} ${progress.message ?? ""} (${completed_units}/${total_units})`);

    // Phase 1 leaves status=running but phase_status=complete when done
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