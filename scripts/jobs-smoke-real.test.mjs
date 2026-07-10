#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertCanonicalOutputs,
  assertTerminalComplete,
  createJobWithSnapshotRepair,
  isSnapshotMissingCreateFailure,
  pollJobToTerminal,
  runRealManuscriptSmoke,
  smokeAuthHeaders,
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
  let pollHeaders = null;
  const fetchImpl = async (_url, init) => {
    pollHeaders = init?.headers ?? null;
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
      env: { SMOKE_USER_ID: "user-1" },
      sleepImpl: async () => {},
      timeoutMs: 100,
      pollMs: 1,
      log() {},
    }),
    /SMOKE_FAILURE[\s\S]*boom/,
  );
  assert.equal(pollHeaders?.["x-user-id"], "user-1");
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
    throw new Error(`unexpected url ${url}`);
  };

  await assert.rejects(
    runRealManuscriptSmoke({
      baseUrl: "http://local",
      fetchImpl,
      env: { MANUSCRIPT_ID: "7518", SMOKE_USER_ID: "user-1" },
      sleepImpl: async () => {},
      timeoutMs: 100,
      pollMs: 1,
      log() {},
    }),
    /BROKEN[\s\S]*nope/,
  );

  assert.equal(calls.some((call) => call.url.includes("evaluation-result")), false);
  assert.equal(calls.some((call) => call.url.includes("/download")), false);
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

await testSmokeAuthHeaders();
await testRepairOnceThenRetry();
await testNonSnapshotErrorDoesNotRepair();
await testTerminalFailedDiagnostics();
await testTerminalCompleteRequiresOutputs();
await testFailedJobStopsBeforeOutputRequests();
await testSnapshotPredicate();
await testScriptDoesNotReferenceRetiredOrWorkerRoutes();
console.log("jobs-smoke-real.test.mjs passed");
