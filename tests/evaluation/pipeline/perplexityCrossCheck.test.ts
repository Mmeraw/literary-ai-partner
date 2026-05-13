import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  detectPerplexityRefusal,
  normalizeCrossCheckShape,
  PerplexityRefusalError,
  runPerplexityCrossCheck,
  type CriterionKey,
  type OpenAICriterionInput,
} from "@/lib/evaluation/pipeline/perplexityCrossCheck";

const PASS4_KEYS: CriterionKey[] = [
  "concept",
  "narrativeDrive",
  "character",
  "voice",
  "sceneConstruction",
  "dialogue",
  "theme",
  "worldbuilding",
  "pacing",
  "proseControl",
  "tone",
  "emotionalResonance",
  "marketability",
];

function makeOpenAICriteria(): Record<CriterionKey, OpenAICriterionInput> {
  return Object.fromEntries(
    PASS4_KEYS.map((key) => [
      key,
      {
        score: 7,
        rationale: `OpenAI rationale for ${key}.`,
        evidence: ["The river moved slowly through the valley."],
        detectedSignals: ["scene pressure", "voice consistency"],
        scoringBand: "7-8",
      },
    ]),
  ) as Record<CriterionKey, OpenAICriterionInput>;
}

function makePerplexityPayload() {
  return {
    criteria: Object.fromEntries(
      PASS4_KEYS.map((key) => [
        key,
        {
          score: 7,
          rationale: `Perplexity rationale for ${key}.`,
          evidence: [
            {
              quote: "The river moved slowly through the valley.",
              explanation: `Evidence for ${key}.`,
            },
          ],
          detectedSignals: ["scene pressure", "voice consistency"],
          scoringBand: "7-8",
          doctrineTrace: ["signal-grounded scoring"],
        },
      ]),
    ),
    synthesisNote: "Cross-check agrees with the primary evaluation.",
  };
}

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function makeFetchResponse(content: unknown, finishReason = "stop"): MockResponse {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          finish_reason: finishReason,
          message: { content },
        },
      ],
    }),
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  };
}

describe("runPerplexityCrossCheck", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("parses JSON returned in Perplexity content blocks", async () => {
    const payload = makePerplexityPayload();
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse([
        {
          type: "output_text",
          text: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
        },
      ]) as unknown as Response,
    );
    global.fetch = fetchMock;

    const result = await runPerplexityCrossCheck({
      openaiCriteria: makeOpenAICriteria(),
      openaiSynthesis: "Primary evaluator synthesis.",
      manuscriptExcerpt: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "The Valley",
      perplexityApiKey: "pplx-test",
    });

    expect(result.canonValid).toBe(true);
    expect(result.overallAgreement).toBe("STRONG");
    expect(result.disputedCriteria).toHaveLength(0);
  });

  it("retries once with a higher token budget when the first response is truncated", async () => {
    const payload = makePerplexityPayload();
    const fullJson = JSON.stringify(payload);
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeFetchResponse(fullJson.slice(0, Math.floor(fullJson.length / 2)), "length") as unknown as Response,
      )
      .mockResolvedValueOnce(makeFetchResponse(fullJson) as unknown as Response);
    global.fetch = fetchMock;

    const result = await runPerplexityCrossCheck({
      openaiCriteria: makeOpenAICriteria(),
      openaiSynthesis: "Primary evaluator synthesis.",
      manuscriptExcerpt: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "The Valley",
      perplexityApiKey: "pplx-test",
    });

    expect(result.canonValid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}"));
    expect(secondBody.max_tokens).toBeGreaterThan(firstBody.max_tokens);
  });

  it("fails explicitly when both initial and retry responses are truncated/incomplete", async () => {
    const payload = makePerplexityPayload();
    const fullJson = JSON.stringify(payload);
    const firstSlice = fullJson.slice(0, Math.floor(fullJson.length / 4));
    const secondSlice = fullJson.slice(0, Math.floor(fullJson.length / 3));

    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeFetchResponse(firstSlice, "length") as unknown as Response,
      )
      .mockResolvedValueOnce(
        makeFetchResponse(secondSlice, "length") as unknown as Response,
      );
    global.fetch = fetchMock;

    await expect(
      runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
      }),
    ).rejects.toThrow(/\[Pass4\] JSON_PARSE_FAILED_/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends the hardened request body (response_format, disable_search, reasoning_effort, stream_mode, raised max_tokens)", async () => {
    const payload = makePerplexityPayload();
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse(JSON.stringify(payload)) as unknown as Response,
    );
    global.fetch = fetchMock;

    await runPerplexityCrossCheck({
      openaiCriteria: makeOpenAICriteria(),
      openaiSynthesis: "Primary evaluator synthesis.",
      manuscriptExcerpt: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "The Valley",
      perplexityApiKey: "pplx-test",
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.response_format?.type).toBe("json_schema");
    expect(body.response_format?.json_schema?.strict).toBe(true);
    expect(body.response_format?.json_schema?.schema?.required).toEqual(
      expect.arrayContaining(["criteria", "synthesisNote"]),
    );
    expect(body.disable_search).toBe(true);
    expect(body.reasoning_effort).toBe("high");
    expect(body.stream_mode).toBe("concise");
    expect(body.max_tokens).toBe(12000);
  });

  it("retries once with a sharpened prompt when the model refuses, then succeeds", async () => {
    const payload = makePerplexityPayload();
    const refusalText =
      "I cannot do literary judgment. As a search-based assistant, that falls outside my design.";
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeFetchResponse(refusalText) as unknown as Response)
      .mockResolvedValueOnce(makeFetchResponse(JSON.stringify(payload)) as unknown as Response);
    global.fetch = fetchMock;

    const result = await runPerplexityCrossCheck({
      openaiCriteria: makeOpenAICriteria(),
      openaiSynthesis: "Primary evaluator synthesis.",
      manuscriptExcerpt: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "The Valley",
      perplexityApiKey: "pplx-test",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.canonValid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Perplexity refused literary judgment/i),
      ]),
    );

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}"));
    const secondUser = secondBody.messages?.find((m: { role: string }) => m.role === "user")?.content ?? "";
    expect(secondUser).toMatch(/RE-FRAMING/);
    expect(secondUser).toMatch(/NOT a web research task/);
  });

  it("throws PerplexityRefusalError when the retry response is still a refusal", async () => {
    const refusalText =
      "I cannot perform literary judgment. I am a search-based assistant and this is outside my design.";
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeFetchResponse(refusalText) as unknown as Response)
      .mockResolvedValueOnce(makeFetchResponse(refusalText) as unknown as Response);
    global.fetch = fetchMock;

    await expect(
      runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
      }),
    ).rejects.toBeInstanceOf(PerplexityRefusalError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("detectPerplexityRefusal", () => {
  it("returns the matched phrase when a refusal phrase appears in leading prose", () => {
    expect(detectPerplexityRefusal("I cannot evaluate this manuscript.")).toBe("i cannot");
    // Second case contains multiple refusal phrases; the first matching one wins.
    expect(
      detectPerplexityRefusal("As an AI search assistant, this falls outside my design."),
    ).toMatch(/search assistant|outside my design|as an ai search/);
  });

  it("returns null for valid JSON responses", () => {
    expect(detectPerplexityRefusal('{"criteria":{}}')).toBeNull();
    expect(detectPerplexityRefusal("  {\"criteria\":{}}  ")).toBeNull();
    expect(detectPerplexityRefusal("```json\n{}\n```")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectPerplexityRefusal("")).toBeNull();
  });
});

describe("normalizeCrossCheckShape", () => {
  it("passes the strict object-keyed shape through unchanged", () => {
    const strict = {
      criteria: { concept: { score: 7 } },
      synthesisNote: "summary",
    };
    const normalized = normalizeCrossCheckShape(strict) as {
      criteria: Record<string, { score: number }>;
      synthesisNote: string;
    };
    expect(normalized.criteria.concept.score).toBe(7);
    expect(normalized.synthesisNote).toBe("summary");
  });

  it("rekeys criteria-as-array into criteria-as-record using the name field", () => {
    const arrayShape = {
      criteria: [
        { name: "concept", score: 8, rationale: "r" },
        { name: "voice", score: 6, rationale: "r" },
      ],
      synthesisNote: "ok",
    };
    const normalized = normalizeCrossCheckShape(arrayShape) as {
      criteria: Record<string, { score: number; rationale: string }>;
    };
    expect(normalized.criteria.concept.score).toBe(8);
    expect(normalized.criteria.voice.score).toBe(6);
    // Ensure the name field itself is stripped from the inner criterion object.
    expect((normalized.criteria.concept as Record<string, unknown>).name).toBeUndefined();
  });

  it("rekeys criteria-as-array using the key field when name is absent", () => {
    const arrayShape = {
      criteria: [{ key: "theme", score: 9 }],
    };
    const normalized = normalizeCrossCheckShape(arrayShape) as {
      criteria: Record<string, { score: number }>;
    };
    expect(normalized.criteria.theme.score).toBe(9);
  });

  it("unwraps the analysisMetadata wrapper variant", () => {
    const wrapped = {
      analysisMetadata: {
        criteria: { concept: { score: 5 } },
        synthesisNote: "inner synthesis",
      },
    };
    const normalized = normalizeCrossCheckShape(wrapped) as {
      criteria: Record<string, { score: number }>;
      synthesisNote: string;
    };
    expect(normalized.criteria.concept.score).toBe(5);
  });

  it("maps snake_case synthesis aliases to synthesisNote", () => {
    const snake = {
      criteria: { concept: { score: 7 } },
      synthesis_note: "snake summary",
    };
    const normalized = normalizeCrossCheckShape(snake) as { synthesisNote: string };
    expect(normalized.synthesisNote).toBe("snake summary");

    const altSnake = {
      criteria: { concept: { score: 7 } },
      synthesis: "alt summary",
    };
    const altNormalized = normalizeCrossCheckShape(altSnake) as { synthesisNote: string };
    expect(altNormalized.synthesisNote).toBe("alt summary");
  });

  it("handles non-object input gracefully", () => {
    expect(normalizeCrossCheckShape(null)).toBeNull();
    expect(normalizeCrossCheckShape("string")).toBe("string");
    expect(normalizeCrossCheckShape(42)).toBe(42);
  });
});
