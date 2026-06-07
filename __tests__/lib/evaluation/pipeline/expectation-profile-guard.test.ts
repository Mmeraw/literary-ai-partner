import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import {
  extractGenreExpectationMetadataFromEvaluationPayload,
  resolveExpectationProfiles,
  shouldSuppressByExpectationProfile,
} from "@/lib/evaluation/genreExpectationProfiles";
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

  test("protects suspense slow-burn pacing but allows action-thriller velocity guidance", () => {
    const suspenseContext = resolveExpectationProfiles({
      workType: "genreFictionGeneral",
      diagnosedGenre: "psychological suspense",
      shelfTargetAudience: "adult suspense",
      dominantCraftEngine: "tonal_pressure",
    });
    const actionThrillerContext = resolveExpectationProfiles({
      workType: "genreFictionGeneral",
      diagnosedGenre: "action thriller",
      shelfTargetAudience: "adult commercial thriller",
      dominantCraftEngine: "propulsion",
    });

    const directive = {
      action: "Accelerate the slow-burn uncertainty so the scene has faster pacing.",
      expected_impact: "Makes the passage more commercial and easier to consume.",
      mechanism: "The current passage withholds information and builds dread slowly.",
      anchor_snippet: "The hallway stayed quiet long after the phone stopped ringing.",
    };

    expect(shouldSuppressByExpectationProfile(suspenseContext, directive)).toMatchObject({
      allowed: false,
    });
    expect(shouldSuppressByExpectationProfile(actionThrillerContext, directive)).toMatchObject({
      allowed: true,
    });
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

  test("resolves memoir genre expectations so displayed genre is also evaluation input", () => {
    const context = resolveExpectationProfiles({
      workType: "memoirChapterNarrative",
      diagnosedGenre: "spiritual memoir",
      shelfTargetAudience: "adult memoir readers",
      dominantCraftEngine: "reflection",
    });

    expect(context.expectation_profiles).toEqual(expect.arrayContaining(["reflection_forward", "voice_forward"]));
    expect(context.genre_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "spiritual_memoir",
          reader_promise: expect.stringContaining("Interior transformation"),
          protected_behaviors: expect.arrayContaining(["low dialogue density"]),
        }),
      ]),
    );
  });

  test("protects epic fantasy lore density unless malfunction evidence exists", () => {
    const context = resolveExpectationProfiles({
      workType: "novelChapter",
      diagnosedGenre: "epic fantasy",
      shelfTargetAudience: "adult epic fantasy readers",
      dominantCraftEngine: "world_concept",
    });

    const decision = shouldSuppressByExpectationProfile(context, {
      action: "Trim the lore and reduce worldbuilding setup to make this chapter move faster.",
      expected_impact: "Creates a more commercial pace.",
      mechanism: "The passage carries invented terminology and council-scene context.",
      anchor_snippet: "The nine houses named their old oaths before the map of the vanished kingdom.",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("epic fantasy protects lore/worldbuilding density");
  });

  test("allows military SF operational-clarity critique as genre-specific guidance", () => {
    const context = resolveExpectationProfiles({
      workType: "novelChapter",
      diagnosedGenre: "military science fiction",
      shelfTargetAudience: "adult military SF readers",
      dominantCraftEngine: "world_concept",
    });

    const decision = shouldSuppressByExpectationProfile(context, {
      action: "Clarify the chain-of-command decision so the tactical cause and effect is legible.",
      expected_impact: "Helps readers understand operational pressure and mission consequence.",
      mechanism: "The order changes the squad's available choices but the command logic is unclear.",
      anchor_snippet: "Captain Vale countermanded the lieutenant before the drop doors opened.",
    });

    expect(decision.allowed).toBe(true);
  });

  test("allows romance relationship-progression critique and comedy timing critique", () => {
    const romanceContext = resolveExpectationProfiles({
      workType: "novelChapter",
      diagnosedGenre: "contemporary romance",
      shelfTargetAudience: "adult romance readers",
      dominantCraftEngine: "emotional_payoff",
    });
    const comedyContext = resolveExpectationProfiles({
      workType: "novelChapter",
      diagnosedGenre: "satirical comedy",
      shelfTargetAudience: "adult comedy readers",
      dominantCraftEngine: "voice",
    });

    expect(
      shouldSuppressByExpectationProfile(romanceContext, {
        action: "Strengthen relationship progression by making the vulnerability exchange change what each character risks next.",
        expected_impact: "Creates clearer romantic tension and emotional payoff.",
        mechanism: "The attraction is asserted, but the relationship turn does not yet alter the obstacle.",
        anchor_snippet: "She smiled at him, then changed the subject.",
      }).allowed,
    ).toBe(true);

    expect(
      shouldSuppressByExpectationProfile(comedyContext, {
        action: "Escalate the recurring joke so the third beat transforms the comic premise instead of repeating it.",
        expected_impact: "Improves comic timing and payoff.",
        mechanism: "The same incongruity repeats without a sharper target or reversal.",
        anchor_snippet: "For the third time, the mayor saluted the parking meter.",
      }).allowed,
    ).toBe(true);
  });

  test("suppresses memoir dialogue-quantity directives without explicit malfunction evidence", () => {
    const context = resolveExpectationProfiles({
      workType: "memoirChapterNarrative",
      diagnosedGenre: "memoir",
      shelfTargetAudience: "adult memoir readers",
      dominantCraftEngine: "reflection",
    });

    const decision = shouldSuppressByExpectationProfile(context, {
      action: "Add more dialogue to increase reader engagement in this reflective passage.",
      expected_impact: "More spoken exchange would make the passage feel faster.",
      mechanism: "The passage currently relies on interior memory and reflection.",
      anchor_snippet: "I remembered the kitchen light and the silence after my father left.",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("profile_guard_suppressed");
  });

  test("parsePass3Response records explicit genre expectation metadata for downstream Revise and TrustedPath", () => {
    const context = resolveExpectationProfiles({
      workType: "memoirChapterNarrative",
      diagnosedGenre: "memoir",
      shelfTargetAudience: "adult memoir readers",
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

    expect(parsed.metadata.genre_expectation_context).toMatchObject({
      diagnosed_genre: "memoir",
      dominant_craft_engine: "reflection",
      expectation_profiles: expect.arrayContaining(["reflection_forward"]),
      genre_expectation_ids: expect.arrayContaining(["memoir_creative_nonfiction"]),
    });

    expect(
      extractGenreExpectationMetadataFromEvaluationPayload({
        governance: {
          transparency: {
            genre_expectation_context: parsed.metadata.genre_expectation_context,
          },
        },
      }),
    ).toMatchObject({ diagnosed_genre: "memoir" });
  });
});
