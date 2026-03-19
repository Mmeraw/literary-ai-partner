/**
 * tests/api/jobs-endpoint.test.ts
 *
 * Test suite for GET /api/jobs/[jobId] endpoint.
 * Canonical job status read (per JOBCONTRACT_v1).
 *
 * Covers:
 * - Authentication (x-user-id required)
 * - Ownership enforcement (404 if not owner)
 * - Canonical response shape (id, status, progress, timestamps, last_error)
 * - Progress calculation
 * - Terminal states (complete, failed)
 */

import { GET } from "@/app/api/jobs/[jobId]/route";
import * as jobStore from "@/lib/jobs/store";
import type { Job, JobStatus } from "@/lib/jobs/types";
import * as supabaseServer from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// Mock the job store
jest.mock("@/lib/jobs/store");
jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockGetJob = jobStore.getJob as unknown as {
  mockResolvedValue: (value: Job | null) => void;
};
const mockGetAuthenticatedUser =
  supabaseServer.getAuthenticatedUser as unknown as {
    mockResolvedValue: (value: { id: string } | null) => void;
  };

// Helper: build a mock Job object
function buildJob(overrides: Partial<Job> = {}): Job {
  const now = "2026-03-19T12:00:00.000Z";
  return {
    id: "job-uuid-123",
    user_id: "user-123",
    manuscript_id: 1,
    job_type: "evaluate_quick",
    status: "running" as JobStatus,
    progress: {
      phase: "phase_1",
      phase_status: "running",
      total_units: 10,
      completed_units: 4,
    },
    created_at: now,
    updated_at: now,
    last_heartbeat: now,
    last_error: null,
    retry_count: 0,
    ...overrides,
  } as Job;
}

// Helper: build a mock NextRequest
function buildRequest(options?: {
  jobId?: string;
  userId?: string | null;
}): NextRequest {
  const { jobId = "job-uuid-123", userId = "user-123" } = options || {};
  const headers = new Headers();
  if (userId) {
    headers.set("x-user-id", userId);
  }
  return new NextRequest("https://localhost:3000/api/jobs/[jobId]", {
    headers,
  });
}

describe("GET /api/jobs/[jobId]", () => {
  const prevTestMode = process.env.TEST_MODE;
  const prevAllowHeaderUserId = process.env.ALLOW_HEADER_USER_ID;

  beforeAll(() => {
    process.env.TEST_MODE = "true";
    process.env.ALLOW_HEADER_USER_ID = "true";
  });

  afterAll(() => {
    process.env.TEST_MODE = prevTestMode;
    process.env.ALLOW_HEADER_USER_ID = prevAllowHeaderUserId;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(null);
  });

  // ========================================
  // Authentication Tests
  // ========================================

  test("returns 401 when x-user-id header missing", async () => {
    const req = buildRequest({ jobId: "job-1", userId: null });
    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(401);
    const json = (await response.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Unauthorized");
  });

  // ========================================
  // Job Not Found Tests
  // ========================================

  test("returns 404 when job does not exist", async () => {
    const req = buildRequest({ jobId: "job-999" });
    mockGetJob.mockResolvedValue(null);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-999" }),
    });

    expect(response.status).toBe(404);
    const json = (await response.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Job not found");
  });

  // ========================================
  // Ownership Enforcement Tests
  // ========================================

  test("returns 404 when user does not own job (permission leak protection)", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-999" });
    const job = buildJob({ user_id: "user-123" });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(404);
    const json = (await response.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Job not found");
  });

  // ========================================
  // Success Cases (Status & Response Shape)
  // ========================================

  test("returns 200 with canonical response when job exists and user owns it", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      status: "running" as JobStatus,
      progress: {
        phase: "phase_1",
        phase_status: "running",
        total_units: 10,
        completed_units: 4,
      },
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      job: {
        id: string;
        status: string;
        progress: number;
        created_at: string;
        updated_at: string;
        last_error?: string;
      };
    };

    expect(json.ok).toBe(true);
    expect(json.job).toMatchObject({
      id: "job-uuid-123",
      status: "running",
      progress: 40, // 4/10 = 0.4 * 100 = 40
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
    // last_error should NOT be present on success
    expect(json.job.last_error).toBeUndefined();
  });

  test("returns queued status correctly", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({ status: "queued" as JobStatus });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { status: string };
    };
    expect(json.job.status).toBe("queued");
  });

  test("returns complete status correctly", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      status: "complete" as JobStatus,
      progress: {
        phase: "phase_1",
        phase_status: "complete",
        total_units: 10,
        completed_units: 10,
      },
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { status: string; progress: number };
    };
    expect(json.job.status).toBe("complete");
    expect(json.job.progress).toBe(100);
  });

  // ========================================
  // last_error Tests
  // ========================================

  test("includes last_error only when status === failed", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      status: "failed" as JobStatus,
      last_error: "Anchor offsets missing for accepted proposal",
      failure_code: "ANCHOR_MISS",
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { status: string; last_error?: string; failure_code?: string };
    };
    expect(json.job.status).toBe("failed");
    expect(json.job.last_error).toBe(
      "Anchor offsets missing for accepted proposal"
    );
    expect(json.job.failure_code).toBe("ANCHOR_MISS");
  });

  test("does not include last_error when status === failed but last_error is null", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      status: "failed" as JobStatus,
      last_error: null,
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { status: string; last_error?: string };
    };
    expect(json.job.status).toBe("failed");
    expect(json.job.last_error).toBeUndefined();
  });

  test("does not include last_error when status === running (even if present)", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      status: "running" as JobStatus,
      last_error: "Some historical error",
      failure_code: "PARSE_ERROR",
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { status: string; last_error?: string; failure_code?: string };
    };
    expect(json.job.status).toBe("running");
    expect(json.job.last_error).toBeUndefined();
    expect(json.job.failure_code).toBeUndefined();
  });

  // ========================================
  // Progress Calculation Tests
  // ========================================

  test("calculates progress as 0 when total_units is 0", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      progress: {
        phase: "phase_1",
        phase_status: "running",
        total_units: 0,
        completed_units: 0,
      },
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { progress: number };
    };
    expect(json.job.progress).toBe(0);
  });

  test("calculates progress as 0 when progress object is null", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({ progress: null });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { progress: number };
    };
    expect(json.job.progress).toBe(0);
  });

  test("rounds progress correctly (7 units / 10 = 70%)", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      progress: {
        phase: "phase_1",
        phase_status: "running",
        total_units: 10,
        completed_units: 7,
      },
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { progress: number };
    };
    expect(json.job.progress).toBe(70);
  });

  test("rounds progress correctly (1 unit / 3 = 33%)", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob({
      progress: {
        phase: "phase_1",
        phase_status: "running",
        total_units: 3,
        completed_units: 1,
      },
    });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      job: { progress: number };
    };
    expect(json.job.progress).toBe(33);
  });

  // ========================================
  // Canonical Status Validation
  // ========================================

  test("returns 500 on invalid status value in DB", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob();
    // Forcefully set invalid status (should not happen, but guard if DB is corrupted)
    (job as unknown as { status: string }).status = "invalid_status";
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(500);
    const json = (await response.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Invalid job state");
  });

  // ========================================
  // Response Envelope
  // ========================================

  test("response envelope always has ok and job fields on success", async () => {
    const req = buildRequest({ jobId: "job-1", userId: "user-123" });
    const job = buildJob();
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as { ok: boolean; job: unknown };
    expect(json).toHaveProperty("ok");
    expect(json).toHaveProperty("job");
    expect(typeof json.ok).toBe("boolean");
    expect(typeof json.job).toBe("object");
  });

  test("response envelope has ok and error fields on failure", async () => {
    const req = buildRequest({ jobId: "job-1", userId: null });

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    const json = (await response.json()) as {
      ok: boolean;
      error?: string;
    };
    expect(json).toHaveProperty("ok");
    expect(json).toHaveProperty("error");
    expect(json.ok).toBe(false);
    expect(typeof json.error).toBe("string");
  });

  test("accepts authenticated session when x-user-id header is missing", async () => {
    const req = buildRequest({ jobId: "job-1", userId: null });
    const job = buildJob({ user_id: "session-user-123" });

    mockGetAuthenticatedUser.mockResolvedValue({ id: "session-user-123" });
    mockGetJob.mockResolvedValue(job);

    const response = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      job: { id: string; status: string };
    };

    expect(json.ok).toBe(true);
    expect(json.job.id).toBe(job.id);
  });

});
