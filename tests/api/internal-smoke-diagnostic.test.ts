/**
 * tests/api/internal-smoke-diagnostic.test.ts
 *
 * Tests for GET /api/internal/smoke/jobs/[jobId]/diagnostic.
 *
 * This is a narrow, fail-closed endpoint for the canonical real-manuscript
 * smoke. It returns only safe, redacted diagnostic fields and must reject
 * ordinary users, broad service tokens, malformed tokens, and requests for
 * non-smoke jobs.
 */

import { GET } from "@/app/api/internal/smoke/jobs/[jobId]/diagnostic/route";
import * as jobStore from "@/lib/jobs/store";
import type { Job, JobStatus } from "@/lib/jobs/types";
import { NextRequest } from "next/server";

jest.mock("@/lib/jobs/store");

const mockGetJob = jobStore.getJob as unknown as {
  mockResolvedValue: (value: Job | null) => void;
};

function buildJob(overrides: Partial<Job> = {}): Job {
  const now = "2026-03-19T12:00:00.000Z";
  return {
    id: "job-uuid-123",
    user_id: "smoke-user-123",
    manuscript_id: 1,
    job_type: "evaluate_full",
    status: "failed" as JobStatus,
    validity_status: "invalid",
    progress: {
      phase: "phase_3",
      phase_status: "failed",
      total_units: 100,
      completed_units: 75,
    },
    created_at: now,
    updated_at: now,
    last_heartbeat: now,
    last_error: "raw internal provider error: token exceeded",
    failure_code: "PASS3_PROVIDER_ERROR",
    retry_count: 0,
    ...overrides,
  } as Job;
}

function buildRequest(options?: {
  jobId?: string;
  token?: string | null;
  userId?: string | null;
}): NextRequest {
  const { jobId = "job-uuid-123", token = "smoke-diag-123", userId = "smoke-user-123" } = options ?? {};
  const headers = new Headers();
  if (token) {
    headers.set("authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
  }
  if (userId) {
    headers.set("x-user-id", userId);
  }
  return new NextRequest(`https://localhost:3000/api/internal/smoke/jobs/${jobId}/diagnostic`, {
    headers,
  });
}

describe("GET /api/internal/smoke/jobs/[jobId]/diagnostic", () => {
  const prevSmokeToken = process.env.SMOKE_DIAGNOSTICS_TOKEN;
  const prevSmokeUserId = process.env.SMOKE_USER_ID;

  beforeAll(() => {
    process.env.SMOKE_DIAGNOSTICS_TOKEN = "smoke-diag-123";
    process.env.SMOKE_USER_ID = "smoke-user-123";
  });

  afterAll(() => {
    process.env.SMOKE_DIAGNOSTICS_TOKEN = prevSmokeToken;
    process.env.SMOKE_USER_ID = prevSmokeUserId;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fails closed when SMOKE_DIAGNOSTICS_TOKEN is missing", async () => {
    const backup = process.env.SMOKE_DIAGNOSTICS_TOKEN;
    delete process.env.SMOKE_DIAGNOSTICS_TOKEN;
    try {
      const req = buildRequest();
      const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
      expect(res.status).toBe(503);
      const json = (await res.json()) as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toContain("configuration incomplete");
    } finally {
      process.env.SMOKE_DIAGNOSTICS_TOKEN = backup;
    }
  });

  test("fails closed when SMOKE_USER_ID is missing", async () => {
    const backup = process.env.SMOKE_USER_ID;
    delete process.env.SMOKE_USER_ID;
    try {
      const req = buildRequest();
      const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
      expect(res.status).toBe(503);
      const json = (await res.json()) as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toContain("configuration incomplete");
    } finally {
      process.env.SMOKE_USER_ID = backup;
    }
  });

  test("a valid token cannot access any job when smoke configuration is incomplete", async () => {
    const backup = process.env.SMOKE_USER_ID;
    delete process.env.SMOKE_USER_ID;
    try {
      const req = buildRequest();
      const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
      expect(res.status).toBe(503);
    } finally {
      process.env.SMOKE_USER_ID = backup;
    }
  });

  test("rejects missing authorization with 401", async () => {
    const req = buildRequest({ token: null });
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(401);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Unauthorized");
  });

  test("rejects malformed authorization with 401", async () => {
    const req = buildRequest({ token: "Basic smoke-diag-123" });
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(401);
  });

  test("rejects wrong diagnostic token with 401", async () => {
    const req = buildRequest({ token: "wrong-token" });
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(401);
  });

  test("rejects broad service-role bearer when it does not match SMOKE_DIAGNOSTICS_TOKEN", async () => {
    const req = buildRequest({ token: "sk-service-role-broad-token" });
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(401);
  });

  test("rejects ordinary user without diagnostic token with 401", async () => {
    const req = buildRequest({ token: null, userId: "ordinary-user" });
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(401);
  });

  test("rejects request with wrong x-user-id when SMOKE_USER_ID is configured", async () => {
    const req = buildRequest({ userId: "wrong-user" });
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.error).toBe("Forbidden");
  });

  test("rejects access to a non-smoke job", async () => {
    const req = buildRequest();
    mockGetJob.mockResolvedValue(buildJob({ user_id: "other-user" }));
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(403);
  });

  test("returns 404 when job does not exist", async () => {
    const req = buildRequest();
    mockGetJob.mockResolvedValue(null);
    const res = await GET(req, { params: Promise.resolve({ jobId: "job-missing" }) });
    expect(res.status).toBe(404);
  });

  test("returns safe redacted diagnostic for a failed job and never exposes operational fields", async () => {
    const req = buildRequest();
    const job = buildJob({
      progress: {
        phase: "phase_3",
        phase_status: "failed",
        total_units: 100,
        completed_units: 75,
        artifact_id: "secret-artifact-uuid",
        lease_id: "lease-123",
        message: "internal phase message",
      } as unknown as Job["progress"],
      last_error: "raw internal provider error: token exceeded",
    });
    mockGetJob.mockResolvedValue(job);

    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(200);

    const headers = Object.fromEntries(res.headers.entries());
    expect(headers["cache-control"]).toMatch(/no-store/);

    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      job_id: "job-uuid-123",
      status: "failed",
      phase: "phase_3",
      phase_status: "failed",
      failure_code: "PASS3_PROVIDER_ERROR",
      category: "provider_response_invalid",
      retryable: true,
      diagnostic_summary: expect.stringContaining("PASS3_PROVIDER_ERROR"),
    });
    expect("last_error" in json).toBe(false);
    expect("progress" in json).toBe(false);
    expect("artifact_id" in json).toBe(false);
    expect("lease_id" in json).toBe(false);
    expect("validity_status" in json).toBe(false);
    expect("last_heartbeat" in json).toBe(false);
    expect("manuscript_id" in json).toBe(false);
    expect("retry_count" in json).toBe(false);
  });

  test("category and retryable are derived even for unknown failure codes", async () => {
    const req = buildRequest();
    mockGetJob.mockResolvedValue(
      buildJob({ failure_code: "MYSTERY_CODE", last_error: "secret details" }),
    );

    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    const json = (await res.json()) as {
      ok: boolean;
      failure_code: string;
      category: string;
      retryable: boolean;
      diagnostic_summary: string;
      last_error?: string;
    };

    expect(json.ok).toBe(true);
    expect(json.failure_code).toBe("MYSTERY_CODE");
    expect(json.category).toBe("unknown");
    expect(json.retryable).toBe(false);
    expect("last_error" in json).toBe(false);
  });

  test("includes redacted integrity violation paths and codes for author-facing text failures", async () => {
    const req = buildRequest();
    const job = buildJob({
      failure_code: "AUTHOR_FACING_TEXT_INTEGRITY_FAILED",
      progress: {
        phase: "phase_3",
        phase_status: "failed",
        total_units: 100,
        completed_units: 75,
        pipeline_failure_diagnostics: {
          author_facing_integrity_violations: [
            { path: "evaluation_result_v2.criteria[2].rationale", code: "OVERLY_GENERIC", message: "secret", value: "raw text" },
            { path: "evaluation_result_v2.criteria[0].recommendations[0].action", code: "TOO_SHORT" },
          ],
        },
        pipeline_failure_envelope: {
          error_code: "AUTHOR_FACING_TEXT_INTEGRITY_FAILED",
          error_message: "raw internal text",
          reason_codes: ["AUTHOR_FACING_TEXT_INTEGRITY_FAILED", "evaluation_result_v2.criteria[2].rationale:OVERLY_GENERIC"],
        },
      },
    });
    mockGetJob.mockResolvedValue(job);

    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.integrity_violations).toEqual([
      { path: "evaluation_result_v2.criteria[2].rationale", code: "OVERLY_GENERIC" },
      { path: "evaluation_result_v2.criteria[0].recommendations[0].action", code: "TOO_SHORT" },
    ]);
    expect(json.reason_codes).toEqual([
      "AUTHOR_FACING_TEXT_INTEGRITY_FAILED",
      "evaluation_result_v2.criteria[2].rationale:OVERLY_GENERIC",
    ]);
    expect("error_message" in json).toBe(false);
    expect("message" in json.integrity_violations[0]).toBe(false);
    expect("value" in json.integrity_violations[0]).toBe(false);
  });

  test("integrity_violations is omitted when no author-facing diagnostics are present", async () => {
    const req = buildRequest();
    mockGetJob.mockResolvedValue(
      buildJob({ failure_code: "PASS3_PROVIDER_ERROR" }),
    );

    const res = await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    const json = await res.json();
    expect(json.integrity_violations).toBeUndefined();
    expect(json.reason_codes).toBeUndefined();
  });
});
