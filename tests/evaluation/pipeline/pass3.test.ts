/**
 * Phase 2.7 — Pass 3 Synthesis Tests
 *
 * Tests the parsePass3Response pure function directly (no OpenAI mock needed).
 * Also tests runPass3Synthesis with dependency-injected completion function.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response, runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import { validateTemplateCompleteness, isMeaningfulRecommendation } from "@/lib/evaluation/pipeline/templateCompletenessGate";
import { PASS3_PROMPT_VERSION } from "@/lib/evaluation/pipeline/prompts/pass3-synthesis";
import type { CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput , Pass1aCharacterLedger } from "@/lib/evaluation/pipeline/types";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import { buildPass2aStructuredContext } from "@/lib/evaluation/pipeline/buildPass2aStructuredContext";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePassOutput(pass: 1 | 2, axis: string): SinglePassOutput {
  return {
    pass,
    axis: axis as SinglePassOutput["axis"],
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Analysis of ${key} for pass ${pass}.`,
      evidence: [{ snippet: "The river moved slowly." }],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makePass3Fixture(overrides: Record<string, unknown> = {}) {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      delta_explanation: undefined,
      final_rationale: `Synthesized analysis for ${key} combining both axes.`,
      evidence: [{ snippet: "The river moved slowly." }],
      recommendations: [
        {
          priority: "medium",
          action: `Refine the ${key} dimension to achieve stronger integration between craft and editorial goals.`,
          expected_impact: "Elevates overall quality.",
          anchor_snippet: '"slowly"',
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "This manuscript shows strong potential but needs targeted revision before submission.",
      top_3_strengths: ["Strong voice", "Clear arc", "Vivid imagery"],
      top_3_risks: ["Pacing gaps", "Thin character motivation", "Weak world-building"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
    },
    ...overrides,
  };
}

function makePass2aStructuredContext() {
  return buildPass2aStructuredContext({
    manuscriptText:
      "Crown Hyla watched the chamber. Zimeon arrived three years later and met Thorander in the Dead Zone.",
  });
}

/** Helper: build a mock completion function that returns the given JSON string. */
function mockCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: responseJson } }],
  });
}

/** Helper: build a mock completion function that returns null content. */
function nullCompletion(): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: null } }],
  });
}

/** Helper: build a mock completion function that returns content parts rather than a flat string. */
function arrayContentCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [
      {
        message: {
          content: [{ type: "output_text", text: responseJson }],
        },
      },
    ],
  });
}

/** Helper: build a mock completion function that returns an empty response with finish metadata. */
function lengthLimitedEmptyCompletion(): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: null }, finish_reason: "length" }],
    usage: { prompt_tokens: 1234, completion_tokens: 8000, total_tokens: 9234 },
  });
}

// ── Pure parser tests ─────────────────────────────────────────────────────────


// Minimal character ledger stub — satisfies assertCharacterLedger() mandatory guard.
// Every novel has at least one character. Pass 3 cannot run without this.
const MINIMAL_CHARACTER_LEDGER: Pass1aCharacterLedger = {
  schema_version: "pass1a_character_ledger_v1",
  prompt_version: "test-stub",
  job_id: "test-job",
  generated_at: new Date().toISOString(),
  total_chunks_processed: 1,
  entries: [{
    canonical_name: "TestCharacter",
    aliases: [],
    pronouns: [],
    age_exact_first: null,
    age_exact_last: null,
    age_signal: null,
    gender_identity: "unknown",
    lgbtq_signals: [],
    racial_ethnic_signals: [],
    skin_tone_signals: [],
    language_signals: [],
    religion_signals: [],
    socioeconomic_signals: [],
    nationality_signals: [],
    disability_neuro_signals: [],
    role: "protagonist",
    narrative_weight_band: "major",
    is_named: true,
    presence_type: "present",
    who_is_this: "Test character for unit testing",
    what_do_they_want: null,
    primary_locations: [],
    why_signal: null,
    how_signal: null,
    arc_start: "initial state",
    arc_pressure: "test pressure",
    arc_turning_points: [],
    arc_end_state: "final state",
    ending_status: "resolved",
    symbolic_objects: [],
    relational_engines: [],
    evidence_anchors: [],
    report_acknowledgement_status: "adequately_accounted_for",
    warnings: [],
    first_chunk_index: 0,
    last_chunk_index: 0,
    mention_count: 1,
    nameStates: [{ name: "TestCharacter", validFromChunk: 0, validUntilChunk: null }],
    copingMechanisms: [],
    coPresenceMap: {},
  }],
  coverage_summary: {
    protagonists: ["TestCharacter"],
    co_protagonists: [],
    antagonists: [],
    major_secondary_characters: [],
    animal_companions: [],
    relational_engines: [],
    symbol_payoff_items: [],
    missing_or_underweighted: [],
    ending_accountability_warnings: [],
    hard_fail_triggers: [],
  },
};

describe("parsePass3Response", () => {
  const pass1 = makePassOutput(1, "craft_execution");
  const pass2 = makePassOutput(2, "editorial_literary");

  it("returns a valid SynthesisOutput with all 13 criteria", () => {
    const result = parsePass3Response(JSON.stringify(makePass3Fixture()), pass1, pass2);

    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(
      expect.arrayContaining(CRITERIA_KEYS as unknown as string[]),
    );
    expect(result.overall.overall_score_0_100).toBe(70);
    expect(result.overall.verdict).toBe("revise");
    expect(result.metadata.pass1_model).toBe("gpt-4o-mini");
  });

  it("preserves template-required semantic enrichment for final report assembly", () => {
    const fixture = makePass3Fixture({
      enrichment: {
        premise:
          "A haunted family story follows Sister through escalating grief, secrecy, and moral pressure.",
        trigger_warnings: ["grief", "family trauma"],
        diagnosed_genre: "literary horror",
        target_audience:
          "Adult readers of character-driven literary horror who value atmosphere, family secrets, and psychological tension.",
      },
    });

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    expect(result.enrichment?.premise).toContain("haunted family story");
    expect(result.enrichment?.trigger_warnings).toEqual(["grief", "family trauma"]);
    expect(result.enrichment?.diagnosed_genre).toBe("literary horror");
    expect(result.enrichment?.target_audience).toContain("Adult readers");
  });

  it("maps parsed short-form Phase 3 output into a template-complete EvaluationResultV2", () => {
    const fixture = makePass3Fixture({
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary:
          "Sister has a strong atmospheric premise and emotionally legible family pressure, but pacing, thematic escalation, and closure need targeted revision before the report can call it submission-ready.",
        top_3_strengths: [
          "Atmospheric voice creates immediate unease and tonal authority.",
          "Family pressure gives the central conflict emotional specificity.",
          "Scene-level imagery provides strong anchors for revision work.",
        ],
        top_3_risks: [
          "Pacing may flatten if transitions do not escalate consequence.",
          "Theme may feel repetitive without clearer turn-by-turn development.",
          "Closure may underdeliver if final consequences remain implicit.",
        ],
        submission_readiness: "nearly_ready",
      },
      enrichment: {
        premise:
          "A haunted family story follows Sister through escalating grief, secrecy, and moral pressure.",
        trigger_warnings: ["grief", "family trauma"],
        diagnosed_genre: "literary horror",
        target_audience:
          "Adult readers of character-driven literary horror who value atmosphere, family secrets, and psychological tension.",
      },
    });

    const parsed = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const manuscriptText = CRITERIA_KEYS.map((key) => `The river moved slowly while Sister carried ${key} pressure through the room.`).join(" ");
    const resultV2 = synthesisToEvaluationResultV2({
      synthesis: parsed,
      ids: {
        evaluation_run_id: "job-1dce7039-regression",
        job_id: "1dce7039-674d-44d6-b647-0742e0e696ec",
        manuscript_id: 7497,
        user_id: "test-user",
      },
      manuscriptText,
      title: "Sister",
      llmEnrichment: parsed.enrichment,
      scopeProfile: {
        inputScale: "standard_chapter",
        wordCount: 4899,
        chunkCount: 1,
        scorableCount: 1,
        confidenceCapSummary: "HIGH",
        scopePolicyVersion: "v1",
      } as import("@/lib/evaluation/pipeline/submissionScope").SubmissionScopeProfile,
    });

    const gate = validateTemplateCompleteness(resultV2);

    expect(gate.pass).toBe(true);
    expect(gate.violations.filter((violation) => violation.severity === "critical")).toEqual([]);
  });

  it("clips overall_score_0_100 to 0-100 range", () => {
    const fixture = makePass3Fixture({
      overall: {
        overall_score_0_100: 150,
        verdict: "pass",
        one_paragraph_summary: "Good.",
        top_3_strengths: [],
        top_3_risks: [],
        submission_readiness: "queryable_now",
      },
    });

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    expect(result.overall.overall_score_0_100).toBe(100);
  });

  it("falls back to averaging pass scores when AI omits final_score_0_10", () => {
    const fixture = makePass3Fixture();
    // Remove final_score_0_10 from first criterion so fallback triggers
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["final_score_0_10"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    // First criterion should fallback to avg of craft/editorial
    expect(result.criteria[0].final_score_0_10).toBeGreaterThanOrEqual(0);
    expect(result.criteria[0].final_score_0_10).toBeLessThanOrEqual(10);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePass3Response("not json", pass1, pass2)).toThrow("JSON_PARSE_FAILED_NO_OBJECT");
  });

  it("classifies clearly truncated response with JSON_PARSE_FAILED_TRUNCATED", () => {
    // A response that starts like JSON but is cut off before closing brace
    expect(() => parsePass3Response('{"key": "value"', pass1, pass2)).toThrow("JSON_PARSE_FAILED_TRUNCATED");
  });

  it("classifies malformed JSON ending with } as JSON_PARSE_FAILED_MALFORMED", () => {
    expect(() => parsePass3Response('{ this: is invalid }', pass1, pass2)).toThrow("JSON_PARSE_FAILED_MALFORMED");
  });

  it("strips markdown json fences before parse", () => {
    const fixture = makePass3Fixture();
    const fenced = "```json\n" + JSON.stringify(fixture) + "\n```";
    const result = parsePass3Response(fenced, pass1, pass2);
    expect(result.criteria).toHaveLength(13);
  });

  it("provides delta_explanation when score_delta > 2", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0].craft_score = 9;
    fixture.criteria[0].editorial_score = 3;
    fixture.criteria[0].delta_explanation = "Craft is strong but editorial insight is weak.";

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    expect(result.criteria[0].score_delta).toBe(6);
    expect(result.criteria[0].delta_explanation).toBeDefined();
  });

  it("preserves anchorless recommendations without fabricating actionability fields", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      evidence: [{ snippet: "Fritz's low growl broke the air before I spoke." }],
      recommendations: [
        {
          priority: "medium",
          action: "Readers will track stakes more clearly if they moved differently, sniffing, test",
          expected_impact: "Improves clarity for readers.",
          anchor_snippet: "",
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const rec = result.criteria[0].recommendations[0];

    expect(rec.anchor_snippet).toBe("");
    expect(rec.specific_fix).toBe("");
    expect(rec.action).toContain("Readers will track stakes more clearly");
  });

  it("injects weak-criterion mention into summary when omitted", () => {
    const fixture = makePass3Fixture();
    fixture.criteria = fixture.criteria.map((criterion, index) =>
      index < 3
        ? {
            ...criterion,
            final_score_0_10: 4,
          }
        : criterion,
    );
    fixture.overall.one_paragraph_summary =
      "The manuscript has momentum and vivid prose with a clear emotional throughline.";

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const summary = result.overall.one_paragraph_summary.toLowerCase();

    // PR-K (2026-05-16): Pass 3 now delegates to the canonical
    // normalizeSummaryWithBottomWeaknesses helper in propagationIntegrity.ts,
    // which emits "Main weaknesses center on <criteria>." and names EVERY
    // bottom-score criterion (not just one).
    expect(summary).toContain("main weaknesses center on");
    const bottomCriteria = result.criteria.filter(
      (criterion) => criterion.final_score_0_10 <= 5,
    );
    // Every bottom-score criterion's human-readable token must appear in
    // the summary — this is the parity contract with QualityGateV2's
    // v2_summary_weakness_presence check.
    for (const criterion of bottomCriteria) {
      const readableToken = criterion.key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .toLowerCase();
      expect(summary).toContain(readableToken);
    }
  });

  // ── Density repair: producer-side evidence-anchored synthesis ────────────────

  it("density repair: score-4 criterion with no LLM recs gets evidence-anchored recs added", () => {
    const fixture = makePass3Fixture();
    // Give one criterion a low score and strip its recommendations
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 4,
      editorial_score: 4,
      final_score_0_10: 4,
      recommendations: [],
      evidence: [{ snippet: "The river moved through darkness, cold and indifferent to the village." }],
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    const repaired = result.criteria[0];
    // Template gate requires ≥2 meaningful recs for score ≤5
    expect(repaired.recommendations.length).toBeGreaterThanOrEqual(2);
    // Every synthesized rec must have a non-empty action and specific_fix
    for (const rec of repaired.recommendations) {
      expect(rec.action.trim().length).toBeGreaterThan(0);
      expect(rec.specific_fix.trim().length).toBeGreaterThan(0);
      expect(rec.anchor_snippet.trim().length).toBeGreaterThan(0);
      expect(rec.source_pass).toBe(3);
    }
  });

  it("density repair: score-6 criterion with no LLM recs gets at least 1 rec added", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[1] = {
      ...fixture.criteria[1],
      craft_score: 6,
      editorial_score: 6,
      final_score_0_10: 6,
      recommendations: [],
      evidence: [{ snippet: "Zimeon opened the door and stared at the empty room." }],
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    const repaired = result.criteria[1];
    // Template gate requires ≥1 meaningful rec for score 6-7
    expect(repaired.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(repaired.recommendations[0].anchor_snippet.trim().length).toBeGreaterThan(0);
    expect(repaired.recommendations[0].source_pass).toBe(3);
  });

  it("density repair: repaired recs pass the template completeness gate", () => {
    const fixture = makePass3Fixture({
      overall: {
        overall_score_0_100: 65,
        verdict: "revise",
        one_paragraph_summary:
          "Sister has a strong atmospheric premise and emotionally legible family pressure, but pacing, thematic escalation, and closure need targeted revision before the report can call it submission-ready.",
        top_3_strengths: [
          "Atmospheric voice creates immediate unease and tonal authority.",
          "Family pressure gives the central conflict emotional specificity.",
          "Scene-level imagery provides strong anchors for revision work.",
        ],
        top_3_risks: [
          "Pacing may flatten if transitions do not escalate consequence.",
          "Theme may feel repetitive without clearer turn-by-turn development.",
          "Closure may underdeliver if final consequences remain implicit.",
        ],
        submission_readiness: "nearly_ready",
      },
      enrichment: {
        premise: "A haunted family story follows Sister through escalating grief, secrecy, and moral pressure.",
        diagnosed_genre: "literary horror",
        target_audience: "Adult readers of character-driven literary horror who value atmosphere and psychological tension.",
      },
    });
    // Strip recs from two low-scoring criteria
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 4, editorial_score: 4, final_score_0_10: 4,
      recommendations: [],
      evidence: [{ snippet: "The old house stood against the hill, grey and insistent." }],
      final_rationale: "The concept fails to establish a clear thematic premise by the first act, leaving the central dramatic question implicit.",
    };
    fixture.criteria[1] = {
      ...fixture.criteria[1],
      craft_score: 6, editorial_score: 6, final_score_0_10: 6,
      recommendations: [],
      evidence: [{ snippet: "He arrived late and alone, carrying nothing but the silence." }],
      final_rationale: "Narrative drive weakens in the second act because the stakes diffuse before the decision point.",
    };

    const synthesis = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const v2 = synthesisToEvaluationResultV2({
      synthesis,
      ids: {
        evaluation_run_id: "density-repair-gate-test",
        job_id: "00000000-0000-0000-0000-000000000001",
        manuscript_id: 1,
        user_id: "test-user",
      },
      manuscriptText: "The old house stood against the hill, grey and insistent. He arrived late and alone, carrying nothing but the silence.",
      title: "Sister",
      llmEnrichment: synthesis.enrichment,
      scopeProfile: {
        inputScale: "standard_chapter",
        wordCount: 4899,
        chunkCount: 1,
        scorableCount: 1,
        confidenceCapSummary: "HIGH",
        scopePolicyVersion: "v1",
      } as import("@/lib/evaluation/pipeline/submissionScope").SubmissionScopeProfile,
    });
    const gateResult = validateTemplateCompleteness(v2 as Parameters<typeof validateTemplateCompleteness>[0]);

    // The density repair should satisfy the gate — no DENSITY_FLOOR_VIOLATION expected
    const densityViolations = gateResult.violations.filter((v) => v.code === "DENSITY_FLOOR_VIOLATION");
    expect(densityViolations).toHaveLength(0);
  });

  it("density repair: score-9 criterion is not touched by density repair", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[2] = {
      ...fixture.criteria[2],
      craft_score: 9,
      editorial_score: 9,
      final_score_0_10: 9,
      recommendations: [],
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    // Score ≥9: repair must NOT add recs (gate has no minimum for 9-10)
    expect(result.criteria[2].recommendations).toHaveLength(0);
  });

  it("density repair: criterion with no evidence anchors does not fabricate recommendations", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[3] = {
      ...fixture.criteria[3],
      craft_score: 4, editorial_score: 4, final_score_0_10: 4,
      recommendations: [],
      evidence: [],
      final_rationale: "", // no rationale either
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    // Without any anchors the repair must produce nothing rather than fabricate
    // (the defect will remain for the gate to report)
    for (const rec of result.criteria[3].recommendations) {
      // Any recs that do exist must still come from upstream pass1/pass2 backfill
      expect(rec.anchor_snippet.trim().length).toBeGreaterThanOrEqual(0);
    }
    // No fabricated content: all recs must have source_pass set
    for (const rec of result.criteria[3].recommendations) {
      expect([1, 2, 3]).toContain(rec.source_pass);
    }
  });
});

// ── Runner integration tests (DI, no real OpenAI) ─────────────────────────────

describe("runPass3Synthesis", () => {
  const registry = loadCanonicalRegistry();

  it("returns parsed synthesis when given a valid completion", async () => {
    const pass1 = makePassOutput(1, "craft_execution");
    const pass2 = makePassOutput(2, "editorial_literary");

    const result = await runPass3Synthesis({
      pass1,
      pass2,
      pass2aStructuredContext: makePass2aStructuredContext(),
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: mockCompletion(JSON.stringify(makePass3Fixture())),
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(result.criteria).toHaveLength(13);
    expect(result.overall.overall_score_0_100).toBe(70);
    expect(result.overall.verdict).toBe("revise");
  });

  it("prefers EVAL_PASS3_MODEL over synthesis/default routing", async () => {
    const previousPass3Model = process.env.EVAL_PASS3_MODEL;
    const previousSynthesisModel = process.env.EVAL_SYNTHESIS_MODEL;
    process.env.EVAL_PASS3_MODEL = "gpt-5";
    process.env.EVAL_SYNTHESIS_MODEL = "gpt-4o";

    const pass1 = makePassOutput(1, "craft_execution");
    const pass2 = makePassOutput(2, "editorial_literary");
    let requestedModel: string | undefined;

    const captureCompletion: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return {
        choices: [
          {
            message: {
              content: JSON.stringify(
                makePass3Fixture({
                  metadata: {
                    pass1_model: "gpt-4o-mini",
                    pass2_model: "gpt-4o-mini",
                    pass3_model: "gpt-5",
                  },
                }),
              ),
            },
          },
        ],
      };
    };

    try {
      const result = await runPass3Synthesis({
        pass1,
        pass2,
        pass2aStructuredContext: makePass2aStructuredContext(),
        manuscriptText: "The river moved slowly through the valley.",
        title: "Test Manuscript",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: captureCompletion,
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

      expect(requestedModel).toBe("gpt-5");
      expect(result.metadata.pass3_model).toBe("gpt-5");
    } finally {
      if (previousPass3Model === undefined) {
        delete process.env.EVAL_PASS3_MODEL;
      } else {
        process.env.EVAL_PASS3_MODEL = previousPass3Model;
      }

      if (previousSynthesisModel === undefined) {
        delete process.env.EVAL_SYNTHESIS_MODEL;
      } else {
        process.env.EVAL_SYNTHESIS_MODEL = previousSynthesisModel;
      }
    }
  });

  it("emits pass3 reducer telemetry in completion capture", async () => {
    const pass1 = makePassOutput(1, "craft_execution");
    const pass2 = makePassOutput(2, "editorial_literary");
    let capture: Parameters<NonNullable<Parameters<typeof runPass3Synthesis>[0]["_onCompletion"]>>[0] | undefined;

    await runPass3Synthesis({
      pass1,
      pass2,
      pass2aStructuredContext: makePass2aStructuredContext(),
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: mockCompletion(JSON.stringify(makePass3Fixture())),
      _onCompletion: (payload) => {
        capture = payload;
      },
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(capture?.pass).toBe(3);
    expect(capture?.pass3_reducer_telemetry).toBeDefined();
    const telemetry = capture?.pass3_reducer_telemetry!;
    // Contract shape
    expect(telemetry.schema_version).toBe("1");
    expect(telemetry.prompt_version).toBe(PASS3_PROMPT_VERSION);
    expect(telemetry.criteria_count_by_state).toBeDefined();
    // Criteria-state invariant: canonical keys must all be present and sum to 13
    const counts = telemetry.criteria_count_by_state;
    expect(typeof counts.agree).toBe("number");
    expect(typeof counts.soft_divergence).toBe("number");
    expect(typeof counts.hard_divergence).toBe("number");
    expect(typeof counts.missing_or_invalid).toBe("number");
    expect(
      counts.agree + counts.soft_divergence + counts.hard_divergence + counts.missing_or_invalid,
    ).toBe(CRITERIA_KEYS.length);
    // Numeric sanity: no payload field may silently zero out
    expect(telemetry.comparison_packet_chars).toBeGreaterThan(0);
    expect(telemetry.system_prompt_chars).toBeGreaterThan(0);
    expect(telemetry.user_prompt_chars).toBeGreaterThan(0);
    expect(telemetry.max_output_tokens).toBeGreaterThan(0);
  });

  it("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        pass2aStructuredContext: makePass2aStructuredContext(),
        manuscriptText: "test",
        title: "Test",
        registry,
        openaiApiKey: "",
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  });

  it("throws when OpenAI returns empty content", async () => {
    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        pass2aStructuredContext: makePass2aStructuredContext(),
        manuscriptText: "test",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: nullCompletion(),
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    }),
    ).rejects.toThrow("Empty response from OpenAI");
  });

  it("accepts content-part arrays when the provider returns structured content", async () => {
    const result = await runPass3Synthesis({
      pass1: makePassOutput(1, "craft_execution"),
      pass2: makePassOutput(2, "editorial_literary"),
      pass2aStructuredContext: makePass2aStructuredContext(),
      manuscriptText: "test",
      title: "Test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: arrayContentCompletion(JSON.stringify(makePass3Fixture())),
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(result.criteria).toHaveLength(13);
    expect(result.overall.verdict).toBe("revise");
  });

  it("surfaces finish_reason and token metadata when the response is empty", async () => {
    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        pass2aStructuredContext: makePass2aStructuredContext(),
        manuscriptText: "test",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: lengthLimitedEmptyCompletion(),
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    }),
    ).rejects.toThrow("finish_reason=length");
  });

  it("fails closed when Pass 2a structured context is missing", async () => {
    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        pass2aStructuredContext: undefined as never,
        manuscriptText: "test",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: mockCompletion(JSON.stringify(makePass3Fixture())),
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    }),
    ).rejects.toThrow("PASS2A_STRUCTURED_CONTEXT_MISSING");
  });
});

// ── Consequence tracking contract tests ──────────────────────────────────────

describe("consequence tracking contract", () => {
  const pass1 = makePassOutput(1, "craft_execution");
  const pass2 = makePassOutput(2, "editorial_literary");

  it("extracts AI-provided pressure_points and decision_points", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Tension builds through repeated failures.", "Stakes escalate in final confrontation."],
      decision_points: ["Character commits despite withdrawal option."],
      consequence_status: "landed",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const first = result.criteria[0];

    expect(first.pressure_points).toEqual([
      "Tension builds through repeated failures.",
      "Stakes escalate in final confrontation.",
    ]);
    expect(first.decision_points).toEqual(["Character commits despite withdrawal option."]);
  });

  it("passes through 'landed' consequence_status and leaves deferred_consequence_risk undefined", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Mild tension."],
      decision_points: ["Resolved cleanly."],
      consequence_status: "landed",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("landed");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("passes through 'deferred' and uses AI-provided deferred_consequence_risk", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Unresolved tension lingers."],
      decision_points: ["No resolution reached."],
      consequence_status: "deferred",
      deferred_consequence_risk: "Risk: unresolved arc may undermine final chapter payoff.",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("deferred");
    expect(result.criteria[0].deferred_consequence_risk).toBe(
      "Risk: unresolved arc may undermine final chapter payoff.",
    );
  });

  it("auto-fills deferred_consequence_risk when AI sets status to 'deferred' but omits the risk field", () => {
    const fixture = makePass3Fixture();
    const first = { ...fixture.criteria[0], consequence_status: "deferred" };
    delete (first as Record<string, unknown>)["deferred_consequence_risk"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("deferred");
    expect(result.criteria[0].deferred_consequence_risk).toBeDefined();
    expect(result.criteria[0].deferred_consequence_risk!.length).toBeGreaterThan(0);
  });

  it("passes through 'dissipated' and clears deferred_consequence_risk", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Pressure arose but was neutralized."],
      decision_points: ["Tension dispersed without payoff."],
      consequence_status: "dissipated",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("dissipated");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("falls back to heuristic 'deferred' when score_delta >= 3 and consequence_status is unrecognized", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 9,
      editorial_score: 5,
      final_score_0_10: 7,
      consequence_status: "unknown_value",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].score_delta).toBeGreaterThanOrEqual(3);
    expect(result.criteria[0].consequence_status).toBe("deferred");
    expect(result.criteria[0].deferred_consequence_risk).toBeDefined();
  });

  it("falls back to heuristic 'dissipated' when final_score <= 4 and consequence_status is unrecognized", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 4,
      editorial_score: 4,
      final_score_0_10: 3,
      consequence_status: "",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("dissipated");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("falls back to heuristic 'landed' when score is healthy and consequence_status is unrecognized", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      consequence_status: "INVALID",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("landed");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("generates fallback pressure_points when AI omits them", () => {
    const fixture = makePass3Fixture();
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["pressure_points"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].pressure_points).toHaveLength(1);
    expect(result.criteria[0].pressure_points[0].length).toBeGreaterThan(0);
  });

  it("generates fallback decision_points when AI omits them", () => {
    const fixture = makePass3Fixture();
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["decision_points"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].decision_points).toHaveLength(1);
    expect(result.criteria[0].decision_points[0].length).toBeGreaterThan(0);
  });

  // ── PR #1078 Regression: governance-suppressed criteria must still get density repair ──
  // Root cause of TEMPLATE_COMPLETENESS_GATE_FAILED for Sister + River evaluations:
  // narrativeClosure scored 7/10 but had 0 meaningful recommendations after governance
  // suppression removed LLM recs. The final fallback was skipping these criteria.

  it("governance-suppressed narrativeClosure (score=7) still gets backfilled recommendations", () => {
    const fixture = makePass3Fixture();
    // Find narrativeClosure and set up the failure scenario:
    // - score 7 (density floor requires 1 meaningful rec)
    // - 0 recommendations (LLM produced nothing)
    // - governance-suppression technical defect present
    const ncIdx = fixture.criteria.findIndex((c: { key: string }) => c.key === "narrativeClosure");
    (fixture.criteria[ncIdx] as Record<string, unknown>) = {
      ...fixture.criteria[ncIdx],
      final_score_0_10: 7,
      recommendations: [],
      technical_defects: [
        {
          code: "DIAGNOSTIC_SPINE_PROMISE_MISMATCH",
          author_facing_reason: "Recommendation guard suppressed unsafe recommendations that contradicted the manuscript's diagnostic spine.",
          retryable: false,
        },
      ],
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const nc = result.criteria.find((c) => c.key === "narrativeClosure");
    expect(nc).toBeDefined();

    // Must have at least 1 meaningful recommendation despite governance suppression
    const meaningfulRecs = nc!.recommendations.filter((r) => isMeaningfulRecommendation(r));
    expect(meaningfulRecs.length).toBeGreaterThanOrEqual(1);
  });

  it("governance-suppressed narrativeClosure passes template completeness gate after repair", () => {
    const fixture = makePass3Fixture({
      enrichment: {
        premise: "A family story about loss and memory.",
        trigger_warnings: ["grief"],
        diagnosed_genre: "literary fiction",
        target_audience: "Adult readers of literary fiction exploring family dynamics and grief.",
      },
    });
    // Set up governance-suppressed narrativeClosure with 0 recs
    const ncIdx = fixture.criteria.findIndex((c: { key: string }) => c.key === "narrativeClosure");
    (fixture.criteria[ncIdx] as Record<string, unknown>) = {
      ...fixture.criteria[ncIdx],
      final_score_0_10: 7,
      recommendations: [],
      technical_defects: [
        {
          code: "DIAGNOSTIC_SPINE_PROMISE_MISMATCH",
          author_facing_reason: "Recommendation guard suppressed unsafe recommendations that contradicted the manuscript's diagnostic spine.",
          retryable: false,
        },
      ],
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const v2 = synthesisToEvaluationResultV2({
      synthesis: result,
      ids: { evaluation_run_id: "test", job_id: "test", manuscript_id: 1, user_id: "test" },
      sourceText: "The morning was damp and overcast, the river restless in its banks.",
      manuscriptText: "The morning was damp and overcast, the river restless in its banks.",
    });

    const gateResult = validateTemplateCompleteness(v2);
    const densityViolations = gateResult.violations.filter(
      (v) => v.code === "DENSITY_FLOOR_VIOLATION" && v.criterion === "narrativeClosure",
    );
    expect(densityViolations).toHaveLength(0);
  });

  it("zero-rec narrativeClosure (no governance defects) also gets backfilled", () => {
    const fixture = makePass3Fixture();
    // Score 7 with 0 recs and NO governance defects — pure LLM omission
    const ncIdx = fixture.criteria.findIndex((c: { key: string }) => c.key === "narrativeClosure");
    fixture.criteria[ncIdx] = {
      ...fixture.criteria[ncIdx],
      final_score_0_10: 7,
      recommendations: [],
    };

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const nc = result.criteria.find((c) => c.key === "narrativeClosure");
    expect(nc).toBeDefined();

    const meaningfulRecs = nc!.recommendations.filter((r) => isMeaningfulRecommendation(r));
    expect(meaningfulRecs.length).toBeGreaterThanOrEqual(1);
  });
});
