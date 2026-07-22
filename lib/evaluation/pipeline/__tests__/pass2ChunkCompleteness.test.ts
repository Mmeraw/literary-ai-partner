import { describe, expect, jest, test } from "@jest/globals";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  aggregatePass2ChunkResults,
  assertPass2OutputDispositionContract,
  runPass2,
  type CreateCompletionFn,
} from "../runPass2";
import { PASS2_PROMPT_VERSION } from "../prompts/pass2-editorial";
import type { SinglePassOutput } from "../types";

const registry = loadCanonicalRegistry();

function makeOutput(omittedKey?: string, extraKeys: string[] = []): SinglePassOutput {
  return {
    pass: 2,
    axis: "editorial_literary",
    model: "o3",
    prompt_version: PASS2_PROMPT_VERSION,
    criteria: [...CRITERIA_KEYS, ...extraKeys]
      .filter((key) => key !== omittedKey)
      .map((key) => ({
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

function responseFor(output: SinglePassOutput, requestId: string) {
  return {
    id: requestId,
    choices: [{
      message: { role: "assistant", content: JSON.stringify({ criteria: output.criteria }) },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
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
    expect(onChunkComplete.mock.calls[0][1].criteria).toHaveLength(CRITERIA_KEYS.length);
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
});
