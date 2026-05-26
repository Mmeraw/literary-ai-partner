import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const BASE_HANDOFF = {
  manuscriptText: "Chapter one text for WAVE.",
  synthesis: {
    overall: {
      weighted_composite_score: 7.8,
      confidence: 0.8,
      risk_flags: [],
      adaptation_notes: [],
      top_strengths: [],
      top_risks: [],
      summary: "ok",
      verdict: "pass",
    },
    criteria: [],
  },
  characterLedgerV2: undefined,
  wordCount: 30000,
  jobId: "c67f69c5-7f08-4ece-b4e3-066f786ee591",
  manuscriptVersionId: null,
};

describe("resolveWaveSourceVersionId", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("uses handoff manuscriptVersionId when it already exists", async () => {
    const existingVersionId = "11111111-1111-4111-8111-111111111111";

    const getVersionById = jest.fn().mockResolvedValue({
      id: existingVersionId,
      manuscript_id: 42,
      version_number: 1,
      source_version_id: null,
      raw_text: "stored",
      word_count: 10,
      created_by: null,
      created_at: new Date().toISOString(),
    });

    const createAdminClient = jest.fn();
    const createInitialVersion = jest.fn();
    const createDerivedVersion = jest.fn();

    jest.doMock("@/lib/manuscripts/versions", () => ({
      getVersionById,
      createInitialVersion,
      createDerivedVersion,
    }));
    jest.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    jest.doMock("@/lib/db/manuscriptVersions", () => ({
      getLatestVersionForManuscript: jest.fn(),
    }));

    const { resolveWaveSourceVersionId } = await import("@/lib/evaluation/waveRevision");

    const resolved = await resolveWaveSourceVersionId({
      ...BASE_HANDOFF,
      manuscriptVersionId: existingVersionId,
    });

    expect(resolved).toBe(existingVersionId);
    expect(getVersionById).toHaveBeenCalledWith(existingVersionId);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createInitialVersion).not.toHaveBeenCalled();
    expect(createDerivedVersion).not.toHaveBeenCalled();
  });

  it("creates and binds a derived snapshot when job is missing manuscript_version_id", async () => {
    const sourceVersionId = "22222222-2222-4222-8222-222222222222";
    const derivedVersionId = "33333333-3333-4333-8333-333333333333";

    const getVersionById = jest.fn().mockResolvedValue({
      id: derivedVersionId,
      manuscript_id: 7,
      version_number: 2,
      source_version_id: sourceVersionId,
      raw_text: BASE_HANDOFF.manuscriptText,
      word_count: BASE_HANDOFF.wordCount,
      created_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
    });
    const createInitialVersion = jest.fn();
    const createDerivedVersion = jest.fn().mockResolvedValue({
      id: derivedVersionId,
      manuscript_id: 7,
      version_number: 2,
      source_version_id: sourceVersionId,
      raw_text: BASE_HANDOFF.manuscriptText,
      word_count: BASE_HANDOFF.wordCount,
      created_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
    });

    const getLatestVersionForManuscript = jest.fn().mockResolvedValue({
      id: sourceVersionId,
      manuscript_id: 7,
      version_number: 1,
      source_version_id: null,
      raw_text: "older text",
      word_count: 3,
      created_by: null,
      created_at: new Date().toISOString(),
    });

    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));
    const single = jest.fn().mockResolvedValue({
      data: {
        id: BASE_HANDOFF.jobId,
        manuscript_id: 7,
        user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        manuscript_version_id: null,
      },
      error: null,
    });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));

    const from = jest.fn((table: string) => {
      if (table !== "evaluation_jobs") {
        throw new Error(`Unexpected table ${table}`);
      }
      return { select, update };
    });
    const createAdminClient = jest.fn(() => ({ from }));

    jest.doMock("@/lib/manuscripts/versions", () => ({
      getVersionById,
      createInitialVersion,
      createDerivedVersion,
    }));
    jest.doMock("@/lib/db/manuscriptVersions", () => ({
      getLatestVersionForManuscript,
    }));
    jest.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));

    const { resolveWaveSourceVersionId } = await import("@/lib/evaluation/waveRevision");

    const resolved = await resolveWaveSourceVersionId({
      ...BASE_HANDOFF,
      manuscriptVersionId: null,
    });

    expect(resolved).toBe(derivedVersionId);
    expect(createAdminClient).toHaveBeenCalled();
    expect(getLatestVersionForManuscript).toHaveBeenCalledWith(7);
    expect(createDerivedVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscript_id: 7,
        source_version_id: sourceVersionId,
        raw_text: BASE_HANDOFF.manuscriptText,
        word_count: BASE_HANDOFF.wordCount,
      }),
    );
    expect(update).toHaveBeenCalledWith({ manuscript_version_id: derivedVersionId });
    expect(updateEq).toHaveBeenCalledWith("id", BASE_HANDOFF.jobId);
  });

  it("throws explicit invariant error when resolved source version cannot be found", async () => {
    const ghostVersionId = "44444444-4444-4444-8444-444444444444";

    const getVersionById = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const createInitialVersion = jest.fn();
    const createDerivedVersion = jest.fn();

    const getLatestVersionForManuscript = jest.fn().mockResolvedValue({
      id: ghostVersionId,
      manuscript_id: 7,
      version_number: 1,
      source_version_id: null,
      raw_text: "",
      word_count: 0,
      created_by: null,
      created_at: new Date().toISOString(),
    });

    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));
    const single = jest.fn().mockResolvedValue({
      data: {
        id: BASE_HANDOFF.jobId,
        manuscript_id: 7,
        user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        manuscript_version_id: null,
      },
      error: null,
    });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select, update }));
    const createAdminClient = jest.fn(() => ({ from }));

    jest.doMock("@/lib/manuscripts/versions", () => ({
      getVersionById,
      createInitialVersion,
      createDerivedVersion,
    }));
    jest.doMock("@/lib/db/manuscriptVersions", () => ({
      getLatestVersionForManuscript,
    }));
    jest.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));

    const { resolveWaveSourceVersionId } = await import("@/lib/evaluation/waveRevision");

    await expect(
      resolveWaveSourceVersionId({
        ...BASE_HANDOFF,
        manuscriptText: "",
        manuscriptVersionId: null,
      }),
    ).rejects.toThrow("WAVE_SOURCE_VERSION_RESOLUTION_FAILED");
  });
});
