import { NextRequest } from "next/server";
import { GET } from "@/app/api/reports/[jobId]/download/route";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseAdmin from "@/lib/supabase/admin";
import * as exposure from "@/lib/evaluation/authorExposureCertification";

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/evaluation/authorExposureCertification", () => ({
  getAuthorExposureDecision: jest.fn().mockResolvedValue({ exposable: true }),
}));

const mockGetAuthenticatedUser = supabaseServer.getAuthenticatedUser as jest.MockedFunction<
  typeof supabaseServer.getAuthenticatedUser
>;
const mockCreateAdminClient = supabaseAdmin.createAdminClient as jest.MockedFunction<
  typeof supabaseAdmin.createAdminClient
>;
const mockGetAuthorExposureDecision = exposure.getAuthorExposureDecision as jest.MockedFunction<
  typeof exposure.getAuthorExposureDecision
>;
const JOB_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(userId?: string) {
  const headers = new Headers();
  if (userId) headers.set("x-user-id", userId);
  return new NextRequest(`https://localhost:3000/api/reports/${JOB_ID}/download?format=txt`, { headers });
}

function mockAdminJob(ownerId: string, overrides: Record<string, unknown> = {}) {
  mockCreateAdminClient.mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "evaluation_artifacts") {
        const artifactChain = {
          select: jest.fn(() => artifactChain),
          eq: jest.fn(() => artifactChain),
          in: jest.fn(() => artifactChain),
          order: jest.fn(() => artifactChain),
          limit: jest.fn(() => artifactChain),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
        return artifactChain;
      }
      if (table !== "evaluation_jobs") throw new Error(`Unexpected table ${table}`);
      const chain = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            evaluation_result: { overview: {} },
            status: "complete",
            validity_status: "valid",
            user_id: ownerId,
            progress: {},
            manuscripts: { title: "Smoke" },
            ...overrides,
          },
          error: null,
        }),
      };
      return chain;
    }),
  } as never);
}

describe("GET /api/reports/[jobId]/download dev header auth", () => {
  const prevTestMode = process.env.TEST_MODE;
  const prevAllowHeaderUserId = process.env.ALLOW_HEADER_USER_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(null);
    mockGetAuthorExposureDecision.mockResolvedValue({ exposable: true, certifiedAt: '2026-07-12T00:00:00Z' });
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_HEADER_USER_ID;
  });

  afterAll(() => {
    process.env.TEST_MODE = prevTestMode;
    process.env.ALLOW_HEADER_USER_ID = prevAllowHeaderUserId;
  });

  test("rejects x-user-id when TEST_MODE is absent", async () => {
    process.env.ALLOW_HEADER_USER_ID = "true";

    const response = await GET(buildRequest("user-1"), { params: { jobId: JOB_ID } });

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  test("rejects x-user-id when ALLOW_HEADER_USER_ID is absent", async () => {
    process.env.TEST_MODE = "true";

    const response = await GET(buildRequest("user-1"), { params: { jobId: JOB_ID } });

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  test("returns 404 for mismatched owner even with guarded x-user-id", async () => {
    process.env.TEST_MODE = "true";
    process.env.ALLOW_HEADER_USER_ID = "true";
    mockAdminJob("different-user");

    const response = await GET(buildRequest("user-1"), { params: { jobId: JOB_ID } });

    expect(response.status).toBe(404);
  });

  test("does not bypass release gate with guarded x-user-id", async () => {
    process.env.TEST_MODE = "true";
    process.env.ALLOW_HEADER_USER_ID = "true";
    mockAdminJob("user-1", { validity_status: "invalid" });

    const response = await GET(buildRequest("user-1"), { params: { jobId: JOB_ID } });

    expect(response.status).toBe(404);
  });

  test("does not bypass exposure certification gate with guarded x-user-id", async () => {
    process.env.TEST_MODE = "true";
    process.env.ALLOW_HEADER_USER_ID = "true";
    mockAdminJob("user-1");
    mockGetAuthorExposureDecision.mockResolvedValue({ exposable: false, reason: "not_certified" } as never);

    const response = await GET(buildRequest("user-1"), { params: { jobId: JOB_ID } });

    expect(response.status).toBe(404);
  });
});
