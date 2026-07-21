/**
 * Generic Recommendation Guard — Acceptance Tests
 *
 * Hard contract: "Strengthening dialogue improves the reader's experience" MUST fail.
 *
 * Also tests:
 * - All listed cliché phrases are caught without evidence
 * - A recommendation with the same phrase + full 7-part evidence passes
 * - Non-generic recommendations are never suppressed
 * - Thriller/pacing recommendations with full evidence pass
 */

import { describe, expect, test } from "@jest/globals";
import {
  evaluateRecommendationGenericContract,
  filterGenericRecommendations,
} from "@/lib/evaluation/pipeline/genericRecommendationGuard";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

// ── Acceptance test fixture ────────────────────────────────────────────────────

function makePassOutput(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "gpt-4o",
    prompt_version: `pass${pass}-v1`,
    temperature: 0.2,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Rationale for ${key} from pass ${pass}.`,
      evidence: [{ snippet: `Evidence for ${key} in the manuscript.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `In chapter 2, tighten the ${key} beat because the current line diffuses intent.`,
          expected_impact: "Gives the reader clearer momentum at the scene turn.",
          anchor_snippet: `The passage for ${key}.`,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
      ...(pass === 2 ? { recommendation_status: "recommendation_provided" as const } : {}),
    })),
  };
}

function buildPass3WithDialogueRec(dialogueRec: object) {
  return JSON.stringify({
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      final_rationale: `Rationale for ${key}.`,
      evidence: [{ snippet: `Evidence for ${key}.` }],
      recommendations:
        key === "dialogue"
          ? [dialogueRec]
          : [
              {
                priority: "medium",
                action: `In chapter 2 for ${key}, tighten one line because the turn is diffuse.`,
                expected_impact: "Gives the reader clearer progression.",
                anchor_snippet: `Anchor for ${key}.`,
                source_pass: 3,
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
                mechanism: "the turn is diffuse",
                specific_fix: "tighten one sentence",
                reader_effect: "clearer progression",
              },
            ],
      recommendation_status: "recommendation_provided",
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "Summary.",
      top_3_strengths: ["voice", "theme", "character"],
      top_3_risks: ["dialogue", "tone", "closure"],
      submission_readiness: "nearly_ready",
    },
  });
}

// ── Unit tests for evaluateRecommendationGenericContract ───────────────────────

describe("evaluateRecommendationGenericContract — acceptance test", () => {
  test("ACCEPTANCE: 'Strengthening dialogue improves the reader's experience' is suppressed", () => {
    const decision = evaluateRecommendationGenericContract({
      action: "Strengthening dialogue improves the reader's experience.",
      expected_impact: "Better overall",
      anchor_snippet: "",
      mechanism: "",
      specific_fix: "",
      reader_effect: "",
      symptom: "",
    });
    expect(decision.suppress).toBe(true);
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  test("ACCEPTANCE: 'Improve pacing.' with no evidence is suppressed", () => {
    const decision = evaluateRecommendationGenericContract({
      action: "Improve pacing.",
      expected_impact: "The story will flow better.",
      anchor_snippet: "",
    });
    expect(decision.suppress).toBe(true);
  });

  test("ACCEPTANCE: 'Increase momentum.' with no evidence is suppressed", () => {
    const decision = evaluateRecommendationGenericContract({
      action: "Increase momentum in this section.",
      expected_impact: "",
      anchor_snippet: "",
    });
    expect(decision.suppress).toBe(true);
  });

  test("ACCEPTANCE: 'Tighten prose.' with no evidence is suppressed", () => {
    const decision = evaluateRecommendationGenericContract({
      action: "Tighten the prose.",
      expected_impact: "It will be crisper.",
      anchor_snippet: "",
    });
    expect(decision.suppress).toBe(true);
  });

  test("ACCEPTANCE: 'Deepen character.' with no anchor is suppressed", () => {
    const decision = evaluateRecommendationGenericContract({
      action: "Deepen character in this section.",
      expected_impact: "Reader connects better.",
      anchor_snippet: "",
      mechanism: "",
    });
    expect(decision.suppress).toBe(true);
  });

  test("Same cliché phrase passes when all 7 parts are present", () => {
    const decision = evaluateRecommendationGenericContract({
      action: "In chapter 3 paragraph 2, strengthen dialogue by cutting Elena's expository tag because the current phrasing diffuses the tension before Rafael responds.",
      expected_impact: "Gives the reader clearer speaker intent and urgency at the exchange turn.",
      anchor_snippet: '"You have to understand," Elena said, smoothing her coat for the third time.',
      mechanism: "the current phrasing diffuses tension before Rafael responds",
      specific_fix: "cut Elena's expository tag and let the action beat carry attribution",
      reader_effect: "clearer speaker intent and urgency",
      symptom: "dialogue turn loses tension mid-exchange",
      mistake_proofing: "preserve Elena's nervous physicality — do not flatten the coat gesture",
      potential_damage: ["Elena's voice register", "micro-tension in the exchange"],
    });
    expect(decision.suppress).toBe(false);
  });

  test("Non-generic recommendation is never suppressed", () => {
    const decision = evaluateRecommendationGenericContract({
      action: 'In the opening chapter, replace the expository summary of the tribunal with a concrete decision moment because the current structure diffuses stakes.',
      expected_impact: "Reader understands the protagonist's urgency and trust immediately.",
      anchor_snippet: "The tribunal had lasted three weeks and yielded nothing.",
      mechanism: "current structure diffuses stakes before the protagonist faces the decision",
      specific_fix: "replace expository summary with a concrete decision moment",
      reader_effect: "stronger reader urgency and trust",
    });
    expect(decision.suppress).toBe(false);
  });
});

// ── Integration test via parsePass3Response ───────────────────────────────────

describe("parsePass3Response — generic guard integration", () => {
  const pass1 = makePassOutput(1);
  const pass2 = makePassOutput(2);

  test("ACCEPTANCE: dialogue recommendation 'Strengthening dialogue improves the reader's experience' is suppressed", () => {
    const raw = buildPass3WithDialogueRec({
      priority: "medium",
      action: "Strengthening dialogue improves the reader's experience.",
      expected_impact: "Better overall.",
      anchor_snippet: "",
      source_pass: 3,
      issue_family: "dialogue",
      strategic_lever: "dialogue_exposition_density",
      revision_granularity: "scene",
      mechanism: "",
      specific_fix: "",
      reader_effect: "",
    });

    const result = parsePass3Response(raw, pass1, pass2, "o3", "A manuscript excerpt.");
    const dialogue = result.criteria.find((c) => c.key === "dialogue");
    expect(dialogue).toBeDefined();

    const suppressedRec = dialogue?.recommendations.find((r) =>
      r.action.includes("Strengthening dialogue improves"),
    );
    expect(suppressedRec).toBeUndefined();
  });

  test("Non-generic dialogue recommendation is retained", () => {
    const raw = buildPass3WithDialogueRec({
      priority: "medium",
      action: 'In chapter 4 line 7, cut Elena\'s interior tag before the exchange because it diffuses speaker tension.',
      expected_impact: "Gives the reader clearer speaker intent and urgency.",
      anchor_snippet: '"You have to understand," Elena said, smoothing her coat.',
      source_pass: 3,
      issue_family: "dialogue",
      strategic_lever: "dialogue_exposition_density",
      revision_granularity: "scene",
      mechanism: "interior tag diffuses speaker tension before the exchange lands",
      specific_fix: "cut the interior tag and let the action beat carry attribution",
      reader_effect: "clearer speaker intent and urgency at the exchange turn",
    });

    const result = parsePass3Response(raw, pass1, pass2, "o3", "A manuscript excerpt.");
    const dialogue = result.criteria.find((c) => c.key === "dialogue");
    expect((dialogue?.recommendations.length ?? 0)).toBeGreaterThan(0);
  });

  test("filterGenericRecommendations batch correctly separates cliché from specific", () => {
    const recs = [
      {
        action: "Improve pacing.",
        expected_impact: "Better flow.",
        anchor_snippet: "",
      },
      {
        action: 'Cut the reflective passage in chapter 3 paragraph 4 because it stalls urgency before the confrontation.',
        expected_impact: "Gives the reader forward momentum into the confrontation.",
        anchor_snippet: "She sat for a long time, thinking about what had happened.",
        mechanism: "reflective passage stalls urgency",
        specific_fix: "cut the reflective passage",
        reader_effect: "forward momentum",
        symptom: "reader loses urgency before confrontation",
      },
    ];

    const passing = filterGenericRecommendations(recs);
    expect(passing).toHaveLength(1);
    expect(passing[0].action).toContain("Cut the reflective");
  });
});

// ── All listed cliché phrases are caught ─────────────────────────────────────

describe("evaluateRecommendationGenericContract — cliché phrase coverage", () => {
  const BASE_GENERIC: object = {
    expected_impact: "Better overall.",
    anchor_snippet: "",
    mechanism: "",
    specific_fix: "",
    reader_effect: "",
  };

  const CLICHE_ACTIONS = [
    "Strengthen dialogue in this section.",
    "Improve the reader's experience throughout.",
    "Improve pacing here.",
    "Increase momentum.",
    "Clarify stakes.",
    "Deepen character.",
    "Heighten tension.",
    "Make it clearer.",
    "Add specificity.",
    "Tighten the prose.",
    "Enhance engagement.",
  ];

  for (const action of CLICHE_ACTIONS) {
    test(`suppresses: "${action}"`, () => {
      const decision = evaluateRecommendationGenericContract({ ...BASE_GENERIC, action });
      expect(decision.suppress).toBe(true);
    });
  }
});
