#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertCanonicalOutputs,
  assertTerminalComplete,
  createJobWithSnapshotRepair,
  formatSmokeDiagnostic,
  isActiveJobConflict,
  isSnapshotMissingCreateFailure,
  pollJobToTerminal,
  runRealManuscriptSmoke,
  smokeAuthHeaders,
  smokeDiagnosticHeaders,
} from "./jobs-smoke-real.mjs";

function response(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function testSmokeAuthHeaders() {
  const headers = smokeAuthHeaders({
    CRON_SECRET: "cron",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SMOKE_USER_ID: " user-1 ",
  });
  assert.equal(headers.Authorization, "Bearer cron");
  assert.equal(headers["x-user-id"], "user-1");
}

async function testSmokeDiagnosticHeaders() {
  const headers = smokeDiagnosticHeaders({
    SMOKE_DIAGNOSTICS_TOKEN: "diag-token",
    SMOKE_USER_ID: " user-1 ",
  });
  assert.equal(headers.Authorization, "Bearer diag-token");
  assert.equal(headers["x-user-id"], "user-1");
}

async function testFormatSmokeDiagnostic() {
  const formatted = formatSmokeDiagnostic({
    phase: "phase_3",
    phase_status: "failed",
    failure_code: "PASS3_PROVIDER_ERROR",
    category: "provider_response_invalid",
    retryable: true,
    diagnostic_summary: "Evaluation failed at phase_3 with failure code PASS3_PROVIDER_ERROR (category: provider_response_invalid). Retryable: yes.",
  });
  assert.match(formatted, /^phase_3 failed: PASS3_PROVIDER_ERROR/);
  assert.match(formatted, /category: provider_response_invalid/);
  assert.match(formatted, /retryable: true/);
}

async function testRepairOnceThenRetry() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) {
      return response(422, {
        ok: false,
        code: "MANUSCRIPT_SOURCE_SNAPSHOT_MISSING",
        error: "Source snapshot missing. Please repair before evaluating.",
      });
    }
    if (calls.length === 2) {
      assert.match(url, /\/api\/manuscripts\/7518\/repair-source$/);
      return response(200, { ok: true });
    }
    return response(201, { ok: true, job_id: "job-1" });
  };

  const res = await createJobWithSnapshotRepair("http://local", "7518", {
    fetchImpl,
    env: { SMOKE_USER_ID: "user-1", CRON_SECRET: "cron" },
    log() {},
  });

  assert.equal(res.status, 201);
  assert.equal(calls.length, 3);
}

async function testNonSnapshotErrorDoesNotRepair() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return response(400, { ok: false, error: "Bad request" });
  };

  const res = await createJobWithSnapshotRepair("http://local", "7518", {
    fetchImpl,
    env: { SMOKE_USER_ID: "user-1" },
    log() {},
  });

  assert.equal(res.status, 400);
  assert.equal(calls.length, 1);
}

async function testTerminalFailedDiagnostics() {
  let diagnosticUrl = null;
  let diagnosticHeaders = null;
  const fetchImpl = async (url, init) => {
    if (url.includes("/api/internal/smoke/jobs/")) {
      diagnosticUrl = url;
      diagnosticHeaders = init?.headers ?? null;
      return response(200, {
        ok: true,
        job_id: "job-1",
        status: "failed",
        phase: "phase_1a",
        phase_status: "failed",
        failure_code: "SMOKE_FAILURE",
        category: "provider_response_invalid",
        retryable: false,
        diagnostic_summary: "Evaluation failed at phase_1a with failure code SMOKE_FAILURE (category: provider_response_invalid). Retryable: no.",
      });
    }
    return response(200, {
      ok: true,
      job: {
        id: "job-1",
        status: "failed",
        phase: "phase_1a",
        phase_status: "failed",
        failure_code: "SMOKE_FAILURE",
        last_error: "boom",
      },
    });
  };

  await assert.rejects(
    pollJobToTerminal("http://local", "job-1", {
      fetchImpl,
      env: { SMOKE_USER_ID: "user-1", SMOKE_DIAGNOSTICS_TOKEN: "diag-token" },
      sleepImpl: async () => {},
      timeoutMs: 100,
      pollMs: 1,
      log() {},
    }),
    /SMOKE_FAILURE[\s\S]*provider_response_invalid[\s\S]*retryable: false/,
  );
  assert.equal(diagnosticUrl, "http://local/api/internal/smoke/jobs/job-1/diagnostic");
  assert.equal(diagnosticHeaders?.Authorization, "Bearer diag-token");
  assert.equal(diagnosticHeaders?.["x-user-id"], "user-1");
}

async function testTerminalCompleteRequiresOutputs() {
  assert.equal(assertTerminalComplete({ status: "complete", validity_status: "valid" }), true);
  assert.throws(() => assertTerminalComplete({ status: "complete", validity_status: "invalid" }), /invalid validity/);

  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("/evaluation-result")) {
      return response(200, {
        ok: true,
        job_id: "job-1",
        evaluation_result: { overview: {} },
        source: "evaluation_artifacts",
      });
    }
    if (url.includes("format=pdf")) return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "content-type": "application/pdf" } });
    if (url.includes("format=docx")) return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
    if (url.includes("format=txt")) return new Response("ok", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    throw new Error(`unexpected url ${url}`);
  };

  const outputs = await assertCanonicalOutputs("http://local", "job-1", {
    fetchImpl,
    env: { SMOKE_USER_ID: "user-1" },
    log() {},
  });

  assert.equal(outputs.source, "evaluation_artifacts");
  assert.deepEqual(outputs.downloads, ["pdf", "docx", "txt"]);
  assert.equal(calls.some((url) => url.includes("/run-phase1") || url.includes("/run-phase2")), false);
}

async function testFailedJobStopsBeforeOutputRequests() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/jobs")) {
      return response(201, { ok: true, job_id: "job-1" });
    }
    if (url.endsWith("/api/jobs/job-1")) {
      return response(200, {
        ok: true,
        job: {
          id: "job-1",
          status: "failed",
          phase: "phase_1a",
          phase_status: "failed",
          failure_code: "BROKEN",
          last_error: "nope",
        },
      });
    }
    if (url.includes("/api/internal/smoke/jobs/job-1/diagnostic")) {
      return response(200, {
        ok: true,
        job_id: "job-1",
        status: "failed",
        phase: "phase_1a",
        phase_status: "failed",
        failure_code: "BROKEN",
        category: "provider_response_invalid",
        retryable: false,
        diagnostic_summary: "Evaluation failed at phase_1a with failure code BROKEN (category: provider_response_invalid). Retryable: no.",
      });
    }
    throw new Error(`unexpected url ${url}`);
  };

  let err;
  try {
    await runRealManuscriptSmoke({
      baseUrl: "http://local",
      fetchImpl,
      env: { MANUSCRIPT_ID: "7518", SMOKE_USER_ID: "user-1", SMOKE_DIAGNOSTICS_TOKEN: "diag-token" },
      sleepImpl: async () => {},
      timeoutMs: 100,
      pollMs: 1,
      log() {},
    });
    assert.fail("expected runRealManuscriptSmoke to throw");
  } catch (e) {
    err = e;
  }

  assert.match(err.message, /BROKEN[\s\S]*provider_response_invalid/);
  assert.equal(calls.some((call) => call.url.includes("evaluation-result")), false);
  assert.equal(calls.some((call) => call.url.includes("/download")), false);
  // Raw last_error must not leak through the safe diagnostic formatter.
  assert.equal(err.message.includes("nope"), false);
}

async function testScriptDoesNotReferenceRetiredOrWorkerRoutes() {
  const source = readFileSync(new URL("./jobs-smoke-real.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("/run-phase1"), false, "smoke script must not call /run-phase1");
  assert.equal(source.includes("/run-phase2"), false, "smoke script must not call /run-phase2");
  assert.equal(source.includes("/api/workers/"), false, "smoke script must not call worker relay directly");
}

async function testSnapshotPredicate() {
  assert.equal(isSnapshotMissingCreateFailure(422, { code: "MANUSCRIPT_SOURCE_SNAPSHOT_MISSING" }), true);
  assert.equal(isSnapshotMissingCreateFailure(500, { code: "MANUSCRIPT_SOURCE_SNAPSHOT_MISSING" }), false);
}

async function testActiveJobConflictReusesSmokeOwnedJob() {
  const fetchImpl = async (url, init) => {
    assert.equal(init?.method, "POST");
    assert.ok(url.endsWith("/api/jobs"));
    return response(409, {
      ok: false,
      code: "ACTIVE_JOB_CONFLICT",
      error: "An evaluation is already running or queued for this manuscript.",
      existing_job_id: "job-existing",
      existing_job_user_id: "user-1",
    });
  };

  const res = await createJobWithSnapshotRepair("http://local", "7518", {
    fetchImpl,
    env: { SMOKE_USER_ID: "user-1" },
    log() {},
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.job_id, "job-existing");
  assert.equal(body.reused, true);
  assert.equal(body.existing_job_user_id, "user-1");
}

async function testActiveJobConflictForeignOwnerFails() {
  const fetchImpl = async () =>
    response(409, {
      ok: false,
      code: "ACTIVE_JOB_CONFLICT",
      error: "An evaluation is already running or queued for this manuscript.",
      existing_job_id: "job-foreign",
      existing_job_user_id: "other-user",
    });

  await assert.rejects(
    createJobWithSnapshotRepair("http://local", "7518", {
      fetchImpl,
      env: { SMOKE_USER_ID: "user-1" },
      log() {},
    }),
    /Active evaluation exists for manuscript 7518 \(owned by other-user\)/,
  );
}

await testSmokeAuthHeaders();
await testSmokeDiagnosticHeaders();
await testFormatSmokeDiagnostic();
await testRepairOnceThenRetry();
await testNonSnapshotErrorDoesNotRepair();
await testTerminalFailedDiagnostics();
await testTerminalCompleteRequiresOutputs();
await testFailedJobStopsBeforeOutputRequests();
await testSnapshotPredicate();
await testScriptDoesNotReferenceRetiredOrWorkerRoutes();
await testActiveJobConflictReusesSmokeOwnedJob();
await testActiveJobConflictForeignOwnerFails();
console.log("jobs-smoke-real.test.mjs passed");
