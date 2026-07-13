import { POST } from "@/app/api/final-review/apply/route";
import { getFinalReviewPayload } from "@/lib/revision/finalReview";
import { applyFinalReviewDecisions } from "@/lib/revision/finalReviewRuntime";

jest.mock("@/lib/revision/finalReview", () => ({
  getFinalReviewPayload: jest.fn(),
}));

jest.mock("@/lib/revision/finalReviewRuntime", () => ({
  applyFinalReviewDecisions: jest.fn(),
}));

const mockedPayload = getFinalReviewPayload as jest.MockedFunction<typeof getFinalReviewPayload>;
const mockedApply = applyFinalReviewDecisions as jest.MockedFunction<typeof applyFinalReviewDecisions>;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    error: null,
    manuscriptId: "7519",
    evaluationJobId: "b099a623",
    manuscriptTitle: "Let the River Decide",
    sourceVersionId: "version-1",
    sourceText: "The river moved below them.\n\nCliff tightened both hands on the wheel.",
    sourceAvailable: true,
    sourceUnavailableReason: null,
    previewParagraphs: ["The river moved below them.", "Cliff tightened both hands on the wheel."],
    decisions: [{
      id: "decision-1",
      opportunityId: "OPP-001",
      title: "Tighten the physical beat",
      decision: "accepted_a",
      selectedOption: "A",
      customText: null,
      selectedText: "Cliff locked both hands around the wheel.",
      sourceExcerpt: "Cliff tightened both hands on the wheel.",
      sourceLocation: "Chapter 5, paragraph 2",
      criterion: "Narrative Drive",
      severity: "must",
      createdAt: "2026-07-13T10:00:00.000Z",
      highlightTone: "system",
    }],
    acceptedCount: 1,
    customCount: 0,
    keptCount: 0,
    rejectedCount: 0,
    deferredCount: 0,
    unresolvedMustCount: 0,
    ...overrides,
  } as Awaited<ReturnType<typeof getFinalReviewPayload>>;
}

function jsonRequest() {
  return new Request("https://revisiongrade.test/api/final-review/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manuscriptId: "7519", evaluationJobId: "b099a623" }),
  });
}

function formRequest() {
  const body = new FormData();
  body.set("manuscriptId", "7519");
  body.set("evaluationJobId", "b099a623");
  return new Request("https://revisiongrade.test/api/final-review/apply", { method: "POST", body });
}

describe("Final Review apply production readiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the runtime only after every applicable decision has a unique exact source match", async () => {
    mockedPayload.mockResolvedValue(payload());
    mockedApply.mockResolvedValue({ ok: true, revisedVersionId: "version-2", appliedCount: 1, reusedExistingVersion: false });

    const response = await POST(jsonRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, revisedVersionId: "version-2", appliedCount: 1, reusedExistingVersion: false });
    expect(mockedApply).toHaveBeenCalledWith({ manuscriptId: "7519", evaluationJobId: "b099a623" });
  });

  it("blocks ambiguous duplicate source excerpts before the runtime can create a version", async () => {
    mockedPayload.mockResolvedValue(payload({
      sourceText: "The river moved below them.\n\nThe river moved below them.",
      previewParagraphs: ["The river moved below them.", "The river moved below them."],
      decisions: [{ ...payload().decisions[0], sourceExcerpt: "The river moved below them." }],
    }));

    const response = await POST(jsonRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/unique exact source match/i);
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it("blocks Apply when the source manuscript is unavailable", async () => {
    mockedPayload.mockResolvedValue(payload({ sourceAvailable: false, sourceText: "" }));

    const response = await POST(jsonRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/source text is not connected/i);
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it("redirects HTML submissions with manuscript identity, version id, and applied count", async () => {
    mockedPayload.mockResolvedValue(payload());
    mockedApply.mockResolvedValue({ ok: true, revisedVersionId: "version-2", appliedCount: 1, reusedExistingVersion: false });

    const response = await POST(formRequest());
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(303);
    expect(location).toContain("manuscriptId=7519");
    expect(location).toContain("evaluationJobId=b099a623");
    expect(location).toContain("applied=version-2");
    expect(location).toContain("appliedCount=1");
    expect(location).not.toContain("reusedApply=1");
  });

  it("marks an idempotent HTML retry as reused without changing the version id", async () => {
    mockedPayload.mockResolvedValue(payload());
    mockedApply.mockResolvedValue({ ok: true, revisedVersionId: "version-2", appliedCount: 1, reusedExistingVersion: true });

    const response = await POST(formRequest());
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(303);
    expect(location).toContain("applied=version-2");
    expect(location).toContain("reusedApply=1");
  });
});
