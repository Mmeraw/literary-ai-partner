/**
 * Unit tests — normalizeArtifact() pre-stage
 *
 * Proves:
 *   1. Only permitted cosmetic operations run (capitalize, terminal_punct,
 *      whitespace, trim_word_boundary).
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

describe("normalizeArtifact() — overview summary trim", () => {
  it("trims a summary exceeding 750 chars at word boundary with ellipsis", () => {
    const longSummary = "The manuscript earns a 74/100 on its Concept & Premise. " + "word ".repeat(200);
    const synthesis = makeSynthesis({ one_paragraph_summary: longSummary });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary.length).toBeLessThanOrEqual(750);
    expect(synthesis.overall.one_paragraph_summary).toMatch(/…$/);
  });

  it("never cuts a word mid-token when trimming", () => {
    // Build a summary that is just over 750 chars ending on a long word
    const prefix = "The manuscript earns a 74/100. The principal blocker is Pacing. ";
    const suffix = "antidisestablishmentarianism ".repeat(40); // long words
    const synthesis = makeSynthesis({ one_paragraph_summary: prefix + suffix });
    normalizeArtifact(synthesis, [], []);
    const trimmed = synthesis.overall.one_paragraph_summary;
    // Must not end on a partial word like "antidisestablishme"
    const body = trimmed.slice(0, -1); // remove ellipsis
    expect(body).not.toMatch(/[a-z]$/i); // last char must not be mid-word alpha
  });

  it("does NOT trim a summary that is exactly 750 chars", () => {
    const exactly750 = "a".repeat(749) + ".";
    const synthesis = makeSynthesis({ one_paragraph_summary: exactly750 });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(exactly750);
  });

  it("does NOT trim a summary that is under 750 chars", () => {
    const synthesis = makeSynthesis();
    const before = synthesis.overall.one_paragraph_summary;
    expect(before.length).toBeLessThan(750);
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
      expect(["capitalize", "terminal_punct", "whitespace", "trim_word_boundary"]).toContain(norm.operation);
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

  it("logs trim_word_boundary when summary is trimmed", () => {
    const longSummary = "The manuscript earns a 74/100. " + "word ".repeat(200);
    const synthesis = makeSynthesis({ one_paragraph_summary: longSummary });
    const result = normalizeArtifact(synthesis, [], []);
    const trimLog = result.normalizations.find(n => n.operation === "trim_word_boundary");
    expect(trimLog).toBeDefined();
    expect(trimLog!.field).toContain("one_paragraph_summary");
  });
});
