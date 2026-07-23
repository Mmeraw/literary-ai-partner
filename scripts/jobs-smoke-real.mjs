#!/usr/bin/env node
/**
 * Real Manuscript End-to-End Evaluation Smoke Test
 *
 * Uses a real numeric manuscripts.id from the database and the same production
 * kickoff path as the application: POST /api/jobs creates the job and dispatches
 * the canonical worker asynchronously. This script observes canonical job state
 * and released outputs; it does not call retired/manual phase endpoints.
 *
 * Usage:
 *   MANUSCRIPT_ID=<numeric-manuscripts-id> npm run jobs:smoke:real
 *   MANUSCRIPT_ID=<numeric-manuscripts-id> USE_SUPABASE_JOBS=true npm run jobs:smoke:real
 */
import { pathToFileURL } from "node:url";
import { getBaseUrl } from "./base-url.mjs";
import { jfetch, must, sleep } from "./_http.mjs";

const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const DEFAULT_POLL_MS = 5_000;
const DOWNLOAD_FORMATS = ["pdf", "docx", "txt"];

export function smokeAuthHeaders(env = process.env) {
  const bearer = env.CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = env.SMOKE_USER_ID?.trim();
  // Operator-nominated proof identity: the real author (owner of the target
  // manuscript) the operator explicitly authorizes this proof job to run as.
  // The route only honors this with ALLOW_PROOF_JOB_IDENTITY=true + a valid
  // bearer CRON_SECRET AND verified ownership; it never bypasses ownership.
  const proofUserId = (env.C2_PROOF_USER_ID || env.PROOF_USER_ID)?.trim();

  return {
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...(userId ? { "x-user-id": userId } : {}),
    ...(proofUserId ? { "x-proof-user-id": proofUserId } : {}),
  };
}

export function smokeDiagnosticHeaders(env = process.env) {
  const token = env.SMOKE_DIAGNOSTICS_TOKEN?.trim();
  const userId = env.SMOKE_USER_ID?.trim();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userId ? { "x-user-id": userId } : {}),
  };
}

export function formatSmokeDiagnostic(diag) {
  const lines = [
    `${diag.phase ?? "unknown"} ${diag.phase_status ?? "failed"}: ${diag.failure_code ?? "UNKNOWN"}`,
    `category: ${diag.category}`,
    `retryable: ${diag.retryable ? "true" : "false"}`,
    diag.diagnostic_summary,
  ];

  if (Array.isArray(diag.reason_codes) && diag.reason_codes.length > 0) {
    lines.push(`reason_codes: ${diag.reason_codes.join(", ")}`);
  }

  if (Array.isArray(diag.integrity_violations) && diag.integrity_violations.length > 0) {
    lines.push("integrity_violations:");
    for (const v of diag.integrity_violations) {
      lines.push(`  - ${v.path ?? "unknown"}: ${v.code ?? "unknown"}`);
    }
  }

  return lines.join("\n");
}

async function fetchSmokeDiagnostic(BASE, jobId, options = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = smokeDiagnosticHeaders(env);

  if (!headers.Authorization) {
    log("[smoke] SMOKE_DIAGNOSTICS_TOKEN not configured; skipping safe diagnostic fetch");
    return null;
  }

  try {
    const res = await fetchImpl(`${BASE}/api/internal/smoke/jobs/${jobId}/diagnostic`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      log(`[smoke] diagnostic endpoint returned ${res.status}; falling back to generic diagnostics`);
      return null;
    }
    const payload = await res.json().catch(() => null);
    if (!payload || payload.ok !== true || !payload.failure_code) {
      return null;
    }
    return payload;
  } catch (err) {
    log("[smoke] diagnostic endpoint unreachable; falling back to generic diagnostics", err);
    return null;
  }
}

function jsonHeaders(env = process.env) {
  return {
    "Content-Type": "application/json",
    ...smokeAuthHeaders(env),
  };
}

async function jsonOrNull(response) {
  return response.json().catch(() => null);
}

export function isSnapshotMissingCreateFailure(status, body) {
  return (
    status === 422 &&
    (body?.code === "MANUSCRIPT_SOURCE_SNAPSHOT_MISSING" ||
      /Source snapshot missing/i.test(body?.error || ""))
  );
}

export async function createJobWithSnapshotRepair(BASE, MANUSCRIPT_ID, options = {}) {
  const fetchImpl = options.fetchImpl ?? jfetch;
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;

  const createRequest = () =>
    fetchImpl(`${BASE}/api/jobs`, {
      method: "POST",
      headers: jsonHeaders(env),
      body: JSON.stringify({
        job_type: "evaluate_full",
        manuscript_id: MANUSCRIPT_ID,
        processing_terms_accepted: true,
      }),
    });

  let createRes = await createRequest();
  if (createRes.ok) return createRes;

  const createError = await jsonOrNull(createRes.clone());
  if (!isSnapshotMissingCreateFailure(createRes.status, createError)) {
    return createRes;
  }

  log("Source snapshot missing; attempting one-time repair-source");
  await must(
    fetchImpl(`${BASE}/api/manuscripts/${MANUSCRIPT_ID}/repair-source`, {
      method: "POST",
      headers: smokeAuthHeaders(env),
    }),
    "Failed to repair source snapshot",
  );

  log("repair-source succeeded; retrying job creation once");
  createRes = await createRequest();
  return createRes;
}

function formatJobDiagnostics(job) {
  return JSON.stringify(
    {
      id: job?.id,
      status: job?.status,
      phase: job?.phase ?? null,
      phase_status: job?.phase_status ?? null,
      failure_code: job?.failure_code ?? null,
      last_error: job?.last_error ?? null,
      public_status_message: job?.public_status_message ?? null,
      block_code: job?.block_code ?? null,
      progress: job?.progress ?? null,
      progress_high_water: job?.progress_high_water ?? null,
    },
    null,
    2,
  );
}

export function assertTerminalComplete(job) {
  if (!job || job.status !== "complete") {
    throw new Error(`Evaluation did not complete:\n${formatJobDiagnostics(job)}`);
  }

  if (
    job.validity_status !== undefined &&
    job.validity_status !== null &&
    job.validity_status !== "valid"
  ) {
    throw new Error(`Evaluation completed with invalid validity:\n${formatJobDiagnostics(job)}`);
  }

  return true;
}

export async function pollJobToTerminal(BASE, jobId, options = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const sleepImpl = options.sleepImpl ?? sleep;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Number(options.timeoutMs ?? env.SMOKE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const pollMs = Number(options.pollMs ?? env.SMOKE_POLL_MS ?? DEFAULT_POLL_MS);
  const deadline = Date.now() + timeoutMs;
  let lastJob = null;

  while (Date.now() < deadline) {
    const getRes = await must(
      fetchImpl(`${BASE}/api/jobs/${jobId}`, {
        headers: smokeAuthHeaders(env),
        cache: "no-store",
      }),
      "Failed to poll canonical job status",
    );
    const payload = await getRes.json();
    const job = payload.job;
    lastJob = job;

    log(
      `[Evaluation ${job.status}] phase=${job.phase ?? ""} phase_status=${job.phase_status ?? ""} ` +
        `progress=${job.progress ?? ""} units=${job.completed_units ?? "?"}/${job.total_units ?? "?"}`,
    );

    if (job.status === "failed") {
      const diagnostic = await fetchSmokeDiagnostic(BASE, jobId, options);
      if (diagnostic) {
        throw new Error(`Evaluation failed:\n${formatSmokeDiagnostic(diagnostic)}`);
      }
      throw new Error(`Evaluation failed:\n${formatJobDiagnostics(job)}`);
    }

    if (job.status === "complete") {
      assertTerminalComplete(job);
      return job;
    }

    if (job.status !== "queued" && job.status !== "running") {
      throw new Error(`Unexpected non-canonical job status:\n${formatJobDiagnostics(job)}`);
    }

    await sleepImpl(pollMs);
  }

  throw new Error(
    `TIMEOUT: evaluation did not reach complete within ${timeoutMs}ms. Last job:\n` +
      formatJobDiagnostics(lastJob),
  );
}

async function requireJson(responsePromise, context) {
  const response = await must(responsePromise, context);
  return response.json();
}

export async function assertCanonicalOutputs(BASE, jobId, options = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = smokeAuthHeaders(env);

  const resultPayload = await requireJson(
    fetchImpl(`${BASE}/api/jobs/${jobId}/evaluation-result`, {
      headers,
      cache: "no-store",
    }),
    "Failed to load canonical evaluation result",
  );

  if (resultPayload.ok !== true) {
    throw new Error(`Canonical evaluation result did not return ok:true: ${JSON.stringify(resultPayload)}`);
  }
  if (resultPayload.job_id !== jobId) {
    throw new Error(`Canonical evaluation result job mismatch: ${JSON.stringify(resultPayload)}`);
  }
  if (!resultPayload.evaluation_result || typeof resultPayload.evaluation_result !== "object") {
    throw new Error("Canonical evaluation result payload is missing evaluation_result");
  }
  if (!resultPayload.source || !["evaluation_artifacts", "evaluation_jobs"].includes(resultPayload.source)) {
    throw new Error(`Canonical evaluation result source is missing/invalid: ${JSON.stringify(resultPayload)}`);
  }

  for (const format of DOWNLOAD_FORMATS) {
    const downloadRes = await must(
      fetchImpl(`${BASE}/api/reports/${jobId}/download?format=${format}`, {
        headers,
        cache: "no-store",
      }),
      `Failed to load ${format.toUpperCase()} report download`,
    );
    const contentType = downloadRes.headers.get("content-type") || "";
    const expected = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    }[format];
    if (!contentType.includes(expected)) {
      throw new Error(`${format.toUpperCase()} download has unexpected content-type: ${contentType}`);
    }
    const bytes = await downloadRes.arrayBuffer();
    if (bytes.byteLength <= 0) {
      throw new Error(`${format.toUpperCase()} report download is empty`);
    }
    log(`OK: ${format.toUpperCase()} download available (${bytes.byteLength} bytes)`);
  }

  return {
    source: resultPayload.source,
    downloads: DOWNLOAD_FORMATS,
  };
}

export async function runRealManuscriptSmoke(options = {}) {
  const BASE = options.baseUrl ?? (await getBaseUrl());
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const MANUSCRIPT_ID = env.MANUSCRIPT_ID?.trim();

  if (!MANUSCRIPT_ID) {
    throw new Error(
      "MANUSCRIPT_ID environment variable required. Usage: MANUSCRIPT_ID=<numeric-manuscripts-id> npm run jobs:smoke:real",
    );
  }
  if (!/^\d+$/.test(MANUSCRIPT_ID)) {
    throw new Error(`MANUSCRIPT_ID must be a numeric manuscripts.id, got: ${MANUSCRIPT_ID}`);
  }

  log(`jobs-smoke-real using manuscript id: ${MANUSCRIPT_ID}`);
  log(`Running at ${new Date().toISOString()}`);

  const createRes = await must(
    createJobWithSnapshotRepair(BASE, MANUSCRIPT_ID, { ...options, env, log }),
    "Failed to create job",
  );
  const created = await createRes.json();
  const jobId = created.job_id;
  if (!jobId) throw new Error("Could not find job id in create response");

  log(`Created job: ${jobId}`);
  log("POST /api/jobs is the canonical production kickoff; polling canonical job status");

  const terminalJob = await pollJobToTerminal(BASE, jobId, options);
  const outputs = await assertCanonicalOutputs(BASE, jobId, { ...options, env, log });

  log("OK: Real manuscript end-to-end evaluation smoke completed");
  log(
    JSON.stringify(
      {
        job_id: jobId,
        status: terminalJob.status,
        phase: terminalJob.phase ?? null,
        phase_status: terminalJob.phase_status ?? null,
        source: outputs.source,
        downloads: outputs.downloads,
      },
      null,
      2,
    ),
  );

  return { jobId, terminalJob, outputs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRealManuscriptSmoke().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
