// @ts-nocheck

import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { runPipeline } from "../runPipeline";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

function makePassOutput(pass: 1 | 2, evaluatedChunks: number) {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `ok-${key}`,
      evidence: [{ snippet: `evidence-${key}` }],
      recommendations: [
        {
          priority: "medium",
          action: `revise-${key}`,
          expected_impact: "better",
          anchor_snippet: `anchor-${key}`,
          issue_family: "pacing",
          strategic_lever: "momentum_visibility",
          revision_granularity: "scene",
        },
      ],
    })),
    model: "test-model",
    prompt_version: "test-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
    coverage_summary: {
      route: "chunk_map_reduce",
      fully_evaluated: evaluatedChunks === 3,
      chunk_ledger: {
        expected_chunks: 3,
        attempted_chunks: 3,
        evaluated_chunks: evaluatedChunks,
        failed_chunks: 3 - evaluatedChunks,
        cap_applied: false,
      },
    },
  };
}

const NEVER_RUN = async () => {
  throw new Error("runner invoked unexpectedly");
};

describe("runPipeline coverage fail-closed", () => {
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

  test("fails with MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE when chunk coverage is partial", async () => {
    const result = await runPipeline({
      manuscriptText: "word ".repeat(6000),
      manuscriptChunks: [
        { chunk_index: 0, content: "x".repeat(2000) },
        { chunk_index: 1, content: "y".repeat(2000) },
        { chunk_index: 2, content: "z".repeat(2000) },
      ],
      workType: "novel",
      title: "coverage-guard",
      _runners: {
        runPass1: async () => makePassOutput(1, 2),
        runPass2: async () => makePassOutput(2, 2),
        runPass3Synthesis: NEVER_RUN,
        runQualityGate: () => {
          throw new Error("quality gate should not run");
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error_code).toBe("MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE");
    expect(result.failed_at).toBe("pass2");
    expect(result.failure_details?.manuscript_chunk_coverage?.chunk_coverage?.chunks_expected).toBe(3);
    expect(result.failure_details?.manuscript_chunk_coverage?.chunk_coverage?.chunks_processed_effective).toBe(2);
  });

  test("fails closed when Pass 1A degraded chunk ratio exceeds threshold", async () => {
    const result = await runPipeline({
      manuscriptText: "word ".repeat(6000),
      manuscriptChunks: [
        { chunk_index: 0, content: "x".repeat(2000) },
        { chunk_index: 1, content: "y".repeat(2000) },
        { chunk_index: 2, content: "z".repeat(2000) },
      ],
      workType: "novel",
      title: "pass1a-degraded-guard",
      _runners: {
        runPass1: async () => makePassOutput(1, 3),
        runPass2: async () => makePassOutput(2, 3),
        runPass1a: async () => ({
          chunkOutputs: [
            { pass: '1a', axis: 'character_evidence_sweep', chunk_index: 0, characters: [], prompt_version: 'test', generated_at: new Date().toISOString(), _degraded: true },
            { pass: '1a', axis: 'character_evidence_sweep', chunk_index: 1, characters: [], prompt_version: 'test', generated_at: new Date().toISOString(), _degraded: true },
            { pass: '1a', axis: 'character_evidence_sweep', chunk_index: 2, characters: [], prompt_version: 'test', generated_at: new Date().toISOString() },
          ],
          failedChunkIndices: [],
          failedChunkErrors: [],
          degradedChunkIndices: [0, 1],
          degradedChunkCount: 2,
          model: 'gpt-5.1',
          prompt_version: 'test',
          total_chunks: 3,
          successful_chunks: 1,
        }),
        runPass3Synthesis: NEVER_RUN,
        runQualityGate: () => {
          throw new Error("quality gate should not run");
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error_code).toBe("PASS1A_DEGRADED_CHUNK_RATIO_EXCEEDED");
    expect(result.failed_at).toBe("pass1");
    expect(result.error).toContain("does not meet next-step input standards");
  });
});
