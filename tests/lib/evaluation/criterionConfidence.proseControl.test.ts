import { describe, expect, test } from "@jest/globals";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";

describe("computeCriterionConfidence — proseControl certification regression", () => {
  test("Fixture B (Cartel Babies) — verbatim anchors + craft-mechanism rationale produce moderate-or-better confidence and a scorable status", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 8,
      final_rationale:
        "Line-level control is consistently tight and image-driven, evidenced by crisp verbs and tactile detail; that matters because clarity and rhythm carry high-threat scenes.",
      evidence: [
        { snippet: "I put the SUV into park. Shut off the engine. Pocketed my keys." },
        {
          snippet:
            "The leather was warm, nearly sticky. Sweat gathered in the bend of my elbows",
        },
        { snippet: "The blue bead flashed once before it disappeared." },
      ],
      recommendations: [
        {
          action:
            "Tighten repeated sentence-starters across Chapter 1 by trimming a few instances of \"Then/Not/And\" that double the beat already implied by syntax.",
          anchor_snippet:
            "\"Then why am I checking the rearview…\" / \"Not this time.\"",
        },
      ],
    });

    expect(result.confidence_level).not.toBe("low");
    expect(result.scorability_status).toBe("scorable");
  });

  test("Fixture A (Froggin Noggin) — non-regression: passing case continues to score as scorable", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 6,
      final_rationale:
        "Both passes register vivid, sensory prose with occasional register clashes and density; targeted line edits will align diction to POV and reduce overexplication.",
      evidence: [
        { snippet: "As he stared at the burning ember, he said, \"Ya mean the undead?\"" },
        { snippet: "He legs stared shaking, and he wasn't sure if it was due to fear" },
        { snippet: "Yep, it's a retardation-fest out there." },
      ],
      recommendations: [
        {
          action:
            "Replace abstract or meteorological imagery in close POV with specific sensory beats tied to the character.",
          anchor_snippet: "A dull fog replaced the cumulus puffballs.",
        },
        {
          action: "Cut expository parentheticals from dialogue and shift necessary facts into adjacent narration.",
        },
        {
          action: "Normalize slang intensity per scene so colloquial spikes don't overshadow meaning.",
        },
      ],
    });

    expect(result.scorability_status).toBe("scorable");
    expect(result.confidence_level).not.toBe("low");
  });

  test("Fixture C (legacy meta-commentary leak) — old-style critic-as-anchor still scores as scorable for backward compatibility", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 6,
      final_rationale:
        "Line work is generally clear and image-forward but occasionally abstract or over-specified relative to POV register.",
      evidence: [
        {
          snippet:
            "Line work is generally clear and image-forward but occasionally abstract or over-specified",
        },
        {
          snippet:
            "Replace an abstract causative phrase with a concrete, active-voice image",
        },
        {
          snippet: "appears duplicated, suggesting drafting residue",
        },
      ],
      recommendations: [
        {
          action:
            "Replace abstract causative phrasing with concrete active-voice imagery for stronger reader specificity.",
        },
      ],
    });

    expect(result.scorability_status).toBe("scorable");
  });

  test("Fixture D — empty rationale and no recommendations stays blocked (non_scorable or low confidence)", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: null,
      final_rationale: "",
      evidence: [],
      recommendations: [],
    });

    expect(result.scorability_status).toBe("non_scorable");
    expect(result.confidence_level).toBe("low");
  });

  test("rationale-based criterion-specific check fires when anchor text is purely verbatim manuscript (no craft vocabulary in snippet)", () => {
    const verbatimOnly = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 7,
      final_rationale:
        "Crisp verbs and tactile imagery establish a tight rhythm that controls the scene's pressure.",
      evidence: [
        { snippet: "I put the SUV into park. Shut off the engine. Pocketed my keys." },
        { snippet: "The blue bead flashed once before it disappeared." },
        { snippet: "Heat tasted of diesel—a film on the teeth." },
      ],
      recommendations: [
        {
          action: "Trim repeated sentence-starters that double the implicit beat already carried by syntax.",
        },
      ],
    });

    expect(verbatimOnly.confidence_reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Rationale or recommendations name a craft mechanism/i),
      ]),
    );
    expect(verbatimOnly.confidence_reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/verbatim manuscript sentences/i),
      ]),
    );
    expect(verbatimOnly.scorability_status).toBe("scorable");
  });
});
