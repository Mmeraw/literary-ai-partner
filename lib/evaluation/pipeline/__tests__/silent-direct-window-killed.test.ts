/**
 * Regression: the silent direct_window fallback is killed.
 *
 * Bug class: long manuscripts (≥ 3,000 words) that arrive at runPipeline
 * without chunks used to silently route to direct_window in Pass 1 and time
 * out at the 12-minute wall. Now they MUST fail-closed with
 * CHUNK_ROUTING_NOT_ENGAGED before any pass dispatch.
 */

import { describe, expect, test } from "@jest/globals";
import { runPipeline } from "../runPipeline";

const NEVER_RUN = async () => {
  throw new Error("pass runner invoked — chunk routing guard did not fail closed");
};

const NEVER_RUN_QG = () => {
  throw new Error("quality gate invoked — chunk routing guard did not fail closed");
};

const stubRunners = {
  runPass1: NEVER_RUN,
  runPass2: NEVER_RUN,
  runPass3Synthesis: NEVER_RUN,
  runQualityGate: NEVER_RUN_QG,
};

type PipelineFailure = Extract<Awaited<ReturnType<typeof runPipeline>>, { ok: false }>;

function expectFailure(result: Awaited<ReturnType<typeof runPipeline>>): PipelineFailure {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected pipeline failure but got success");
  }
  return result as PipelineFailure;
}

function generateText(targetWords: number): string {
  const vocab = "the quick brown fox jumps over the lazy dog and considers what to do next".split(" ");
  const parts: string[] = [];
  for (let i = 0; i < targetWords; i++) {
    parts.push(vocab[i % vocab.length]);
    if (i % 15 === 14) parts.push(".");
  }
  return parts.join(" ");
}

describe("silent direct_window fallback is killed", () => {
  test("10k-word text with no chunks → CHUNK_ROUTING_NOT_ENGAGED before any pass", async () => {
    const manuscriptText = generateText(10_000);
    const result = await runPipeline({
      manuscriptText,
      workType: "novel",
      title: "regression: silent direct_window",
      manuscriptId: "test:silent-direct-window",
      manuscriptChunks: undefined,
      _passTimeoutMs: 5_000,
      _runners: stubRunners as unknown as Parameters<typeof runPipeline>[0]["_runners"],
      _maxManuscriptChars: 10_000_000,
    });
    const failure = expectFailure(result);
    expect(failure.error_code).toBe("CHUNK_ROUTING_NOT_ENGAGED");
    expect(failure.error).toMatch(/Chunk-routed evaluation did not engage/);
  });

  test("10k-word text with exactly 1 chunk → chunk routing IS engaged (dispatches)", async () => {
    // A single materialized chunk is legitimate chunk-routed engagement: the
    // manuscript travelled through the chunking pipeline, was persisted, and
    // rehydrated. The earlier guard (`chunkCount <= 1`) incorrectly rejected
    // these runs as silent fallbacks — see job 3b7a549b-ea34-4b3d-ae85-30bc8b234576.
    // Only zero chunks counts as "did not engage".
    const manuscriptText = generateText(10_000);
    const result = await runPipeline({
      manuscriptText,
      workType: "novel",
      title: "regression: 1-chunk routing engaged",
      manuscriptId: "test:silent-1-chunk",
      manuscriptChunks: [{ chunk_index: 0, content: manuscriptText.slice(0, 12_000) }],
      _passTimeoutMs: 5_000,
      _runners: stubRunners as unknown as Parameters<typeof runPipeline>[0]["_runners"],
      _maxManuscriptChars: 10_000_000,
    });
    const failure = expectFailure(result);
    expect(failure.error_code).not.toBe("CHUNK_ROUTING_NOT_ENGAGED");
  });

  test("sub-threshold text (2,500 words) with no chunks is OK at the pipeline guard", async () => {
    // Below the structural chunking threshold (3k), direct evaluation is the
    // correct path. The pipeline-level guard must NOT fire — downstream runners
    // are stubbed to throw, but the failure should be in pass dispatch, not in
    // the chunk-routing guard.
    // _passTimeoutMs must be << Jest's default 5 000 ms so the pipeline
    // resolves before Jest kills the test with its own timeout.
    const manuscriptText = generateText(2_500);
    const result = await runPipeline({
      manuscriptText,
      workType: "novel",
      title: "sub-threshold OK",
      manuscriptId: "test:sub-threshold",
      manuscriptChunks: undefined,
      _passTimeoutMs: 500,
      _runners: stubRunners as unknown as Parameters<typeof runPipeline>[0]["_runners"],
      _maxManuscriptChars: 10_000_000,
    });
    const failure = expectFailure(result);
    expect(failure.error_code).not.toBe("CHUNK_ROUTING_NOT_ENGAGED");
  }, 10_000);

  test("manuscript above HARD_MANUSCRIPT_CEILING_WORDS → MANUSCRIPT_EXCEEDS_HARD_CEILING", async () => {
    const manuscriptText = generateText(310_000);
    const result = await runPipeline({
      manuscriptText,
      workType: "novel",
      title: "regression: hard ceiling",
      manuscriptId: "test:hard-ceiling",
      manuscriptChunks: undefined,
      _passTimeoutMs: 5_000,
      _runners: stubRunners as unknown as Parameters<typeof runPipeline>[0]["_runners"],
      _maxManuscriptChars: 100_000_000,
    });
    const failure = expectFailure(result);
    expect(failure.error_code).toBe("MANUSCRIPT_EXCEEDS_HARD_CEILING");
  });
});
