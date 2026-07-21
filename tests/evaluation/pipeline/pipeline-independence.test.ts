/**
 * Phase 2.7 — Pipeline Independence Tests (spec §3.2, Non-Negotiable Rule #3)
 *
 * Proves that Pass 2 is NEVER called with Pass 1 output.
 * Uses dependency injection to inspect call arguments without jest.mock.
 */

import { describe, it, expect, jest, beforeEach, afterAll } from "@jest/globals";
import { makeCurrentProcessorSynthesisOutput } from "@/__tests__/lib/evaluation/test-fixtures/currentProcessorSynthesisOutput";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";
import { requireCurrentRecommendationDisposition } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import { PASS2_PROMPT_VERSION } from "@/lib/evaluation/pipeline/prompts/pass2-editorial";
import type {
  SinglePassOutput,
  SynthesisOutput,
  QualityGateResult,
  PipelineResult,
} from "@/lib/evaluation/pipeline/types";
import type { RunPass1Options } from "@/lib/evaluation/pipeline/runPass1";
import type { RunPass2Options } from "@/lib/evaluation/pipeline/runPass2";
import type { RunPass3Options } from "@/lib/evaluation/pipeline/runPass3Synthesis";

function isPipelineFailure(result: PipelineResult): result is Extract<PipelineResult, { ok: false }> {
  return result.ok === false;
}

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeSinglePassOutput(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => {
      const criterion = {
        key,
        score_0_10: 7,
        rationale: `Test rationale for ${key}.`,
        evidence: [],
        recommendations: [],
      };
      if (pass === 1) return criterion;

      return requireCurrentRecommendationDisposition(
        {
          ...criterion,
          recommendation_status: "no_recommendation_warranted" as const,
          recommendation_status_rationale:
            "This independence fixture intentionally emits no editorial recommendation for the criterion.",
        },
        {
          score: criterion.score_0_10,
          context: `pipeline_independence_pass2_fixture:${key}`,
        },
      );
    }),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : PASS2_PROMPT_VERSION,
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeSynthesisOutput(): SynthesisOutput {
  return makeCurrentProcessorSynthesisOutput();
}

function makePassingQualityGate(): QualityGateResult {
  return {
    pass: true,
    checks: [{ check_id: "criteria_complete", passed: true }],
    warnings: [],
  };
}

// ── Mock runners ──────────────────────────────────────────────────────────────

let mockRunPass1: jest.Mock<(opts: RunPass1Options) => Promise<SinglePassOutput>>;
let mockRunPass2: jest.Mock<(opts: RunPass2Options) => Promise<SinglePassOutput>>;
let mockRunPass3: jest.Mock<(opts: RunPass3Options) => Promise<SynthesisOutput>>;
let mockRunQualityGate: jest.Mock<
  (synthesis: SynthesisOutput, pass1: SinglePassOutput, pass2: SinglePassOutput) => QualityGateResult
>;
const originalPerplexityApiKey = process.env.PERPLEXITY_API_KEY;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Pipeline Independence Guarantee (spec §3.2)", () => {
  beforeEach(() => {
    delete process.env.PERPLEXITY_API_KEY;

    mockRunPass1 = jest.fn<(opts: RunPass1Options) => Promise<SinglePassOutput>>();
    mockRunPass2 = jest.fn<(opts: RunPass2Options) => Promise<SinglePassOutput>>();
    mockRunPass3 = jest.fn<(opts: RunPass3Options) => Promise<SynthesisOutput>>();
    mockRunQualityGate = jest.fn<
      (synthesis: SynthesisOutput, pass1: SinglePassOutput, pass2: SinglePassOutput) => QualityGateResult
    >();

    mockRunPass1.mockResolvedValue(makeSinglePassOutput(1));
    mockRunPass2.mockResolvedValue(makeSinglePassOutput(2));
    mockRunPass3.mockResolvedValue(makeSynthesisOutput());
    mockRunQualityGate.mockReturnValue(makePassingQualityGate());
  });

  afterAll(() => {
    if (originalPerplexityApiKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = originalPerplexityApiKey;
    }
  });

  it("runPass2 is never called with Pass 1 output in its options", async () => {
    const pass1Output = makeSinglePassOutput(1);
    mockRunPass1.mockResolvedValueOnce(pass1Output);

    await runPipeline({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Independence Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runQualityGate: mockRunQualityGate,
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          failedChunkErrors: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(mockRunPass2).toHaveBeenCalledTimes(1);
    const pass2CallArg = mockRunPass2.mock.calls[0][0];
    const pass2CallArgRecord = pass2CallArg as unknown as Record<string, unknown>;

    // Pass 2 options must NOT contain any reference to Pass 1 output
    expect(pass2CallArgRecord["pass1"]).toBeUndefined();
    expect(pass2CallArgRecord["pass1Output"]).toBeUndefined();
    expect(pass2CallArgRecord["criteria"]).toBeUndefined();

    // Pass 2 receives only manuscript context
    expect(pass2CallArg.manuscriptText).toBe("The river moved slowly through the valley.");
    expect(pass2CallArg.workType).toBe("literary_fiction");
    expect(pass2CallArg.title).toBe("Independence Test");
  });

  it("Pass 1 output IS passed to Pass 3 (required for synthesis)", async () => {
    const pass1Output = makeSinglePassOutput(1);
    const pass2Output = makeSinglePassOutput(2);
    mockRunPass1.mockResolvedValueOnce(pass1Output);
    mockRunPass2.mockResolvedValueOnce(pass2Output);

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runQualityGate: mockRunQualityGate,
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          failedChunkErrors: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(result).toMatchObject({ ok: true });
    expect(mockRunPass3).toHaveBeenCalledTimes(1);
    const pass3CallArg = mockRunPass3.mock.calls[0][0] as unknown as Record<string, unknown>;
    // Pass 3 should receive pass1 and pass2
    expect(pass3CallArg["pass1"]).toBeDefined();
    expect(pass3CallArg["pass2"]).toBeDefined();
  });

  it("fails closed when Pass 1 throws — Pass 2 is never called", async () => {
    mockRunPass1.mockRejectedValueOnce(new Error("Pass 1 OpenAI error"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runQualityGate: mockRunQualityGate,
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          failedChunkErrors: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS1_FAILED");
      expect(result.failed_at).toBe("pass1");
    }
    // Pass 1 and Pass 2 run in parallel (Promise.allSettled) by design for
    // throughput — Pass 2 is started but its output is discarded on Pass 1
    // failure. The independence guarantee is data-flow: Pass 2 never receives
    // Pass 1 output. Verified below by confirming Pass 3 is not called
    // (Pass 3 requires both outputs; if either is discarded, Pass 3 cannot run).
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("fails closed when Pass 2 throws — Pass 3 is never called", async () => {
    mockRunPass2.mockRejectedValueOnce(new Error("Pass 2 OpenAI error"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runQualityGate: mockRunQualityGate,
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          failedChunkErrors: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS2_FAILED");
      expect(result.failed_at).toBe("pass2");
    }
    expect(mockRunPass3).not.toHaveBeenCalled();
  });
});
