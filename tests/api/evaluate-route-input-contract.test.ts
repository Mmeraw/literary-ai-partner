import { POST } from "@/app/api/evaluate/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/auth/devHeaderActor", () => ({
  getDevHeaderActor: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetDevHeaderActor = getDevHeaderActor as jest.MockedFunction<typeof getDevHeaderActor>;
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

describe("POST /api/evaluate input contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDevHeaderActor.mockReturnValue({ userId: "user-1", isAdmin: false });
    delete process.env.CRON_SECRET;
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("returns 400 when both manuscript_id and manuscript_text are provided", async () => {
    const supabase = {
      from: jest.fn(),
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
    expect(supabase.from).not.toHaveBeenCalled();
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

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
        // evaluation_jobs: handle both INSERT and SELECT-back
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

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
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

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
        // evaluation_jobs: INSERT + SELECT-back (alternates per request)
        const currentJobId = jobIds[jobSelectBackCallCount] ?? "job-first";
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

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { insert: manuscriptInsertMock };
        }
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
});
