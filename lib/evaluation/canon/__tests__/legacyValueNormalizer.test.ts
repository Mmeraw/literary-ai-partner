// Uses Jest globals (injected by jest.config.js) — no vitest import needed.
import {
  normalizeSubmissionReadiness,
  normalizeOverallSubmissionReadiness,
  isCanonicalSubmissionReadiness,
  type CanonicalSubmissionReadiness,
} from "@/lib/evaluation/canon/legacyValueNormalizer";

describe("normalizeSubmissionReadiness", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps legacy 'close' to 'nearly_ready'", () => {
    expect(normalizeSubmissionReadiness("close")).toBe("nearly_ready");
  });

  it("passes canonical 'nearly_ready' through unchanged", () => {
    expect(normalizeSubmissionReadiness("nearly_ready")).toBe("nearly_ready");
  });

  it("passes canonical 'queryable_now' through unchanged", () => {
    expect(normalizeSubmissionReadiness("queryable_now")).toBe("queryable_now");
  });

  it("passes canonical 'not_yet' through unchanged", () => {
    expect(normalizeSubmissionReadiness("not_yet")).toBe("not_yet");
  });

  it("normalizes null to 'not_yet'", () => {
    expect(normalizeSubmissionReadiness(null)).toBe("not_yet");
  });

  it("normalizes undefined to 'not_yet'", () => {
    expect(normalizeSubmissionReadiness(undefined)).toBe("not_yet");
  });

  it("normalizes unknown string to 'not_yet' with a warning", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeSubmissionReadiness("bogus_value")).toBe("not_yet");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("bogus_value"),
    );
  });

  it("is case-insensitive (uppercased legacy value)", () => {
    expect(normalizeSubmissionReadiness("CLOSE")).toBe("nearly_ready");
    expect(normalizeSubmissionReadiness("QUERYABLE_NOW")).toBe("queryable_now");
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeSubmissionReadiness("  close  ")).toBe("nearly_ready");
  });
});

describe("normalizeOverallSubmissionReadiness", () => {
  it("normalizes submission_readiness field on overall object", () => {
    const input = { submission_readiness: "close", overall_score_0_100: 72 };
    const result = normalizeOverallSubmissionReadiness(input);
    expect(result.submission_readiness).toBe("nearly_ready");
    expect(result.overall_score_0_100).toBe(72);
  });

  it("preserves all other fields unchanged", () => {
    const input = {
      submission_readiness: "close" as unknown,
      verdict: "revise",
      one_paragraph_summary: "test",
    };
    const result = normalizeOverallSubmissionReadiness(input);
    expect(result.verdict).toBe("revise");
    expect(result.one_paragraph_summary).toBe("test");
  });

  it("returns canonical value when already canonical", () => {
    const input = { submission_readiness: "queryable_now" };
    expect(normalizeOverallSubmissionReadiness(input).submission_readiness).toBe("queryable_now");
  });
});

describe("isCanonicalSubmissionReadiness", () => {
  it.each([
    ["queryable_now", true],
    ["nearly_ready", true],
    ["not_yet", true],
    ["close", false],
    ["", false],
    [null, false],
    [undefined, false],
    [42, false],
  ] as const)("isCanonicalSubmissionReadiness(%s) === %s", (value, expected) => {
    expect(isCanonicalSubmissionReadiness(value)).toBe(expected);
  });
});
