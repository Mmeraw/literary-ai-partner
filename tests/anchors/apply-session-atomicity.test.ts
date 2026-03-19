import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { ChangeProposal } from "@/lib/revision/types";

const mockCreateDerivedVersion = jest.fn();
const mockGetVersionById = jest.fn();
const mockHydrateSourceVersionIfMissing = jest.fn();
const mockTransitionRevisionSessionState = jest.fn();
const mockGetRevisionSessionById = jest.fn();
const mockListProposalsForSession = jest.fn();
const mockLogRevisionEvent = jest.fn();

jest.mock("@/lib/manuscripts/versions", () => ({
  createDerivedVersion: (...args: unknown[]) => mockCreateDerivedVersion(...args),
  getVersionById: (...args: unknown[]) => mockGetVersionById(...args),
}));

jest.mock("@/lib/manuscripts/hydrateVersions", () => ({
  hydrateSourceVersionIfMissing: (...args: unknown[]) =>
    mockHydrateSourceVersionIfMissing(...args),
}));

jest.mock("@/lib/revision/sessionTransitions", () => ({
  transitionRevisionSessionState: (...args: unknown[]) =>
    mockTransitionRevisionSessionState(...args),
}));

jest.mock("@/lib/revision/sessions", () => ({
  getRevisionSessionById: (...args: unknown[]) =>
    mockGetRevisionSessionById(...args),
  listProposalsForSession: (...args: unknown[]) =>
    mockListProposalsForSession(...args),
}));

jest.mock("@/lib/revision/logRevisionEvent", () => ({
  logRevisionEvent: (...args: unknown[]) => mockLogRevisionEvent(...args),
}));

const { applyRevisionSession } = require("@/lib/revision/apply") as {
  applyRevisionSession: (revisionSessionId: string) => Promise<unknown>;
};

function buildProposal(
  source: string,
  original: string,
  replacement: string,
  overrides: Partial<ChangeProposal> = {},
): ChangeProposal {
  const start = source.indexOf(original);
  if (start === -1) {
    throw new Error(`Original text not found in source: ${original}`);
  }
  const end = start + original.length;

  return {
    id: overrides.id ?? `${start}-${end}-${original}`,
    revision_session_id: overrides.revision_session_id ?? "session-apply",
    location_ref: overrides.location_ref ?? "loc:1",
    rule: overrides.rule ?? "clarity",
    action: overrides.action ?? "refine",
    original_text: overrides.original_text ?? original,
    proposed_text: overrides.proposed_text ?? replacement,
    justification: overrides.justification ?? "test",
    severity: overrides.severity ?? "medium",
    decision: overrides.decision ?? "accepted",
    modified_text: overrides.modified_text ?? null,
    start_offset: overrides.start_offset ?? start,
    end_offset: overrides.end_offset ?? end,
    before_context:
      overrides.before_context ?? source.slice(Math.max(0, start - 40), start),
    after_context:
      overrides.after_context ?? source.slice(end, Math.min(source.length, end + 40)),
    anchor_text_normalized:
      overrides.anchor_text_normalized ?? original.replace(/\r\n/g, "\n"),
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

describe("applyRevisionSession atomicity", () => {
  const sourceText = `Alpha beta ${"x".repeat(60)} delta.`;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetRevisionSessionById.mockResolvedValue({
      id: "session-1",
      evaluation_run_id: "eval-1",
      source_version_id: "ver-source-1",
      result_version_id: null,
      status: "proposals_ready",
      summary: {},
      findings_count: 0,
      actionable_findings_count: 0,
      proposal_ready_actionable_findings_count: 0,
      proposals_created_count: 0,
      created_at: new Date().toISOString(),
      completed_at: null,
      last_transition_at: null,
      failure_code: null,
      failure_message: null,
    });

    mockGetVersionById.mockResolvedValue({
      id: "ver-source-1",
      manuscript_id: 101,
      raw_text: sourceText,
    } as any);

    mockHydrateSourceVersionIfMissing.mockResolvedValue({
      raw_text: sourceText,
    } as any);

    mockCreateDerivedVersion.mockResolvedValue({
      id: "ver-result-1",
    } as any);

    mockTransitionRevisionSessionState.mockResolvedValue(undefined as never);
    mockLogRevisionEvent.mockResolvedValue(undefined);
  });

  test("fails atomically on overlap preflight: no derived version or state transition", async () => {
    const p1 = buildProposal(sourceText, "beta", "BETA", {
      id: "p1",
      start_offset: 6,
      end_offset: 10,
      original_text: "beta",
      before_context: sourceText.slice(Math.max(0, 6 - 40), 6),
      after_context: sourceText.slice(10, Math.min(sourceText.length, 10 + 40)),
    });

    const p2 = buildProposal(sourceText, "eta ", "ETA_", {
      id: "p2",
      start_offset: 7,
      end_offset: 11,
      original_text: "eta ",
      before_context: sourceText.slice(Math.max(0, 7 - 40), 7),
      after_context: sourceText.slice(11, Math.min(sourceText.length, 11 + 40)),
    });

    mockListProposalsForSession.mockResolvedValue([p1, p2] as any);

    await expect(applyRevisionSession("session-1")).rejects.toThrow(
      /Overlapping proposals detected/,
    );

    expect(mockCreateDerivedVersion).not.toHaveBeenCalled();
    expect(mockTransitionRevisionSessionState).not.toHaveBeenCalled();
  });

  test("successful apply writes derived version then transitions session", async () => {
    const p1 = buildProposal(sourceText, "beta", "BETA", { id: "p1" });
    const p2 = buildProposal(sourceText, "delta", "DELTA", { id: "p2" });

    mockListProposalsForSession.mockResolvedValue([p1, p2] as any);

    const result = await applyRevisionSession("session-1");

    expect(mockCreateDerivedVersion).toHaveBeenCalledTimes(1);
    expect(mockTransitionRevisionSessionState).toHaveBeenCalledTimes(1);

    const createArgs = mockCreateDerivedVersion.mock.calls[0]?.[0];
    expect(createArgs?.raw_text).toBe(`Alpha BETA ${"x".repeat(60)} DELTA.`);

    const transitionArgs = mockTransitionRevisionSessionState.mock.calls[0]?.[1];
    expect(transitionArgs?.nextStatus).toBe("applied");
    expect(transitionArgs?.result_version_id).toBe("ver-result-1");

    expect(result).toEqual({
      revision_session_id: "session-1",
      source_version_id: "ver-source-1",
      result_version_id: "ver-result-1",
      accepted_count: 2,
      modified_count: 0,
    });
  });
});