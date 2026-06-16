/**
 * Hard test: Character Name Sanitizer
 *
 * Given manuscript text containing "No" as a repeated token and "Michael"
 * as the actual character name, the final report must not identify "No"
 * as a character or alias.
 *
 * Covers:
 * - isAllowedCharacterName() rejects blocked words
 * - sanitizeBlockedCharacterNames() replaces blocked names in free text
 * - sanitizeSynthesisCharacterNames() scans all synthesis output fields
 * - containsBlockedCharacterName() detects blocked name references
 */

import {
  sanitizeBlockedCharacterNames,
  sanitizeSynthesisCharacterNames,
  containsBlockedCharacterName,
  isBlockedCharacterName,
} from "@/lib/evaluation/pipeline/characterNameSanitizer";
import {
  isAllowedCharacterName,
  BLOCKED_CANONICAL_NAMES,
} from "@/lib/evaluation/pipeline/pass1aQuarantine";

describe("isAllowedCharacterName", () => {
  it("rejects all blocked canonical names", () => {
    for (const blocked of BLOCKED_CANONICAL_NAMES) {
      expect(isAllowedCharacterName(blocked)).toBe(false);
    }
  });

  it("rejects case-insensitive variants", () => {
    expect(isAllowedCharacterName("No")).toBe(false);
    expect(isAllowedCharacterName("NO")).toBe(false);
    expect(isAllowedCharacterName("Yes")).toBe(false);
    expect(isAllowedCharacterName("OH")).toBe(false);
    expect(isAllowedCharacterName("Hey")).toBe(false);
  });

  it("accepts real character names", () => {
    expect(isAllowedCharacterName("Michael")).toBe(true);
    expect(isAllowedCharacterName("Michael Salter")).toBe(true);
    expect(isAllowedCharacterName("Benjamin Lopez Castro")).toBe(true);
    expect(isAllowedCharacterName("Paolito")).toBe(true);
    expect(isAllowedCharacterName("Santiago")).toBe(true);
  });

  it("rejects empty and whitespace-only names", () => {
    expect(isAllowedCharacterName("")).toBe(false);
    expect(isAllowedCharacterName("   ")).toBe(false);
  });
});

describe("isBlockedCharacterName", () => {
  it("detects common blocked words", () => {
    expect(isBlockedCharacterName("no")).toBe(true);
    expect(isBlockedCharacterName("No")).toBe(true);
    expect(isBlockedCharacterName("yes")).toBe(true);
    expect(isBlockedCharacterName("hey")).toBe(true);
    expect(isBlockedCharacterName("narrator")).toBe(true);
  });

  it("passes real names through", () => {
    expect(isBlockedCharacterName("Michael")).toBe(false);
    expect(isBlockedCharacterName("Benjamin")).toBe(false);
  });
});

describe("sanitizeBlockedCharacterNames", () => {
  const canonical = ["Michael Salter", "Benjamin Lopez Castro", "Raúl"];
  const narratorCanonical = ["Unnamed male narrator/protagonist", "Kim"];

  it("replaces possessive form: No's → Michael Salter's", () => {
    const input = "No's survival instincts drive the narrative forward.";
    const result = sanitizeBlockedCharacterNames(input, canonical);
    expect(result).toBe("Michael Salter's survival instincts drive the narrative forward.");
    expect(result).not.toContain("No's");
  });

  it("replaces slash-alias form: No/Michael → Michael Salter", () => {
    const input = "No/Michael faces a difficult choice at the checkpoint.";
    const result = sanitizeBlockedCharacterNames(input, canonical);
    expect(result).toBe("Michael Salter faces a difficult choice at the checkpoint.");
    expect(result).not.toContain("No/");
  });

  it("replaces subject position: No notices → Michael Salter notices", () => {
    const input = "No notices the rig blocking the highway.";
    const result = sanitizeBlockedCharacterNames(input, canonical);
    expect(result).toBe("Michael Salter notices the rig blocking the highway.");
  });

  it("handles multiple blocked name occurrences in one text", () => {
    const input = "No's journey begins when No notices the roadblock. No/Michael must decide.";
    const result = sanitizeBlockedCharacterNames(input, canonical);
    expect(result).not.toContain("No's");
    expect(result).not.toContain("No/");
    expect(result).not.toMatch(/\bNo notices\b/);
    expect(result).toContain("Michael Salter");
  });

  it("does not modify text without blocked character names", () => {
    const input = "Michael Salter drives through the checkpoint. Benjamin follows.";
    const result = sanitizeBlockedCharacterNames(input, canonical);
    expect(result).toBe(input);
  });

  it("preserves the word 'No' in normal usage (lowercase, mid-sentence)", () => {
    // Only capitalized "No" in name-like positions should be replaced
    const input = "There is no way to escape. He said no to the offer.";
    const result = sanitizeBlockedCharacterNames(input, canonical);
    expect(result).toBe(input); // lowercase "no" should not be touched
  });

  it("returns empty/undefined inputs unchanged", () => {
    expect(sanitizeBlockedCharacterNames("", canonical)).toBe("");
    expect(sanitizeBlockedCharacterNames("test", [])).toBe("test");
  });

  it("replaces Cost possessive with narrator label (curly apostrophe)", () => {
    const input = "Cost’s disastrous hair-color day reveals vanity and consequence.";
    const result = sanitizeBlockedCharacterNames(input, narratorCanonical);
    expect(result).toBe("The narrator's disastrous hair-color day reveals vanity and consequence.");
    expect(result).not.toContain("Cost’s");
  });

  it("replaces Cost in subject position with narrator label", () => {
    const input = "Cost delivers a propulsive and humorous account of vanity.";
    const result = sanitizeBlockedCharacterNames(input, narratorCanonical);
    expect(result).toBe("The narrator delivers a propulsive and humorous account of vanity.");
    expect(result).not.toMatch(/\bCost delivers\b/);
  });
});

describe("containsBlockedCharacterName", () => {
  it("detects possessive blocked names", () => {
    expect(containsBlockedCharacterName("No's abduction arc")).toBe(true);
  });

  it("detects slash-alias blocked names", () => {
    expect(containsBlockedCharacterName("No/Michael at the checkpoint")).toBe(true);
  });

  it("detects subject-position blocked names", () => {
    expect(containsBlockedCharacterName("No notices the danger")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(containsBlockedCharacterName("Michael Salter notices the danger")).toBe(false);
  });

  it("returns false for empty/undefined", () => {
    expect(containsBlockedCharacterName("")).toBe(false);
  });
});

describe("sanitizeSynthesisCharacterNames — full synthesis output", () => {
  const canonical = ["Michael Salter", "Benjamin Lopez Castro"];

  /**
   * HARD TEST: Given a synthesis output that uses "No" as a character name
   * (exactly matching the Cartel Babies production bug), verify that ALL
   * fields are sanitized to use "Michael Salter" instead.
   */
  it("must not identify 'No' as a character in any output field", () => {
    const synthesis = {
      overall: {
        overall_score_0_100: 91,
        verdict: "pass",
        one_paragraph_summary: "No's journey through captivity reveals deep emotional layers.",
        one_sentence_pitch: "No's abduction drives a gripping crime narrative.",
        one_paragraph_pitch: "No/Michael faces impossible choices in the cartel's grip.",
        top_3_strengths: [
          "No's internal monologue creates visceral tension",
          "Benjamin's relationship with No evolves compellingly",
          "Clean prose style maintains reader engagement",
        ],
        top_3_risks: [
          "No's passivity in Act 2 slows momentum",
          "Secondary characters lack No's depth",
        ],
      },
      criteria: [
        {
          key: "characterDepth",
          final_rationale: "No demonstrates remarkable psychological complexity. No's arc is the emotional core.",
          fit_summary: "No's internal world is richly drawn.",
          gap_summary: "No's arc could benefit from more external agency.",
          recommendations: [
            {
              action: "Strengthen No's decision-making in the camp scenes.",
              symptom: "No remains passive during key confrontations. No's reactions are muted.",
              cause: "No's survival instincts override agency.",
              mechanism: "No watches rather than acts. No remains passive.",
              specific_fix: "Give No's character a moment of active resistance in Chapter 12.",
              reader_effect: "No's agency would increase reader investment.",
              expected_impact: "No's character becomes more compelling.",
              anchor_snippet: "No noticed the rig blocking the highway.",
              rationale: "No's passivity undermines tension.",
              fix_direction: "No should take initiative.",
              mistake_proofing: "Don't damage No's established vulnerability.",
              candidate_text_a: "No's courage emerged in the final scene.",
              candidate_text_b: "No's hands trembled but he spoke anyway.",
              candidate_text_c: "No's resolve was tested at the crossing.",
              priority: "high" as const,
              source_pass: 3 as const,
              issue_family: "character" as const,
              strategic_lever: "character_agency" as const,
              revision_granularity: "scene" as const,
            },
          ],
        },
      ],
    };

    const modifiedCount = sanitizeSynthesisCharacterNames(synthesis, canonical);

    // Should have modified multiple fields
    expect(modifiedCount).toBeGreaterThan(0);

    // ── Overall fields must not contain "No" as character name ──
    expect(synthesis.overall.one_paragraph_summary).not.toMatch(/\bNo's\b/);
    expect(synthesis.overall.one_paragraph_summary).toContain("Michael Salter");

    expect(synthesis.overall.one_sentence_pitch).not.toMatch(/\bNo's\b/);
    expect(synthesis.overall.one_sentence_pitch).toContain("Michael Salter");

    expect(synthesis.overall.one_paragraph_pitch).not.toContain("No/");
    expect(synthesis.overall.one_paragraph_pitch).toContain("Michael Salter");

    for (const strength of synthesis.overall.top_3_strengths) {
      expect(strength).not.toMatch(/\bNo's\b/);
    }

    for (const risk of synthesis.overall.top_3_risks) {
      expect(risk).not.toMatch(/\bNo's\b/);
    }

    // ── Per-criterion fields must not contain "No" as character name ──
    const criterion = synthesis.criteria[0];
    expect(criterion.final_rationale).not.toMatch(/\bNo demonstrates\b/);
    expect(criterion.final_rationale).not.toMatch(/\bNo's\b/);
    expect(criterion.final_rationale).toContain("Michael Salter");

    const rec = criterion.recommendations[0];
    expect(rec.action).not.toContain("No's");
    expect(rec.symptom).not.toMatch(/\bNo remains\b/);
    expect(rec.cause).not.toMatch(/\bNo's\b/);
    expect(rec.mechanism).not.toMatch(/\bNo watches\b/);
    expect(rec.mechanism).toContain("Michael Salter");
    expect(rec.specific_fix).not.toContain("No ");
    expect(rec.reader_effect).not.toMatch(/\bNo's\b/);
    expect(rec.expected_impact).not.toMatch(/\bNo's\b/);
    expect(rec.rationale).not.toMatch(/\bNo's\b/);
    expect(rec.fix_direction).not.toMatch(/\bNo should\b/);
    expect(rec.mistake_proofing).not.toMatch(/\bNo's\b/);
    // Candidate texts contain "No" in creative prose positions — sanitizer catches verb-following patterns
    expect(rec.candidate_text_b).not.toMatch(/\bNo's\b/);
    // candidate_text_c checked via full JSON scan below

    // Final check: no "No" used as a character name anywhere in the output
    const allText = JSON.stringify(synthesis);
    expect(containsBlockedCharacterName(allText)).toBe(false);
  });

  it("returns 0 when no blocked names are present", () => {
    const clean = {
      overall: {
        one_paragraph_summary: "Michael Salter faces captivity with resilience.",
        top_3_strengths: ["Strong prose", "Deep characters"],
        top_3_risks: ["Slow pacing"],
      },
      criteria: [],
    };
    const count = sanitizeSynthesisCharacterNames(clean, canonical);
    expect(count).toBe(0);
  });

  it("returns 0 when canonicalNames is empty", () => {
    const synthesis = {
      overall: { one_paragraph_summary: "No's journey is compelling." },
      criteria: [],
    };
    const count = sanitizeSynthesisCharacterNames(synthesis, []);
    expect(count).toBe(0);
  });

  it("sanitizes Cost in one-sentence pitch to narrator label", () => {
    const synthesis = {
      overall: {
        one_sentence_pitch:
          "This chapter delivers a propulsive, humorous account of Cost’s disastrous hair-color day while contrasting vanity with hard-won values.",
      },
      criteria: [],
    };

    const count = sanitizeSynthesisCharacterNames(synthesis, ["Unnamed male narrator/protagonist", "Kim"]);

    expect(count).toBeGreaterThan(0);
    expect(synthesis.overall.one_sentence_pitch).toContain("the narrator's disastrous hair-color day");
    expect(synthesis.overall.one_sentence_pitch).not.toContain("Cost’s");
  });
});

describe("financial/thematic token blocklist — Price of Vanity regression", () => {
  /**
   * REGRESSION TEST: The Price of Vanity evaluation named the unnamed
   * protagonist "Cost" because the word appeared as a ledger-style price
   * label ("Cost: $65.00"). The LLM promoted the financial token to a
   * character name. Financial and thematic words must be blocked.
   */
  it("blocks 'cost' as a character name", () => {
    expect(isAllowedCharacterName("Cost")).toBe(false);
    expect(isAllowedCharacterName("cost")).toBe(false);
    expect(isBlockedCharacterName("cost")).toBe(true);
    expect(isBlockedCharacterName("Cost")).toBe(true);
  });

  it("blocks other financial tokens as character names", () => {
    for (const token of ["price", "value", "money", "profit", "loss", "expense", "total"]) {
      expect(isAllowedCharacterName(token)).toBe(false);
      expect(isAllowedCharacterName(token.charAt(0).toUpperCase() + token.slice(1))).toBe(false);
    }
  });

  it("blocks thematic abstract nouns as character names", () => {
    for (const token of ["vanity", "beauty", "truth", "fate", "hope", "grace", "faith"]) {
      expect(isAllowedCharacterName(token)).toBe(false);
    }
  });

  it("sanitizes 'Cost's' possessive in synthesis output", () => {
    const input = "Cost's disastrous hair-color day contrasts his vanity with Kim's values.";
    const result = sanitizeBlockedCharacterNames(input, ["the narrator"]);
    expect(result).not.toContain("Cost's");
    expect(result).toContain("narrator");
  });

  it("sanitizes 'Cost notices' subject-position pattern", () => {
    const input = "Cost realizes the true value of human connection.";
    const result = sanitizeBlockedCharacterNames(input, ["the narrator"]);
    expect(result).not.toMatch(/\bCost realizes\b/);
    expect(result).toContain("narrator");
  });

  it("does not touch lowercase 'cost' in normal financial context", () => {
    const input = "The total cost was $341.00 for the day's adventure.";
    const result = sanitizeBlockedCharacterNames(input, ["the narrator"]);
    expect(result).toBe(input);
  });
});
