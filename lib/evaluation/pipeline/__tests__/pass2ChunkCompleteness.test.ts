import { describe, expect, jest, test } from "@jest/globals";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  aggregatePass2ChunkResults,
  assertPass2OutputDispositionContract,
  runPass2,
  type CreateCompletionFn,
} from "../runPass2";
import { Pass2OutputIncompleteError } from "../failures";
import { PASS2_PROMPT_VERSION } from "../prompts/pass2-editorial";
import type { SinglePassOutput } from "../types";

const registry = loadCanonicalRegistry();

function makeOutput(omittedKey?: string, extraKeys: string[] = []): SinglePassOutput {
  return makeOutputWithKeys(
    [...CRITERIA_KEYS, ...extraKeys].filter((key) => key !== omittedKey),
  );
}

function makeOutputWithKeys(keys: string[]): SinglePassOutput {
  return {
    pass: 2,
    axis: "editorial_literary",
    model: "o3",
    prompt_version: PASS2_PROMPT_VERSION,
    criteria: keys.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Grounded rationale for ${key}.`,
      evidence: [{ snippet: `Evidence for ${key}.` }],
      recommendations: [],
      recommendation_status: "insufficient_evidence",
      recommendation_status_rationale:
        "The evidence supports diagnosis but not a separate intervention.",
    })),
  } as unknown as SinglePassOutput;
}

function responseFor(
  output: SinglePassOutput,
  requestId: string,
  finishReason: string = "stop",
  completionTokens: number = 50,
) {
  return {
    id: requestId,
    choices: [{
      message: { role: "assistant", content: JSON.stringify({ criteria: output.criteria }) },
      finish_reason: finishReason,
    }],
    usage: { prompt_tokens: 100, completion_tokens: completionTokens, total_tokens: 100 + completionTokens },
  };
}

function options(overrides: Partial<Parameters<typeof runPass2>[0]> = {}) {
  return {
    manuscriptText: "A complete manuscript for the Pass 2 completeness test.",
    manuscriptChunks: [{ chunk_index: 0, content: "A chunk of source manuscript text." }],
    workType: "novel",
    title: "Pass 2 completeness test",
    executionMode: "TRUSTED_PATH" as const,
    openaiApiKey: "test-key",
    registry,
    _chunkConcurrency: 1,
    ...overrides,
  };
}

function withRetryLimit(limit: string): () => void {
  const original = process.env.EVAL_CHUNK_RETRY_MAX;
  process.env.EVAL_CHUNK_RETRY_MAX = limit;
  return () => {
    if (original === undefined) {
      delete process.env.EVAL_CHUNK_RETRY_MAX;
    } else {
      process.env.EVAL_CHUNK_RETRY_MAX = original;
    }
  };
}

describe("Pass 2 chunk completeness SIPOC kickback", () => {
  test.each(CRITERIA_KEYS)("rejects any missing canonical criterion before a checkpoint can persist: %s", (missingKey) => {
    expect(() =>
      assertPass2OutputDispositionContract(makeOutput(missingKey), "criterion-agnostic-guard"),
    ).toThrow(new RegExp(`PASS2_OUTPUT_INCOMPLETE.*${missingKey}`));
  });

  test("missing marketability triggers a fresh completion and succeeds without persisting the discarded result", async () => {
    const onChunkComplete = jest.fn(async () => undefined);
    const captures: Array<{ request_id?: string; retry_attempt?: number }> = [];
    const responses = [
      responseFor(makeOutput("marketability"), "discarded-marketability"),
      responseFor(makeOutput(), "fresh-marketability-repair"),
    ];
    const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;

    const result = await runPass2(options({
      _createCompletion: completion,
      _onCompletion: (capture) => captures.push(capture),
      _onChunkComplete: onChunkComplete,
    }));

    expect(completion).toHaveBeenCalledTimes(2);
    expect(captures.map((capture) => capture.request_id)).toEqual([
      "discarded-marketability",
      "fresh-marketability-repair",
    ]);
    expect(captures.map((capture) => capture.retry_attempt)).toEqual([0, 1]);
    expect(result.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(onChunkComplete).toHaveBeenCalledTimes(1);
    expect((onChunkComplete.mock.calls[0] as [number, SinglePassOutput])[1].criteria).toHaveLength(CRITERIA_KEYS.length);
  });

  test("missing voice follows the same fresh retry path", async () => {
    const responses = [
      responseFor(makeOutput("voice"), "discarded-voice"),
      responseFor(makeOutput(), "fresh-voice-repair"),
    ];
    const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;

    const result = await runPass2(options({ _createCompletion: completion }));

    expect(completion).toHaveBeenCalledTimes(2);
    expect(result.criteria.map((criterion) => criterion.key).sort()).toEqual([...CRITERIA_KEYS].sort());
  });

  test("incomplete cached output is rejected and regenerated, while complete cached output is reused", async () => {
    const staleCache = new Map<number, SinglePassOutput>([[0, makeOutput("marketability")]]);
    const regeneration = jest.fn(async () => responseFor(makeOutput(), "regenerated-cache-entry")) as unknown as CreateCompletionFn;
    const regenerated = await runPass2(options({ _chunkCache: staleCache, _createCompletion: regeneration }));
    expect(regeneration).toHaveBeenCalledTimes(1);
    expect(regenerated.criteria).toHaveLength(CRITERIA_KEYS.length);

    const completeCache = new Map<number, SinglePassOutput>([[0, makeOutput()]]);
    const shouldNotRun = jest.fn(async () => responseFor(makeOutput(), "unexpected-provider-call")) as unknown as CreateCompletionFn;
    const reused = await runPass2(options({ _chunkCache: completeCache, _createCompletion: shouldNotRun }));
    expect(shouldNotRun).not.toHaveBeenCalled();
    expect(reused.criteria).toHaveLength(CRITERIA_KEYS.length);
  });

  test("a second incomplete response fails closed after the bounded retry and never invokes checkpoint persistence", async () => {
    const restore = withRetryLimit("1");
    const onChunkComplete = jest.fn(async () => undefined);
    const completion = jest.fn(async () => responseFor(makeOutput("marketability"), "still-incomplete")) as unknown as CreateCompletionFn;
    try {
      await expect(runPass2(options({ _createCompletion: completion, _onChunkComplete: onChunkComplete })))
        .rejects.toThrow(/PASS2_OUTPUT_INCOMPLETE/);
    } finally {
      restore();
    }
    expect(completion).toHaveBeenCalledTimes(2);
    expect(onChunkComplete).not.toHaveBeenCalled();
  });

  test("two complete chunks aggregate all canonical criteria, while an incomplete sibling prevents aggregate output", async () => {
    const twoChunks = [
      { chunk_index: 0, content: "First complete chunk." },
      { chunk_index: 1, content: "Second complete chunk." },
    ];
    const completeResponses = [
      responseFor(makeOutput(), "complete-0"),
      responseFor(makeOutput(), "complete-1"),
    ];
    const completeProvider = jest.fn(async () => completeResponses.shift()!) as unknown as CreateCompletionFn;
    const aggregate = await runPass2(options({ manuscriptChunks: twoChunks, _createCompletion: completeProvider }));
    expect(aggregate.criteria.map((criterion) => criterion.key).sort()).toEqual([...CRITERIA_KEYS].sort());

    const restore = withRetryLimit("0");
    const completed = jest.fn(async () => undefined);
    const mixedResponses = [
      responseFor(makeOutput(), "complete-before-failure"),
      responseFor(makeOutput("marketability"), "incomplete-sibling"),
    ];
    const mixedProvider = jest.fn(async () => mixedResponses.shift()!) as unknown as CreateCompletionFn;
    try {
      await expect(runPass2(options({
        manuscriptChunks: twoChunks,
        _createCompletion: mixedProvider,
        _onChunkComplete: completed,
      }))).rejects.toThrow(/PASS2_OUTPUT_INCOMPLETE/);
    } finally {
      restore();
    }
    expect(completed).toHaveBeenCalledTimes(1);
  });

  test("duplicate canonical keys fail closed, and unknown provider keys are ignored without displacing a required criterion", () => {
    const duplicate = makeOutput();
    duplicate.criteria.push({ ...duplicate.criteria[0] });
    expect(() => assertPass2OutputDispositionContract(duplicate, "duplicate-checkpoint")).toThrow(
      /PASS2_OUTPUT_DUPLICATE_CRITERION/,
    );

    const providerExtra = makeOutput(undefined, ["unknown_extra"]);
    expect(() => assertPass2OutputDispositionContract(providerExtra, "unknown-checkpoint")).toThrow(
      /PASS2_OUTPUT_UNKNOWN_CRITERION/,
    );
    const aggregate = aggregatePass2ChunkResults([makeOutput(), makeOutput()]);
    expect(aggregate.criteria).toHaveLength(CRITERIA_KEYS.length);
  });

  test("accepts criteria in any order, including tail-position marketability", async () => {
    const reversed = [...CRITERIA_KEYS].reverse();
    const shuffled = [...CRITERIA_KEYS].sort(() => 0.5 - Math.random());

    for (const order of [reversed, shuffled]) {
      const responses = [responseFor(makeOutputWithKeys(order), "random-order")];
      const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;
      const result = await runPass2(options({ _createCompletion: completion }));
      expect(result.criteria.map((c) => c.key).sort()).toEqual([...CRITERIA_KEYS].sort());
    }
  });

  test("classifies truncation and escalates output tokens when finish_reason=length", async () => {
    const responses = [
      responseFor(makeOutput("marketability"), "chunk-12-truncated", "length", 8000),
      responseFor(makeOutput(), "chunk-12-repair"),
    ];
    const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;

    const result = await runPass2(options({ _createCompletion: completion }));

    expect(completion).toHaveBeenCalledTimes(2);
    const getOutputTokens = (call: unknown) => {
      const params = call as { max_tokens?: number; max_completion_tokens?: number };
      return params.max_tokens ?? params.max_completion_tokens;
    };
    expect(getOutputTokens(completion.mock.calls[0][0])).toBe(8000);
    expect(getOutputTokens(completion.mock.calls[1][0])).toBe(12000);
    expect(result.criteria).toHaveLength(CRITERIA_KEYS.length);
  });

  test("does not escalate tokens for provider omission when finish_reason=stop", async () => {
    const responses = [
      responseFor(makeOutput("marketability"), "chunk-12-omission", "stop", 50),
      responseFor(makeOutput(), "chunk-12-repair"),
    ];
    const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;

    await runPass2(options({ _createCompletion: completion }));

    expect(completion).toHaveBeenCalledTimes(2);
    const getOutputTokens = (call: unknown) => {
      const params = call as { max_tokens?: number; max_completion_tokens?: number };
      return params.max_tokens ?? params.max_completion_tokens;
    };
    expect(getOutputTokens(completion.mock.calls[0][0])).toBe(8000);
    expect(getOutputTokens(completion.mock.calls[1][0])).toBe(8000);
  });

  test("production-shape 29 valid chunks + chunk 12 missing marketability repair and aggregate once", async () => {
    const chunks = Array.from({ length: 30 }, (_, i) => ({
      chunk_index: i,
      content: `Chunk ${i} of the long-form manuscript.`,
    }));
    const responses: unknown[] = [];
    for (let i = 0; i < 30; i++) {
      responses.push(
        i === 12
          ? responseFor(makeOutput("marketability"), `chunk-${i}-incomplete`, "stop", 50)
          : responseFor(makeOutput(), `chunk-${i}-complete`),
      );
    }
    responses.push(responseFor(makeOutput(), "chunk-12-repair"));

    const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;
    const onChunkComplete = jest.fn(async () => undefined);
    const result = await runPass2(options({
      manuscriptChunks: chunks,
      _createCompletion: completion,
      _chunkConcurrency: 1,
      _onChunkComplete: onChunkComplete,
    }));

    expect(completion).toHaveBeenCalledTimes(31);
    expect(onChunkComplete).toHaveBeenCalledTimes(30);
    expect(result.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(result.coverage_summary.route).toBe("chunk_map_reduce");
  });

  test("retry exhaustion preserves PASS2_OUTPUT_INCOMPLETE diagnosis with chunk id and origin", async () => {
    const restore = withRetryLimit("0");
    const completion = jest.fn(async () =>
      responseFor(makeOutput("marketability"), "still-incomplete", "stop", 50)
    ) as unknown as CreateCompletionFn;
    try {
      await runPass2(options({ _createCompletion: completion }));
      throw new Error("Expected PASS2_OUTPUT_INCOMPLETE to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Pass2OutputIncompleteError);
      const typed = error as Pass2OutputIncompleteError;
      expect(typed.diagnostic.missing_criteria).toEqual(["marketability"]);
      expect(typed.diagnostic.chunk_id).toBe(0);
      expect(typed.diagnostic.attempt).toBe(0);
      expect(typed.diagnostic.origin_classification).toBe("provider_omission");
    } finally {
      restore();
    }
  });

  test("replayed complete checkpoint after recovery is reused with zero provider work", async () => {
    const responses = [
      responseFor(makeOutput("marketability"), "chunk-0-incomplete", "stop", 50),
      responseFor(makeOutput(), "chunk-0-repair"),
    ];
    const completion = jest.fn(async () => responses.shift()!) as unknown as CreateCompletionFn;
    const cache = new Map<number, SinglePassOutput>();
    const onChunkComplete = jest.fn(async (chunkIndex: number, result: SinglePassOutput) => {
      cache.set(chunkIndex, result);
    });

    await runPass2(options({ _createCompletion: completion, _onChunkComplete: onChunkComplete }));
    expect(completion).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(1);

    const replayCompletion = jest.fn(async () => responseFor(makeOutput(), "should-not-run")) as unknown as CreateCompletionFn;
    const replay = await runPass2(options({ _chunkCache: cache, _createCompletion: replayCompletion }));
    expect(replayCompletion).not.toHaveBeenCalled();
    expect(replay.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(replay.criteria).toBe(cache.get(0)!.criteria);
  });
});
