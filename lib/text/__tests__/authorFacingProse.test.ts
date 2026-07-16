/**
 * Unit + fixture tests — shared author-facing prose helpers.
 *
 * These are PURE, idempotent helpers. They only transform or inspect a string
 * and make NO pass/fail decision (authority lives in the gates). Each helper is
 * exercised for its documented behavior, idempotency, and — where a defect from
 * the Copy-Polish brief maps to a helper — the EXACT source fixture string.
 *
 * Defect → helper map:
 *   A1  detectProseScoreDivergence   (prose "64/100" vs canonical 68 — never inflate)
 *   A2  detectRawFallbackSentinel    ("A distinct market hook was not generated…")
 *   A3  capitalizeFirstAlpha + ensureTerminalPunctuation
 *   A4  collapseAdjacentDuplicateWords ("passage reflective passage")
 *   D1  ensureSingleSpaceAfterColon   ("Symptom:After" → "Symptom: After")
 *   D3  collapseDuplicatedStrategyLabel (doubled "A: Recommended" header)
 *   mid-sentence invariant: endsMidSentence / endsWithDanglingConnective / trimAtSentenceBoundary
 */

import { describe, it, expect } from "@jest/globals";
import {
  capitalizeFirstAlpha,
  ensureTerminalPunctuation,
  ensureSingleSpaceAfterColon,
  collapseAdjacentDuplicateWords,
  collapseDuplicatedStrategyLabel,
  detectRawFallbackSentinel,
  detectProseScoreDivergence,
  endsMidSentence,
  endsWithDanglingConnective,
  trimAtSentenceBoundary,
} from "@/lib/text/authorFacingProse";

// ── capitalizeFirstAlpha (A3, A4, D2) ────────────────────────────────────────
describe("capitalizeFirstAlpha", () => {
  it("capitalizes the first alphabetic character", () => {
    expect(capitalizeFirstAlpha("insert one concrete stakes beat")).toBe(
      "Insert one concrete stakes beat",
    );
  });

  it("leaves leading punctuation/numbering untouched", () => {
    expect(capitalizeFirstAlpha("4. insert one beat")).toBe("4. Insert one beat");
    expect(capitalizeFirstAlpha("• the reflective passage")).toBe("• The reflective passage");
  });

  it("is idempotent on already-capitalized text", () => {
    const once = capitalizeFirstAlpha("The reflective passage stalls.");
    expect(once).toBe("The reflective passage stalls.");
    expect(capitalizeFirstAlpha(once)).toBe(once);
  });

  it("returns empty/no-alpha input unchanged", () => {
    expect(capitalizeFirstAlpha("")).toBe("");
    expect(capitalizeFirstAlpha("123 —")).toBe("123 —");
  });
});

// ── ensureTerminalPunctuation (A3, A4) ───────────────────────────────────────
describe("ensureTerminalPunctuation", () => {
  it("appends a period when terminal punctuation is missing", () => {
    expect(ensureTerminalPunctuation("the stakes signal arrives too late")).toBe(
      "the stakes signal arrives too late.",
    );
  });

  it("replaces a dangling clause-level mark with a period", () => {
    expect(ensureTerminalPunctuation("the stakes signal arrives too late,")).toBe(
      "the stakes signal arrives too late.",
    );
    expect(ensureTerminalPunctuation("increased momentum:")).toBe("increased momentum.");
  });

  it("is idempotent when already terminally punctuated", () => {
    expect(ensureTerminalPunctuation("Done.")).toBe("Done.");
    expect(ensureTerminalPunctuation("Really?")).toBe("Really?");
    expect(ensureTerminalPunctuation('He said "stop."')).toBe('He said "stop."');
  });
});

// ── ensureSingleSpaceAfterColon (D1) ─────────────────────────────────────────
describe("ensureSingleSpaceAfterColon", () => {
  it("inserts a single space after a label colon (D1 fixture)", () => {
    expect(ensureSingleSpaceAfterColon("Symptom:After")).toBe("Symptom: After");
    expect(ensureSingleSpaceAfterColon("Fix:Add")).toBe("Fix: Add");
  });

  it("does not double-space when a space already exists (idempotent)", () => {
    expect(ensureSingleSpaceAfterColon("Symptom: After")).toBe("Symptom: After");
    expect(ensureSingleSpaceAfterColon(ensureSingleSpaceAfterColon("Symptom:After"))).toBe(
      "Symptom: After",
    );
  });

  it("collapses multiple spaces after a colon to one", () => {
    expect(ensureSingleSpaceAfterColon("Symptom:   After")).toBe("Symptom: After");
  });

  it("leaves digit:digit ratios/times untouched", () => {
    expect(ensureSingleSpaceAfterColon("ratio 3:1")).toBe("ratio 3:1");
    expect(ensureSingleSpaceAfterColon("at 12:30")).toBe("at 12:30");
  });
});

// ── collapseAdjacentDuplicateWords (A4) ──────────────────────────────────────
describe("collapseAdjacentDuplicateWords", () => {
  it("collapses a duplicate straddling one word (A4 fixture)", () => {
    expect(
      collapseAdjacentDuplicateWords(
        "The passage reflective passage stalls forward momentum before the narrative urgency peaks",
      ),
    ).toBe("The reflective passage stalls forward momentum before the narrative urgency peaks");
  });

  it("collapses an immediate safe-function-word repeat", () => {
    expect(collapseAdjacentDuplicateWords("the the reflective passage")).toBe(
      "the reflective passage",
    );
  });

  it("never collapses legitimate repetition", () => {
    expect(collapseAdjacentDuplicateWords("he had had enough")).toBe("he had had enough");
    expect(collapseAdjacentDuplicateWords("she knew that that man")).toBe("she knew that that man");
  });

  it("is idempotent", () => {
    const once = collapseAdjacentDuplicateWords("the passage reflective passage stalls");
    expect(collapseAdjacentDuplicateWords(once)).toBe(once);
  });
});

// ── collapseDuplicatedStrategyLabel (D3) ─────────────────────────────────────
describe("collapseDuplicatedStrategyLabel", () => {
  it("collapses an accidentally doubled strategy label", () => {
    expect(collapseDuplicatedStrategyLabel("A: Recommended A: Recommended")).toBe("A: Recommended");
    expect(collapseDuplicatedStrategyLabel("A — Recommended Repair A — Recommended Repair")).toBe(
      "A — Recommended Repair",
    );
  });

  it("preserves a correctly-single intended label (no false positive)", () => {
    expect(collapseDuplicatedStrategyLabel("A: Recommended")).toBe("A: Recommended");
    expect(collapseDuplicatedStrategyLabel("B — Rhythm Variant")).toBe("B — Rhythm Variant");
    expect(collapseDuplicatedStrategyLabel("C: Bolder Shift")).toBe("C: Bolder Shift");
  });

  it("does not touch non-strategy duplicated text", () => {
    expect(collapseDuplicatedStrategyLabel("really really good")).toBe("really really good");
  });

  it("is idempotent", () => {
    const once = collapseDuplicatedStrategyLabel("A: Recommended A: Recommended");
    expect(collapseDuplicatedStrategyLabel(once)).toBe(once);
  });
});

// ── detectRawFallbackSentinel (A2) ───────────────────────────────────────────
describe("detectRawFallbackSentinel", () => {
  it("detects the market-hook sentinel (A2 fixture)", () => {
    expect(detectRawFallbackSentinel("A distinct market hook was not generated for Criminality.")).toBe(
      true,
    );
  });

  it("detects the story-synopsis sentinel", () => {
    expect(detectRawFallbackSentinel("A distinct story synopsis was not generated.")).toBe(true);
  });

  it("treats null/empty as absent", () => {
    expect(detectRawFallbackSentinel(null)).toBe(true);
    expect(detectRawFallbackSentinel(undefined)).toBe(true);
    expect(detectRawFallbackSentinel("   ")).toBe(true);
  });

  it("returns false for a genuine pitch", () => {
    expect(
      detectRawFallbackSentinel(
        "A sardonic diamond dealer's retirement evening becomes a reckoning with blood money.",
      ),
    ).toBe(false);
  });
});

// ── detectProseScoreDivergence (A1) ──────────────────────────────────────────
describe("detectProseScoreDivergence", () => {
  it("flags the floor-vs-round 64-vs-68 divergence without inflating (A1 fixture)", () => {
    const r = detectProseScoreDivergence("This excerpt earns a 64/100 on the strength of its premise.", 68);
    expect(r.proseScores).toEqual([64]);
    expect(r.diverges).toBe(true);
    expect(r.inflates).toBe(false); // 64 < 68 → not inflation, but still a mismatch
  });

  it("flags inflation when prose EXCEEDS canonical", () => {
    const r = detectProseScoreDivergence("This excerpt earns a 72/100.", 68);
    expect(r.diverges).toBe(true);
    expect(r.inflates).toBe(true);
  });

  it("does not flag when prose matches canonical", () => {
    const r = detectProseScoreDivergence("This excerpt earns a 68/100.", 68);
    expect(r.diverges).toBe(false);
    expect(r.inflates).toBe(false);
  });

  it("handles prose with no score", () => {
    const r = detectProseScoreDivergence("A strong, well-paced excerpt.", 68);
    expect(r.proseScores).toEqual([]);
    expect(r.diverges).toBe(false);
  });
});

// ── mid-sentence invariant: endsMidSentence / endsWithDanglingConnective ─────
describe("endsMidSentence", () => {
  it("flags a dangling connective", () => {
    expect(endsMidSentence("The stakes arrive late because")).toBe(true);
  });

  it("flags a dangling comma / colon / open paren", () => {
    expect(endsMidSentence("The stakes arrive late,")).toBe(true);
    expect(endsMidSentence("The stakes arrive late:")).toBe(true);
    expect(endsMidSentence("The stakes arrive late (")).toBe(true);
  });

  it("flags mere absence of terminal punctuation", () => {
    expect(endsMidSentence("The stakes arrive late")).toBe(true);
  });

  it("passes a complete sentence", () => {
    expect(endsMidSentence("The stakes arrive late.")).toBe(false);
  });

  it("does not misclassify hyphenated compounds as dangling connectives", () => {
    expect(endsMidSentence("weakening reader buy-in.")).toBe(false);
    expect(endsMidSentence("weakening reader buy-in")).toBe(true);
  });
});

describe("endsWithDanglingConnective", () => {
  it("flags a dangling connective but not mere missing punctuation", () => {
    expect(endsWithDanglingConnective("The stakes arrive late because")).toBe(true);
    expect(endsWithDanglingConnective("The stakes arrive late,")).toBe(true);
    // Strong-signal subset: no terminal punctuation alone is NOT flagged.
    expect(endsWithDanglingConnective("Fix direction")).toBe(false);
  });

  it("does not flag hyphenated compounds that end with a dangling-word token", () => {
    expect(endsWithDanglingConnective("weakening reader buy-in")).toBe(false);
    expect(endsWithDanglingConnective("Weakening reader buy-in")).toBe(false);
    expect(endsWithDanglingConnective("The reader buys in")).toBe(true);
    expect(endsWithDanglingConnective("a for-profit choice")).toBe(false);
  });
});

// ── trimAtSentenceBoundary (global invariant helper) ─────────────────────────
describe("trimAtSentenceBoundary", () => {
  it("drops a trailing incomplete fragment", () => {
    expect(
      trimAtSentenceBoundary("The stakes arrive late. The reader loses momentum because"),
    ).toBe("The stakes arrive late.");
  });

  it("returns a complete sentence unchanged", () => {
    expect(trimAtSentenceBoundary("The stakes arrive late.")).toBe("The stakes arrive late.");
  });

  it("never leaves a dangling connective when trimming to a budget", () => {
    const out = trimAtSentenceBoundary(
      "The stakes arrive late. The reader loses momentum and the scene stalls before the turn.",
      30,
    );
    expect(endsWithDanglingConnective(out)).toBe(false);
  });

  it("is idempotent", () => {
    const once = trimAtSentenceBoundary("The stakes arrive late. The reader loses momentum because");
    expect(trimAtSentenceBoundary(once)).toBe(once);
  });
});
