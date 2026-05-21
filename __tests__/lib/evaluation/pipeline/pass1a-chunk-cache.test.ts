/**
 * Pass 1A chunk cache (PR-E checkpoint) tests.
 *
 * Mirrors the pass1_chunk_cache_v1 pattern. Validates that:
 *   1. A pre-populated _chunkCache entry short-circuits OpenAI for that chunk.
 *   2. A partial cache (20 of 40) only invokes OpenAI for the 20 fresh chunks.
 *   3. An empty cache (e.g. processor rejected a stale source_hash) re-runs all chunks.
 *
 * NOTE: jest.mock("openai", ...) is hoisted above all imports. The factory must
 * not reference outer-scope variables — we expose the create-mock via a getter
 * stored on globalThis so the test can reset it per-test.
 */
export {};

jest.mock("openai", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const create = jest.fn() as jest.Mock<(params: any) => Promise<any>>;
  // Stash the mock on globalThis so the test body can reset/inspect it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__pass1aCreateMock = create;
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
  return { __esModule: true, default: OpenAIMock };
});

import { runPass1a } from "@/lib/evaluation/pipeline/runPass1a";
import type {
  ManuscriptChunkEvidence,
  Pass1aChunkOutput,
} from "@/lib/evaluation/pipeline/types";

// The mock factory above stashes its create-fn on globalThis. We read it lazily
// via a helper so the lookup happens after the factory has run (the factory is
// triggered by the runPass1a import above, which calls `import OpenAI from "openai"`).
function getCreateMock(): jest.Mock<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (params: any) => Promise<any>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (globalThis as any).__pass1aCreateMock;
  if (!m) {
    throw new Error(
      "openai mock not installed — jest.mock factory did not run before test body",
    );
  }
  return m;
}

function makeChunks(n: number): ManuscriptChunkEvidence[] {
  const chunks: ManuscriptChunkEvidence[] = [];
  for (let i = 0; i < n; i++) {
    chunks.push({ chunk_index: i, content: `chunk ${i} text` });
  }
  return chunks;
}

function makeCachedOutput(chunkIndex: number, marker: string): Pass1aChunkOutput {
  return {
    pass: "1a",
    axis: "character_evidence_sweep",
    chunk_index: chunkIndex,
    characters: [
      {
        canonical_name: marker,
        aliases: [],
        pronouns: [],
        age_signal: "unknown",
        age_exact: null,
        life_stage_evidence: null,
        gender_identity: "unknown",
        lgbtq_signals: [],
        racial_ethnic_signals: [],
        skin_tone_signals: [],
        language_signals: [],
        religion_signals: [],
        socioeconomic_signals: [],
        nationality_signals: [],
        disability_neuro_signals: [],
        role_signal: "unknown",
        narrative_weight_signal: "unknown",
        is_named: true,
        who_is_this: "cached entry",
        what_do_they_want: null,
        where_are_they: null,
        when_signal: null,
        why_signal: null,
        how_signal: null,
        arc_state_in_chunk: "stable",
        arc_pressure: null,
        arc_shift: null,
        is_ending_chunk: false,
        symbolic_objects: [],
        relationship_signals: [],
        evidence_anchors: [],
      },
    ],
    prompt_version: "pass1a-cached",
    generated_at: new Date().toISOString(),
  };
}

function makeFreshCompletion(chunkIndex: number) {
  return {
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            characters: [
              {
                canonical_name: `FreshChar_${chunkIndex}`,
                aliases: [],
                pronouns: [],
                age_signal: "unknown",
                gender_identity: "unknown",
                role_signal: "unknown",
                narrative_weight_signal: "unknown",
                is_named: true,
                who_is_this: "fresh from openai",
                arc_state_in_chunk: "stable",
                is_ending_chunk: false,
                symbolic_objects: [],
                relationship_signals: [],
                evidence_anchors: [],
              },
            ],
            generated_at: new Date().toISOString(),
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

describe("Pass 1A chunk cache (PR-E checkpoint)", () => {
  beforeEach(() => {
    const createMock = getCreateMock();
    createMock.mockReset();
    createMock.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (params: any) => {
        const userMsg = params?.messages?.find(
          (m: { role: string }) => m.role === "user",
        );
        const match =
          typeof userMsg?.content === "string"
            ? userMsg.content.match(/chunk\s+(\d+)\s+text/)
            : null;
        const idx = match ? Number(match[1]) : 0;
        return makeFreshCompletion(idx);
      },
    );
  });

  it("cache hit skips OpenAI for cached chunk", async () => {
    const chunks = makeChunks(3);
    const cache = new Map<number, Pass1aChunkOutput>();
    cache.set(1, makeCachedOutput(1, "CachedChar_1"));

    const result = await runPass1a({
      manuscriptText: chunks.map((c) => c.content).join("\n\n"),
      manuscriptChunks: chunks,
      title: "Test Manuscript",
      workType: "novel",
      openaiApiKey: "sk-test",
      jobId: "job-cache-hit",
      _chunkCache: cache,
    });

    // 3 chunks total, 1 cached → OpenAI invoked only for the other 2.
    expect(getCreateMock()).toHaveBeenCalledTimes(2);
    expect(result.successful_chunks).toBe(3);

    // The cached chunk's marker must propagate through unmodified.
    const cachedOutput = result.chunkOutputs.find((c) => c.chunk_index === 1);
    expect(cachedOutput?.characters[0]?.canonical_name).toBe("CachedChar_1");
  });

  it("partial cache (20 of 40) only invokes OpenAI for the 20 fresh chunks", async () => {
    const chunks = makeChunks(40);
    const cache = new Map<number, Pass1aChunkOutput>();
    for (let i = 0; i < 20; i++) {
      cache.set(i, makeCachedOutput(i, `CachedChar_${i}`));
    }

    const onChunkComplete = jest.fn(async () => {});

    const result = await runPass1a({
      manuscriptText: chunks.map((c) => c.content).join("\n\n"),
      manuscriptChunks: chunks,
      title: "Test Manuscript",
      workType: "novel",
      openaiApiKey: "sk-test",
      jobId: "job-partial-cache",
      _chunkCache: cache,
      _onChunkComplete: onChunkComplete,
    });

    expect(getCreateMock()).toHaveBeenCalledTimes(20);
    expect(result.successful_chunks).toBe(40);
    // _onChunkComplete fires for every chunk — cached + fresh — so processor
    // can refresh the rolling artifact timestamp on each attempt.
    expect(onChunkComplete).toHaveBeenCalledTimes(40);
  });

  it("empty cache (source_hash mismatch path) re-runs all chunks", async () => {
    const chunks = makeChunks(5);
    // Empty cache simulates the processor having rejected a stale artifact
    // because its source_hash didn't match the current job/manuscript/chunk-count
    // identity. Pass 1A treats this identically to "no cache provided".
    const emptyCache = new Map<number, Pass1aChunkOutput>();

    const result = await runPass1a({
      manuscriptText: chunks.map((c) => c.content).join("\n\n"),
      manuscriptChunks: chunks,
      title: "Test Manuscript",
      workType: "novel",
      openaiApiKey: "sk-test",
      jobId: "job-invalidated-cache",
      _chunkCache: emptyCache,
    });

    expect(getCreateMock()).toHaveBeenCalledTimes(5);
    expect(result.successful_chunks).toBe(5);
    for (const chunkOut of result.chunkOutputs) {
      expect(chunkOut.characters[0]?.canonical_name).toMatch(/^FreshChar_/);
    }
  });
});
