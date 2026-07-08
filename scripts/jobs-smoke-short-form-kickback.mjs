#!/usr/bin/env node
/**
 * Real short-form kickback smoke test.
 *
 * Submits a real short-form manuscript job through /api/jobs, starts Phase 1,
 * then polls the job until the SHORT_FORM FIPOC kickback is observed.
 *
 * Required:
 *   MANUSCRIPT_ID=<real numeric short-form manuscript id>
 *
 * Optional:
 *   BASE_URL=http://localhost:3002
 *   CRON_SECRET=<worker/admin bearer secret>
 *   SUPABASE_SERVICE_ROLE_KEY=<dev service role bearer fallback>
 *   KICKBACK_SMOKE_TIMEOUT_MS=900000
 *
 * Expected terminal observation:
 *   status: queued
 *   phase: phase_3
 *   phase_status: queued
 *   progress.last_kick_failure_code in SHORT_FORM_* kickable codes
 *   progress.short_form_retry_instruction is non-empty
 */
import { getBaseUrl } from "./base-url.mjs";
import { jfetch, must, sleep } from "./_http.mjs";
import { skipIfMemoryMode } from "./_skip.mjs";

const KICKABLE_SHORT_FORM_CODES = new Set([
  "SHORT_FORM_LONGFORM_ARTIFACT_LEAK",
  "SHORT_FORM_INTERNAL_PROCESS_LEAK",
  "SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM",
]);

function workerAuthHeaders() {
  const bearer = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return bearer ? { Authorization: `Bearer ${bearer}` } : {};
}

function readProgress(job) {
  return job?.progress && typeof job.progress === "object" ? job.progress : {};
}

function isKickbackSnapshot(job) {
  const progress = readProgress(job);
  const failureCode = progress.last_kick_failure_code;
  return (
    job?.status === "queued" &&
    (job?.phase === "phase_3" || progress.phase === "phase_3") &&
    progress.phase_status === "queued" &&
    typeof failureCode === "string" &&
    KICKABLE_SHORT_FORM_CODES.has(failureCode) &&
    typeof progress.short_form_retry_instruction === "string" &&
    progress.short_form_retry_instruction.trim().length > 0
  );
}

async function pollJob(BASE, jobId, context) {
  const res = await must(fetch(`${BASE}/api/jobs/${jobId}`), `Failed to poll job (${context})`);
  const payload = await res.json();
  return payload.job ?? payload;
}

async function tickWorker(BASE) {
  const headers = workerAuthHeaders();
  const candidates = [
    `${BASE}/api/workers/process-evaluations`,
    `${BASE}/api/workers/process-evaluations?limit=1`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "GET", headers });
      if (res.ok || res.status === 202 || res.status === 204) return true;
    } catch {
      // Local dev may not expose the worker route yet; polling still catches background workers.
    }
  }
  return false;
}

async function main() {
  skipIfMemoryMode("short-form kickback smoke", "Supabase jobs + worker-backed evaluation pipeline");

  const BASE = await getBaseUrl();
  const manuscriptId = process.env.MANUSCRIPT_ID;
  const timeoutMs = Number(process.env.KICKBACK_SMOKE_TIMEOUT_MS ?? 900_000);

  if (!manuscriptId) {
    throw new Error("MANUSCRIPT_ID is required. Use a real numeric short-form manuscript id that is expected to trigger a SHORT_FORM sanity kickback.");
  }

  console.log("short-form-kickback-smoke", { base: BASE, manuscriptId, timeoutMs });

  const createRes = await must(
    jfetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_type: "evaluate_full",
        manuscript_id: Number.isNaN(Number(manuscriptId)) ? manuscriptId : Number(manuscriptId),
      }),
    }),
    "Failed to submit short-form job",
  );

  const created = await createRes.json();
  const jobId = created.job_id ?? created.id;
  if (!jobId) throw new Error(`Could not find job id in create response: ${JSON.stringify(created)}`);
  console.log(`Created job: ${jobId}`);

  await must(
    jfetch(`${BASE}/api/jobs/${jobId}/run-phase1`, {
      method: "POST",
      headers: workerAuthHeaders(),
    }),
    "Failed to start Phase 1",
  );

  const deadline = Date.now() + timeoutMs;
  let lastWorkerTick = 0;

  while (Date.now() < deadline) {
    if (Date.now() - lastWorkerTick > 10_000) {
      await tickWorker(BASE);
      lastWorkerTick = Date.now();
    }

    const job = await pollJob(BASE, jobId, "kickback smoke");
    const progress = readProgress(job);
    const completed = progress.completed_units ?? job.completed_units ?? 0;
    const total = progress.total_units ?? job.total_units ?? 0;

    console.log(
      `[${job.status}] phase=${job.phase ?? progress.phase ?? ""} phase_status=${progress.phase_status ?? ""} ` +
      `failure=${job.failure_code ?? progress.last_kick_failure_code ?? ""} (${completed}/${total})`,
    );

    if (isKickbackSnapshot(job)) {
      console.log("OK: SHORT_FORM kickback observed");
      console.log(JSON.stringify({
        job_id: jobId,
        status: job.status,
        phase: job.phase ?? progress.phase,
        phase_status: progress.phase_status,
        last_kick_failure_code: progress.last_kick_failure_code,
        has_retry_instruction: typeof progress.short_form_retry_instruction === "string" && progress.short_form_retry_instruction.length > 0,
      }, null, 2));
      process.exit(0);
    }

    if (job.status === "failed") {
      throw new Error(
        `Job failed before kickback. failure_code=${job.failure_code ?? ""} last_error=${job.last_error ?? ""}`,
      );
    }

    if (job.status === "complete") {
      throw new Error("Job completed without SHORT_FORM kickback; smoke fixture did not exercise the kickback path.");
    }

    await sleep(3_000);
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for SHORT_FORM kickback on job ${jobId}`);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
