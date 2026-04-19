import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
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
});
