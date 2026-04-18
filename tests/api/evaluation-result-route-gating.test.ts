import { NextRequest } from "next/server";
import { GET } from "@/app/api/jobs/[jobId]/evaluation-result/route";
import { createAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/schemas/evaluation-result-v1", () => ({
  isEvaluationResultV1: jest.fn(() => true),
  validateEvaluationResult: jest.fn(() => ({ valid: true, errors: [] })),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

function makeRequest(): NextRequest {
  return new NextRequest("https://localhost:3000/api/jobs/11111111-1111-1111-1111-111111111111/evaluation-result", {
    method: "GET",
  });
}

describe("GET /api/jobs/[jobId]/evaluation-result release gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 404 when job is complete but validity_status is invalid", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: {
                id: "11111111-1111-1111-1111-111111111111",
                manuscript_id: 42,
                status: "complete",
                validity_status: "invalid",
                evaluation_result: { arbitrary: true },
                evaluation_result_version: "v1",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ jobId: "11111111-1111-1111-1111-111111111111" }),
    });

    const json = (await response.json()) as { error: string };
    expect(response.status).toBe(404);
    expect(json.error).toBe("Evaluation not releasable");
  });

  test("returns 404 when job is complete + valid but confidence is below release threshold", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: {
                id: "11111111-1111-1111-1111-111111111111",
                manuscript_id: 42,
                status: "complete",
                validity_status: "valid",
                evaluation_result: {
                  governance: {
                    confidence: 0.4,
                  },
                },
                evaluation_result_version: "v1",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ jobId: "11111111-1111-1111-1111-111111111111" }),
    });

    expect(response.status).toBe(404);
  });

  test("returns 200 when job is complete + valid and payload is schema-valid", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: {
                id: "11111111-1111-1111-1111-111111111111",
                manuscript_id: 42,
                status: "complete",
                validity_status: "valid",
                evaluation_result: {
                  schema_version: "evaluation_result_v1",
                  ids: {
                    evaluation_run_id: "run-1",
                    job_id: "11111111-1111-1111-1111-111111111111",
                    manuscript_id: 42,
                    user_id: "user-1",
                  },
                  generated_at: new Date().toISOString(),
                  engine: { model: "gpt-5", provider: "openai", prompt_version: "p1" },
                  overview: {
                    verdict: "pass",
                    overall_score_0_100: 82,
                    one_paragraph_summary: "Good manuscript quality.",
                    top_3_strengths: ["voice", "pacing", "structure"],
                    top_3_risks: ["stakes", "clarity", "ending"],
                  },
                  criteria: [],
                  recommendations: { quick_wins: [], strategic_revisions: [] },
                  metrics: { manuscript: {}, processing: {} },
                  artifacts: [],
                  governance: {
                    confidence: 0.84,
                    warnings: [],
                    limitations: [],
                    policy_family: "standard",
                  },
                },
                evaluation_result_version: "v1",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ jobId: "11111111-1111-1111-1111-111111111111" }),
    });
    const json = (await response.json()) as { status: string; validity_status: string };

    expect(response.status).toBe(200);
    expect(json.status).toBe("complete");
    expect(json.validity_status).toBe("valid");
  });
});
