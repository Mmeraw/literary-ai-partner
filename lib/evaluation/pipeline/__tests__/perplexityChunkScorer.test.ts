import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { runPerplexityChunkScorer } from "../perplexityChunkScorer";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

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

function buildFetchMock(opts: { jsonBody?: unknown; status?: number; text?: string } = {}) {
  const body = opts.jsonBody ?? {
    choices: [
      {
        message: { content: buildPerplexityChunkResponseJson() },
        finish_reason: "stop",
      },
    ],
  };
  const status = opts.status ?? 200;
  const text = opts.text ?? "";
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return body;
      },
      async text() {
        return text;
      },
    }) as unknown as Response;
}

describe("runPerplexityChunkScorer", () => {
  const ORIGINAL_KEY = process.env.PERPLEXITY_API_KEY;

  beforeEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_KEY !== undefined) {
      process.env.PERPLEXITY_API_KEY = ORIGINAL_KEY;
    } else {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  test("returns null when PERPLEXITY_API_KEY is missing (graceful degradation)", async () => {
    const result = await runPerplexityChunkScorer({
      manuscriptText: "Short manuscript text.",
      manuscriptChunks: [{ chunk_index: 0, content: "Short manuscript text." }],
      workType: "novel",
      title: "Test",
    });
    expect(result).toBeNull();
  });

  test("returns a SinglePassOutput shape covering all 13 criteria when API responds successfully", async () => {
    const fetchMock = buildFetchMock();
    const result = await runPerplexityChunkScorer({
      manuscriptText: "Test manuscript content sufficient for one chunk.",
      manuscriptChunks: [
        { chunk_index: 0, content: "Test manuscript content sufficient for one chunk." },
      ],
      workType: "novel",
      title: "Test",
      perplexityApiKey: "test-key",
      _fetch: fetchMock as unknown as typeof fetch,
    });

    expect(result).not.toBeNull();
    expect(result?.pass).toBe(1);
    expect(result?.axis).toBe("craft_execution");
    expect(result?.model).toBe("sonar-reasoning-pro");
    expect(result?.temperature).toBe(0.1);
    expect(Array.isArray(result?.criteria)).toBe(true);
    expect(result?.criteria.length).toBe(CRITERIA_KEYS.length);

    const keys = new Set(result?.criteria.map((c) => c.key));
    for (const key of CRITERIA_KEYS) {
      expect(keys.has(key)).toBe(true);
    }

    for (const c of result!.criteria) {
      expect(c.score_0_10).toBeGreaterThanOrEqual(1);
      expect(c.score_0_10).toBeLessThanOrEqual(10);
      expect(typeof c.rationale).toBe("string");
      expect(c.rationale.length).toBeGreaterThan(0);
    }
  });

  test("calls Perplexity API once per chunk with sonar-reasoning-pro and disable_search", async () => {
    const captured: Array<{ url: string; body: unknown }> = [];
    const fetchSpy: typeof fetch = (async (url: string, init: RequestInit) => {
      const parsed = JSON.parse((init.body as string) ?? "{}");
      captured.push({ url, body: parsed });
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
    }) as unknown as typeof fetch;

    const chunks = [
      { chunk_index: 0, content: "Chunk zero content." },
      { chunk_index: 1, content: "Chunk one content." },
    ];

    const result = await runPerplexityChunkScorer({
      manuscriptText: "Chunk zero content.\nChunk one content.",
      manuscriptChunks: chunks,
      workType: "novel",
      title: "Test",
      perplexityApiKey: "test-key",
      _fetch: fetchSpy,
    });

    expect(result).not.toBeNull();
    expect(captured.length).toBe(2);
    for (const call of captured) {
      expect(call.url).toContain("api.perplexity.ai");
      const body = call.body as Record<string, unknown>;
      expect(body.model).toBe("sonar-reasoning-pro");
      expect(body.disable_search).toBe(true);
      expect(body.reasoning_effort).toBe("high");
      expect(body.temperature).toBe(0.1);
    }
  });

  test("returns null when every chunk request fails (graceful degradation)", async () => {
    const failingFetch: typeof fetch = (async () =>
      ({
        ok: false,
        status: 500,
        async json() {
          return {};
        },
        async text() {
          return "internal error";
        },
      }) as unknown as Response) as unknown as typeof fetch;

    const result = await runPerplexityChunkScorer({
      manuscriptText: "Test.",
      manuscriptChunks: [{ chunk_index: 0, content: "Test." }],
      workType: "novel",
      title: "Test",
      perplexityApiKey: "test-key",
      _fetch: failingFetch,
    });

    expect(result).toBeNull();
  });

  test("clamps out-of-range scores into the canonical 1..10 range", async () => {
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
    const fetchMock = buildFetchMock({
      jsonBody: {
        choices: [
          {
            message: { content: JSON.stringify({ criteria: outOfRangeCriteria }) },
            finish_reason: "stop",
          },
        ],
      },
    });
    const result = await runPerplexityChunkScorer({
      manuscriptText: "text",
      manuscriptChunks: [{ chunk_index: 0, content: "text" }],
      workType: "novel",
      title: "T",
      perplexityApiKey: "test-key",
      _fetch: fetchMock as unknown as typeof fetch,
    });
    expect(result).not.toBeNull();
    for (const c of result!.criteria) {
      expect(c.score_0_10).toBeGreaterThanOrEqual(1);
      expect(c.score_0_10).toBeLessThanOrEqual(10);
    }
  });
});
