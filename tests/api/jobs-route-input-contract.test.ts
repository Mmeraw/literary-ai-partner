import { POST } from "@/app/api/jobs/route";
import { createJob } from "@/lib/jobs/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

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

jest.mock("@/lib/jobs/backpressure", () => ({
  backpressureGuard: jest.fn(async () => null),
}));

const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;

describe("POST /api/jobs input contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" } as never);
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

  test("accepts text-only input and creates fresh manuscript-backed job", async () => {
    const supabase = {
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: () => ({
            single: async () => ({ data: { id: 321 }, error: null }),
          }),
        })),
      })),
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
        manuscript_title: "Let the River Decide",
        job_type: "evaluate_full",
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
        user_id: "user-1",
        job_type: "evaluate_full",
      }),
    );
  });
});
