/**
 * Flow 1 Proof Pack (CI)
 *
 * Goal: Prove Flow 1 end-to-end wiring works against local Supabase:
 *   1) Create a manuscript
 *   2) Create an evaluation job referencing manuscript_id + job_type
 *
 * This prevents "missing manuscript_id/job_type" failures and catches real contract breaks.
 */

import { describe, test, expect, beforeAll } from "@jest/globals";

const BASE_URL = process.env.FLOW1_BASE_URL || "http://127.0.0.1:3002";
const CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret-for-flow1-proof";

type Json = Record<string, any>;

async function postJson(path: string, body: Json, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep as text
  }
  return { res, text, json };
}

/**
 * Try a small set of likely manuscript-create endpoints.
 * Adjust here if your app uses a different route.
 */
async function createManuscript(): Promise<number> {
  const candidatePaths = [
    "/api/manuscripts",          // common REST
    "/api/manuscripts/create",   // common action
    "/api/manuscript",           // alternate
    "/api/manuscript/create",    // alternate action
  ];

  const payload = {
    title: "Flow 1 CI Proof Manuscript",
    work_type: "novel",
    content: "CI proof content.\nThis is a short manuscript body used for Flow 1 proof pack.",
  };

  let lastError: string | null = null;

  for (const path of candidatePaths) {
    const { res, json, text } = await postJson(path, payload);

    if (res.ok) {
      // Accept a few common response shapes
      const id =
        json?.id ??
        json?.manuscript?.id ??
        json?.data?.id ??
        json?.result?.id;

      if (typeof id === "number") return id;

      lastError = `Manuscript created at ${path} but no numeric id found. Body: ${text}`;
      continue;
    }

    lastError = `POST ${path} failed (${res.status}). Body: ${text}`;
  }

  throw new Error(
    [
      "Unable to create manuscript for Flow 1 proof pack.",
      "Tried endpoints:",
      ...candidatePaths.map((p) => `- ${p}`),
      "",
      "Last error:",
      lastError ?? "(none)",
      "",
      "Fix: update createManuscript() to hit your real manuscript creation endpoint/shape.",
    ].join("\n")
  );
}

/**
 * Create job using current Flow 1 contract requirements.
 */
async function createJob(manuscriptId: number, jobType: string) {
  // Your API probably enforces cron secret on job creation; include it if needed.
  const headers: Record<string, string> = {
    "x-cron-secret": CRON_SECRET,
  };

  // Common job-create endpoints (try primary, then alternates)
  const candidatePaths = [
    "/api/jobs/create",
    "/api/jobs",
    "/api/job/create",
    "/api/job",
  ];

  const payload = {
    manuscript_id: manuscriptId,
    job_type: jobType,
  };

  let last: { status: number; body: string } | null = null;

  for (const path of candidatePaths) {
    const { res, text } = await postJson(path, payload, headers);
    if (res.ok) return { path, status: res.status, body: text };
    last = { status: res.status, body: text };
  }

  throw new Error(
    [
      "Unable to create job for Flow 1 proof pack.",
      "Tried endpoints:",
      ...candidatePaths.map((p) => `- ${p}`),
      "",
      "Last response:",
      last ? `status=${last.status}\n${last.body}` : "(none)",
      "",
      "Fix: update createJob() endpoint list or payload to match your jobs API.",
    ].join("\n")
  );
}

describe("Flow 1 Proof Pack", () => {
  let manuscriptId: number;

  beforeAll(async () => {
    // Basic boot check (avoid false positives)
    const res = await fetch(`${BASE_URL}/`);
    expect(res.status).toBeLessThan(500);

    manuscriptId = await createManuscript();
    expect(typeof manuscriptId).toBe("number");
  }, 180000);

  test(
    "can create a Flow 1 evaluation job with manuscript_id + job_type",
    async () => {
      // Use the job_type your system expects for Flow 1 (adjust if needed)
      const jobType = "flow1";

      const out = await createJob(manuscriptId, jobType);

      // We only need to prove the API accepts the contract and responds successfully.
      // Any deeper assertions can be added later once the response schema is stable.
      expect(out.status).toBeGreaterThanOrEqual(200);
      expect(out.status).toBeLessThan(300);
      expect(out.body.length).toBeGreaterThan(0);
    },
    180000
  );
});
