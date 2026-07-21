import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { dedupeRecommendationsPreGate } from "@/lib/evaluation/pipeline/runPipeline";
import type { SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";

function makeRecommendation(key: CriterionKey, action: string, anchor: string) {
  return {
    priority: "medium" as const,
    action,
    expected_impact: `Expected impact for ${key}`,
    anchor_snippet: anchor,
    source_pass: 3 as const,
    issue_family: "scene_structure" as const,
    strategic_lever: "scene_goal_clarity" as const,
    revision_granularity: "scene" as const,
    mechanism: "",
    specific_fix: "",
    reader_effect: "",
    symptom: `Symptom for ${key}`,
  };
}

function makeCriterion(key: CriterionKey, recommendation: ReturnType<typeof makeRecommendation>): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: `Rationale for ${key} with sufficient detail for synthesis shape completeness.`,
    pressure_points: ["Pressure point"],
    decision_points: ["Decision point"],
    consequence_status: "landed",
    evidence: [{ snippet: `Evidence snippet for ${key}` }],
    recommendations: [recommendation],
    recommendation_status: "recommendation_provided",
  };
}

function makeSynthesis(overrides: Partial<Record<CriterionKey, ReturnType<typeof makeRecommendation>>> = {}): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) =>
      makeCriterion(
        key,
        overrides[key] ??
          makeRecommendation(
            key,
            `Unique recommendation action for ${key} to ensure baseline non-duplication across criteria.`,
            `Anchor snippet for ${key}`,
          ),
      ),
    ),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "Summary",
      top_3_strengths: ["a", "b", "c"],
      top_3_risks: ["x", "y", "z"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

describe("dedupeRecommendationsPreGate", () => {
  it("collapses duplicate actions and preserves merged provenance/context", () => {
    const duplicateAction =
      "Replace the abstract reaction line with a concrete bodily beat before the decision point to preserve scene tension and consequence flow.";

    const synthesis = makeSynthesis({
      concept: {
        ...makeRecommendation("concept", duplicateAction, "Concept anchor excerpt"),
        mechanism: "",
        specific_fix: "",
        reader_effect: "",
      },
      pacing: {
        ...makeRecommendation("pacing", duplicateAction, "Pacing anchor excerpt"),
        mechanism: "Pacing mechanism from duplicate",
        specific_fix: "Specific fix from duplicate",
        reader_effect: "Reader effect from duplicate",
      },
    });

    const result = dedupeRecommendationsPreGate(synthesis);

    expect(result.removedCount).toBe(1);

    const conceptRec = result.synthesis.criteria.find((c) => c.key === "concept")?.recommendations[0];
    const pacingRecs = result.synthesis.criteria.find((c) => c.key === "pacing")?.recommendations ?? [];

    expect(conceptRec).toBeDefined();
    expect(pacingRecs).toHaveLength(0);
    expect(result.synthesis.criteria.find((c) => c.key === "concept")?.recommendation_status)
      .toBe("recommendation_provided");
    expect(result.synthesis.criteria.find((c) => c.key === "pacing")?.recommendation_status)
      .toBe("no_recommendation_warranted");

    expect(conceptRec?.collapsed_from_criteria).toContain("pacing");
    expect(conceptRec?.anchor_snippet).toContain("Concept anchor excerpt");
    expect(conceptRec?.anchor_snippet).toContain("Pacing anchor excerpt");
    expect(conceptRec?.mechanism).toBe("Pacing mechanism from duplicate");
    expect(conceptRec?.specific_fix).toBe("Specific fix from duplicate");
    expect(conceptRec?.reader_effect).toBe("Reader effect from duplicate");
  });

  it("is idempotent on already-deduped synthesis", () => {
    const synthesis = makeSynthesis();
    const first = dedupeRecommendationsPreGate(synthesis);
    const second = dedupeRecommendationsPreGate(first.synthesis);

    expect(first.removedCount).toBe(0);
    expect(second.removedCount).toBe(0);
  });

  it("dedupes equivalent actions when one includes anchored lead-in boilerplate", () => {
    const baseAction =
      "replace one abstract reaction line with a concrete decision beat before the consequence turn.";
    const leadInAction =
      `In the section where "Chapter 9 — The Bell", ${baseAction}`;

    const synthesis = makeSynthesis({
      concept: makeRecommendation("concept", leadInAction, "Concept anchor excerpt"),
      pacing: makeRecommendation("pacing", baseAction, "Pacing anchor excerpt"),
    });

    const result = dedupeRecommendationsPreGate(synthesis);
    expect(result.removedCount).toBe(1);

    const conceptRec = result.synthesis.criteria.find((c) => c.key === "concept")?.recommendations ?? [];
    const pacingRec = result.synthesis.criteria.find((c) => c.key === "pacing")?.recommendations ?? [];

    expect(conceptRec.length + pacingRec.length).toBe(1);
  });
});
