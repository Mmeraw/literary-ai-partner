import { GET } from "@/app/api/evaluations/[jobId]/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/auth/devHeaderActor", () => ({
  getDevHeaderActor: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(async () => null),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetDevHeaderActor = getDevHeaderActor as jest.MockedFunction<typeof getDevHeaderActor>;

describe("GET /api/evaluations/[jobId] release gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDevHeaderActor.mockReturnValue({ userId: "user-1", isAdmin: false });
  });

  test("returns 409 when job is complete but invalid", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                id: "job-1",
                user_id: "user-1",
                status: "complete",
                validity_status: "invalid",
                evaluation_result: { governance: { confidence: 0.9 } },
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET(new Request("https://localhost/api/evaluations/job-1"), {
      params: { jobId: "job-1" },
    });

    const json = (await response.json()) as { error: string; details: string };
    expect(response.status).toBe(409);
    expect(json.error).toBe("Evaluation not releasable");
    expect(json.details).toBe("invalid_evaluation");
  });

  test("returns 409 when job is low confidence and not accepted", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                id: "job-1",
                user_id: "user-1",
                status: "complete",
                validity_status: "valid",
                evaluation_result: { governance: { confidence: 0.2 } },
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET(new Request("https://localhost/api/evaluations/job-1"), {
      params: { jobId: "job-1" },
    });

    const json = (await response.json()) as { error: string; details: string };
    expect(response.status).toBe(409);
    expect(json.error).toBe("Evaluation not releasable");
    expect(json.details).toBe("low_confidence");
  });

  test("returns 200 and prefers artifact content when releasable", async () => {
    const artifactMaybeSingle = jest.fn(async () => ({
      data: { content: { summary: "artifact summary" } },
      error: null,
    }));

    const artifactEqArtifactType = jest.fn(() => ({
      maybeSingle: artifactMaybeSingle,
    }));

    const artifactEqJobId = jest.fn(() => ({
      eq: artifactEqArtifactType,
    }));

    const artifactSelect = jest.fn(() => ({
      eq: artifactEqJobId,
    }));

    const jobMaybeSingle = jest.fn(async () => ({
      data: {
        id: "job-1",
        user_id: "user-1",
        status: "complete",
        validity_status: "valid",
        evaluation_result: { governance: { confidence: 0.9 }, summary: "inline summary" },
      },
      error: null,
    }));

    const jobEq = jest.fn(() => ({
      maybeSingle: jobMaybeSingle,
    }));

    const jobSelect = jest.fn(() => ({
      eq: jobEq,
    }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "evaluation_jobs") {
          return { select: jobSelect };
        }

        if (table === "evaluation_artifacts") {
          return { select: artifactSelect };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET(new Request("https://localhost/api/evaluations/job-1"), {
      params: { jobId: "job-1" },
    });

    const json = (await response.json()) as {
      ok: boolean;
      source: "artifact" | "inline_job_result";
      evaluation_result: { summary: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("artifact");
    expect(json.evaluation_result.summary).toBe("artifact summary");
  });
});
