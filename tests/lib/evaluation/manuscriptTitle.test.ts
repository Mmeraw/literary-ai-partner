import { normalizeManuscriptId, normalizeTitle } from "@/lib/evaluation/manuscriptTitle";

describe("normalizeManuscriptId", () => {
  it("accepts positive numeric ids", () => {
    expect(normalizeManuscriptId(42)).toBe(42);
    expect(normalizeManuscriptId(42.9)).toBe(42);
  });

  it("accepts numeric string ids", () => {
    expect(normalizeManuscriptId("26220")).toBe(26220);
    expect(normalizeManuscriptId("  26220  ")).toBe(26220);
  });

  it("rejects invalid ids", () => {
    expect(normalizeManuscriptId(undefined)).toBeNull();
    expect(normalizeManuscriptId(null)).toBeNull();
    expect(normalizeManuscriptId(0)).toBeNull();
    expect(normalizeManuscriptId(-7)).toBeNull();
    expect(normalizeManuscriptId("0")).toBeNull();
    expect(normalizeManuscriptId("12a")).toBeNull();
    expect(normalizeManuscriptId("abc")).toBeNull();
  });
});

describe("normalizeTitle", () => {
  it("trims and returns non-empty title", () => {
    expect(normalizeTitle("  Cartel Babies  ")).toBe("Cartel Babies");
  });

  it("returns null for empty-like title values", () => {
    expect(normalizeTitle("   ")).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle(undefined)).toBeNull();
  });
});
