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
    mechanism: "the current phrasing diffuses tension before the decision point",
    specific_fix: "replace the abstract reaction line with a concrete bodily beat",
    reader_effect: "clearer cause-and-effect chain, increasing urgency and emotional clarity at the turn",
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

describe("qualityGate recommendation_editorial_quality", () => {
  it("passes when recommendations include mechanism, fix, reader effect, and anchor context", () => {
    const result = runQualityGate(makeSynthesis());
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
  });

  it("warns (does not block) generic feedback recommendations when isolated", () => {
    const synthesis = makeSynthesis({
      concept: {
        recommendations: [
          {
            ...makeRecommendation("concept"),
            action: "This section should be stronger overall to improve quality across the chapter.",
            expected_impact: "Makes it better.",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
    expect(check?.details).toContain("WARN");
    expect(result.pass).toBe(true);
    expect(result.editorial_diagnostics?.[0]?.action_applied).toBe("warn");
  });

  it("warns when mechanism or cause is missing in an isolated recommendation", () => {
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
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
    expect(result.pass).toBe(true);
    expect(result.editorial_diagnostics?.find((d) => d.criterion === "dialogue")?.action_applied).toBe("warn");
  });

  it("does not warn when specific_fix field provides a concrete move", () => {
    const synthesis = makeSynthesis({
      pacing: {
        recommendations: [
          {
            ...makeRecommendation("pacing"),
            action:
              "The opening paragraph feels diffuse because the tension signal arrives late, which causes the stakes to blur for pacing.",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
    expect(result.pass).toBe(true);
    expect(result.editorial_diagnostics?.find((d) => d.criterion === "pacing")?.action_applied).toBeUndefined();
  });

  it("does not warn when reader_effect field provides reader-facing outcome", () => {
    const synthesis = makeSynthesis({
      voice: {
        recommendations: [
          {
            ...makeRecommendation("voice"),
            expected_impact: "Improves this section and tightens execution across the draft.",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
    expect(result.pass).toBe(true);
    expect(result.editorial_diagnostics?.find((d) => d.criterion === "voice")?.action_applied).toBeUndefined();
  });

  it("passes borderline recommendation when mechanism is expressed in expected impact", () => {
    const synthesis = makeSynthesis({
      sceneConstruction: {
        recommendations: [
          {
            ...makeRecommendation("sceneConstruction"),
            action:
              "In the midpoint scene for sceneConstruction, reframe the reaction beat to foreground the decision trigger before the pivot moment.",
            expected_impact:
              "Gives readers clearer causal flow, which helps preserve momentum and coherence through the turn.",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
  });

  it("accepts context-anchored editorial quality signals even when anchor_snippet is absent", () => {
    const synthesis = makeSynthesis({
      concept: {
        recommendations: [
          {
            ...makeRecommendation("concept"),
            action:
              "In the second paragraph of the opening scene for concept, replace the abstract reveal line with a concrete image because the current ordering diffuses stakes before the turn.",
            expected_impact:
              "Gives the reader a clearer escalation path and stronger comprehension of consequence at the pivot.",
            anchor_snippet: "",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const editorialCheck = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");
    const genericRecCheck = result.checks.find((c) => c.check_id === "no_generic_recs");

    expect(editorialCheck?.passed).toBe(true);
    expect(genericRecCheck?.passed).toBe(false);
    expect(genericRecCheck?.error_code).toBe("QG_GENERIC_REC");
  });

  it("warns duplicate editorial reasoning when issue is isolated", () => {
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
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
    expect(check?.details).toContain("WARN");
    expect(check?.details).toContain("duplicate editorial reasoning");
    // Overall result still fails because the separate no_duplicate_recs gate blocks exact duplicate actions.
    expect(result.pass).toBe(false);
  });

  it("blocks when editorial recommendation degradation is systemic", () => {
    const systemic = makeSynthesis({
      concept: { recommendations: [{ ...makeRecommendation("concept"), action: "Make this better.", expected_impact: "Improve it." }] },
      narrativeDrive: { recommendations: [{ ...makeRecommendation("narrativeDrive"), action: "Improve narrative flow.", expected_impact: "Better pacing." }] },
      character: { recommendations: [{ ...makeRecommendation("character"), action: "Enhance character depth.", expected_impact: "More emotion." }] },
      voice: { recommendations: [{ ...makeRecommendation("voice"), action: "Strengthen voice quality.", expected_impact: "Sharper writing." }] },
      sceneConstruction: { recommendations: [{ ...makeRecommendation("sceneConstruction"), action: "Refine scene work.", expected_impact: "Better scenes." }] },
      dialogue: { recommendations: [{ ...makeRecommendation("dialogue"), action: "Improve dialogue quality.", expected_impact: "Cleaner dialogue." }] },
      theme: { recommendations: [{ ...makeRecommendation("theme"), action: "Develop themes more.", expected_impact: "Stronger themes." }] },
    });

    const result = runQualityGate(systemic);
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(false);
    expect(check?.error_code).toBe("QG_EDITORIAL_GENERIC_FEEDBACK");
    expect(check?.details).toContain("BLOCK");
    expect(result.pass).toBe(false);
    expect(result.editorial_diagnostics?.every((d) => d.action_applied === "block")).toBe(true);
  });

  it("passes former #359 failing rhetorical openings once repaired for mechanism+fix contract", () => {
    const synthesis = makeSynthesis({
      dialogue: {
        recommendations: [
          {
            ...makeRecommendation("dialogue"),
            action:
              "replace one expository exchange with two short turns plus an interruption beat; instead of resolving the moment in exposition, anchor speaker pressure because attribution blur reduces tension.",
            expected_impact:
              "Gives the reader clearer speaker intent and stronger tension progression through the exchange.",
          },
        ],
      },
      pacing: {
        recommendations: [
          {
            ...makeRecommendation("pacing"),
            action:
              "cut one reflective sentence and insert one immediate external trigger because momentum stalls when reflection resolves before consequence.",
            expected_impact:
              "Gives the reader stronger forward momentum and clearer consequence timing.",
          },
        ],
      },
      proseControl: {
        recommendations: [
          {
            ...makeRecommendation("proseControl"),
            action:
              "rewrite one abstract sentence as a concrete sensory-action line because abstraction diffuses line-level consequence.",
            expected_impact:
              "Gives the reader sharper clarity and stronger emotional engagement at sentence level.",
          },
        ],
      },
    });

    const result = runQualityGate(synthesis);
    const check = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");

    expect(check?.passed).toBe(true);
    expect(check?.error_code).toBeUndefined();
  });
});
