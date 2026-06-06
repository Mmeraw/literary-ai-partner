import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { resolveExpectationProfiles } from "@/lib/evaluation/genreExpectationProfiles";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

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
      rationale: `Pass ${pass} rationale for ${key}.`,
      evidence: [{ snippet: `Evidence for ${key} from manuscript text.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `In chapter 2 for ${key}, clarify the beat because the current line blurs intent.`,
          expected_impact: "Gives readers clearer cause-and-effect and stronger immersion.",
          anchor_snippet: `Anchor for ${key}.`,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
  };
}

function buildRawWithPacingAction(action: string, mechanism = "the passage stalls and diffuses urgency", anchor = "The road lay quiet while they waited.") {
  return JSON.stringify({
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      final_rationale: `Synthesis rationale for ${key}.`,
      evidence: [{ snippet: `Evidence for ${key}.` }],
      recommendations:
        key === "pacing"
          ? [
              {
                priority: "medium",
                action,
                expected_impact: "Supports clarity and engagement.",
                anchor_snippet: anchor,
                source_pass: 3,
                issue_family: "pacing",
                strategic_lever: "momentum_visibility",
                revision_granularity: "scene",
                mechanism,
                specific_fix: "revise the scene turn",
                reader_effect: "clearer momentum",
                symptom: "reader momentum diffuses before the section turn",
                mistake_proofing: "preserve atmosphere while clarifying the turn",
              },
            ]
          : [
              {
                priority: "medium",
                action: `In chapter 2 for ${key}, tighten one sentence because the turn is currently diffuse.`,
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
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "Summary.",
      top_3_strengths: ["voice", "theme", "character"],
      top_3_risks: ["pacing", "tone", "closure"],
      submission_readiness: "nearly_ready",
    },
  });
}

describe("expectation profile recommendation guard", () => {
  const pass1 = makePassOutput(1);
  const pass2 = makePassOutput(2);

  test("suppresses propulsion directive in mood-forward profile when malfunction evidence is absent", () => {
    const context = resolveExpectationProfiles({
      workType: "literaryFictionGeneral",
      diagnosedGenre: "literary_fiction",
      shelfTargetAudience: "adult literary",
      dominantCraftEngine: "tonal_pressure",
    });

    const parsed = parsePass3Response(
      buildRawWithPacingAction(
        "In chapter 3, increase momentum by adding a decision beat and a clearer next step.",
        "the passage currently sustains reflective cadence",
        "She studies the rain on the glass and waits.",
      ),
      pass1,
      pass2,
      "o3",
      "A long manuscript excerpt used for tests.",
      context,
    );

    const pacing = parsed.criteria.find((c) => c.key === "pacing");
    expect(pacing).toBeDefined();
    expect(pacing?.recommendations).toHaveLength(0);
  });

  test("does not over-suppress thriller/commercial suspense propulsion diagnostics", () => {
    const context = resolveExpectationProfiles({
      workType: "genreFictionGeneral",
      diagnosedGenre: "commercial suspense thriller",
      shelfTargetAudience: "adult commercial suspense",
      dominantCraftEngine: "propulsion",
    });

    const parsed = parsePass3Response(
      buildRawWithPacingAction(
        "In chapter 3, increase momentum by adding a decision beat and a clearer next step.",
      ),
      pass1,
      pass2,
      "o3",
      "A long manuscript excerpt used for tests.",
      context,
    );

    const pacing = parsed.criteria.find((c) => c.key === "pacing");
    expect(pacing).toBeDefined();
    expect((pacing?.recommendations.length ?? 0)).toBeGreaterThan(0);
  });

  test("allows protected-profile propulsion directive when explicit malfunction evidence is present", () => {
    const context = resolveExpectationProfiles({
      workType: "memoirChapterNarrative",
      diagnosedGenre: "memoir",
      shelfTargetAudience: "memoir readers",
      dominantCraftEngine: "reflection",
    });

    const parsed = parsePass3Response(
      buildRawWithPacingAction(
        "In chapter 3, increase momentum by adding a decision beat and a clearer next step.",
        "the scene stalls and reader clarity breaks at the turn",
        "She stops at the doorway and says nothing.",
      ),
      pass1,
      pass2,
      "o3",
      "A long manuscript excerpt used for tests.",
      context,
    );

    const pacing = parsed.criteria.find((c) => c.key === "pacing");
    expect(pacing).toBeDefined();
    expect((pacing?.recommendations.length ?? 0)).toBeGreaterThan(0);
  });
});
