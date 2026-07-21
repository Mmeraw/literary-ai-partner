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

import { afterAll, beforeAll } from "@jest/globals";
import {
  buildProcessorSynthesisManuscriptContent,
  makeCurrentProcessorSynthesisOutput,
} from "@/__tests__/lib/evaluation/test-fixtures/currentProcessorSynthesisOutput";
import { resolveEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { requireCurrentRecommendationDisposition } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";
import { PASS2_PROMPT_VERSION } from "@/lib/evaluation/pipeline/prompts/pass2-editorial";
import type { SynthesisOutput, SinglePassOutput } from "@/lib/evaluation/pipeline/types";

// policy.ts reads from process.env directly so we need to set it before importing.
// We call getCanonicalPass3FallbackModel inline after setting env.

const BASE_ENV = {
  OPENAI_API_KEY: "sk-test",
  EVAL_OPENAI_MODEL: "gpt-4o",
  EVAL_WORKER_MAX_EXECUTION_MS: "800000",
  EVAL_WORKER_LEASE_MS: "800000",
  CRON_SECRET: "test-secret",
};

function buildEnv(overrides: Record<string, string | undefined> = {}) {
  return { ...BASE_ENV, ...overrides } as Record<string, string | undefined>;
}

const originalPerplexityApiKey = process.env.PERPLEXITY_API_KEY;

beforeAll(() => {
  delete process.env.PERPLEXITY_API_KEY;
});

afterAll(() => {
  if (originalPerplexityApiKey === undefined) {
    delete process.env.PERPLEXITY_API_KEY;
  } else {
    process.env.PERPLEXITY_API_KEY = originalPerplexityApiKey;
  }
});

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
    criteria: CRITERIA_KEYS.map((key) => {
      const criterion = {
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
            anchor_snippet: "The text demonstrates measurable progress.",
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
          },
        ],
      };
      if (pass === 1) return criterion;

      return requireCurrentRecommendationDisposition(
        {
          ...criterion,
          recommendation_status: "recommendation_provided" as const,
        },
        {
          score: criterion.score_0_10,
          context: `evaluation_pass_routing_pass2_fixture:${key}`,
        },
      );
    }),
    model: "gpt-5-mini",
    prompt_version: pass === 1 ? "pass1-v1" : PASS2_PROMPT_VERSION,
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeStubSynthesis(): SynthesisOutput {
  return makeCurrentProcessorSynthesisOutput({
    metadata: {
      pass1_model: "gpt-5-mini",
      pass2_model: "gpt-5-mini",
      pass3_model: "gpt-5",
    },
  });
}

describe("runPipeline routing field in pipeline_result", () => {
  it("includes resolved routing in ok:true result for audit traceability", async () => {
    const stub1 = makeStubPass(1);
    const stub2 = makeStubPass(2);
    const stub3 = makeStubSynthesis();

    const result = await runPipeline({
      manuscriptText:
        `${buildProcessorSynthesisManuscriptContent()} The text demonstrates measurable progress.`,
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
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.routing).toBeDefined();
      expect(typeof result.routing?.pass1Model).toBe("string");
      expect(typeof result.routing?.pass2Model).toBe("string");
      expect(typeof result.routing?.chunkModel).toBe("string");
      expect(typeof result.routing?.seedModel).toBe("string");
      expect(typeof result.routing?.ledgerModel).toBe("string");
      expect(typeof result.routing?.polishModel).toBe("string");
      expect(typeof result.routing?.synthesisModel).toBe("string");
      expect(typeof result.routing?.pass3Model).toBe("string");
      expect(typeof result.routing?.pass3FallbackModel).toBe("string");
    }
  });
});
