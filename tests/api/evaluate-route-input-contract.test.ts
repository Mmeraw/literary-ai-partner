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
    const insertMock = jest
      .fn()
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({ data: { id: 987 }, error: null }),
        }),
      }))
      .mockImplementationOnce(() => ({
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
      from: jest.fn(() => ({
        insert: insertMock,
      })),
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

  test("returns 200 even when the best-effort worker trigger rejects", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const fetchMock = jest.fn().mockRejectedValue(new Error("wake-up failed"));
    global.fetch = fetchMock as typeof fetch;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const insertMock = jest
      .fn()
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({ data: { id: 654 }, error: null }),
        }),
      }))
      .mockImplementationOnce(() => ({
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
      from: jest.fn(() => ({
        insert: insertMock,
      })),
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
        method: "POST",
        headers: {
          Authorization: "Bearer cron-secret",
        },
      }
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[evaluate] Best-effort worker trigger failed (cron will retry):",
      "wake-up failed"
    );

    warnSpy.mockRestore();
  });
});
