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

  // ── RCA-U2-006 G1 — deterministic branch coverage ──────────────────────────
  //
  // These tests prove every branch of hasTextualAnchor() and the score cap
  // through the real parsePass2Response() integration path.
  //
  // hasTextualAnchor() PASS conditions (any one sufficient):
  //   A. rationale contains a quoted string ≥8 chars  /[""""][^""""]{8,}[""""]/
  //   B. any evidence snippet contains a quoted string ≥8 chars (same regex)
  //   C. any evidence snippet is ≥20 chars (no quotes required)
  //
  // Score cap when all conditions fail:
  //   cappedScore = Math.max(1, Math.min(originalScore, 5))
  //   reason_codes gains "NO_TEXTUAL_ANCHOR"

  // PASS-A: rationale alone has a qualifying quoted string — no evidence needed
  test("PASS-A: does not cap when rationale contains quoted text ≥8 chars", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "concept",
          score_0_10: 8,
          rationale: 'The author anchors the premise in \u201cI cannot forgive what you did\u201d, making the conflict explicit.',
          evidence: [{ snippet: "short" }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(8);
    expect(parsed.criteria[0].reason_codes ?? []).not.toContain("NO_TEXTUAL_ANCHOR");
  });

  // PASS-A negative: quoted text in rationale that is shorter than 8 chars must not satisfy PASS-A
  test("PASS-A negative: short quote in rationale (<8 chars) still triggers cap", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "concept",
          score_0_10: 9,
          // \u201coh no\u201d is only 5 chars between quotes — below the 8-char minimum
          rationale: 'She said \u201coh no\u201d and left.',
          evidence: [{ snippet: "tiny" }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  // PASS-B: evidence snippet alone has a qualifying quoted string
  test("PASS-B: does not cap when evidence snippet contains quoted text ≥8 chars", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "voice",
          score_0_10: 7,
          rationale: "The passage is relevant to the analysis.",
          evidence: [{ snippet: '\u201cThe fog rolled in like a living thing\u201d' }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(7);
    expect(parsed.criteria[0].reason_codes ?? []).not.toContain("NO_TEXTUAL_ANCHOR");
  });

  // PASS-C: evidence snippet ≥20 chars (no quotes required)
  test("PASS-C: does not cap when evidence snippet is ≥20 chars without quotes", () => {
    const snippet = "The castle loomed above the village in the early morning light.";
    expect(snippet.length).toBeGreaterThanOrEqual(20);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "sceneConstruction",
          score_0_10: 6,
          rationale: "The scene is well described.",
          evidence: [{ snippet }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(6);
    expect(parsed.criteria[0].reason_codes ?? []).not.toContain("NO_TEXTUAL_ANCHOR");
  });

  // PASS-C boundary: snippet exactly 20 chars passes
  test("PASS-C boundary: snippet of exactly 20 chars does not trigger cap", () => {
    const snippet = "A".repeat(20);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "pacing",
          score_0_10: 5,
          rationale: "Minimal.",
          evidence: [{ snippet }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes ?? []).not.toContain("NO_TEXTUAL_ANCHOR");
  });

  // FAIL boundary: snippet at 19 chars (one under threshold) triggers cap
  test("FAIL boundary: snippet of 19 chars triggers NO_TEXTUAL_ANCHOR", () => {
    const snippet = "A".repeat(19);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "pacing",
          score_0_10: 8,
          rationale: "Plain observation.",
          evidence: [{ snippet }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  // Score cap ceiling: score already at 5 stays at 5
  test("score cap ceiling: failing criterion with score=5 stays at 5", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "theme",
          score_0_10: 5,
          rationale: "No anchored quote here.",
          evidence: [{ snippet: "tiny" }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  // Score cap floor: score=1 stays at 1 (Math.max(1, ...) floor)
  test("score cap floor: failing criterion with score=1 stays at 1", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          score_0_10: 1,
          rationale: "",
          evidence: [],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(1);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  // Score cap mid: score=6 capped to 5
  test("score cap: failing criterion with score=6 is capped to 5", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "tone",
          score_0_10: 6,
          rationale: "Plain sentence with no quoted anchor.",
          evidence: [{ snippet: "small" }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  // Empty evidence, valid quoted rationale → PASS-A path, no cap
  test("PASS-D: empty evidence with valid quoted rationale passes via PASS-A", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "character",
          score_0_10: 7,
          rationale: 'She whispered \u201cI always knew this would happen\u201d as the door closed behind her.',
          evidence: [],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(7);
    expect(parsed.criteria[0].reason_codes ?? []).not.toContain("NO_TEXTUAL_ANCHOR");
  });

  // Empty evidence, plain rationale → FAIL — triggers cap
  test("FAIL-E: empty evidence and plain rationale triggers NO_TEXTUAL_ANCHOR", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "worldbuilding",
          score_0_10: 8,
          rationale: "The character grows considerably over the course of this chapter.",
          evidence: [],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria[0].score_0_10).toBe(5);
    expect(parsed.criteria[0].reason_codes).toContain("NO_TEXTUAL_ANCHOR");
  });

  // Multi-criterion: cap fires on the failing one, not the passing one
  test("multi-criterion: cap fires only on criteria that fail anchor check", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          key: "concept",
          score_0_10: 9,
          rationale: 'Anchored in \u201cShe opened the sealed letter and stepped forward\u201d — strong premise.',
          evidence: [{ snippet: '\u201cShe opened the sealed letter and stepped forward\u201d' }],
          recommendations: [],
        },
        {
          key: "pacing",
          score_0_10: 9,
          rationale: "The pacing is generally appropriate for the genre.",
          evidence: [{ snippet: "weak" }],
          recommendations: [],
        },
      ],
    });

    const parsed = parsePass2Response(raw);
    expect(parsed.criteria).toHaveLength(2);

    const concept = parsed.criteria.find((c) => c.key === "concept");
    const pacing = parsed.criteria.find((c) => c.key === "pacing");

    // concept passes — no cap
    expect(concept?.score_0_10).toBe(9);
    expect(concept?.reason_codes ?? []).not.toContain("NO_TEXTUAL_ANCHOR");

    // pacing fails — capped
    expect(pacing?.score_0_10).toBe(5);
    expect(pacing?.reason_codes).toContain("NO_TEXTUAL_ANCHOR");
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
