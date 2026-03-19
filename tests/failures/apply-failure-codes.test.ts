import {
  RevisionFailureCode,
  REVISION_FAILURE_DETAILS,
  getRevisionFailureDetails,
  isRevisionFailureCode,
} from "@/lib/errors/revisionCodes";

type SimulatedApplyFailure = {
  failure_code: RevisionFailureCode;
  failure_message: string;
  failure_context: Record<string, unknown>;
};

function simulateApplyFailure(code: RevisionFailureCode): SimulatedApplyFailure {
  const details = getRevisionFailureDetails(code);

  return {
    failure_code: code,
    failure_message: details.message,
    failure_context: {
      stage: "apply",
      code,
      simulated: true,
      at: new Date("2026-03-19T00:00:00.000Z").toISOString(),
    },
  };
}

describe("Phase 2.4.c — apply failure code classification", () => {
  const EXPECTED_CODES: RevisionFailureCode[] = [
    RevisionFailureCode.ANCHOR_MISS,
    RevisionFailureCode.ANCHOR_AMBIGUOUS,
    RevisionFailureCode.CONTEXT_MISMATCH,
    RevisionFailureCode.OFFSET_CONFLICT,
    RevisionFailureCode.PARSE_ERROR,
    RevisionFailureCode.INVARIANT_VIOLATION,
    RevisionFailureCode.APPLY_COLLISION,
  ];

  test("closed enum matches expected canonical set (no extras, no omissions)", () => {
    const actual = Object.values(RevisionFailureCode);

    expect(actual).toHaveLength(EXPECTED_CODES.length);
    expect(actual.slice().sort()).toEqual(EXPECTED_CODES.slice().sort());
  });

  test("does not include UNKNOWN or generic fallback codes", () => {
    const allCodes = Object.values(RevisionFailureCode);

    expect(allCodes).not.toContain("UNKNOWN");
    expect(allCodes).not.toContain("UNKNOWN_ERROR");
    expect(allCodes).not.toContain("GENERIC_ERROR");
  });

  test.each(EXPECTED_CODES)(
    "classifies %s with non-null code, non-empty message, non-empty context",
    (code) => {
      const failure = simulateApplyFailure(code);

      expect(failure.failure_code).toBe(code);
      expect(failure.failure_code).not.toBeNull();
      expect(failure.failure_code).not.toBe("");

      expect(typeof failure.failure_message).toBe("string");
      expect(failure.failure_message.trim().length).toBeGreaterThan(0);

      expect(failure.failure_context).toBeTruthy();
      expect(Object.keys(failure.failure_context).length).toBeGreaterThan(0);
    }
  );

  test.each(EXPECTED_CODES)("details exist for %s", (code) => {
    const details = getRevisionFailureDetails(code);

    expect(details.message).toBeTruthy();
    expect(["retryable", "non_retryable"]).toContain(details.severity);
    expect(details.message.toLowerCase()).not.toContain("unknown");
  });

  test("details map covers every enum value exactly", () => {
    const mapKeys = Object.keys(REVISION_FAILURE_DETAILS).sort();
    const enumKeys = Object.values(RevisionFailureCode).sort();

    expect(mapKeys).toEqual(enumKeys);
  });

  test("type guard accepts canonical codes and rejects non-canonical values", () => {
    for (const code of EXPECTED_CODES) {
      expect(isRevisionFailureCode(code)).toBe(true);
    }

    expect(isRevisionFailureCode("NOT_A_REAL_CODE")).toBe(false);
    expect(isRevisionFailureCode("UNKNOWN")).toBe(false);
    expect(isRevisionFailureCode("")).toBe(false);
    expect(isRevisionFailureCode(null)).toBe(false);
    expect(isRevisionFailureCode(undefined)).toBe(false);
    expect(isRevisionFailureCode(42)).toBe(false);
  });
});
