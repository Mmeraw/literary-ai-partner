import {
  TEST_MANUSCRIPT_ID_MIN,
  isTestManuscript,
} from "@/lib/manuscripts/testRange";

describe("testRange.TEST_MANUSCRIPT_ID_MIN", () => {
  it("is locked at 9000 per OPERATIONS.md", () => {
    expect(TEST_MANUSCRIPT_ID_MIN).toBe(9000);
  });
});

describe("testRange.isTestManuscript", () => {
  it("returns false for ids just below the threshold", () => {
    expect(isTestManuscript(8999)).toBe(false);
    expect(isTestManuscript(0)).toBe(false);
    expect(isTestManuscript(1)).toBe(false);
  });

  it("returns true for ids at or above the threshold", () => {
    expect(isTestManuscript(9000)).toBe(true);
    expect(isTestManuscript(9001)).toBe(true);
    expect(isTestManuscript(123456)).toBe(true);
  });

  it("parses string-numeric ids", () => {
    expect(isTestManuscript("9001")).toBe(true);
    expect(isTestManuscript("8999")).toBe(false);
  });

  it("returns false for NaN-like values", () => {
    expect(isTestManuscript("not-a-number")).toBe(false);
    expect(isTestManuscript(Number.NaN)).toBe(false);
    expect(isTestManuscript("")).toBe(false);
  });

  it("returns false for negative ids", () => {
    expect(isTestManuscript(-1)).toBe(false);
    expect(isTestManuscript("-9000")).toBe(false);
  });
});
