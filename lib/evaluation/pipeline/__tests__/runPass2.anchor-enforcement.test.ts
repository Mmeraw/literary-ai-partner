import { describe, expect, test } from "@jest/globals";
import { parsePass2Response, runPass2 } from "@/lib/evaluation/pipeline/runPass2";

describe("runPass2 textual anchor enforcement", () => {
  test("caps score and emits NO_TEXTUAL_ANCHOR when rationale/evidence lack quoted anchors", () => {
    const raw = JSON.stringify({
      model: "o3",
      criteria: [
        {
          key: "concept",
          score_0_10: 9,
          rationale: "The concept is generally strong and coherent throughout.",
          evidence: [{ snippet: "Generic." }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria).toHaveLength(1);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  test("keeps score when textual anchors are present", () => {
    const raw = JSON.stringify({
      model: "o3",
      criteria: [
        {
          key: "concept",
          score_0_10: 9,
          rationale:
            'The central hook is explicit in "She opened the sealed letter" and escalates stakes immediately.',
          evidence: [{ snippet: '"She opened the sealed letter"' }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria).toHaveLength(1);
    expect(parsed.criteria[0].score_0_10).toBe(9);
    expect(parsed.criteria[0].reason_codes).toBeUndefined();
  });
});

describe("runPass2 truncated JSON retry", () => {
  test("retries once with a higher token budget when the first response is truncated JSON", async () => {
    const completionCalls: Array<{ max_tokens?: number; max_completion_tokens?: number }> = [];
    const validPayload = JSON.stringify({
      criteria: [
        {
          key: "concept",
          score_0_10: 8,
          rationale: 'The premise is anchored by "She opened the sealed letter" and escalates cleanly.',
          evidence: [{ snippet: '"She opened the sealed letter"' }],
          recommendations: [],
        },
      ],
    });

    const result = await runPass2({
      manuscriptText: "She opened the sealed letter and stepped into the rain.",
      workType: "fiction",
      title: "Retry Fixture",
      registry: new Map([["concept", {}]]) as any,
      openaiApiKey: "test-key",
      _createCompletion: async (params) => {
        completionCalls.push({
          max_tokens: params.max_tokens,
          max_completion_tokens: params.max_completion_tokens,
        });

        if (completionCalls.length === 1) {
          return {
            choices: [
              {
                message: { content: '{"criteria":[{"key":"concept","score_0_10":8,' },
                finish_reason: "length",
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
          };
        }

        return {
          choices: [
            {
              message: { content: validPayload },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        };
      },
    });

    expect(completionCalls).toHaveLength(2);
    expect(result.criteria).toHaveLength(1);
    expect(result.criteria[0].key).toBe("concept");
  });
});
