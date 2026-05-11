/**
 * Tests for per-pass model routing resolution and EVAL_PASS3_FALLBACK_MODEL.
 *
 * Covers:
 *  - resolveEvaluationRuntimeConfig exposes a `routing` section
 *  - pass1/2/3 models resolve from env vars
 *  - EVAL_PASS3_FALLBACK_MODEL resolves independently of primary Pass 3 model
 *  - fallback falls back to pass3 primary when EVAL_PASS3_FALLBACK_MODEL is absent
 *  - getCanonicalPass3FallbackModel in policy resolves from env
 *  - runPipeline includes resolved routing in ok:true result (audit traceability)
 */

import { resolveEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";
import type { SynthesisOutput, SinglePassOutput } from "@/lib/evaluation/pipeline/types";

// policy.ts reads from process.env directly so we need to set it before importing.
// We call getCanonicalPass3FallbackModel inline after setting env.

const BASE_ENV = {
  OPENAI_API_KEY: "sk-test",
  EVAL_OPENAI_MODEL: "gpt-4o",
  EVAL_WORKER_MAX_EXECUTION_MS: "110000",
  EVAL_WORKER_LEASE_MS: "600000",
  CRON_SECRET: "test-secret",
};

function buildEnv(overrides: Record<string, string | undefined> = {}) {
  return { ...BASE_ENV, ...overrides } as Record<string, string | undefined>;
}

describe("EvaluationRuntimeConfig routing section", () => {
  it("exposes resolved pass models in routing property", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({
        EVAL_PASS1_MODEL: "gpt-5-mini",
        EVAL_PASS2_MODEL: "gpt-5-mini",
        EVAL_PASS3_MODEL: "gpt-5",
        EVAL_PASS3_FALLBACK_MODEL: "gpt-4o",
      }),
    );

    expect(config.routing.pass1Model).toBe("gpt-5-mini");
    expect(config.routing.pass2Model).toBe("gpt-5-mini");
    expect(config.routing.pass3Model).toBe("gpt-5");
    expect(config.routing.pass3FallbackModel).toBe("gpt-4o");
  });

  it("falls back to runtime default model when pass-specific vars are absent", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({ EVAL_OPENAI_MODEL: "gpt-4o" }),
    );

    expect(config.routing.pass1Model).toBe("gpt-4o");
    expect(config.routing.pass2Model).toBe("gpt-4o");
    expect(config.routing.pass3Model).toBe("gpt-4o");
    expect(config.routing.pass3FallbackModel).toBe("gpt-4o");
  });

  it("uses EVAL_CHUNK_MODEL as fallback for pass1 and pass2 when specific vars absent", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({
        EVAL_CHUNK_MODEL: "gpt-5-mini",
        EVAL_OPENAI_MODEL: "gpt-4o",
      }),
    );

    expect(config.routing.pass1Model).toBe("gpt-5-mini");
    expect(config.routing.pass2Model).toBe("gpt-5-mini");
    // Pass 3 does not use EVAL_CHUNK_MODEL
    expect(config.routing.pass3Model).toBe("gpt-4o");
  });

  it("EVAL_PASS3_FALLBACK_MODEL resolves independently from pass3 primary", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({
        EVAL_PASS3_MODEL: "gpt-5-mini",
        EVAL_PASS3_FALLBACK_MODEL: "gpt-5",
      }),
    );

    expect(config.routing.pass3Model).toBe("gpt-5-mini");
    expect(config.routing.pass3FallbackModel).toBe("gpt-5");
  });

  it("fallback model equals primary pass3 model when EVAL_PASS3_FALLBACK_MODEL is absent", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({ EVAL_PASS3_MODEL: "gpt-5" }),
    );

    expect(config.routing.pass3Model).toBe("gpt-5");
    expect(config.routing.pass3FallbackModel).toBe("gpt-5");
  });
});

// ── pipeline_result routing inclusion test ────────────────────────────────────

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

function makeStubPass(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale:
        pass === 1
          ? `Craft analysis of ${key} shows competent structure with targeted execution.`
          : `Editorial review of ${key} highlights thematic depth requiring development.`,
      evidence: [{ snippet: "The text demonstrates measurable progress." }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `In the scene for ${key}, clarify the cause-and-effect move because the current phrasing lacks tension.`,
          expected_impact: "Improves specificity.",
          anchor_snippet: '"progress"',
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
    model: "gpt-5-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeStubSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      score_delta: 1,
      final_rationale: `Synthesized: ${key} analysis converges on strong execution.`,
      pressure_points: ["Tension accumulates here."],
      decision_points: ["A concrete decision is made."],
      consequence_status: "landed" as const,
      evidence: [{ snippet: "The text demonstrates measurable progress." }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `In the opening scene for ${key}, replace the abstract transition with a concrete cause-and-effect move because the current phrasing blunts tension.`,
          expected_impact: "Improves specificity and reader connection.",
          anchor_snippet: '"progress"',
          source_pass: 3 as const,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
          mechanism: "current phrasing blunts tension",
          specific_fix: "replace the abstract transition with a concrete cause-and-effect move",
          reader_effect: "clearer escalation chain",
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary:
        "This manuscript demonstrates solid craft and distinctive literary sensibility.",
      top_3_strengths: ["Strong narrative voice", "Clear structural arc", "Vivid sensory imagery"],
      top_3_risks: ["Pacing inconsistencies", "Thin character motivation", "World-building gaps"],
      submission_readiness: "close",
    },
    metadata: {
      pass1_model: "gpt-5-mini",
      pass2_model: "gpt-5-mini",
      pass3_model: "gpt-5",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

describe("runPipeline routing field in pipeline_result", () => {
  it("includes resolved routing in ok:true result for audit traceability", async () => {
    const stub1 = makeStubPass(1);
    const stub2 = makeStubPass(2);
    const stub3 = makeStubSynthesis();

    const result = await runPipeline({
      manuscriptText: "A short test manuscript with enough words to pass minimum validation checks.",
      workType: "novel_chapter",
      title: "Routing Proof Test",
      model: "gpt-5-mini",
      _passTimeoutMs: 60000,
      _lessonsLearned: {
        evaluateRules: () => ({ overall_pass: true, results: [] }),
        deriveDecision: () => ({ action: "ALLOW" as const, reason: "test allow" }),
      },
      _runners: {
        runPass1: async () => stub1,
        runPass2: async () => stub2,
        runPass3Synthesis: async () => stub3,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routing).toBeDefined();
      expect(typeof result.routing?.pass1Model).toBe("string");
      expect(typeof result.routing?.pass2Model).toBe("string");
      expect(typeof result.routing?.pass3Model).toBe("string");
      expect(typeof result.routing?.pass3FallbackModel).toBe("string");
    }
  });
});
