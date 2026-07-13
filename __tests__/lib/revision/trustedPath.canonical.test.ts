import { applyTrustedPath, previewTrustedPath } from "@/lib/revision/trustedPath";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import { syncRevisionLedgerDecisions } from "@/lib/revision/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isRepairCrossCheckEnabled } from "@/lib/revision/repairCrossCheck";

jest.mock("@/lib/supabase/server", () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/revision/workbenchQueue", () => ({ getWorkbenchQueue: jest.fn() }));
jest.mock("@/lib/revision/ledger", () => ({ syncRevisionLedgerDecisions: jest.fn() }));
jest.mock("@/lib/revision/repairCrossCheck", () => ({
  ...jest.requireActual("@/lib/revision/repairCrossCheck"),
  isRepairCrossCheckEnabled: jest.fn(),
}));

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetWorkbenchQueue = getWorkbenchQueue as jest.MockedFunction<typeof getWorkbenchQueue>;
const mockSyncRevisionLedgerDecisions = syncRevisionLedgerDecisions as jest.MockedFunction<typeof syncRevisionLedgerDecisions>;
const mockIsRepairCrossCheckEnabled = isRepairCrossCheckEnabled as jest.MockedFunction<typeof isRepairCrossCheckEnabled>;

type MockQueryInput = { single?: unknown; list?: unknown[] };

function makeQuery(input: MockQueryInput = {}) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    in: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: input.single ?? null, error: null })),
    single: jest.fn(async () => ({ data: input.single ?? null, error: null })),
    then: (onF: any) => onF({ data: input.list ?? [], error: null }),
  };
  return query;
}

function buildSupabaseMock(options: {
  existingDecisions?: { opportunity_id: string }[];
  crossChecks?: { finding_id: string; option_key: string; verdict: string }[];
} = {}) {
  const tables: Record<string, ReturnType<typeof makeQuery>> = {
    manuscripts: makeQuery({ single: { id: 1234, user_id: "user-1" } }),
    evaluation_jobs: makeQuery({
      single: {
        id: "job-1",
        status: "complete",
        manuscript_id: 1234,
        manuscript_version_id: "version-1",
        policy_family: "standard",
        voice_preservation_level: "balanced",
      },
    }),
    evaluation_artifacts: makeQuery({
      single: {
        content: {
          confirmed_mode: {
            evaluationMode: "STANDARD",
            voicePreservationMode: "BALANCED",
          },
          governance: {
            transparency: {
              genre_expectation_context: {
                diagnosed_genre: "literary",
                shelf_target_audience: "adult literary readers",
                dominant_craft_engine: "voice",
                expectation_profiles: ["voice_forward"],
                genre_expectation_ids: ["literary_fiction"],
                genre_expectation_labels: ["Literary fiction"],
                resolution_notes: ["genre_expectation:literary_fiction"],
              },
            },
          },
        },
      },
    }),
    revision_ledger_decisions: makeQuery({ list: options.existingDecisions ?? [] }),
    revision_repair_cross_checks: makeQuery({ list: options.crossChecks ?? [] }),
  };

  return {
    from: jest.fn((table: string) => {
      const query = tables[table];
      if (!query) throw new Error(`Unexpected table: ${table}`);
      return query;
    }),
  };
}

function makeOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: "finding-1",
    source: "evaluation",
    severity: "should",
    scope: "Passage",
    mode: "direct-rewrite",
    criterion: "Weak intensifiers",
    leverage: "Prose control",
    crumb: "Weak intensifiers · prose control",
    title: "Weak intensifiers",
    issueStatement: "Weak intensifiers dilute prose control.",
    meta: "chapter 1, paragraph 2",
    confidence: "high",
    anchor: "really very tired",
    quoteHighlight: "really very tired",
    quoteRest: "",
    symptom: "intensifiers stack up",
    cause: "unnecessary adverbs",
    fixDirection: "remove intensifiers",
    readerEffect: "prose tightens",
    mistakeProofing: "do not change surrounding sentences",
    diagnostic: {
      symptom: "intensifiers stack up",
      cause: "unnecessary adverbs",
      fixStrategy: "cut the adverbs",
      readerImpact: "prose tightens",
      evidence: { quotedExcerpt: "really very tired", locationLabel: "chapter 1, paragraph 2" },
      operationTargeting: "replace the selected passage",
      mistakeProofing: "do not change surrounding sentences",
    },
    revisionOperation: "replace_selected_passage",
    readiness: "ready_for_revise",
    readinessReason: null,
    cardType: "copy_paste_rewrite",
    trustedPathStatus: "eligible",
    executabilityReasons: [],
    options: [
      { key: "A", mechanism: "remove", candidateText: "She was exhausted by the time the patrol ended, and the strain showed in every gesture.", text: "She was exhausted by the time the patrol ended, and the strain showed in every gesture.", rationale: "clean" },
      { key: "B", mechanism: "remove", candidateText: "The shift left her drained, and the weariness showed in every gesture.", text: "The shift left her drained, and the weariness showed in every gesture.", rationale: "variant" },
      { key: "C", mechanism: "remove", candidateText: "Every line of her body announced the fatigue of the patrol.", text: "Every line of her body announced the fatigue of the patrol.", rationale: "bolder" },
    ],
    ...overrides,
  };
}

function makeQueuePayload(opportunities: any[] = []) {
  return {
    ok: true,
    error: null,
    manuscriptId: "1234",
    evaluationJobId: "job-1",
    manuscriptTitle: "Sister",
    modeContract: {
      evaluation_mode: "STANDARD",
      voice_preservation: "BALANCED",
      source: "evaluation_result_v2.confirmed_mode",
      policy_family: "standard",
      voice_preservation_level: "balanced",
    },
    opportunities,
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: opportunities.length, needs_targeting: 0, withheld_unsupported: 0 },
    totals: { must: 0, should: opportunities.length, could: 0 },
    scopes: { Line: 0, Passage: opportunities.length, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: { "Weak intensifiers": opportunities.length },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" } as never);
  mockIsRepairCrossCheckEnabled.mockReturnValue(false);
});

describe("applyTrustedPath", () => {
  it("rejects unauthenticated users", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null as never);
    const result = await applyTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("rejects invalid manuscript id", async () => {
    const result = await applyTrustedPath({ manuscriptId: "not-a-number", evaluationJobId: "job-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid manuscript id");
  });

  it("applies a single eligible copy-paste repair with the actual selected text", async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock() as any);
    const opportunity = makeOpportunity();
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([opportunity]) as any);
    mockSyncRevisionLedgerDecisions.mockResolvedValue([] as any);

    const result = await applyTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result.ok).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(result.appliedFindingIds).toEqual(["finding-1"]);
    expect(result.finalReviewUrl).toBe("/workbench/final-review?manuscriptId=1234&evaluationJobId=job-1");

    expect(mockSyncRevisionLedgerDecisions).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscriptId: 1234,
        evaluationJobId: "job-1",
        entries: expect.arrayContaining([
          expect.objectContaining({
            opportunityId: "finding-1",
            decision: "accepted_a",
            selectedText: "She was exhausted by the time the patrol ended, and the strain showed in every gesture.",
            metadata: expect.objectContaining({ source: "trusted_path", trustedPath: true }),
          }),
        ]),
      }),
    );
  });

  it("skips already-decided opportunities and excludes them from appliedCount", async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ existingDecisions: [{ opportunity_id: "finding-1" }] }) as any,
    );
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([makeOpportunity()]) as any);
    mockSyncRevisionLedgerDecisions.mockResolvedValue([] as any);

    const result = await applyTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result.ok).toBe(true);
    expect(result.appliedCount).toBe(0);
    expect(result.alreadyDecidedCount).toBe(1);
    expect(mockSyncRevisionLedgerDecisions).not.toHaveBeenCalled();
  });

  it("skips strategy cards and non-eligible copy-paste cards", async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock() as any);
    const strategy = makeOpportunity({ id: "strategy-1", cardType: "revision_strategy", trustedPathStatus: "ineligible" });
    const withheld = makeOpportunity({ id: "withheld-1", cardType: "withheld_unsupported", trustedPathStatus: "ineligible" });
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([strategy, withheld]) as any);
    mockSyncRevisionLedgerDecisions.mockResolvedValue([] as any);

    const result = await applyTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result.ok).toBe(true);
    expect(result.appliedCount).toBe(0);
    expect(result.skippedCount).toBe(2);
    expect(mockSyncRevisionLedgerDecisions).not.toHaveBeenCalled();
  });

  it("requires an approve cross-check verdict when cross-check is enabled", async () => {
    mockIsRepairCrossCheckEnabled.mockReturnValue(true);
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({
        crossChecks: [
          { finding_id: "finding-1", option_key: "A", verdict: "approve" },
          { finding_id: "finding-2", option_key: "A", verdict: "pending" },
        ],
      }) as any,
    );
    const approved = makeOpportunity({ id: "finding-1" });
    const pending = makeOpportunity({ id: "finding-2" });
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([approved, pending]) as any);
    mockSyncRevisionLedgerDecisions.mockResolvedValue([] as any);

    const result = await applyTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result.ok).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(result.appliedFindingIds).toEqual(["finding-1"]);
    expect(result.skippedCount).toBe(1);
  });

  it("returns a finalReviewUrl even when nothing is applied", async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock() as any);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([]) as any);
    mockSyncRevisionLedgerDecisions.mockResolvedValue([] as any);

    const result = await applyTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result.ok).toBe(true);
    expect(result.appliedCount).toBe(0);
    expect(result.finalReviewUrl).toBe("/workbench/final-review?manuscriptId=1234&evaluationJobId=job-1");
  });
});

describe("previewTrustedPath", () => {
  it("returns zero counts when no eligible opportunities exist", async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock() as any);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([]) as any);

    const result = await previewTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result).toEqual({ eligible: 0, alreadyDecided: 0, total: 0 });
  });

  it("counts eligible, already-decided, and total separately", async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ existingDecisions: [{ opportunity_id: "finding-2" }] }) as any,
    );
    const opp1 = makeOpportunity({ id: "finding-1" });
    const opp2 = makeOpportunity({ id: "finding-2" });
    const strategy = makeOpportunity({ id: "strategy-1", cardType: "revision_strategy", trustedPathStatus: "ineligible" });
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([opp1, opp2, strategy]) as any);

    const result = await previewTrustedPath({ manuscriptId: 1234, evaluationJobId: "job-1" });

    expect(result).toEqual({ eligible: 1, alreadyDecided: 1, total: 2 });
  });
});
