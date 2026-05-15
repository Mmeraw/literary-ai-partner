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
  "narrativeClosure",
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
      usage: { prompt_tokens: 1234, completion_tokens: 567, total_tokens: 1801 },
    }),
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  };
}

type Pass4LogLine = {
  level: "log" | "warn" | "error";
  payload: Record<string, unknown>;
};

function collectPass4Logs(): {
  lines: Pass4LogLine[];
  restore: () => void;
} {
  const lines: Pass4LogLine[] = [];
  const consoleLog = jest.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith("[Pass4] {")) {
      try {
        const json = first.slice("[Pass4] ".length);
        lines.push({ level: "log", payload: JSON.parse(json) });
      } catch {
        // unstructured legacy log; ignore
      }
    }
  });
  const consoleWarn = jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith("[Pass4] {")) {
      try {
        const json = first.slice("[Pass4] ".length);
        lines.push({ level: "warn", payload: JSON.parse(json) });
      } catch {
        // unstructured legacy log; ignore
      }
    }
  });
  const consoleError = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith("[Pass4] {")) {
      try {
        const json = first.slice("[Pass4] ".length);
        lines.push({ level: "error", payload: JSON.parse(json) });
      } catch {
        // unstructured legacy log; ignore
      }
    }
  });

  return {
    lines,
    restore: () => {
      consoleLog.mockRestore();
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    },
  };
}

function eventsOf(lines: Pass4LogLine[]): string[] {
  return lines.map((l) => String(l.payload.event));
}

describe("runPerplexityCrossCheck structured observability", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("healthy response emits start → attempt → parse(ok) → complete with the supplied job_id", async () => {
    const payload = makePerplexityPayload();
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse(JSON.stringify(payload)) as unknown as Response,
    );
    global.fetch = fetchMock;

    const log = collectPass4Logs();

    try {
      const result = await runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
        jobId: "job-healthy-001",
      });
      expect(result.canonValid).toBe(true);
    } finally {
      log.restore();
    }

    const events = eventsOf(log.lines);
    expect(events).toEqual(["pass4_start", "pass4_attempt", "pass4_parse", "pass4_complete"]);

    const start = log.lines[0].payload;
    expect(start.job_id).toBe("job-healthy-001");
    expect(start.chunk_count).toBe(PASS4_KEYS.length);
    expect(start.model).toBe("sonar-reasoning-pro");
    expect(typeof start.prompt_chars).toBe("number");
    expect(start.max_completion_tokens).toBe(12000);

    const attempt = log.lines[1].payload;
    expect(attempt.attempt).toBe(1);
    expect(attempt.http_status).toBe(200);
    expect(attempt.finish_reason).toBe("stop");
    expect(attempt.usage).toEqual({
      prompt_tokens: 1234,
      completion_tokens: 567,
      total_tokens: 1801,
    });

    const parse = log.lines[2].payload;
    expect(parse.refusal_detected).toBe(false);
    expect(parse.shape_variant).toBe("canonical");
    expect(parse.parse_outcome).toBe("ok");
    expect(Array.isArray(parse.criteria_keys_seen)).toBe(true);
    expect((parse.criteria_keys_seen as string[]).length).toBe(PASS4_KEYS.length);

    const complete = log.lines[3].payload;
    expect(complete.final_status).toBe("success");
    expect(complete.cross_check_returned).toBe(true);
    expect(complete.attempts_made).toBe(1);
    expect(complete.error_code).toBeNull();
  });

  it("refusal-then-recovered emits two attempts + two parses with refusal_detected on attempt 1", async () => {
    const payload = makePerplexityPayload();
    const refusalText =
      "I cannot do literary judgment. As a search-based assistant, that falls outside my design.";
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeFetchResponse(refusalText) as unknown as Response)
      .mockResolvedValueOnce(makeFetchResponse(JSON.stringify(payload)) as unknown as Response);
    global.fetch = fetchMock;

    const log = collectPass4Logs();

    try {
      const result = await runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
        jobId: "job-refuse-recover-002",
      });
      expect(result.canonValid).toBe(true);
    } finally {
      log.restore();
    }

    const parseLines = log.lines.filter((l) => l.payload.event === "pass4_parse");
    expect(parseLines).toHaveLength(2);
    expect(parseLines[0].payload.refusal_detected).toBe(true);
    expect(parseLines[0].payload.parse_outcome).toBe("refusal");
    expect(typeof parseLines[0].payload.refusal_signature).toBe("string");
    expect(parseLines[1].payload.refusal_detected).toBe(false);
    expect(parseLines[1].payload.parse_outcome).toBe("ok");

    const attemptLines = log.lines.filter((l) => l.payload.event === "pass4_attempt");
    expect(attemptLines.map((l) => l.payload.attempt)).toEqual([1, 2]);

    const complete = log.lines.find((l) => l.payload.event === "pass4_complete");
    expect(complete?.payload.attempts_made).toBe(2);
    expect(complete?.payload.final_status).toBe("success");
  });

  it("canon-invalid (missing required field) emits pass4_failed with error_code=PASS4_CANON_INVALID", async () => {
    const payload = makePerplexityPayload();
    // Strip the required doctrineTrace+scoringBand+rationale on one criterion so
    // validatePerplexityCriterion throws a canon-shaped error (the shape that
    // surfaces in real Pass 4 canon-invalid failures).
    (payload.criteria.concept as Record<string, unknown>).scoringBand = "invalid";
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse(JSON.stringify(payload)) as unknown as Response,
    );
    global.fetch = fetchMock;

    const log = collectPass4Logs();

    let threw = false;
    try {
      await runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
        jobId: "job-canon-invalid-003",
      });
    } catch {
      threw = true;
    } finally {
      log.restore();
    }

    expect(threw).toBe(true);
    const failed = log.lines.find((l) => l.payload.event === "pass4_failed");
    expect(failed).toBeDefined();
    expect(failed?.payload.error_code).toBe("PASS4_CANON_INVALID");
    expect(failed?.payload.final_status).toBe("canon_invalid");
    expect(failed?.payload.cross_check_returned).toBe(false);
    expect(failed?.payload.job_id).toBe("job-canon-invalid-003");
  });

  it("analysisMetadata wrapper response produces parse log with shape_variant=analysisMetadata_wrapper", async () => {
    const inner = makePerplexityPayload();
    // Wrap in analysisMetadata so detectShapeVariant identifies the wrapper variant
    // (the same shape observed in 1 of 11 historical Pass 4 audit failures).
    const wrapped = {
      analysisMetadata: {
        criteria: inner.criteria,
        synthesisNote: inner.synthesisNote,
      },
    };
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse(JSON.stringify(wrapped)) as unknown as Response,
    );
    global.fetch = fetchMock;

    const log = collectPass4Logs();

    try {
      const result = await runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
        jobId: "job-shape-variant-004",
      });
      expect(result.canonValid).toBe(true);
    } finally {
      log.restore();
    }

    const parse = log.lines.find((l) => l.payload.event === "pass4_parse");
    expect(parse).toBeDefined();
    expect(parse?.payload.shape_variant).toBe("analysisMetadata_wrapper");
    expect(parse?.payload.parse_outcome).toBe("ok");
  });

  it("omitted jobId defaults to 'unknown' in log lines (back-compat for callers not yet plumbed)", async () => {
    const payload = makePerplexityPayload();
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse(JSON.stringify(payload)) as unknown as Response,
    );
    global.fetch = fetchMock;

    const log = collectPass4Logs();

    try {
      await runPerplexityCrossCheck({
        openaiCriteria: makeOpenAICriteria(),
        openaiSynthesis: "Primary evaluator synthesis.",
        manuscriptExcerpt: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "The Valley",
        perplexityApiKey: "pplx-test",
      });
    } finally {
      log.restore();
    }

    for (const line of log.lines) {
      expect(line.payload.job_id).toBe("unknown");
    }
  });
});
