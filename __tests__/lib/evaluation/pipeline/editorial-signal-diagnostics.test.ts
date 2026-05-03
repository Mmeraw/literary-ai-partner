import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import type { SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";

function makeRecommendation(key: CriterionKey) {
  return {
    priority: "medium" as const,
    action:
      `In the opening scene for ${key}, replace the abstract reaction line with a concrete bodily beat because the current phrasing diffuses tension before the decision point.`,
    expected_impact:
      "Gives the reader a clearer cause-and-effect chain, increasing urgency and emotional clarity at the turn.",
    anchor_snippet: `Anchor for ${key} in the opening exchange where tension should escalate.`,
    source_pass: 3 as const,
    issue_family: "scene_structure" as const,
    strategic_lever: "scene_goal_clarity" as const,
    revision_granularity: "scene" as const,
  };
}

function makeCriterion(
  key: CriterionKey,
  overrides: Partial<SynthesizedCriterion> = {},
): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale:
      `Criterion ${key} is supported by direct textual evidence and includes criterion-specific analysis to satisfy quality-gate rationale depth requirements.`,
    pressure_points: ["Pressure enters in the scene transition."],
    decision_points: ["A consequential choice is made at the turn."],
    consequence_status: "landed",
    evidence: [
      {
        snippet:
          `Evidence anchor for ${key} confirms the observed craft signal with sufficient textual detail.`,
      },
    ],
    recommendations: [makeRecommendation(key)],
    ...overrides,
  };
}

function makeSynthesis(overridesByKey: Partial<Record<CriterionKey, Partial<SynthesizedCriterion>>> = {}): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => makeCriterion(key, overridesByKey[key] ?? {})),
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary:
        "The manuscript has strong underlying material but needs targeted revision for cleaner scene-level consequence delivery.",
      top_3_strengths: ["voice", "character", "premise"],
      top_3_risks: ["pacing", "scene turns", "tension carryover"],
      submission_readiness: "close",
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

describe("editorial diagnostics (observer-only)", () => {
  it("keeps pass decision unchanged and emits non-blocking diagnostics for valid recommendations", () => {
    const result = runQualityGate(makeSynthesis());

    expect(result.pass).toBe(true);
    expect(result.editorial_diagnostics).toBeDefined();
    expect(result.editorial_diagnostics?.length).toBe(CRITERIA_KEYS.length);

    const blocked = (result.editorial_diagnostics ?? []).filter((d) => d.action_applied === "block");
    expect(blocked).toHaveLength(0);

    expect(result.editorial_diagnostics_summary).toBeDefined();
    expect(result.editorial_diagnostics_summary?.reportVersion).toBe(4);
    expect(result.editorial_diagnostics_summary?.total_diagnostics).toBe(CRITERIA_KEYS.length);
  });

  it("keeps fail decision unchanged and emits missing_mechanism diagnostics when mechanism is absent", () => {
    const synthesis = makeSynthesis({
      dialogue: {
        recommendations: [
          {
            ...makeRecommendation("dialogue"),
            action:
              "In the opening exchange, replace the abstract line with a concrete action beat at the same moment for dialogue.",
            expected_impact:
              "Gives the reader stronger urgency and engagement at the turn.",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const editorialCheck = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(result.pass).toBe(false);
    expect(editorialCheck?.error_code).toBe("QG_EDITORIAL_GENERIC_FEEDBACK");

    const dialogueDiagnostic = result.editorial_diagnostics?.find((d) => d.criterion === "dialogue");
    expect(dialogueDiagnostic).toBeDefined();
    expect(dialogueDiagnostic?.classification).toBe("missing_mechanism");
    expect(dialogueDiagnostic?.action_applied).toBe("block");
    expect(dialogueDiagnostic?.missing_fields).toContain("mechanism/cause");
    expect(dialogueDiagnostic?.gate_check_id).toBe("recommendation_editorial_quality");
  });

  it("emits duplicate_reasoning classification when reasoning repeats within a criterion", () => {
    const duplicateAction =
      "In the midpoint scene for concept, replace the abstract reaction sentence with a concrete sensory cue because the current phrasing blunts escalation.";
    const duplicateImpact =
      "Gives the reader clearer escalation logic, improving urgency and narrative momentum at the turn.";

    const synthesis = makeSynthesis({
      concept: {
        recommendations: [
          {
            ...makeRecommendation("concept"),
            action: duplicateAction,
            expected_impact: duplicateImpact,
          },
          {
            ...makeRecommendation("concept"),
            action: duplicateAction,
            expected_impact: duplicateImpact,
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const duplicateDiagnostic = result.editorial_diagnostics?.find(
      (d) => d.criterion === "concept" && d.classification === "duplicate_reasoning",
    );

    expect(result.pass).toBe(false);
    expect(duplicateDiagnostic).toBeDefined();
    expect(duplicateDiagnostic?.action_applied).toBe("block");
  });
});
