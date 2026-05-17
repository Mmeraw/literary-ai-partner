import {
  getDisplayDateTime,
  getDisplayDreamList,
  getDisplayDreamMarketField,
  getDisplayDreamScore,
  getDisplayText,
} from "@/lib/evaluation/reportRenderSafety";
import {
  canonicalDreamSectionKeys,
  fullDreamDocFixture,
  malformedDreamDocFixture,
} from "@/__tests__/fixtures/dreamDocs";

describe("reportRenderSafety", () => {
  test("getDisplayText returns fallback for non-renderable values", () => {
    expect(getDisplayText({ value: 1 })).toBe("—");
    expect(getDisplayText("   ", "n/a")).toBe("n/a");
    expect(getDisplayText("  ready  ")).toBe("ready");
  });

  test("getDisplayDateTime fails closed for invalid timestamps", () => {
    expect(getDisplayDateTime("not-a-date", "Unknown")).toBe("Unknown");
    expect(getDisplayDateTime("", "Unknown")).toBe("Unknown");
    expect(getDisplayDateTime("2026-05-01T10:00:00.000Z", "Unknown")).not.toBe("Unknown");
  });

  test("getDisplayDreamScore returns em dash for malformed score blocks", () => {
    const malformed = malformedDreamDocFixture as unknown as Parameters<typeof getDisplayDreamScore>[0];
    const valid = fullDreamDocFixture as unknown as Parameters<typeof getDisplayDreamScore>[0];

    expect(getDisplayDreamScore(malformed, "quality")).toBe("—");
    expect(getDisplayDreamScore(valid, "quality")).toBe("89");
    expect(getDisplayDreamScore(null, "readiness")).toBe("—");
  });

  test("getDisplayDreamList filters non-strings and blanks", () => {
    expect(getDisplayDreamList(["  Keep tension  ", "", 42, null, "Trim exposition"]))
      .toEqual(["Keep tension", "Trim exposition"]);
    expect(getDisplayDreamList("not-an-array")).toEqual([]);
  });

  test("getDisplayDreamMarketField returns null on missing/blank fields", () => {
    const doc = fullDreamDocFixture as unknown as Parameters<typeof getDisplayDreamMarketField>[0];

    expect(getDisplayDreamMarketField(doc, "best_shelf")).toBe("Upmarket Literary Fantasy");
    expect(getDisplayDreamMarketField(doc, "marketable_hook")).toBe("Mythic courtroom intrigue with intimate POV.");
    expect(getDisplayDreamMarketField(doc, "market_danger")).toBe("Opening pace may underserve commercial readers.");
    expect(
      getDisplayDreamMarketField(malformedDreamDocFixture as unknown as Parameters<typeof getDisplayDreamMarketField>[0], "marketable_hook"),
    ).toBeNull();
    expect(getDisplayDreamMarketField(null, "best_shelf")).toBeNull();
  });

  test("full fixture exposes all canonical DREAM section keys", () => {
    for (const key of canonicalDreamSectionKeys) {
      expect(Object.prototype.hasOwnProperty.call(fullDreamDocFixture, key)).toBe(true);
    }
  });
});
