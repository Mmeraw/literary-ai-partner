import { describe, expect, test } from "@jest/globals";
import { parsePass2Response } from "@/lib/evaluation/pipeline/runPass2";

describe("runPass2 textual anchor enforcement", () => {
  test("caps score and emits NO_TEXTUAL_ANCHOR when rationale/evidence lack quoted anchors", () => {
    const raw = JSON.stringify({
      model: "o3",
      criteria: [
        {
          key: "concept",
          score_0_10: 9,
          rationale: "The concept is generally strong and coherent throughout.",
          evidence: [{ snippet: "Generic." }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria).toHaveLength(1);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  test("keeps score when textual anchors are present", () => {
    const raw = JSON.stringify({
      model: "o3",
      criteria: [
        {
          key: "concept",
          score_0_10: 9,
          rationale:
            'The central hook is explicit in "She opened the sealed letter" and escalates stakes immediately.',
          evidence: [{ snippet: '"She opened the sealed letter"' }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria).toHaveLength(1);
    expect(parsed.criteria[0].score_0_10).toBe(9);
    expect(parsed.criteria[0].reason_codes).toBeUndefined();
  });
});
