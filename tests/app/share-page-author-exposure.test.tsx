import SharePage from "@/app/share/[token]/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthorExposureDecision } from "@/lib/evaluation/authorExposureCertification";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/evaluation/authorExposureCertification", () => ({
  getAuthorExposureDecision: jest.fn(async () => ({ exposable: true, certifiedAt: null })),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthorExposureDecision = getAuthorExposureDecision as jest.MockedFunction<typeof getAuthorExposureDecision>;

function shareRpcRow() {
  return {
    content: {
      summary: "Shared report summary",
      generated_at: "2026-07-22T00:00:00.000Z",
    },
    artifact_type: "one_page_summary",
    artifact_version: "v1",
    source_phase: "phase5",
    source_hash: "hash-1",
    job_id: "job-1",
    updated_at: "2026-07-22T00:00:00.000Z",
  };
}

describe("public share page author exposure recheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAdminClient.mockReturnValue({ from: jest.fn() } as never);
    mockCreateClient.mockResolvedValue({
      rpc: jest.fn(async () => ({ data: [shareRpcRow()], error: null })),
    } as never);
    mockGetAuthorExposureDecision.mockResolvedValue({ exposable: true, certifiedAt: null });
  });

  test("blocks a previously minted share token when current author exposure is no longer eligible", async () => {
    mockGetAuthorExposureDecision.mockResolvedValue({
      exposable: false,
      reason: "gate_15_audit_failed",
      details: "internal Gate 15 detail",
    });

    await expect(SharePage({ params: { token: "existing-token" } })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAuthorExposureDecision).toHaveBeenCalledWith(expect.anything(), "job-1");
  });

  test("renders a valid share only after current author exposure passes", async () => {
    await expect(SharePage({ params: { token: "existing-token" } })).resolves.toBeTruthy();
    expect(mockGetAuthorExposureDecision).toHaveBeenCalledWith(expect.anything(), "job-1");
  });
});