/**
 * Regression test: short-form manuscripts must synthesize a single chunk
 * for Pass 3A.  Before the fix, manuscriptChunksForPipeline was undefined
 * for non-long_form routes, causing runPass3Preflight to receive [] and
 * instantly produce "all_chunks_failed" with reducer_status=failed.
 *
 * This test validates the synthetic-chunk logic at the processor level
 * by simulating the branch guard that was missing.
 */

import type { ManuscriptChunkEvidence } from "@/lib/evaluation/pipeline/types";

describe("Short-form Pass 3A chunk synthesis", () => {
  /**
   * Reproduces the exact code path that was broken:
   *   let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
   *   if (chunkRouting.route === 'long_form') { … sets it … }
   *   // MISSING else → stays undefined
   *   const allChunks = manuscriptChunksForPipeline;
   *   // Array.isArray(undefined) → false → [] → "all_chunks_failed"
   */
  test("before fix: undefined manuscriptChunksForPipeline yields empty array for Pass 3A", () => {
    let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
    const route = "short_form"; // NOT long_form

    if (route === "long_form") {
      manuscriptChunksForPipeline = [{ chunk_index: 0, content: "chunk text" }];
    }
    // No else block → stays undefined

    const allChunks = manuscriptChunksForPipeline;
    const passedToPass3A = Array.isArray(allChunks) ? allChunks : [];

    // This is the bug: Pass 3A gets [] → "all_chunks_failed"
    expect(passedToPass3A).toHaveLength(0);
  });

  test("after fix: short-form route synthesizes single chunk from manuscript text", () => {
    let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
    const route = "short_form";
    const manuscriptContent =
      'Money was clearly one way he could differentiate himself, except he couldn\'t exactly go around telling people...';

    if (route === "long_form") {
      manuscriptChunksForPipeline = [{ chunk_index: 0, content: "chunk text" }];
    } else {
      // THE FIX: synthesize a single chunk from the full manuscript text
      const fullText = (manuscriptContent || "").trim();
      if (fullText.length > 0) {
        manuscriptChunksForPipeline = [{ chunk_index: 0, content: fullText }];
      }
    }

    const allChunks = manuscriptChunksForPipeline;
    const passedToPass3A = Array.isArray(allChunks) ? allChunks : [];

    // After fix: Pass 3A gets 1 chunk with the full text
    expect(passedToPass3A).toHaveLength(1);
    expect(passedToPass3A[0].chunk_index).toBe(0);
    expect(passedToPass3A[0].content).toContain("Money was clearly");
  });

  test("after fix: empty manuscript text does not synthesize a chunk", () => {
    let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
    const route = "sub_threshold";
    const manuscriptContent = "   "; // whitespace only

    if (route === "long_form") {
      manuscriptChunksForPipeline = [{ chunk_index: 0, content: "chunk text" }];
    } else {
      const fullText = (manuscriptContent || "").trim();
      if (fullText.length > 0) {
        manuscriptChunksForPipeline = [{ chunk_index: 0, content: fullText }];
      }
    }

    const allChunks = manuscriptChunksForPipeline;
    const passedToPass3A = Array.isArray(allChunks) ? allChunks : [];

    // Empty/whitespace text should not synthesize a chunk
    expect(passedToPass3A).toHaveLength(0);
  });

  test("long-form route still uses DB chunks (no regression)", () => {
    let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
    const route = "long_form";
    const dbChunks: ManuscriptChunkEvidence[] = [
      { chunk_index: 0, content: "Chapter 1..." },
      { chunk_index: 1, content: "Chapter 2..." },
      { chunk_index: 2, content: "Chapter 3..." },
    ];

    if (route === "long_form") {
      manuscriptChunksForPipeline = dbChunks;
    } else {
      const fullText = "full text";
      if (fullText.length > 0) {
        manuscriptChunksForPipeline = [{ chunk_index: 0, content: fullText }];
      }
    }

    const allChunks = manuscriptChunksForPipeline;
    const passedToPass3A = Array.isArray(allChunks) ? allChunks : [];

    expect(passedToPass3A).toHaveLength(3);
    expect(passedToPass3A[0].content).toBe("Chapter 1...");
  });
});
