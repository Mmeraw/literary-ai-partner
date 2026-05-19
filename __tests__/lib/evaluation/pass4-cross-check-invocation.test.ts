/**
 * Pass 4 Cross-Check Invocation — RETIRED
 *
 * ARCHIVED: Pass 4 retired in favor of dual-model parallel scoring
 * (feat/dual-model-parallel-scoring). The runPerplexityCrossCheck call is no
 * longer invoked by runPipeline; Perplexity now scores all chunks during
 * Pass 1+2 alongside GPT and feeds the Pass 3 collator as an independent
 * second packet.
 *
 * These tests previously enforced that the pipeline awaits a post-synthesis
 * Perplexity cross-check. After retirement, the file is preserved as a
 * marker so the test suite documents the contract change. The retained
 * assertions verify that the retirement is in place (i.e. the legacy
 * invocation path is no longer present).
 */

import { describe, test, expect } from "@jest/globals";
import * as fs from "fs/promises";
import * as path from "path";

describe("Pass 4 Cross-Check — Retired", () => {
  test("runPipeline no longer awaits runPerplexityCrossCheck (Pass 4 retired)", async () => {
    const pipelineFile = path.join(
      process.cwd(),
      "lib/evaluation/pipeline/runPipeline.ts",
    );
    const source = await fs.readFile(pipelineFile, "utf-8");
    expect(source).not.toMatch(/await\s+runPerplexityCrossCheck\s*\(/);
  });

  test("runPipeline references the dual-model parallel scorer", async () => {
    const pipelineFile = path.join(
      process.cwd(),
      "lib/evaluation/pipeline/runPipeline.ts",
    );
    const source = await fs.readFile(pipelineFile, "utf-8");
    expect(source).toMatch(/runPerplexityChunkScorer/);
  });
});
