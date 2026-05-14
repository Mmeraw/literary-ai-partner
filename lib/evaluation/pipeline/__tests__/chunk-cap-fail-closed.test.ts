/**
 * Regression: chunk-cap silent truncation is killed.
 *
 * Bug class: when EVAL_CHUNK_MAX_PER_PASS was set, both runPass1 and runPass2
 * used to silently slice the chunks array — later chunks were dropped without
 * any signal. Now they MUST throw ChunkCountExceedsCapError before any LLM
 * call so the failure surfaces as CHUNK_COUNT_EXCEEDS_CAP in dashboards.
 */

import { describe, expect, test, afterEach, beforeEach } from "@jest/globals";
import { runPass1 } from "../runPass1";
import { runPass2 } from "../runPass2";
import { ChunkCountExceedsCapError } from "../failures";
import type { ManuscriptChunkEvidence } from "../types";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";

const NEVER_CALL_COMPLETION = (async () => {
  throw new Error("OpenAI completion invoked — chunk cap guard did not fail closed");
}) as unknown as Parameters<typeof runPass1>[0]["_createCompletion"];

function makeChunks(n: number): ManuscriptChunkEvidence[] {
  // Each chunk has enough content to pass MIN_VIABLE_CHUNK_CHARS upstream.
  // We don't route through runPipeline here — we test the pass-level guard
  // directly — so chunk content only needs to be a non-empty string.
  return Array.from({ length: n }, (_, i) => ({
    chunk_index: i,
    content: `Chunk ${i} content. `.repeat(100),
  }));
}

describe("CHUNK_COUNT_EXCEEDS_CAP fail-closed (no silent truncation)", () => {
  const mockRegistry = loadCanonicalRegistry();
  const baseOpts = {
    manuscriptText: "Long manuscript text. ".repeat(500),
    workType: "novel",
    title: "chunk-cap regression",
    registry: mockRegistry,
    openaiApiKey: "test-key",
  };

  beforeEach(() => {
    process.env.EVAL_CHUNK_MAX_PER_PASS = "10";
  });

  afterEach(() => {
    delete process.env.EVAL_CHUNK_MAX_PER_PASS;
  });

  test("Pass 1: 25 chunks with cap=10 throws ChunkCountExceedsCapError before any LLM call", async () => {
    const chunks = makeChunks(25);
    await expect(
      runPass1({
        ...baseOpts,
        manuscriptChunks: chunks,
        _createCompletion: NEVER_CALL_COMPLETION,
      } as Parameters<typeof runPass1>[0]),
    ).rejects.toBeInstanceOf(ChunkCountExceedsCapError);
  });

  test("Pass 2: 25 chunks with cap=10 throws ChunkCountExceedsCapError before any LLM call", async () => {
    const chunks = makeChunks(25);
    await expect(
      runPass2({
        ...baseOpts,
        manuscriptChunks: chunks,
        _createCompletion: NEVER_CALL_COMPLETION,
      } as Parameters<typeof runPass2>[0]),
    ).rejects.toBeInstanceOf(ChunkCountExceedsCapError);
  });

  test("error carries CHUNK_COUNT_EXCEEDS_CAP code and diagnostic counts", async () => {
    const chunks = makeChunks(25);
    try {
      await runPass1({
        ...baseOpts,
        manuscriptChunks: chunks,
        _createCompletion: NEVER_CALL_COMPLETION,
      } as Parameters<typeof runPass1>[0]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ChunkCountExceedsCapError);
      const e = err as ChunkCountExceedsCapError;
      expect(e.code).toBe("CHUNK_COUNT_EXCEEDS_CAP");
      expect(e.details.chunk_count).toBe(25);
      expect(e.details.chunk_cap).toBe(10);
    }
  });

  test("at-cap chunks pass the guard (cap=10, chunks=10)", async () => {
    // The guard fires only when chunk_count > cap. At exactly cap, dispatch
    // proceeds — proven by the OpenAI stub throwing.
    const chunks = makeChunks(10);
    await expect(
      runPass1({
        ...baseOpts,
        manuscriptChunks: chunks,
        _createCompletion: NEVER_CALL_COMPLETION,
      } as Parameters<typeof runPass1>[0]),
    ).rejects.toThrow(/completion invoked|aggregate|Chunk evaluation failures/);
  });
});
