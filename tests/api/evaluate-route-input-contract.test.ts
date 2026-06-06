import { POST } from "@/app/api/evaluate/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import { createInitialVersion } from "@/lib/manuscripts/versions";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/auth/devHeaderActor", () => ({
  getDevHeaderActor: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/manuscripts/versions", () => ({
  createInitialVersion: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetDevHeaderActor = getDevHeaderActor as jest.MockedFunction<typeof getDevHeaderActor>;
const mockCreateInitialVersion = createInitialVersion as jest.MockedFunction<
  typeof createInitialVersion
>;
const originalFetch = global.fetch;

// ---------------------------------------------------------------------------
// Helper: build the evaluation_jobs SELECT-back stub.
// The route calls:
//   supabase.from('evaluation_jobs').select('id, status').eq('id', <id>).maybeSingle()
// after every successful INSERT, to verify the row actually persisted.
// ---------------------------------------------------------------------------
function makeJobsSelectBackStub(jobId: string) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: async () => ({ data: { id: jobId, status: "queued" }, error: null }),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Helper: stub the abuse-limit queries that run before input validation.
// enforceUserEvaluationAbuseLimits calls:
//   supabase.from('evaluation_jobs').select('id', {count,head}).eq('user_id',...).gte(...)
//   supabase.from('evaluation_jobs').select('id', {count,head}).eq('user_id',...).in(...)
// ---------------------------------------------------------------------------
function makeAbuseLimitStub() {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(async () => ({ count: 0, error: null })),
        in: jest.fn(async () => ({ count: 0, error: null })),
      })),
    })),
  };
}

describe("POST /api/evaluate input contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDevHeaderActor.mockReturnValue({ userId: "user-1", isAdmin: false });
    mockCreateInitialVersion.mockResolvedValue({ id: "version-1" } as never);
    delete process.env.CRON_SECRET;
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("returns 400 when both manuscript_id and manuscript_text are provided", async () => {
    const abuseLimitStub = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(async () => ({ count: 0, error: null })),
          in: jest.fn(async () => ({ count: 0, error: null })),
        })),
      })),
    };
    const supabase = {
      from: jest.fn(() => abuseLimitStub),
    };
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_id: 123,
        manuscript_text: "Fresh text that should not be mixed with ID",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBe(
      "Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.",
    );
  });

  test("rejects short non-fiction letter submissions with a clean preflight message", async () => {
    let evalJobsCalls = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "evaluation_jobs") {
          evalJobsCalls++;
          return makeAbuseLimitStub();
        }
        return {};
      }),
    };
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_title: "Coaching Letter",
        manuscript_text:
          "Dear Andrew, I am writing to provide coaching feedback on your recent draft. Best regards, Mentor.",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string; code: string };

    expect(response.status).toBe(422);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("NARRATIVE_EVALUATION_PREFLIGHT_REJECTED");
    expect(json.error).toMatch(/letter|essay|synopsis|non-fiction/i);
    expect(evalJobsCalls).toBe(2);
    expect(supabase.from).toHaveBeenCalledWith("evaluation_jobs");
  });

  test("accepts text-only input and creates manuscript + evaluation job", async () => {
    // manuscripts INSERT returns manuscript id=987
    const manuscriptInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 987 }, error: null }),
      }),
    }));

    // evaluation_jobs INSERT returns job id="job-abc"
    const jobInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({
          data: {
            id: "job-abc",
            status: "queued",
            phase: "phase_1",
            phase_1_status: null,
            policy_family: "standard",
            voice_preservation_level: "balanced",
            english_variant: "us",
          },
          error: null,
        }),
      }),
    }));

    let evalJobsCalls = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
        // First two evaluation_jobs calls are abuse-limit checks
        evalJobsCalls++;
        if (evalJobsCalls <= 2) return makeAbuseLimitStub();
        // Subsequent calls: INSERT and SELECT-back
        return {
          insert: jobInsertMock,
          ...makeJobsSelectBackStub("job-abc"),
        };
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: "Chapter text only",
        manuscript_title: "Let the River Decide",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as {
      ok: boolean;
      job: { id: string; manuscript_id: number };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.job.id).toBe("job-abc");
    expect(json.job.manuscript_id).toBe(987);
    expect(mockCreateInitialVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscript_id: 987,
        raw_text: "Chapter text only",
      }),
    );

    expect(jobInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscript_id: 987,
        manuscript_version_id: "version-1",
      }),
    );

    expect(supabase.from).toHaveBeenCalledWith("manuscripts");
    expect(supabase.from).toHaveBeenCalledWith("evaluation_jobs");
  });

  test("derives a meaningful manuscript title when none is provided", async () => {
    // manuscripts INSERT (called once for the text-only path)
    const manuscriptInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 246 }, error: null }),
      }),
    }));

    // evaluation_jobs INSERT
    const jobInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({
          data: {
            id: "job-derived-title",
            status: "queued",
            phase: "phase_1",
            phase_1_status: null,
            policy_family: "standard",
            voice_preservation_level: "balanced",
            english_variant: "us",
          },
          error: null,
        }),
      }),
    }));

    let evalJobsCalls2 = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
        evalJobsCalls2++;
        if (evalJobsCalls2 <= 2) return makeAbuseLimitStub();
        return {
          insert: jobInsertMock,
          ...makeJobsSelectBackStub("job-derived-title"),
        };
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: "First line of the story\nSecond line continues",
        manuscript_title: "Untitled Manuscript",
      }),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(manuscriptInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "First line of the story",
      }),
    );
  });

  test("creates a fresh manuscript row on repeated text submissions", async () => {
    // Four sequential INSERTs: manuscript #1, job #1, manuscript #2, job #2
    const manuscriptInsertMock = jest
      .fn()
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({ data: { id: 701 }, error: null }),
        }),
      }))
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({ data: { id: 702 }, error: null }),
        }),
      }));

    const jobInsertMock = jest
      .fn()
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "job-first",
              status: "queued",
              phase: "phase_1",
              phase_1_status: null,
              policy_family: "standard",
              voice_preservation_level: "balanced",
              english_variant: "us",
            },
            error: null,
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "job-second",
              status: "queued",
              phase: "phase_1",
              phase_1_status: null,
              policy_family: "standard",
              voice_preservation_level: "balanced",
              english_variant: "us",
            },
            error: null,
          }),
        }),
      }));

    // SELECT-back needs to handle two different job IDs across the two requests.
    // We use a simple mock that returns a valid stub for any ID.
    let jobSelectBackCallCount = 0;
    const jobIds = ["job-first", "job-second"];

    let evalJobsCalls3 = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
        evalJobsCalls3++;
        // First 2 calls per POST are abuse-limit checks (4 total for 2 requests)
        if (evalJobsCalls3 <= 2 || (evalJobsCalls3 >= 5 && evalJobsCalls3 <= 6)) return makeAbuseLimitStub();
        // Remaining: INSERT + SELECT-back
        return {
          insert: jobInsertMock,
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: async () => {
                const id = jobIds[jobSelectBackCallCount];
                jobSelectBackCallCount++;
                return { data: { id, status: "queued" }, error: null };
              },
            })),
          })),
        };
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const buildRequest = () => new Request("https://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: "Same text, new snapshot",
        manuscript_title: "Repeatable Draft",
      }),
    });

    const firstResponse = await POST(buildRequest());
    const secondResponse = await POST(buildRequest());

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    // 2 manuscript INSERTs + 2 job INSERTs = 4 total insert calls
    expect(manuscriptInsertMock).toHaveBeenCalledTimes(2);
    expect(jobInsertMock).toHaveBeenCalledTimes(2);
  });

  test("returns 200 even when the best-effort worker trigger rejects", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const fetchMock = jest.fn().mockRejectedValue(new Error("wake-up failed"));
    global.fetch = fetchMock as typeof fetch;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const manuscriptInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 654 }, error: null }),
      }),
    }));

    const jobInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({
          data: {
            id: "job-trigger",
            status: "queued",
            phase: "phase_1",
            phase_1_status: null,
            policy_family: "standard",
            voice_preservation_level: "balanced",
            english_variant: "us",
          },
          error: null,
        }),
      }),
    }));

    let evalJobsCalls4 = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
        evalJobsCalls4++;
        if (evalJobsCalls4 <= 2) return makeAbuseLimitStub();
        return {
          insert: jobInsertMock,
          ...makeJobsSelectBackStub("job-trigger"),
        };
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://preview.example.com/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: "Trigger me maybe",
        manuscript_title: "Wake the Worker",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as {
      ok: boolean;
      job: { id: string; manuscript_id: number };
    };

    await Promise.resolve();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.job.id).toBe("job-trigger");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://preview.example.com/api/workers/process-evaluations",
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: "Bearer cron-secret",
          "x-trigger-source": "api.evaluate.create",
          "x-job-id": "job-trigger",
          "x-trace-id": expect.any(String),
        },
      }
    );
    const warnLog = String(warnSpy.mock.calls[0]?.[0] ?? "");
    expect(warnLog).toContain("worker.kickoff.failed");
    expect(warnLog).toContain("wake-up failed");

    warnSpy.mockRestore();
  });

  test("fails closed when manuscript source snapshot creation fails", async () => {
    const manuscriptInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 333 }, error: null }),
      }),
    }));

    const jobInsertMock = jest.fn(() => ({
      select: () => ({
        single: async () => ({
          data: {
            id: "job-should-not-exist",
            status: "queued",
          },
          error: null,
        }),
      }),
    }));

    let evalJobsCalls = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "evaluation_jobs") {
          evalJobsCalls++;
          if (evalJobsCalls <= 2) return makeAbuseLimitStub();
        }

        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }

        return {
          insert: jobInsertMock,
          ...makeJobsSelectBackStub("job-should-not-exist"),
        };
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);
    mockCreateInitialVersion.mockRejectedValue(new Error("snapshot insert failed"));

    const req = new Request("https://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: "Snapshot must exist first",
        manuscript_title: "No Snapshot No Job",
      }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Failed to create manuscript source snapshot");
    expect(jobInsertMock).not.toHaveBeenCalled();
  });
});
