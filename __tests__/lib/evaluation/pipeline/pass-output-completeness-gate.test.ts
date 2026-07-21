/**
 * Regression tests for Pass Output Completeness Gate (SIPOC dual-checkpoint enforcement).
 * Validates that incomplete/dirty data from Pass 1, Pass 2, or Pass 3 is detected
 * and blocked before flowing downstream.
 */

import {
  validatePass1OutputCompleteness,
  validatePass2OutputCompleteness,
  validatePass3OutputCompleteness,
} from "@/lib/evaluation/pipeline/passOutputCompletenessGate";
import type { SinglePassOutput, SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

// ── Test Helpers ─────────────────────────────────────────────────────────────

function buildValidPass1Output(): SinglePassOutput {
  return {
    pass: 1,
    axis: "craft_execution",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: "This criterion demonstrates competent execution with room for improvement in several areas that could elevate the work.",
      evidence: [{ snippet: "Newton limped home, hungry and scared.", char_start: 100, char_end: 140 }],
      recommendations: [],
    })),
    model: "gpt-4.1",
    prompt_version: "v1.0",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function buildValidPass2Output(): SinglePassOutput {
  return {
    pass: 2,
    axis: "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 6,
      rationale: "The editorial dimension of this criterion shows moderate strength with identifiable areas for focused revision.",
      evidence: [{ snippet: "The old tree groaned in the wind as shadows lengthened.", char_start: 200, char_end: 260 }],
      recommendations: [
        {
          priority: "high" as const,
          action: "Replace the passive construction with an active voice sentence that grounds the reader in the POV character's sensory experience.",
          expected_impact: "Reader engagement improves because the prose delivers information through character perception rather than authorial summary.",
          anchor_snippet: "The old tree groaned in the wind as shadows lengthened.",
          issue_family: "scene_structure" as any,
          strategic_lever: "scene_goal_clarity" as any,
          revision_granularity: "scene" as any,
        },
      ],
    })),
    model: "gpt-4.1",
    prompt_version: "v1.0",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function buildValidPass3Output(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      score_delta: 1,
      final_rationale: "The synthesis of structural and editorial analyses reveals competent execution with clear opportunities for targeted improvement.",
      pressure_points: ["tension accumulates at the midpoint"],
      decision_points: ["character chooses to confront"],
      consequence_status: "landed" as const,
      evidence: [{ snippet: "Newton limped home, hungry and scared.", char_start: 100, char_end: 140 }],
      recommendations: [
        {
          priority: "high" as const,
          action: "Replace the passive construction with an active verb anchored in the POV character's sensory experience.",
          expected_impact: "Reader immersion deepens because the prose renders through character perception.",
          anchor_snippet: "Newton limped home, hungry and scared.",
          source_pass: 3 as const,
          issue_family: "scene_structure" as any,
          strategic_lever: "scene_goal_clarity" as any,
          revision_granularity: "scene" as any,
          mechanism: "the passive phrasing diffuses urgency before the decision point",
          specific_fix: "replace 'was seen' with 'Newton spotted' to anchor in POV",
          reader_effect: "reader tracks stakes more clearly through character perception",
          symptom: "passive voice distances reader from character experience",
        },
      ],
    })) as SynthesizedCriterion[],
    overall: {
      overall_score_0_100: 68,
      verdict: "revise",
      one_paragraph_summary: "This manuscript demonstrates promising narrative voice and character development but requires focused revision in scene construction and pacing to reach submission readiness.",
      top_3_strengths: ["Strong character voice", "Compelling premise", "Good dialogue rhythm"],
      top_3_risks: ["Pacing inconsistency", "Scene transitions", "Underdeveloped subplots"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4.1",
      pass2_model: "gpt-4.1",
      pass3_model: "gpt-4.1",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

// ── Pass 1 Tests ─────────────────────────────────────────────────────────────

describe("validatePass1OutputCompleteness", () => {
  it("passes with complete data", () => {
    const result = validatePass1OutputCompleteness(buildValidPass1Output());
    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
  });

  it("fails critically when a criterion has null score", () => {
    const pass1 = buildValidPass1Output();
    (pass1.criteria[0] as any).score_0_10 = null;
    const result = validatePass1OutputCompleteness(pass1);
    expect(result.ok).toBe(false);
    expect(result.criticalCount).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.code === "MISSING_SCORE")).toBe(true);
  });

  it("fails critically when a criterion has out-of-range score", () => {
    const pass1 = buildValidPass1Output();
    pass1.criteria[0].score_0_10 = 15;
    const result = validatePass1OutputCompleteness(pass1);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.code === "SCORE_OUT_OF_RANGE")).toBe(true);
  });

  it("fails critically when a criterion is entirely missing", () => {
    const pass1 = buildValidPass1Output();
    pass1.criteria = pass1.criteria.slice(0, 5); // Only 5 of 13
    const result = validatePass1OutputCompleteness(pass1);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.code === "MISSING_CRITERION")).toBe(true);
    expect(result.criticalCount).toBe(CRITERIA_KEYS.length - 5);
  });

  it("warns (non-critical) when rationale is empty", () => {
    const pass1 = buildValidPass1Output();
    pass1.criteria[0].rationale = "";
    const result = validatePass1OutputCompleteness(pass1);
    // Should still pass (warnings only)
    expect(result.ok).toBe(true);
    expect(result.violations.some((v) => v.code === "EMPTY_RATIONALE")).toBe(true);
    expect(result.violations.find((v) => v.code === "EMPTY_RATIONALE")?.severity).toBe("warning");
  });

  it("warns when evidence is empty", () => {
    const pass1 = buildValidPass1Output();
    pass1.criteria[0].evidence = [];
    const result = validatePass1OutputCompleteness(pass1);
    expect(result.ok).toBe(true); // Non-critical
    expect(result.violations.some((v) => v.code === "NO_EVIDENCE")).toBe(true);
  });
});

// ── Pass 2 Tests ─────────────────────────────────────────────────────────────

describe("validatePass2OutputCompleteness", () => {
  it("passes with complete data", () => {
    const result = validatePass2OutputCompleteness(buildValidPass2Output());
    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
  });

  it("fails critically when score is missing", () => {
    const pass2 = buildValidPass2Output();
    (pass2.criteria[0] as any).score_0_10 = null;
    const result = validatePass2OutputCompleteness(pass2);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.code === "MISSING_SCORE")).toBe(true);
  });

  it("does not infer editorial meaning from an empty recommendation collection", () => {
    const pass2 = buildValidPass2Output();
    pass2.criteria[0].recommendations = [];
    const result = validatePass2OutputCompleteness(pass2);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("warns when recommendation action is too short", () => {
    const pass2 = buildValidPass2Output();
    pass2.criteria[0].recommendations[0].action = "Fix it";
    const result = validatePass2OutputCompleteness(pass2);
    expect(result.ok).toBe(true); // Non-critical
    expect(result.violations.some((v) => v.code === "EMPTY_RECOMMENDATION_ACTION")).toBe(true);
  });

  it("warns when recommendation has no anchor_snippet", () => {
    const pass2 = buildValidPass2Output();
    pass2.criteria[0].recommendations[0].anchor_snippet = "";
    const result = validatePass2OutputCompleteness(pass2);
    expect(result.ok).toBe(true); // Non-critical
    expect(result.violations.some((v) => v.code === "MISSING_ANCHOR_SNIPPET")).toBe(true);
  });

  it("fails critically when multiple criteria missing", () => {
    const pass2 = buildValidPass2Output();
    pass2.criteria = pass2.criteria.slice(0, 3);
    const result = validatePass2OutputCompleteness(pass2);
    expect(result.ok).toBe(false);
    expect(result.criticalCount).toBe(CRITERIA_KEYS.length - 3);
  });
});

// ── Pass 3 Tests ─────────────────────────────────────────────────────────────

describe("validatePass3OutputCompleteness", () => {
  it("passes with complete synthesis data", () => {
    const result = validatePass3OutputCompleteness(buildValidPass3Output());
    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
  });

  it("fails critically when final_score_0_10 is missing", () => {
    const pass3 = buildValidPass3Output();
    (pass3.criteria[0] as any).final_score_0_10 = null;
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.code === "MISSING_SCORE")).toBe(true);
  });

  it("fails critically when final_score_0_10 out of range", () => {
    const pass3 = buildValidPass3Output();
    (pass3.criteria[0] as any).final_score_0_10 = 0;
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.code === "SCORE_OUT_OF_RANGE")).toBe(true);
  });

  it("fails critically when criterion missing from synthesis", () => {
    const pass3 = buildValidPass3Output();
    pass3.criteria = pass3.criteria.slice(0, 8);
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(false);
    expect(result.criticalCount).toBe(CRITERIA_KEYS.length - 8);
  });

  it("warns when final_rationale is empty", () => {
    const pass3 = buildValidPass3Output();
    (pass3.criteria[0] as any).final_rationale = "";
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(true); // Non-critical
    expect(result.violations.some((v) => v.code === "EMPTY_RATIONALE")).toBe(true);
  });

  it("does not use score as authority for an empty recommendation collection", () => {
    const pass3 = buildValidPass3Output();
    pass3.criteria[0].recommendations = [];
    (pass3.criteria[0] as any).final_score_0_10 = 5;
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(true);
    expect(result.violations.some((v) => v.criterion_key === pass3.criteria[0].key)).toBe(false);
  });

  it("does NOT warn about missing recommendations for high-scoring criterion (9-10)", () => {
    const pass3 = buildValidPass3Output();
    pass3.criteria[0].recommendations = [];
    (pass3.criteria[0] as any).final_score_0_10 = 9;
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(true);
    expect(result.violations.some((v) => v.code === "NO_RECOMMENDATIONS" && v.criterion_key === pass3.criteria[0].key)).toBe(false);
  });

  it("warns when overall summary is missing", () => {
    const pass3 = buildValidPass3Output();
    pass3.overall.one_paragraph_summary = "";
    const result = validatePass3OutputCompleteness(pass3);
    expect(result.ok).toBe(true); // Non-critical
    expect(result.violations.some((v) => v.criterion_key === "overall")).toBe(true);
  });
});
