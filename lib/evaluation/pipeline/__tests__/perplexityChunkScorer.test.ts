import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

import { runPerplexityChunkScorer } from "../perplexityChunkScorer";

const pipelineLogMock = jest.fn() as jest.Mock;

function buildPerplexityChunkResponseJson(): string {
  const criteria = Object.fromEntries(
    CRITERIA_KEYS.map((key, i) => [
      key,
      {
        score: ((i % 9) + 1),
        rationale: `${key} demonstrates ${i % 2 === 0 ? "competent" : "uneven"} craft in this window.`,
        evidence: `representative line for ${key}.`,
      },
    ]),
  );
  return JSON.stringify({ criteria });
}

function successResponse(): Response {
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

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    async json() {
      return {};
    },
    async text() {
      return body;
    },
  } as unknown as Response;
}

function makeChunks(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    chunk_index: i,
    content: `chunk ${i} content`,
  }));
}

describe("runPerplexityChunkScorer — fail-fast gates", () => {
  const ORIGINAL_KEY = process.env.PERPLEXITY_API_KEY;

  beforeEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
    pipelineLogMock.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL_KEY !== undefined) {
      process.env.PERPLEXITY_API_KEY = ORIGINAL_KEY;
    } else {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  test("missing key → returns null (operator GPT-only mode)", async () => {
    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: [{ chunk_index: 0, content: "x" }],
      workType: "novel",
      title: "T",
    });
    expect(result).toBeNull();
  });

  test("Gate 1 — 422 deterministic probe → throws FATAL", async () => {
    const fetchSpy: typeof fetch = (async () =>
      errorResponse(422, "unprocessable entity body")) as unknown as typeof fetch;
    await expect(
      runPerplexityChunkScorer({
        manuscriptText: "x",
        manuscriptChunks: makeChunks(40),
        workType: "novel",
        title: "T",
        perplexityApiKey: "test-key",
        _fetch: fetchSpy,
        _sleep: async () => undefined,
      _log: pipelineLogMock,
      }),
    ).rejects.toThrow(/PERPLEXITY_CHUNK_SCORER_FATAL/);

    const errorCalls = pipelineLogMock.mock.calls.filter((c) => {
      const arg = c[0] as { level?: string };
      return arg.level === "error";
    });
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("Gate 1 — 401 deterministic probe → throws FATAL", async () => {
    const fetchSpy: typeof fetch = (async () =>
      errorResponse(401, "bad key")) as unknown as typeof fetch;
    await expect(
      runPerplexityChunkScorer({
        manuscriptText: "x",
        manuscriptChunks: makeChunks(40),
        workType: "novel",
        title: "T",
        perplexityApiKey: "test-key",
        _fetch: fetchSpy,
        _sleep: async () => undefined,
      _log: pipelineLogMock,
      }),
    ).rejects.toThrow(/PERPLEXITY_CHUNK_SCORER_FATAL/);
  });

  test("Gate 1 — 429 transient probe, retry succeeds → sweep proceeds", async () => {
    let calls = 0;
    const fetchSpy: typeof fetch = (async () => {
      calls += 1;
      if (calls === 1) return errorResponse(429, "rate limited");
      return successResponse();
    }) as unknown as typeof fetch;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: makeChunks(1),
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _log: pipelineLogMock,
    });

    expect(result).not.toBeNull();
    expect(result?.pass).toBe(1);
    expect(result?.criteria.length).toBe(CRITERIA_KEYS.length);
  });

  test("Gate 1 — 429 transient probe, retry also 429 → throws TRANSIENT", async () => {
    const fetchSpy: typeof fetch = (async () =>
      errorResponse(429, "rate limited")) as unknown as typeof fetch;

    await expect(
      runPerplexityChunkScorer({
        manuscriptText: "x",
        manuscriptChunks: makeChunks(40),
        workType: "novel",
        title: "T",
        perplexityApiKey: "test-key",
        _fetch: fetchSpy,
        _sleep: async () => undefined,
      _log: pipelineLogMock,
      }),
    ).rejects.toThrow(/PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE/);
  });

  test("Gate 2 — 3/4 sample chunks fail → throws HIGH_ERROR_RATE", async () => {
    // chunks 0 (probe) succeeds, then sample = chunks 1-4 (4 of them).
    // We want 3 of those 4 sample requests to fail with a transient error.
    // The probe call is the first call (index 0). After that, sample is concurrent.
    // To control which calls fail we look at the call body for `chunk N content`.
    const fetchSpy: typeof fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse((init.body as string) ?? "{}");
      const userMsg = body.messages?.[1]?.content ?? "";
      const m = /chunk (\d+) content/.exec(userMsg);
      const idx = m ? Number(m[1]) : -1;
      if (idx >= 1 && idx <= 3) {
        return errorResponse(500, "boom");
      }
      return successResponse();
    }) as unknown as typeof fetch;

    await expect(
      runPerplexityChunkScorer({
        manuscriptText: "x",
        manuscriptChunks: makeChunks(40),
        workType: "novel",
        title: "T",
        perplexityApiKey: "test-key",
        _fetch: fetchSpy,
        _sleep: async () => undefined,
      _log: pipelineLogMock,
      }),
    ).rejects.toThrow(/PERPLEXITY_CHUNK_SCORER_HIGH_ERROR_RATE/);
  });

  test("Gate 2 — 1/4 sample chunks fail → does NOT throw, proceeds to main batch", async () => {
    const fetchSpy: typeof fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse((init.body as string) ?? "{}");
      const userMsg = body.messages?.[1]?.content ?? "";
      const m = /chunk (\d+) content/.exec(userMsg);
      const idx = m ? Number(m[1]) : -1;
      if (idx === 2) {
        return errorResponse(500, "boom");
      }
      return successResponse();
    }) as unknown as typeof fetch;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: makeChunks(40),
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _log: pipelineLogMock,
    });

    expect(result).not.toBeNull();
    expect(result?.criteria.length).toBe(CRITERIA_KEYS.length);
  });

  test("Gate 3 — per-chunk error logging: chunk 7 fails → pipelineLog called with chunkIndex 7", async () => {
    const fetchSpy: typeof fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse((init.body as string) ?? "{}");
      const userMsg = body.messages?.[1]?.content ?? "";
      const m = /chunk (\d+) content/.exec(userMsg);
      const idx = m ? Number(m[1]) : -1;
      if (idx === 7) {
        return errorResponse(500, "boom on 7");
      }
      return successResponse();
    }) as unknown as typeof fetch;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: makeChunks(40),
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _log: pipelineLogMock,
    });

    expect(result).not.toBeNull();

    const chunk7Log = pipelineLogMock.mock.calls.find((c) => {
      const arg = c[0] as { metadata?: { chunkIndex?: number } };
      return arg.metadata?.chunkIndex === 7;
    });
    expect(chunk7Log).toBeDefined();
  });

  test("happy path with success across all chunks returns SinglePassOutput", async () => {
    const fetchSpy: typeof fetch = (async () => successResponse()) as unknown as typeof fetch;
    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: makeChunks(10),
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _log: pipelineLogMock,
    });
    expect(result).not.toBeNull();
    expect(result?.pass).toBe(1);
    expect(result?.axis).toBe("craft_execution");
    expect(result?.model).toBe("sonar-reasoning-pro");
    expect(result?.criteria.length).toBe(CRITERIA_KEYS.length);
    for (const c of result!.criteria) {
      expect(c.score_0_10).toBeGreaterThanOrEqual(1);
      expect(c.score_0_10).toBeLessThanOrEqual(10);
    }
  });

  test("missing criteria in response are backfilled with placeholder", async () => {
    const partialCriteria = {
      concept: { score: 7, rationale: "ok", evidence: "snippet" },
      voice: { score: 4, rationale: "weak", evidence: "snippet" },
      pacing: { score: 6, rationale: "ok", evidence: "snippet" },
    };
    const fetchSpy: typeof fetch = (async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [
              {
                message: { content: JSON.stringify({ criteria: partialCriteria }) },
                finish_reason: "stop",
              },
            ],
          };
        },
        async text() {
          return "";
        },
      }) as unknown as Response) as unknown as typeof fetch;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: [{ chunk_index: 0, content: "x" }],
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _log: pipelineLogMock,
    });
    expect(result).not.toBeNull();
    expect(result?.criteria.length).toBe(CRITERIA_KEYS.length);
    const placeholderCount = result!.criteria.filter((c) =>
      c.rationale.includes("criterion missing from response"),
    ).length;
    expect(placeholderCount).toBe(CRITERIA_KEYS.length - 3);
  });

  test("clamps out-of-range scores into 1..10", async () => {
    const outOfRangeCriteria = Object.fromEntries(
      CRITERIA_KEYS.map((key, i) => [
        key,
        {
          score: i === 0 ? 99 : i === 1 ? -3 : 5,
          rationale: `rationale for ${key}`,
          evidence: `evidence for ${key}`,
        },
      ]),
    );
    const fetchSpy: typeof fetch = (async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [
              {
                message: { content: JSON.stringify({ criteria: outOfRangeCriteria }) },
                finish_reason: "stop",
              },
            ],
          };
        },
        async text() {
          return "";
        },
      }) as unknown as Response) as unknown as typeof fetch;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "x",
      manuscriptChunks: [{ chunk_index: 0, content: "x" }],
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
      _sleep: async () => undefined,
      _log: pipelineLogMock,
    });
    expect(result).not.toBeNull();
    for (const c of result!.criteria) {
      expect(c.score_0_10).toBeGreaterThanOrEqual(1);
      expect(c.score_0_10).toBeLessThanOrEqual(10);
    }
  });
});
