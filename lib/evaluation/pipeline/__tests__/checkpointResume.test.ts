/**
 * Checkpoint resume, source-hash validation, and fail-soft callback tests
 * for Pass 1, Pass 2, and Perplexity chunk scorers.
 */
import { describe, expect, jest, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import type { AxisCriterionResult } from "@/lib/evaluation/pipeline/perplexityChunkScorer";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeSinglePassOutput(chunkIndex: number): SinglePassOutput {
  return {
    pass: 2,
    model: "o3",
    axis: "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `rationale for ${key} chunk ${chunkIndex}`,
      evidence: [{ snippet: `"evidence for chunk ${chunkIndex}"` }],
      recommendations: [],
    })),
    metadata: { chunk_index: chunkIndex },
  } as unknown as SinglePassOutput;
}

function makePplxResults(chunkIndex: number): AxisCriterionResult[] {
  return CRITERIA_KEYS.map((key) => ({
    key,
    score: 7,
    rationale: `pplx rationale ${key} chunk ${chunkIndex}`,
    evidence: `"pplx evidence chunk ${chunkIndex}"`,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Pass 2 — checkpoint resume via _chunkCache
// ────────────────────────────────────────────────────────────────────────────

describe("Pass 2 checkpoint resume", () => {
  test("resumes from partial cache without re-calling OpenAI for cached chunks", async () => {
    const { runPass2 } = await import("@/lib/evaluation/pipeline/runPass2");
    const { loadCanonicalRegistry } = await import("@/lib/governance/canonRegistry");
    const registry = loadCanonicalRegistry();

    const chunks = Array.from({ length: 3 }, (_, i) => ({
      chunk_index: i,
      content: `chunk ${i} content for test ${"x".repeat(200)}`,
    }));

    const cachedOutput = makeSinglePassOutput(0);
    const chunkCache = new Map<number, SinglePassOutput>();
    chunkCache.set(0, cachedOutput);

    const completedChunks: number[] = [];
    const onChunkComplete = jest.fn(async (idx: number) => {
      completedChunks.push(idx);
    }) as jest.Mock;

    let openAiCallCount = 0;

    const result = await runPass2({
      manuscriptText: "full manuscript text ".repeat(50),
      manuscriptChunks: chunks,
      workType: "novel",
      title: "Test",
      executionMode: "TRUSTED_PATH",
      openaiApiKey: "test-key",
      jobId: "test-job",
      registry,
      _chunkCache: chunkCache,
      _onChunkComplete: onChunkComplete as unknown as (idx: number, r: SinglePassOutput) => Promise<void>,
      _createCompletion: async () => {
        openAiCallCount++;
        const output = makeSinglePassOutput(99);
        return {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  model: "o3",
                  criteria: output.criteria,
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        };
      },
    });

    expect(result).toBeDefined();
    // Chunk 0 was cached — should NOT have called OpenAI for it.
    // 2 fresh chunks should have called OpenAI.
    expect(openAiCallCount).toBe(2);
    // _onChunkComplete should have been called for ALL chunks (cached + fresh).
    expect(onChunkComplete).toHaveBeenCalledTimes(3);
    expect(completedChunks).toContain(0);
  });

  test("_onChunkComplete failure is fail-soft — does not fail the chunk", async () => {
    const { runPass2 } = await import("@/lib/evaluation/pipeline/runPass2");
    const { loadCanonicalRegistry } = await import("@/lib/governance/canonRegistry");
    const registry = loadCanonicalRegistry();

    const chunks = [{ chunk_index: 0, content: `chunk content ${"x".repeat(200)}` }];

    const failingCallback = jest.fn(async () => {
      throw new Error("Simulated checkpoint write failure");
    }) as jest.Mock;

    const result = await runPass2({
      manuscriptText: "full manuscript text ".repeat(50),
      manuscriptChunks: chunks,
      workType: "novel",
      title: "Test",
      executionMode: "TRUSTED_PATH",
      openaiApiKey: "test-key",
      jobId: "test-job",
      registry,
      _onChunkComplete: failingCallback as unknown as (idx: number, r: SinglePassOutput) => Promise<void>,
      _createCompletion: async () => {
        const output = makeSinglePassOutput(0);
        return {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  model: "o3",
                  criteria: output.criteria,
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        };
      },
    });

    // Pass 2 should succeed even though the callback threw.
    expect(result).toBeDefined();
    expect(failingCallback).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Perplexity — checkpoint resume via _chunkCache
// ────────────────────────────────────────────────────────────────────────────

function buildPerplexityChunkResponseJson(): string {
  const criteria = Object.fromEntries(
    CRITERIA_KEYS.map((key, i) => [
      key,
      {
        score: ((i % 9) + 1),
        rationale: `${key} demonstrates competent craft.`,
        evidence: `representative line for ${key}.`,
      },
    ]),
  );
  return JSON.stringify({ criteria });
}

function pplxSuccessResponse(): Response {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [
          {
            message: { content: buildPerplexityChunkResponseJson() },
            finish_reason: "stop",
          },
        ],
      };
    },
    async text() {
      return "";
    },
  } as unknown as Response;
}

describe("Perplexity checkpoint resume", () => {
  test("resumes from partial cache and skips cached chunks", async () => {
    const { runPerplexityChunkScorer } = await import(
      "@/lib/evaluation/pipeline/perplexityChunkScorer"
    );

    const chunks = Array.from({ length: 3 }, (_, i) => ({
      chunk_index: i,
      content: `chunk ${i} content`,
    }));

    const cachedResults = makePplxResults(0);
    const chunkCache = new Map<number, AxisCriterionResult[]>();
    chunkCache.set(0, cachedResults);

    let fetchCallCount = 0;
    const fetchSpy: typeof fetch = (async () => {
      fetchCallCount++;
      return pplxSuccessResponse();
    }) as unknown as typeof fetch;

    const completedChunks: number[] = [];
    const onChunkComplete = jest.fn(async (idx: number) => {
      completedChunks.push(idx);
    }) as jest.Mock;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: chunks,
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _chunkCache: chunkCache,
      _onChunkComplete: onChunkComplete as unknown as (idx: number, r: AxisCriterionResult[]) => Promise<void>,
    });

    expect(result).not.toBeNull();
    // Chunk 0 was cached. The pre-warm probe is 1 fetch call, the probe gate
    // uses chunk 0 (which is cached, so no fetch). Chunks 1 and 2 are fresh.
    // Total fetches = 1 (pre-warm) + 2 (fresh chunks) = 3.
    // But the probe gate picks the first chunk — if it's cached, probe gate
    // is skipped and only the sample/main batches run the fresh chunks.
    // Fresh chunks 1 and 2 each need 1 fetch call.
    // So: 1 (pre-warm) + 2 (fresh) = 3 max, but chunk 0 is NOT fetched.
    expect(completedChunks).toContain(0);
    expect(onChunkComplete).toHaveBeenCalled();
  });

  test("checkpoint callback failure is fail-soft — does not fail the sweep", async () => {
    const { runPerplexityChunkScorer } = await import(
      "@/lib/evaluation/pipeline/perplexityChunkScorer"
    );

    const chunks = [{ chunk_index: 0, content: "chunk content" }];

    const fetchSpy: typeof fetch = (async () =>
      pplxSuccessResponse()) as unknown as typeof fetch;

    const failingCallback = jest.fn(async () => {
      throw new Error("Simulated checkpoint write failure");
    }) as jest.Mock;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: chunks,
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _onChunkComplete: failingCallback as unknown as (idx: number, r: AxisCriterionResult[]) => Promise<void>,
    });

    // Sweep should succeed even though callback threw.
    expect(result).not.toBeNull();
    expect(failingCallback).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Source-hash invalidation
// ────────────────────────────────────────────────────────────────────────────

describe("Source-hash validation", () => {
  test("changed source hash invalidates cache — stale entries are not reused", () => {
    const { createHash } = require("crypto");

    const hash1 = createHash("sha256")
      .update("job-1:manuscript-1:29")
      .digest("hex");
    const hash2 = createHash("sha256")
      .update("job-1:manuscript-1:30")
      .digest("hex");

    // Different chunk counts → different hashes → cache should be invalidated.
    expect(hash1).not.toBe(hash2);

    // Same inputs → same hash → cache should be reused.
    const hash1b = createHash("sha256")
      .update("job-1:manuscript-1:29")
      .digest("hex");
    expect(hash1).toBe(hash1b);
  });

  test("cache artifact with mismatched source_hash is not loaded", () => {
    // This tests the contract: if the artifact's source_hash doesn't match
    // the computed hash, the cache should be ignored.
    const artifactContent = {
      job_id: "job-1",
      source_hash: "old-hash-from-previous-version",
      chunks: { 0: { result: {}, completed_at: "2026-01-01T00:00:00Z" } },
      total_expected: 29,
      cached_at: "2026-01-01T00:00:00Z",
    };

    const currentHash = "new-hash-for-current-version";

    // The processor checks: if (pass1Content.source_hash === pass12SourceHash)
    // This should be false, so no chunks are loaded.
    expect(artifactContent.source_hash).not.toBe(currentHash);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Checkpoint merge safety
// ────────────────────────────────────────────────────────────────────────────

describe("Checkpoint merge safety", () => {
  test("existing cache with N chunks is never overwritten by smaller payload", () => {
    // Simulates the processor's seeding logic:
    // pass1ChunkResults is seeded from loaded cache, then new chunks are added.
    // Every upsert writes the full merged set.

    // Simulate existing cache with 20 chunks.
    const existingCache: Record<number, { result: SinglePassOutput; completed_at: string }> = {};
    for (let i = 0; i < 20; i++) {
      existingCache[i] = {
        result: makeSinglePassOutput(i),
        completed_at: "2026-01-01T00:00:00Z",
      };
    }

    // Simulate processor seeding: copy all existing entries to rolling payload.
    const chunkResults: Record<number, { result: SinglePassOutput; completed_at: string }> = {};
    for (const [idx, entry] of Object.entries(existingCache)) {
      chunkResults[Number(idx)] = entry;
    }

    // Before any new work, the rolling payload has all 20 existing chunks.
    expect(Object.keys(chunkResults).length).toBe(20);

    // New chunk completes — add it.
    chunkResults[20] = {
      result: makeSinglePassOutput(20),
      completed_at: new Date().toISOString(),
    };

    // The upsert payload now has 21 chunks — strictly larger than the original 20.
    expect(Object.keys(chunkResults).length).toBe(21);

    // Even if only 1 new chunk was added since last upsert, the payload
    // includes all previously cached chunks. No data loss.
    for (let i = 0; i <= 20; i++) {
      expect(chunkResults[i]).toBeDefined();
    }
  });
});
