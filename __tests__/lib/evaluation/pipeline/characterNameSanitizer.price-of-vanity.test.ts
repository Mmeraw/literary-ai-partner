import {
  sanitizeBlockedCharacterNames,
  sanitizeSynthesisCharacterNames,
} from "@/lib/evaluation/pipeline/characterNameSanitizer";

describe("Price of Vanity expense-label character-name sanitizer", () => {
  it("replaces Cost used as a false character name even without canonical ledger names", () => {
    const input =
      "Cost's disastrous day culminates in meeting Kim. Cost actively contrasts the $341 tally with Kim's values.";

    const output = sanitizeBlockedCharacterNames(input, []);

    expect(output).toBe(
      "The narrator's disastrous day culminates in meeting Kim. The narrator actively contrasts the $341 tally with Kim's values.",
    );
    expect(output).not.toContain("Cost's");
    expect(output).not.toContain("Cost actively");
  });

  it("does not rewrite literal expense labels or product/store names", () => {
    const input =
      "Cost: $14.00. Shoppers Drug Mart sold Revlon Frost&Glow, and Kim fixed the narrator's hair.";

    expect(sanitizeBlockedCharacterNames(input, [])).toBe(input);
  });

  it("sanitizes synthesis summaries, risks, and recommendations with narrator fallback", () => {
    const synthesis = {
      overall: {
        one_paragraph_summary:
          "This Toronto-set story about Cost's disastrous day scores strongly on theme.",
        one_sentence_pitch:
          "Cost learns that vanity has a price after a hair-coloring fiasco.",
        one_paragraph_pitch:
          "Cost actively tries to fix a DIY bleaching error before meeting Kim.",
        top_3_strengths: ["Cost's ledger-style ending creates payoff."],
        top_3_risks: ["Internal reaction from Cost needs more dramatization."],
      },
      criteria: [
        {
          final_rationale: "Cost's financial vanity is clear.",
          fit_summary: "Cost actively counts each expense.",
          gap_summary: "Cost needs a stronger internal pivot.",
          recommendations: [
            {
              action: "Sharpen Cost's internal reaction after Marcus's salon.",
              expected_impact: "The reader better understands Cost's change.",
              anchor_snippet: "Cost: $140.00.",
              mechanism: "Cost remains too abstract in the transition beat.",
            },
          ],
        },
      ],
    };

    const modified = sanitizeSynthesisCharacterNames(synthesis, []);

    expect(modified).toBeGreaterThan(0);
    const serialized = JSON.stringify(synthesis);
    expect(serialized).not.toContain("Cost's");
    expect(serialized).not.toContain("Cost actively");
    expect(serialized).toContain("the narrator's disastrous day");
    expect(serialized).toContain("the narrator's internal reaction");
    expect(serialized).toContain("Cost: $140.00.");
  });
});
