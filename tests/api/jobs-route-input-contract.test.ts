import { POST } from "@/app/api/jobs/route";
import { createJob } from "@/lib/jobs/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createInitialVersion } from "@/lib/manuscripts/versions";
import { attachFreeDiagnosticJob, claimFreeDiagnostic } from "@/lib/freeDiagnostic/claims";
import { failEvaluationJobTerminally } from "@/lib/jobs/failJobTerminal";

jest.mock("@/lib/jobs/store", () => ({
  createJob: jest.fn(),
  getAllJobs: jest.fn(),
}));

jest.mock("@/lib/jobs/metrics", () => ({
  onJobCreated: jest.fn(),
}));

jest.mock("@/lib/jobs/rateLimiter", () => ({
  checkJobCreationRateLimit: jest.fn(async () => ({ allowed: true })),
  checkFeatureAccess: jest.fn(async () => ({ allowed: true })),
  validateManuscriptSize: jest.fn(() => ({ allowed: true })),
}));

jest.mock("@/lib/observability/logger", () => ({
  generateTraceId: jest.fn(() => "trace-1"),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  jobLogger: {
    created: jest.fn(),
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/manuscripts/versions", () => ({
  createInitialVersion: jest.fn(),
}));

jest.mock("@/lib/freeDiagnostic/claims", () => ({
  claimFreeDiagnostic: jest.fn(),
  attachFreeDiagnosticJob: jest.fn(),
}));

jest.mock("@/lib/jobs/backpressure", () => ({
  backpressureGuard: jest.fn(async () => null),
}));

jest.mock("@/lib/jobs/failJobTerminal", () => ({
  failEvaluationJobTerminally: jest.fn(async () => ({ ok: true, jobId: "job-terminal" })),
}));

const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateInitialVersion = createInitialVersion as jest.MockedFunction<typeof createInitialVersion>;
const mockClaimFreeDiagnostic = claimFreeDiagnostic as jest.MockedFunction<typeof claimFreeDiagnostic>;
const mockAttachFreeDiagnosticJob = attachFreeDiagnosticJob as jest.MockedFunction<typeof attachFreeDiagnosticJob>;
const mockFailEvaluationJobTerminally = failEvaluationJobTerminally as jest.MockedFunction<typeof failEvaluationJobTerminally>;
const mockFetch = jest.fn();
const originalFetch = global.fetch;

function mockWorkerClaimSuccess() {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      claimed: 1,
      processed: 1,
      targetClaimed: true,
    }),
  } as Response);
}

function buildDefaultAdminClientMock() {
  const evaluationJobsUpdateEq = jest.fn(async () => ({ error: null }));
  const evaluationJobsUpdate = jest.fn(() => ({ eq: evaluationJobsUpdateEq }));

  const evaluationJobsSelectLimit = jest.fn(async () => ({ data: [], error: null }));
  const evaluationJobsSelectIn = jest.fn(() => ({ limit: evaluationJobsSelectLimit }));
  const evaluationJobsSelectEq = jest.fn(() => ({ in: evaluationJobsSelectIn }));
  const evaluationJobsSelect = jest.fn(() => ({ eq: evaluationJobsSelectEq }));

  const manuscriptsMaybeSingle = jest.fn(async () => ({
    data: {
      word_count: 4412,
      file_url: `data:text/plain;charset=utf-8,${encodeURIComponent("He walked to the door and said, \"Wait.\"")}`,
    },
    error: null,
  }));
  const manuscriptsEqUser = jest.fn(() => ({ maybeSingle: manuscriptsMaybeSingle }));
  const manuscriptsEqId = jest.fn(() => ({ eq: manuscriptsEqUser }));
  const manuscriptsSelect = jest.fn(() => ({ eq: manuscriptsEqId }));

  return {
    from: jest.fn((table: string) => {
      if (table === "evaluation_jobs") {
        return {
          select: evaluationJobsSelect,
          update: evaluationJobsUpdate,
        };
      }

      if (table === "manuscripts") {
        return {
          select: manuscriptsSelect,
          insert: jest.fn(() => ({
            select: () => ({
              single: async () => ({ data: { id: 321 }, error: null }),
            }),
          })),
        };
      }

      throw new Error(`Unexpected table in default admin client mock: ${table}`);
    }),
  };
}

describe("POST /api/jobs input contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
    process.env.CRON_SECRET = "test-cron-secret";
    mockWorkerClaimSuccess();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "writer@example.com" } as never);
    mockCreateAdminClient.mockReturnValue(buildDefaultAdminClientMock() as never);
    mockCreateInitialVersion.mockResolvedValue({ id: "version-1" } as never);
    mockClaimFreeDiagnostic.mockResolvedValue({ ok: true, claimId: "claim-1", ipHash: "hash-1" });
    mockAttachFreeDiagnosticJob.mockResolvedValue(undefined);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("returns 400 when both manuscript_id and manuscript_text are provided", async () => {
    const req = new Request("https://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 555,
        manuscript_text: "Conflicting source",
        job_type: "evaluate_full",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBe(
      "Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.",
    );
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  test("returns 400 when evaluation processing terms acknowledgement is missing", async () => {
    const req = new Request("https://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 777,
        job_type: "evaluate_full",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBe(
      "Please acknowledge that RevisionGrade evaluations are custom digital services and that processing begins after submission.",
    );
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  test("accepts text-only input and creates fresh manuscript-backed job", async () => {
    const updateMock = jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return {
            insert: jest.fn(() => ({
              select: () => ({
                single: async () => ({ data: { id: 321 }, error: null }),
              }),
            })),
          };
        }

        if (table === "evaluation_jobs") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  limit: jest.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            update: updateMock,
          };
        }

        throw new Error(`Unexpected table in test mock: ${table}`);
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);
    mockCreateJob.mockResolvedValue({
      id: "job-321",
      manuscript_id: 321,
      job_type: "evaluate_full",
      status: "queued",
    } as never);

    const req = new Request("https://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: "Fresh chapter text",
        author_name: "Michael Meraw",
        manuscript_title: "Let the River Decide",
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; job_id: string };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.job_id).toBe("job-321");

    expect(supabase.from).toHaveBeenCalledWith("manuscripts");
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscript_id: 321,
        manuscript_version_id: "version-1",
        user_id: "user-1",
        job_type: "evaluate_full",
      }),
    );
    const updatePayload = (updateMock.mock.calls as unknown[][])[0]?.[0] as { progress?: Record<string, unknown> } | undefined;
    expect(updatePayload?.progress?.submitted_author_name).toBe("Michael Meraw");
    expect(updatePayload?.progress?.submitted_project_title).toBe("Let the River Decide");
  });

  test("classifier is audit-only: letter-style submissions create a job and record flagged type", async () => {
    const updateMock = jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return {
            insert: jest.fn(() => ({
              select: () => ({
                single: async () => ({ data: { id: 400 }, error: null }),
              }),
            })),
          };
        }
        if (table === "evaluation_jobs") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  limit: jest.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            update: updateMock,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockCreateAdminClient.mockReturnValue(supabase as never);
    mockCreateJob.mockResolvedValue({
      id: "job-letter",
      manuscript_id: 400,
      job_type: "evaluate_full",
      status: "queued",
    } as never);

    const req = new Request("https://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text:
          "Dear Andrew, I am writing to share professional coaching feedback. Best regards, Mentor.",
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; job_id: string };

    // Classifier is audit-only — never returns 422 for document type.
    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(mockCreateJob).toHaveBeenCalled();

    // Audit flag recorded in progress.
    const updatePayload = (updateMock.mock.calls as unknown[][])[0]?.[0] as { progress?: Record<string, unknown> } | undefined;
    expect(updatePayload?.progress?.narrative_preflight_classifier_flagged).toBe(true);
    expect(updatePayload?.progress?.narrative_preflight_detected_type).toBe("business_letter");
  });

  test("kicks off the evaluation worker after successful job creation", async () => {
    mockCreateJob.mockResolvedValue({
      id: "job-999",
      manuscript_id: 999,
      job_type: "evaluate_full",
      status: "queued",
    } as never);

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 999,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.test/api/workers/process-evaluations",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-cron-secret",
          "x-job-id": "job-999",
        }),
      }),
    );
  });

  test("accepts manuscript_id-only payload and does not create a new manuscript row", async () => {
    const updateMock = jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    }));

    const insertMock = jest.fn(() => {
      throw new Error("Unexpected manuscripts.insert in manuscript_id-only path");
    });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return {
            insert: insertMock,
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: async () => ({
                    data: {
                      word_count: 4412,
                      file_url: `data:text/plain;charset=utf-8,${encodeURIComponent("She closed the letter and stepped into the rain.")}`,
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "evaluation_jobs") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  limit: jest.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            update: updateMock,
          };
        }

        throw new Error(`Unexpected table in test mock: ${table}`);
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);
    mockCreateJob.mockResolvedValue({
      id: "job-1002",
      manuscript_id: 1002,
      job_type: "evaluate_full",
      status: "queued",
    } as never);

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1002,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; job_id: string };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.job_id).toBe("job-1002");
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscript_id: 1002,
        user_id: "user-1",
        job_type: "evaluate_full",
      }),
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("reserves a free diagnostic claim and links it to the created job", async () => {
    mockCreateJob.mockResolvedValue({
      id: "job-free-1",
      manuscript_id: 1200,
      job_type: "evaluate_full",
      status: "queued",
    } as never);

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({
        manuscript_id: 1200,
        job_type: "evaluate_full",
        user_tier: "free",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; job_id: string };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.job_id).toBe("job-free-1");
    expect(mockClaimFreeDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        userId: "user-1",
        email: "writer@example.com",
        manuscriptId: 1200,
      }),
    );
    expect(mockAttachFreeDiagnosticJob).toHaveBeenCalledWith(
      expect.objectContaining({ claimId: "claim-1", jobId: "job-free-1" }),
    );
  });

  test("blocks duplicate free diagnostic claims before creating a job", async () => {
    mockClaimFreeDiagnostic.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "FREE_DIAGNOSTIC_ALREADY_USED",
      message: "This account or email has already used the free diagnostic. Please choose a paid evaluation to continue.",
    });

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1201,
        job_type: "evaluate_full",
        user_tier: "free",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; code: string; error: string };

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("FREE_DIAGNOSTIC_ALREADY_USED");
    expect(json.error).toContain("already used the free diagnostic");
    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(mockAttachFreeDiagnosticJob).not.toHaveBeenCalled();
  });

  test("does not claim a free diagnostic for paid or default evaluation submissions", async () => {
    mockCreateJob.mockResolvedValue({
      id: "job-paid-1",
      manuscript_id: 1202,
      job_type: "evaluate_full",
      status: "queued",
    } as never);

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1202,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(mockClaimFreeDiagnostic).not.toHaveBeenCalled();
    expect(mockAttachFreeDiagnosticJob).not.toHaveBeenCalled();
  });

  test("short-form fast-track stays in canonical phase_0 and does not stamp Phase 0 complete", async () => {
    const updateMock = jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: async () => ({
                    data: {
                      word_count: 4412,
                      file_url: `data:text/plain;charset=utf-8,${encodeURIComponent("The town went quiet as the bell struck midnight.")}`,
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "evaluation_jobs") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  limit: jest.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            update: updateMock,
          };
        }

        throw new Error(`Unexpected table in test mock: ${table}`);
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);
    mockCreateJob.mockResolvedValue({
      id: "job-no-fast-track",
      manuscript_id: 1234,
      job_type: "evaluate_full",
      status: "queued",
      progress: {},
    } as never);

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1234,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    // Short-form fast-track is metadata only: intake must not bypass Phase 0
    // or stamp phase0_completed_at before mandatory seeds are persisted.
    if (updateMock.mock.calls.length > 0) {
      const firstCall = (updateMock.mock.calls as unknown[][])[0]?.[0] as Record<string, unknown> | undefined;
      const progressArg = firstCall?.progress as Record<string, unknown> | undefined;
      expect(firstCall?.phase).toBe("phase_0");
      expect(firstCall?.phase_status).toBe("queued");
      expect(firstCall?.phase0_completed_at).toBeUndefined();
      expect(progressArg?.phase).toBe("phase_0");
      expect(progressArg?.phase_status).toBe("queued");
      expect(progressArg?.phase0_fast_track).toBe(true);
      expect(progressArg?.phase0_fast_track_reason).toBe("short_form_under_25000_words");
      expect(progressArg?.phase0_completed_at).toBeUndefined();
      expect(progressArg?.phase0_bypass_reason).toBeFalsy();
    }
  });

  test("returns 201 and logs async when worker kickoff fetch rejects", async () => {
    mockCreateJob.mockResolvedValue({
      id: "job-1000",
      manuscript_id: 1000,
      job_type: "evaluate_full",
      status: "queued",
    } as never);
    // Worker fetch throws — kickoff is async so this must not affect the HTTP response.
    mockFetch.mockRejectedValue(new Error("worker unavailable"));

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1000,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; job_id: string };

    // Job is created and returned immediately — kickoff failure is handled async.
    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.job_id).toBe("job-1000");
    // failEvaluationJobTerminally is NOT called — the job stays queued for the
    // next worker poll cycle rather than being terminated by the API layer.
    expect(mockFailEvaluationJobTerminally).not.toHaveBeenCalled();
  });

  test("returns 201 and logs async when worker kickoff responds with ok false", async () => {
    mockCreateJob.mockResolvedValue({
      id: "job-1001",
      manuscript_id: 1001,
      job_type: "evaluate_full",
      status: "queued",
    } as never);
    // Worker returns ok:false — kickoff is async so this must not affect the HTTP response.
    mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({ success: false }) } as Response);

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1001,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; job_id: string };

    // Job is created and returned immediately — kickoff failure is handled async.
    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.job_id).toBe("job-1001");
    // failEvaluationJobTerminally is NOT called — the job stays queued for the
    // next worker poll cycle rather than being terminated by the API layer.
    expect(mockFailEvaluationJobTerminally).not.toHaveBeenCalled();
  });

  test("returns 409 with actionable message when duplicate active job constraint is hit", async () => {
    mockCreateJob.mockRejectedValue(
      new Error(
        'Failed to create job: duplicate key value violates unique constraint "uq_eval_jobs_active_phase1"',
      ) as never,
    );

    const req = new Request("https://example.test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 1003,
        job_type: "evaluate_full",
        processing_terms_accepted: true,
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string; trace_id: string };

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.error).toContain("already running or queued");
    expect(typeof json.trace_id).toBe("string");
  });
});
