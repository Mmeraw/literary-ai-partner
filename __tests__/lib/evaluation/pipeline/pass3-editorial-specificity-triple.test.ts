/**
 * Pass 3 Editorial Specificity Triple Contract — Unit Test
 *
 * Mistake-proof guard: fails if any recommendation emitted by parsePass3Response
 * is missing non-empty `mechanism`, `specific_fix`, or `reader_effect`.
 *
 * This ensures QG_EDITORIAL_GENERIC_FEEDBACK triggers only on genuinely generic
 * content, not on schema gaps where these fields were never populated.
 *
 * Ref: GitHub issue — fix(pass3): enforce structured editorial recommendation
 * contract (mechanism / specific_fix / reader_effect)
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePassOutput(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "gpt-4o",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Pass ${pass} rationale for ${key} with specific evidence.`,
      evidence: [{ snippet: `Pass ${pass} evidence for ${key}: The river moved slowly.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `In the opening scene, replace the abstract ${key} signal because the current phrasing diffuses stakes.`,
          expected_impact: `Gives the reader clearer ${key} stakes and stronger engagement.`,
          anchor_snippet: `Anchor for ${key}.`,
          issue_family: "scene_structure" as const,
          strategic_lever: "scene_goal_clarity" as const,
          revision_granularity: "scene" as const,
        },
      ],
    })),
  };
}

/**
 * Build a minimal valid Pass 3 JSON response with all 13 criteria.
 * Recommendations include the specificity triple as separate fields.
 */
function buildCompliantPass3Json(overrideRecs?: Partial<Record<string, object[]>>) {
  return JSON.stringify({
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      final_rationale: `Synthesized rationale for ${key} grounded in both passes.`,
      evidence: [{ snippet: `Evidence for ${key}: The chapter turn carries narrative weight.` }],
      recommendations: overrideRecs?.[key] ?? [
        {
          priority: "medium",
          action: `In the opening scene for ${key}, replace the abstract line with a concrete beat because the current phrasing diffuses tension before the decision point.`,
          expected_impact: `Gives the reader clearer cause-and-effect, increasing urgency at the turn.`,
          anchor_snippet: `Anchor for ${key} in the opening scene.`,
          source_pass: 3,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
          mechanism: `the current phrasing diffuses tension for ${key} before the decision point`,
          specific_fix: `replace the abstract ${key} line with a concrete beat`,
          reader_effect: `clearer cause-and-effect and stronger urgency at the turn for ${key}`,
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "The manuscript has strong potential and needs targeted revision.",
      top_3_strengths: ["voice", "premise", "character"],
      top_3_risks: ["pacing", "tone", "worldbuilding"],
      submission_readiness: "close",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Pass 3 editorial specificity triple — schema enforcement", () => {
  const pass1 = makePassOutput(1);
  const pass2 = makePassOutput(2);

  it("every recommendation from compliant LLM output has non-empty mechanism, specific_fix, reader_effect", () => {
    const result = parsePass3Response(buildCompliantPass3Json(), pass1, pass2);

    for (const criterion of result.criteria) {
      for (const rec of criterion.recommendations) {
        expect(rec.mechanism).toBeDefined();
        expect(rec.mechanism.trim().length).toBeGreaterThan(0);

        expect(rec.specific_fix).toBeDefined();
        expect(rec.specific_fix.trim().length).toBeGreaterThan(0);

        expect(rec.reader_effect).toBeDefined();
        expect(rec.reader_effect.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("normalizer populates mechanism/specific_fix/reader_effect even when LLM omits them (fallback repair)", () => {
    // LLM output WITHOUT the three explicit fields — normalizer must populate them
    const rawWithoutTriple = JSON.stringify({
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 6,
        final_score_0_10: 7,
        final_rationale: `Rationale for ${key}.`,
        evidence: [{ snippet: `Evidence for ${key}.` }],
        recommendations: [
          {
            priority: "medium",
            // No mechanism, specific_fix, reader_effect fields — gate would fire on missing patterns
            action: `In the opening scene for ${key}, replace the abstract line with a concrete beat because the current phrasing diffuses tension.`,
            expected_impact: `Gives the reader clearer cause-and-effect and urgency at the turn.`,
            anchor_snippet: `Anchor for ${key}.`,
            source_pass: 3,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
          },
        ],
      })),
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary: "The manuscript has strong potential.",
        top_3_strengths: ["voice", "premise", "character"],
        top_3_risks: ["pacing", "tone", "worldbuilding"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "gpt-4o",
        pass2_model: "gpt-4o",
        pass3_model: "gpt-4o",
      },
    });

    const result = parsePass3Response(rawWithoutTriple, pass1, pass2);

    for (const criterion of result.criteria) {
      for (const rec of criterion.recommendations) {
        expect(rec.mechanism.trim().length).toBeGreaterThan(0);
        expect(rec.specific_fix.trim().length).toBeGreaterThan(0);
        expect(rec.reader_effect.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("backfilled recommendations (from pass1/pass2 anchored recs) have non-empty mechanism, specific_fix, reader_effect", () => {
    // Empty recommendations from LLM → backfill from pass1/pass2.
    // Pass1/pass2 fixtures have anchor_snippet, so static defaults ARE permitted.
    const rawEmptyRecs = JSON.stringify({
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 6,
        final_score_0_10: 7,
        final_rationale: `Rationale for ${key}.`,
        evidence: [{ snippet: `Evidence for ${key}.` }],
        recommendations: [], // empty → backfill triggers
      })),
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary: "The manuscript has strong potential.",
        top_3_strengths: ["voice", "premise", "character"],
        top_3_risks: ["pacing", "tone", "worldbuilding"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "gpt-4o",
        pass2_model: "gpt-4o",
        pass3_model: "gpt-4o",
      },
    });

    const result = parsePass3Response(rawEmptyRecs, pass1, pass2);

    for (const criterion of result.criteria) {
      for (const rec of criterion.recommendations) {
        // Backfilled recs have anchor_snippet from pass1/pass2 fixture → non-empty triple
        expect(rec.mechanism.trim().length).toBeGreaterThan(0);
        expect(rec.specific_fix.trim().length).toBeGreaterThan(0);
        expect(rec.reader_effect.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("anchorless generic recommendation with omitted triple stays generic — NOT bypassed by static defaults", () => {
    // Simulate an LLM that emits an anchorless, generic recommendation (no anchor_snippet,
    // no mechanism/specific_fix/reader_effect fields, no causal connectors, no fix verbs,
    // no reader-effect words in expected_impact). This is exactly the pattern that should
    // trigger QG_EDITORIAL_GENERIC_FEEDBACK. Verify that the normalizer does NOT fill in
    // static criterion-aware defaults — leaving the triple empty so the gate can fire.
    const rawAnchorlessGeneric = JSON.stringify({
      criteria: [{
        key: "tone",
        craft_score: 6,
        editorial_score: 5,
        final_score_0_10: 5,
        final_rationale: "Tone needs work.",
        evidence: [],
        recommendations: [
          {
            priority: "medium",
            // No location, no fix verb, no mechanism connector, no reader-effect word
            action: "Improve the tone throughout the manuscript.",
            expected_impact: "This will make the text better overall.",
            anchor_snippet: "", // anchorless
            source_pass: 3,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            // mechanism / specific_fix / reader_effect intentionally absent
          },
        ],
      }],
      overall: {
        overall_score_0_100: 55,
        verdict: "revise",
        one_paragraph_summary: "The manuscript needs significant revision.",
        top_3_strengths: ["voice", "premise", "character"],
        top_3_risks: ["tone", "pacing", "marketability"],
        submission_readiness: "not_yet",
      },
      metadata: {
        pass1_model: "gpt-4o",
        pass2_model: "gpt-4o",
        pass3_model: "gpt-4o",
      },
    });

    const result = parsePass3Response(rawAnchorlessGeneric, pass1, pass2);
    const toneRec = result.criteria.find((c) => c.key === "tone")?.recommendations?.[0];

    expect(toneRec).toBeDefined();
    // Static defaults must NOT have been applied: all three fields stay empty
    // because anchor_snippet is empty and no evidence can be extracted from the action/expected_impact text
    expect(toneRec?.mechanism).toBe("");
    expect(toneRec?.specific_fix).toBe("");
    expect(toneRec?.reader_effect).toBe("");
    // The action must NOT have been repaired to a passing form (no anchor to repair from)
    expect(toneRec?.action).toBe("Improve the tone throughout the manuscript.");
  });
});
