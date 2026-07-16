/**
 * Regression tests for CMOS sanitizer extensions added for the workbench-v2
 * error-fix pass (manuscript #7691 audit).
 *
 * Covers the three sanitizer defects that leaked into the author-facing
 * revision workbench:
 *   - British → US spelling normalization (e.g. "millimetre" → "millimeter")
 *   - Unbalanced / mismatched quotation marks (CMOS 6.9)
 *   - Straight → curly quotes and closed em-dashes (pre-existing, guarded here)
 *
 * These assert on the public sanitizeCMOS() entry point, which is the choke
 * point now shared by both the evaluation-report path and the revision path
 * (via lib/revision/workbenchQueue.cleanAuthorFacingText).
 */
import { describe, expect, test } from "@jest/globals";
import { sanitizeCMOS } from "@/lib/evaluation/cmosSanitizer";

describe("sanitizeCMOS — British → US spelling", () => {
  test("normalizes -re metric units", () => {
    expect(sanitizeCMOS("a gap of one millimetre")).toContain("millimeter");
    expect(sanitizeCMOS("five centimetres across")).toContain("centimeters");
    expect(sanitizeCMOS("two metres tall")).toContain("meters");
  });

  test("normalizes -our → -or", () => {
    expect(sanitizeCMOS("the colour of the sky")).toContain("color");
    expect(sanitizeCMOS("to honour the request")).toContain("honor");
    expect(sanitizeCMOS("their behaviour changed")).toContain("behavior");
  });

  test("normalizes -ise → -ize verbs", () => {
    expect(sanitizeCMOS("she recognised him")).toContain("recognized");
    expect(sanitizeCMOS("organise the shelves")).toContain("organize");
  });

  test("normalizes misc British forms", () => {
    expect(sanitizeCMOS("a grey morning")).toContain("gray");
    expect(sanitizeCMOS("they travelled far")).toContain("traveled");
  });

  test("preserves capitalization of the original token", () => {
    expect(sanitizeCMOS("Colour matters here.")).toContain("Color");
    expect(sanitizeCMOS("GREY skies")).toContain("GRAY");
  });

  test("does not mangle words that merely contain a British substring", () => {
    // "metre" appears inside "barometre"? No — but ensure whole-word matching
    // leaves unrelated words alone.
    const out = sanitizeCMOS("the diameter of the parameter");
    expect(out).toContain("diameter");
    expect(out).toContain("parameter");
  });
});

describe("sanitizeCMOS — quotation balancing (CMOS 6.9)", () => {
  test("restores a double close quote replaced by a single quote", () => {
    // Observed defect: Item 3 Option A ended with .' instead of ."
    const out = sanitizeCMOS("\u201cThat is the end of the story.\u2019");
    expect(out).toContain("\u201d");
    expect(out).not.toMatch(/\.\u2019$/);
  });

  test("appends a closing double quote when dialogue is left unclosed", () => {
    // Observed defect: Item 2 opened a quote but never closed it.
    const out = sanitizeCMOS("\u201cThat's the end of the story.");
    const opens = (out.match(/\u201c/g) || []).length;
    const closes = (out.match(/\u201d/g) || []).length;
    expect(opens).toBe(closes);
  });

  test("leaves already-balanced quotes untouched", () => {
    const balanced = "\u201cHello,\u201d she said.";
    expect(sanitizeCMOS(balanced)).toBe(balanced);
  });
});

describe("sanitizeCMOS — quotes & em-dashes (pre-existing guards)", () => {
  test("converts straight double quotes to curly", () => {
    const out = sanitizeCMOS('"quoted phrase"');
    expect(out).toContain("\u201c");
    expect(out).toContain("\u201d");
    expect(out).not.toContain('"');
  });

  test("closes spaced em-dashes", () => {
    const out = sanitizeCMOS("a pause \u2014 then silence");
    expect(out).not.toContain(" \u2014 ");
    expect(out).toContain("\u2014");
  });

  test("normalizes spaces before punctuation", () => {
    const out = sanitizeCMOS("Tighten pacing , improve transitions .");
    expect(out).toBe("Tighten pacing, improve transitions.");
  });

  test("normalizes missing space after comma and colon", () => {
    const out = sanitizeCMOS("Fix this,now:today");
    expect(out).toBe("Fix this, now: today");
  });
});
