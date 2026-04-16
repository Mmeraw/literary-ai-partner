import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import type { SinglePassOutput, SynthesisOutput } from "@/lib/evaluation/pipeline/types";
import { ACTIVE_RULES, deriveLessonsLearnedEnforcementDecision, evaluateLessonsLearnedRules } from "@/lib/governance/lessonsLearned";
import type { RuleEvaluationInput } from "@/lib/governance/lessonsLearned";

function makePassOutput(pass: 1 | 2, rationaleText: string): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `${rationaleText} [${key}]`,
      evidence: [],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeGenericPassOutput(pass: 1 | 2, rationaleText: string): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: rationaleText,
      evidence: [],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeSynthesis(summary: string, strengths: string[], risks: string[]): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale: `${summary} [${key}]`,
      pressure_points: ["Narrative pressure accumulates around this criterion."],
      decision_points: ["The chapter commits to a clear direction for this criterion."],
      consequence_status: "landed" as const,
      evidence: [],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Address the ${key} dimension by grounding in specific textual evidence.`,
          expected_impact: "Increases specificity and reader connection.",
          anchor_snippet: '"test"',
          source_pass: 3 as const,
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: summary,
      top_3_strengths: strengths,
      top_3_risks: risks,
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

function makeGenericSynthesis(summary: string, strengths: string[], risks: string[]): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale: summary,
      pressure_points: ["Narrative pressure accumulates around this criterion."],
      decision_points: ["The chapter commits to a clear direction for this criterion."],
      consequence_status: "landed" as const,
      evidence: [],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Address the ${key} dimension by grounding in specific textual evidence.`,
          expected_impact: "Increases specificity and reader connection.",
          anchor_snippet: '"test"',
          source_pass: 3 as const,
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: summary,
      top_3_strengths: strengths,
      top_3_risks: risks,
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

function makeInput(overrides?: Partial<RuleEvaluationInput>): RuleEvaluationInput {
  const base: RuleEvaluationInput = {
    manuscript_id: "ms-001",
    execution_mode: "TRUSTED_PATH",
    structural_result: makePassOutput(1, "Criterion structure canon wave anchor"),
    diagnostic_result: makePassOutput(2, "Structure signal canon criterion"),
    convergence_result: makeSynthesis(
      "Canonical structure and wave-aligned synthesis with criterion anchor",
      ["Strong structure", "Clear criterion framing", "Wave-consistent escalation"],
      ["Pacing needs work", "Minor tone drift", "Closure clarity needed"],
    ),
    registry: loadCanonicalRegistry(),
    metadata: {
      trace_id: "trace-001",
      timestamp: new Date().toISOString(),
    },
  };

  return { ...base, ...overrides };
}

function ruleById(id: string) {
  const rule = ACTIVE_RULES.find((r) => r.rule_id === id);
  if (!rule) throw new Error(`Missing rule: ${id}`);
  return rule;
}

describe("Phase 0.2 lessons-learned rule engine", () => {
  it("registers all five mandatory active rules", () => {
    expect(ACTIVE_RULES.map((r) => r.rule_id)).toEqual([
      "LLR-001",
      "LLR-002",
      "LLR-003",
      "LLR-004",
      "LLR-005",
    ]);
  });

  it("LLR-001 fails multiplicity framing without boundary evidence", () => {
    const input = makeInput({
      structural_result: makeGenericPassOutput(1, "General feedback without specific support."),
      diagnostic_result: makeGenericPassOutput(2, "General readability notes only."),
      convergence_result: makeSynthesis(
        "The chapter has too many ideas and too many concepts across scenes.",
        ["Strong imagery"],
        ["Overloaded concept stack"],
      ),
    });

    const result = ruleById("LLR-001").predicate(input);
    expect(result.passed).toBe(false);
  });

  it("LLR-002 fails authority shift without marker/justification", () => {
    const input = makeInput({
      convergence_result: makeSynthesis(
        "POV shift occurs repeatedly with authority shift and voice shift.",
        ["Strong premise"],
        ["POV shift confusion"],
      ),
    });

    const result = ruleById("LLR-002").predicate(input);
    expect(result.passed).toBe(false);
  });

  it("LLR-003 fails contradictory framing without contextual differentiation", () => {
    const input = makeInput({
      convergence_result: makeSynthesis(
        "Clean summary with no contrast markers.",
        ["Strong pacing", "Controlled tone", "Clear closure"],
        ["Pacing collapse", "Tone inconsistency", "Closure unclear"],
      ),
    });

    const result = ruleById("LLR-003").predicate(input);
    expect(result.passed).toBe(false);
  });

  it("LLR-004 fails non-canonical terminology", () => {
    const input = makeInput({
      convergence_result: makeSynthesis(
        "This just gives vibes and feels off; generic writing advice applies.",
        ["Readable prose"],
        ["Vibes are inconsistent"],
      ),
    });

    const result = ruleById("LLR-004").predicate(input);
    expect(result.passed).toBe(false);
  });

  it("LLR-005 fails canon-free generic critique", () => {
    const genericPass = makeGenericPassOutput(1, "Good chapter with interesting writing and emotional impact.");
    const genericDiag = makeGenericPassOutput(2, "General readability notes and broad style comments.");
    const genericSynth = makeGenericSynthesis(
      "Readable chapter with broad strengths and broad weaknesses.",
      ["Engaging", "Readable", "Interesting"],
      ["Unclear", "Wordy", "Flat"],
    );

    const input = makeInput({
      structural_result: genericPass,
      diagnostic_result: genericDiag,
      convergence_result: genericSynth,
    });

    const result = ruleById("LLR-005").predicate(input);
    expect(result.passed).toBe(false);
  });

  it("evaluateLessonsLearnedRules blocks on ERROR failures", () => {
    const input = makeInput({
      convergence_result: makeSynthesis(
        "POV shift occurs repeatedly with authority shift and voice shift.",
        ["Strong pacing"],
        ["Pacing collapse"],
      ),
    });

    const report = evaluateLessonsLearnedRules(input, "pre_artifact_generation");
    const decision = deriveLessonsLearnedEnforcementDecision(report);

    expect(report.overall_pass).toBe(false);
    expect(decision.action).toBe("BLOCK");
  });

  it("evaluateLessonsLearnedRules passes for canon-anchored coherent output", () => {
    const input = makeInput();
    const report = evaluateLessonsLearnedRules(input, "pre_artifact_generation");
    const decision = deriveLessonsLearnedEnforcementDecision(report);

    expect(report.overall_pass).toBe(true);
    expect(decision.action).toBe("ALLOW");
  });
});
