import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/admin/analytics/rejected-revise-candidates/route";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/admin/requireAdmin", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

describe("GET /api/admin/analytics/rejected-revise-candidates", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns denied response when requester is not admin", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "admin_forbidden" } }, { status: 403 }),
    );

    const req = {
      nextUrl: new URL("https://example.test/api/admin/analytics/rejected-revise-candidates"),
      headers: new Headers(),
    } as unknown as NextRequest;

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns aggregate-only telemetry payload without prose fields", async () => {
    mockRequireAdmin.mockResolvedValue(null);

    const rows = [
      {
        created_at: "2026-06-08T00:00:00.000Z",
        metadata: {
          rejection_reasons: ["canon_authority_blocked"],
          criterion: "DIALOGUE",
          revision_operation: "replace_selected_passage",
          model: "gpt-4o-mini",
          prompt_version: "candidate_hydration_v1",
          candidate_anchor_overlap_scores: { a: 0.1, b: 0.4, c: 0.8 },
          candidate_word_counts: { a: 0, b: 17, c: 63 },
          hydration_result: "blocked_preflight",
          candidate_generation_status: "backend_filled_abc_v1",
        },
      },
      {
        created_at: "2026-06-08T00:01:00.000Z",
        metadata: {
          rejection_reasons: ["hydration_candidate_rejected_overlap"],
          criterion: "PACING",
          revision_operation: "compress_selected_passage",
          model: "gpt-4o-mini",
          prompt_version: "candidate_hydration_v1",
          candidate_anchor_overlap_scores: { a: 0.6, b: 0.6, c: 0.6 },
          candidate_word_counts: { a: 12, b: 77, c: 201 },
          hydration_result: "rejected_overlap",
          candidate_generation_status: "backend_filled_abc_v1_ai_hydrated_partial",
        },
      },
    ];

    const queryBuilder: any = {
      select: jest.fn(() => queryBuilder),
      eq: jest.fn(() => queryBuilder),
      gte: jest.fn(() => queryBuilder),
      order: jest.fn(() => queryBuilder),
      limit: jest.fn(async () => ({ data: rows, error: null })),
    };

    mockCreateAdminClient.mockReturnValue({
      from: jest.fn(() => queryBuilder),
    } as any);

    const req = {
      nextUrl: new URL("https://example.test/api/admin/analytics/rejected-revise-candidates?range=7d"),
      headers: new Headers(),
    } as unknown as NextRequest;

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.total_rejected_events).toBe(2);
    expect(json.data.reason_code_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "canon_authority_blocked", count: 1 }),
        expect.objectContaining({ key: "hydration_candidate_rejected_overlap", count: 1 }),
      ]),
    );

    const serialized = JSON.stringify(json.data);
    const forbiddenKeys = [
      "evidence_anchor",
      "anchor_text",
      "candidate_text_a",
      "candidate_text_b",
      "candidate_text_c",
      "rationale",
      "manuscript_context",
      "source_excerpt",
      "dialogue",
      "character_name",
      "location_name",
    ];

    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(`\"${key}\"`);
    }
  });
});
