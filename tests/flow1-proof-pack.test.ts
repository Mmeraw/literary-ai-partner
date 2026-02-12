/**
 * Flow 1 Proof Pack (API-level)
 *
 * Requires a running dev server:
 *   npm run dev
 *
 * Run:
 *   npm test -- tests/flow1-proof-pack.test.ts
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

const BASE_URL = process.env.FLOW1_BASE_URL || "http://127.0.0.1:3002";
const CRON_SECRET = process.env.CRON_SECRET;

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

type JobCreateResponse = { ok?: boolean; job_id?: string; id?: string };

type EvaluationResultResponse = {
  job_id: string;
  manuscript_id: number;
  status: string;
  result: {
    criteria: Array<{ key: string }>;
  };
};

async function httpJson<T>(url: string, init?: RequestInit): Promise<{ status: number; ok: boolean; json?: T; text: string }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: T | undefined;
  try {
    json = text ? (JSON.parse(text) as T) : undefined;
  } catch {
    // leave json undefined
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function createJob(userId: string, manuscriptText: string): Promise<string> {
  const { ok, status, json, text } = await httpJson<JobCreateResponse>(`${BASE_URL}/api/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      job_type: "evaluate_full",
      manuscript_text: manuscriptText,
      title: "Flow 1 Proof Pack",
    }),
  });

  if (!ok) {
    throw new Error(`createJob failed: ${status} ${text}`);
  }

  const jobId = json?.job_id ?? json?.id;
  if (!jobId) {
    throw new Error(`createJob: response missing job id. Body: ${text}`);
  }
  return jobId;
}

async function ensureJobVisible(jobId: string, userId: string, timeoutMs = 10_000): Promise<void> {
  const started = Date.now();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  while (Date.now() - started < timeoutMs) {
    const { ok, status } = await httpJson(`${BASE_URL}/api/jobs/${jobId}`, {
      headers: { "x-user-id": userId },
    });

    if (ok) return;

    if (status === 404) {
      await sleep(500);
      continue;
    }

    throw new Error(`Job visibility check failed: status=${status}`);
  }

  throw new Error(
    "Job not visible via /api/jobs. Confirm USE_SUPABASE_JOBS=true and restart dev server.",
  );
}

async function runProcessor(): Promise<void> {
  if (!CRON_SECRET) {
    throw new Error("CRON_SECRET not set; cannot trigger evaluation worker.");
  }

  const { ok, status, text } = await httpJson(`${BASE_URL}/api/workers/process-evaluations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${CRON_SECRET}`,
    },
  });

  if (!ok) {
    throw new Error(`process-evaluations failed: ${status} ${text}`);
  }
}

async function waitForEvaluationResult(jobId: string, userId: string, timeoutMs = 120_000): Promise<EvaluationResultResponse> {
  const started = Date.now();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await ensureJobVisible(jobId, userId);

  while (Date.now() - started < timeoutMs) {
    await runProcessor();

    const { ok, status, json, text } = await httpJson<EvaluationResultResponse>(
      `${BASE_URL}/api/jobs/${jobId}/evaluation-result`,
      {
        headers: { "x-user-id": userId },
      },
    );

    if (ok && json?.result) return json;

    if (status === 403) {
      throw new Error("Ownership enforcement failed for owner request.");
    }

    if (status >= 500) {
      throw new Error(`evaluation-result failed: ${status} ${text}`);
    }

    await sleep(1000);
  }

  throw new Error(`evaluation-result not ready within ${timeoutMs}ms`);
}

const shouldRun = Boolean(process.env.FLOW1_BASE_URL && process.env.CRON_SECRET);

const describeFlow1 = shouldRun ? describe : describe.skip;

describeFlow1("Flow 1 proof pack (Must Never Fail)", () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    const { ok, status, text } = await httpJson(`${BASE_URL}/api/jobs`, {
      headers: { "x-user-id": USER_A },
    });

    if (!ok && status >= 500) {
      throw new Error(`Dev server not reachable: ${status} ${text}`);
    }
  });

  test("Cross-user read is blocked (403/404) — never OK", async () => {
    const jobId = await createJob(USER_A, "Flow1 cross-user read test.");
    await waitForEvaluationResult(jobId, USER_A);

    const res = await fetch(`${BASE_URL}/api/jobs/${jobId}/evaluation-result`, {
      headers: { "x-user-id": USER_B },
    });

    expect([403, 404]).toContain(res.status);
  });

  test("Evaluation result includes canonical criteria keys only", async () => {
    const jobId = await createJob(USER_A, "Flow1 canonical keys test.");
    const json = await waitForEvaluationResult(jobId, USER_A);
    const result = json.result;
    if (!result || !Array.isArray(result.criteria)) {
      throw new Error("criteria array not found in evaluation result.");
    }

    const keys = result.criteria.map((criterion) => criterion.key).sort();
    const canonicalKeys = [...CRITERIA_KEYS].sort();

    expect(keys).toEqual(canonicalKeys);
    expect(keys).not.toContain("plot");
  });

  test("Evaluation result returns manuscript_id and job_id", async () => {
    const jobId = await createJob(USER_A, "Flow1 manuscript linkage test.");
    const json = await waitForEvaluationResult(jobId, USER_A);

    expect(json.job_id).toBe(jobId);
    expect(typeof json.manuscript_id).toBe("number");
  });
});

describe.skip("Flow 1 proof pack prerequisites", () => {
  test("Set FLOW1_BASE_URL and CRON_SECRET to run proof pack", () => {
    expect(shouldRun).toBe(true);
  });
});
