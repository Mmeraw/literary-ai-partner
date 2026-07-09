/**
 * Unit tests — normalizeArtifact() pre-stage
 *
 * Proves:
 *   1. Only permitted cosmetic operations run (capitalize, terminal_punct,
 *      whitespace, trim_sentence_boundary).
 *   2. Scores are never touched.
 *   3. Summary meaning is never altered.
 *   4. Wrong score in summary is left as-is (ECG's job to flag it, not ours).
 *   5. Each normalization is logged with before/after/operation.
 *   6. Already-clean inputs produce zero normalizations.
 */

import { describe, it, expect } from "@jest/globals";
import { normalizeArtifact } from "@/lib/evaluation/pipeline/normalizeArtifact";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSynthesis(overrides: {
  one_paragraph_summary?: string;
  one_sentence_pitch?: string;
  one_paragraph_pitch?: string;
  criteriaRecs?: Array<{ action?: string }>;
} = {}) {
  return {
    overall: {
      one_paragraph_summary:
        overrides.one_paragraph_summary ??
        "The manuscript earns a 74/100 on its Concept & Premise. The principal " +
        "blocker is Pacing. Tightening mid-chapter exposition is the first revision priority.",
      one_sentence_pitch:
        overrides.one_sentence_pitch ??
        "A sardonic Antwerp diamond dealer confronts friendship and cobalt money.",
      one_paragraph_pitch:
        overrides.one_paragraph_pitch ??
        "Calvin joins Monty in Antwerp for a farewell evening that becomes an ultimatum.",
    },
    criteria: [
      {
        recommendations: overrides.criteriaRecs ?? [
          { action: "Tighten the exposition for better narrative momentum." },
        ],
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clean inputs — no normalizations
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeArtifact() — already-clean inputs", () => {
  it("produces zero normalizations when everything is already clean", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress the mid-chapter exposition for better pacing." }];
    const result = normalizeArtifact(synthesis, quickWins, []);
    expect(result.normalizations).toHaveLength(0);
  });

  it("does not touch an already-capitalized, punctuated recommendation", () => {
    const synthesis = makeSynthesis();
    const action = "Tighten the mid-chapter diamond exposition to improve narrative momentum.";
    const quickWins = [{ action }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe(action);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation normalization
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeArtifact() — recommendation normalization", () => {
  it("capitalizes a lowercase action start", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "compress the mid-chapter exposition for better pacing." }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action.charAt(0)).toBe("C");
  });

  it("adds a period when terminal punctuation is missing", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress the mid-chapter exposition for better pacing" }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toMatch(/\.$/);
  });

  it("does not add a period when action ends with a question mark", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Should the author reconsider the opening scene structure?" }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toMatch(/\?$/);
    expect(quickWins[0].action).not.toMatch(/\?\.$/);
  });

  it("does not add a period when action ends with ellipsis", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress the mid-chapter exposition for better pacing\u2026" }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toMatch(/…$/);
    expect(quickWins[0].action).not.toMatch(/…\.$/);
  });

  it("collapses multiple whitespace in action text", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress  the   exposition  for better pacing." }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe("Compress the exposition for better pacing.");
  });

  it("applies multiple normalizations in sequence (whitespace + capitalize + punct)", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "  compress  the exposition" }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe("Compress the exposition.");
  });

  it("normalizes strategic_revisions as well as quick_wins", () => {
    const synthesis = makeSynthesis();
    const strategicRevisions = [{ action: "introduce physical beats in the penthouse scene" }];
    normalizeArtifact(synthesis, [], strategicRevisions);
    expect(strategicRevisions[0].action.charAt(0)).toBe("I");
    expect(strategicRevisions[0].action).toMatch(/\.$/);
  });

  it("normalizes criterion-level recommendations too", () => {
    const synthesis = makeSynthesis({
      criteriaRecs: [{ action: "add a concrete resolution beat at the climax" }],
    });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.criteria[0].recommendations![0].action).toMatch(/^Add/);
    expect(synthesis.criteria[0].recommendations![0].action).toMatch(/\.$/);
  });

  it("skips empty action strings", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "" }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Overview summary trimming
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeArtifact() — overview summary trim (cap 1000, sentence boundary)", () => {
  it("trims a summary exceeding the 1000-char cap at a complete-sentence boundary", () => {
    // Whole sentences past the cap → trimmed to last full sentence, no ellipsis.
    const longSummary = "The manuscript earns a solid score on its concept. ".repeat(40);
    const synthesis = makeSynthesis({ one_paragraph_summary: longSummary });
    normalizeArtifact(synthesis, [], []);
    const after = synthesis.overall.one_paragraph_summary;
    expect(after.length).toBeLessThanOrEqual(1000);
    expect(after.endsWith(".")).toBe(true);   // ends on a complete sentence
    expect(after.includes("\u2026")).toBe(false); // no ellipsis when a sentence fits
  });

  it("never cuts a word mid-token even when one sentence is longer than the cap", () => {
    // A single sentence longer than the cap forces the word-boundary fallback,
    // which is the only branch that appends an ellipsis. It must still end on a
    // COMPLETE source word — never a partial like "antidisestablishme".
    const source = "The blocker is " + "antidisestablishmentarianism ".repeat(50) + "and more.";
    const synthesis = makeSynthesis({ one_paragraph_summary: source });
    normalizeArtifact(synthesis, [], []);
    const trimmed = synthesis.overall.one_paragraph_summary;
    expect(trimmed).toMatch(/\u2026$/);
    const body = trimmed.slice(0, -1).trimEnd();
    const lastToken = body.split(/\s+/).pop() ?? "";
    const sourceTokens = new Set(source.split(/\s+/));
    expect(sourceTokens.has(lastToken)).toBe(true);
  });

  it("does NOT trim a summary that is exactly at the 1000-char cap", () => {
    const exactly1000 = "a".repeat(999) + ".";
    const synthesis = makeSynthesis({ one_paragraph_summary: exactly1000 });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(exactly1000);
  });

  it("does NOT trim a summary that is under the cap (overage above base allowed)", () => {
    const synthesis = makeSynthesis();
    const before = synthesis.overall.one_paragraph_summary;
    expect(before.length).toBeLessThan(1000);
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Semantic immutability — never touch scores or meaning
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeArtifact() — semantic immutability", () => {
  it("NEVER replaces a wrong score in the exec summary (that is ECG's job)", () => {
    const summaryWith80 =
      "This manuscript earns a solid 80/100 on the strength of its Concept & Core Premise. " +
      "The principal blocker is Pacing & Structural Balance. " +
      "Tightening the mid-chapter exposition is the first revision priority.";
    const synthesis = makeSynthesis({ one_paragraph_summary: summaryWith80 });
    normalizeArtifact(synthesis, [], []);
    // Must still say 80/100 — normalization must NOT touch it
    expect(synthesis.overall.one_paragraph_summary).toContain("80/100");
    expect(synthesis.overall.one_paragraph_summary).not.toContain("74/100");
  });

  it("NEVER rewrites pitch text", () => {
    const synthesis = makeSynthesis();
    const pitchBefore = synthesis.overall.one_sentence_pitch;
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_sentence_pitch).toBe(pitchBefore);
  });

  it("NEVER deduplicates fields that are identical", () => {
    // If sentence_pitch and paragraph_pitch are the same, normalization
    // must leave them both as-is. ECG will flag it as IDENT_PITCH_DUPLICATION.
    const same = "Both fields are the same content and should flag in ECG not normalization.";
    const synthesis = makeSynthesis({
      one_sentence_pitch: same,
      one_paragraph_pitch: same,
    });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_sentence_pitch).toBe(same);
    expect(synthesis.overall.one_paragraph_pitch).toBe(same);
  });

  it("NEVER fills a missing field with fallback content", () => {
    const synthesis = makeSynthesis({ one_sentence_pitch: "" });
    normalizeArtifact(synthesis, [], []);
    // Must remain empty — filling is ECG's fatal, not normalization's job
    expect(synthesis.overall.one_sentence_pitch).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalization log
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeArtifact() — normalization log", () => {
  it("logs each normalization with field, before, after, and operation", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "compress the exposition" }];
    const result = normalizeArtifact(synthesis, quickWins, []);
    for (const norm of result.normalizations) {
      expect(norm.field).toBeTruthy();
      expect(norm.before).toBeTruthy();
      expect(norm.after).toBeTruthy();
      expect(["capitalize", "terminal_punct", "whitespace", "trim_sentence_boundary"]).toContain(norm.operation);
    }
  });

  it("before and after differ on every logged normalization", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "compress the exposition" }];
    const result = normalizeArtifact(synthesis, quickWins, []);
    for (const norm of result.normalizations) {
      expect(norm.before).not.toBe(norm.after);
    }
  });

  it("logs trim_sentence_boundary when summary exceeds the 1000-char cap", () => {
    // Build a summary of complete sentences that runs well past the 1000-char
    // hard cap so the sentence-boundary trimmer must engage.
    const sentence = "The manuscript earns a strong score on its craft and voice. ";
    const longSummary = sentence.repeat(40); // ~2360 chars, all whole sentences
    const synthesis = makeSynthesis({ one_paragraph_summary: longSummary });
    const result = normalizeArtifact(synthesis, [], []);
    const trimLog = result.normalizations.find(n => n.operation === "trim_sentence_boundary");
    expect(trimLog).toBeDefined();
    expect(trimLog!.field).toContain("one_paragraph_summary");
    // Result must be within the hard cap and end on a complete sentence
    // (no mid-sentence cut, no ellipsis since whole sentences fit).
    const after = synthesis.overall.one_paragraph_summary!;
    expect(after.length).toBeLessThanOrEqual(1000);
    expect(after.endsWith(".")).toBe(true);
    expect(after.includes("\u2026")).toBe(false);
  });

  it("does NOT trim a summary that is over base but under the 1000-char cap", () => {
    // "more is more": a summary between base (750) and cap (1000) must pass
    // through untouched — overage above base is allowed.
    const sentence = "The prose is confident and the pacing is assured throughout. ";
    let summary = "";
    while (summary.length < 850) summary += sentence; // lands ~850-900 chars
    const synthesis = makeSynthesis({ one_paragraph_summary: summary });
    const result = normalizeArtifact(synthesis, [], []);
    const trimLog = result.normalizations.find(n => n.field.includes("one_paragraph_summary"));
    expect(trimLog).toBeUndefined();
    expect(synthesis.overall.one_paragraph_summary).toBe(summary);
  });
});
