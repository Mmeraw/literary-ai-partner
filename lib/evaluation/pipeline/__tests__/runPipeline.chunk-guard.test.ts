/**
 * runPipeline chunk-shape guard tests.
 *
 * Covers the two structural invariants added at the runPipeline boundary:
 *   1. CHUNK_BUDGET_OVERFLOW — chunk.content.length > inputCharBudget * 0.95.
 *   2. PIPELINE_INPUT_INVALID — chunk.content.trim().length < 32 (MIN_VIABLE_CHUNK_CHARS).
 *
 * Both guards run before Pass 1 dispatch; tests assert this by injecting
 * runners that throw if invoked, so a passing test proves no pass ran.
 */

import { describe, expect, test } from "@jest/globals";
import { runPipeline } from "../runPipeline";
import { getDefaultPassInputCharBudget } from "../promptInput";
import type { ManuscriptChunkEvidence } from "../types";

const NEVER_RUN = async () => {
  throw new Error("pass runner invoked — guard did not fail closed");
};

const NEVER_RUN_QG = () => {
  throw new Error("quality gate invoked — guard did not fail closed");
};

const stubRunners = {
  runPass1: NEVER_RUN,
  runPass2: NEVER_RUN,
  runPass3Synthesis: NEVER_RUN,
  runQualityGate: NEVER_RUN_QG,
};

const BASE_OPTS = {
  manuscriptText: "Manuscript body that is long enough to satisfy validatePipelineInput.",
  workType: "novel" as const,
  title: "chunk-guard test",
  manuscriptId: "test:chunk-guard",
  _passTimeoutMs: 5_000,
  _runners: stubRunners as unknown as Parameters<typeof runPipeline>[0]["_runners"],
};

function chunk(index: number, content: string): ManuscriptChunkEvidence {
  return { chunk_index: index, content };
}

type PipelineFailure = Extract<Awaited<ReturnType<typeof runPipeline>>, { ok: false }>;

function expectFailure(result: Awaited<ReturnType<typeof runPipeline>>): PipelineFailure {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected pipeline failure but got success");
  }
  return result as PipelineFailure;
}

describe("runPipeline chunk-shape guards", () => {
  describe("CHUNK_BUDGET_OVERFLOW (upper bound)", () => {
    test("100k-char single chunk fails closed", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x".repeat(100_000))],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.failed_at).toBe("pass1");
      expect(failure.error).toMatch(/chunk 0/);
    });

    test("chunk exactly at budget ceiling passes the guard", async () => {
      // ceiling = floor(budget * 0.95). The runners stub will throw, proving
      // the chunk passed the guard and progressed to Pass 1 dispatch.
      const budget = getDefaultPassInputCharBudget();
      const ceiling = Math.floor(budget * 0.95);
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x".repeat(ceiling))],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).not.toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    });

    test("chunk at ceiling - 1 passes the guard", async () => {
      const budget = getDefaultPassInputCharBudget();
      const ceiling = Math.floor(budget * 0.95);
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x".repeat(ceiling - 1))],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).not.toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    });

    test("chunk at ceiling + 1 trips the guard", async () => {
      const budget = getDefaultPassInputCharBudget();
      const ceiling = Math.floor(budget * 0.95);
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x".repeat(ceiling + 1))],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("CHUNK_BUDGET_OVERFLOW");
    });

    test("offending chunk index is surfaced when not first", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [
          chunk(0, "x".repeat(2_000)),
          chunk(1, "x".repeat(100_000)),
        ],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.error).toMatch(/chunk 1/);
    });
  });

  describe("PIPELINE_INPUT_INVALID (lower bound)", () => {
    test("single-character chunk fails closed", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x")],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("PIPELINE_INPUT_INVALID");
      expect(failure.failed_at).toBe("pass1");
    });

    test("chunk at MIN_VIABLE_CHUNK_CHARS - 1 trips the guard", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x".repeat(31))],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("PIPELINE_INPUT_INVALID");
    });

    test("chunk at MIN_VIABLE_CHUNK_CHARS passes the guard", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "x".repeat(32))],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).not.toBe("PIPELINE_INPUT_INVALID");
      expect(failure.error_code).not.toBe("CHUNK_BUDGET_OVERFLOW");
    });

    test("whitespace-only chunk is treated as undersized (trim length=0)", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [chunk(0, "   \n\n   ")],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("PIPELINE_INPUT_INVALID");
    });
  });

  describe("no-op cases (guard must not false-positive)", () => {
    test("empty chunks array passes the guard (no chunks supplied is valid)", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [],
      });
      // Empty array means: no chunk-based input. Pipeline falls through to
      // single-pass window path using manuscriptText. Stub runners throw,
      // proving the guard did not fail closed pre-dispatch.
      const failure = expectFailure(result);
      expect(failure.error_code).not.toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    });

    test("multiple in-budget chunks all pass", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [
          chunk(0, "a".repeat(1_000)),
          chunk(1, "b".repeat(2_000)),
          chunk(2, "c".repeat(3_000)),
        ],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).not.toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    });

    test("undefined manuscriptChunks (omitted) does not invoke the guard", async () => {
      const result = await runPipeline({
        ...BASE_OPTS,
        // manuscriptChunks omitted entirely
      });
      const failure = expectFailure(result);
      expect(failure.error_code).not.toBe("CHUNK_BUDGET_OVERFLOW");
      expect(failure.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    });
  });

  describe("guard ordering / idempotency", () => {
    test("lower-bound violation is reported even when other chunks would also overflow", async () => {
      // Confirms iteration short-circuits on first failure; order of chunks
      // determines which code surfaces. The undersized chunk comes first.
      const result = await runPipeline({
        ...BASE_OPTS,
        manuscriptChunks: [
          chunk(0, "x"),
          chunk(1, "y".repeat(100_000)),
        ],
      });
      const failure = expectFailure(result);
      expect(failure.error_code).toBe("PIPELINE_INPUT_INVALID");
      expect(failure.error).toMatch(/chunk 0/);
    });
  });
});
