import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

export {};

function makePass(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "o3",
    prompt_version: "test",
    temperature: 0.2,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale:
        pass === 1
          ? `Pass 1 rationale for ${key} highlights structural pressure and chapter-level movement with specific manuscript grounding.`
          : `Pass 2 rationale for ${key} highlights interpretive consequences and reader-facing impact with specific manuscript grounding.`,
      evidence: [
        {
          snippet:
            pass === 1
              ? `Pass 1 evidence for ${key}: The river bucked against the hull while Cliff recalculated his route.`
              : `Pass 2 evidence for ${key}: The narrator's restraint turns observation into consequential tension.`,
        },
      ],
      recommendations: [
        {
          priority: "medium",
          action:
            pass === 1
              ? `Strengthen ${key} by adding one earlier pressure cue that foreshadows later decisions in the chapter arc.`
              : `Strengthen ${key} by clarifying how the reflective beat changes the reader's interpretation of risk.`,
          expected_impact:
            "Improves coherence and makes criterion-level consequences legible without flattening voice.",
          anchor_snippet:
            pass === 1
              ? "The river bucked against the hull while Cliff recalculated his route."
              : "The narrator's restraint turns observation into consequential tension.",
        },
      ],
    })),
  };
}

describe("Pass 3 backfill quality", () => {
  test("backfills rationale/evidence/recommendations when synthesis output is under-covered", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "concept",
          craft_score: 6,
          editorial_score: 8,
          final_score_0_10: 7,
          final_rationale: "Neither pass supplied a focused appraisal.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");
    const concept = parsed.criteria.find((c) => c.key === "concept");

    expect(concept).toBeDefined();
    expect(concept!.final_rationale.toLowerCase()).not.toContain("neither pass supplied");
    expect(concept!.final_rationale.length).toBeGreaterThanOrEqual(40);
    expect(concept!.evidence.length).toBeGreaterThan(0);
    expect(concept!.recommendations.length).toBeGreaterThan(0);
    expect(concept!.recommendations[0].source_pass).toBe(1);
  });
});
