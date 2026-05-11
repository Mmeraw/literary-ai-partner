import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  extractQuotesFromRationale,
  promoteRationaleQuotesToEvidence,
  enforceProseControlAnchorFloor,
  parsePass3Response,
} from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";
import {
  maxLowConfidenceScoreFor,
  QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
} from "@/lib/evaluation/pipeline/qualityGate";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

export {};

const MANUSCRIPT =
  "The air smelled faintly of baked dust, cedar, and paper. " +
  "Outside, the wind moved through the cottonwoods like a slow breath. " +
  "Her hands rested on the table; she did not look up. " +
  "He had almost said it, and then the silence pulled them apart.";

describe("Pass-3 stranded-quote promotion (Fix 2)", () => {
  test("extractQuotesFromRationale finds verbatim quoted sentences", () => {
    const rationale =
      'The line "The air smelled faintly of baked dust, cedar, and paper." carries texture, ' +
      'and "the wind moved through the cottonwoods like a slow breath" controls cadence.';

    const quotes = extractQuotesFromRationale(rationale);
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toBe(
      "The air smelled faintly of baked dust, cedar, and paper.",
    );
    expect(quotes[1]).toBe(
      "the wind moved through the cottonwoods like a slow breath",
    );
  });

  test("extractQuotesFromRationale skips generic/short phrases", () => {
    const rationale =
      '"Good writing." "strong writing" Some real texture: "Her hands rested on the table; she did not look up."';

    const quotes = extractQuotesFromRationale(rationale);
    expect(quotes).toEqual([
      "Her hands rested on the table; she did not look up.",
    ]);
  });

  test("promoteRationaleQuotesToEvidence anchors via indexOf on the manuscript", () => {
    const evidence = [
      { snippet: "Existing anchor", char_start: 999, char_end: 1014 },
    ];
    const rationale =
      'See "the wind moved through the cottonwoods like a slow breath" and "Her hands rested on the table; she did not look up."';

    const promoted = promoteRationaleQuotesToEvidence(
      evidence,
      rationale,
      MANUSCRIPT,
    );

    expect(promoted.length).toBe(3);
    // Existing anchor preserved
    expect(promoted[0].snippet).toBe("Existing anchor");
    // First promoted quote has real offsets
    expect(promoted[1].char_start).toBe(
      MANUSCRIPT.indexOf(
        "the wind moved through the cottonwoods like a slow breath",
      ),
    );
    expect(promoted[1].char_end).toBe(
      (promoted[1].char_start ?? 0) +
        "the wind moved through the cottonwoods like a slow breath".length,
    );
    // Second promoted quote also anchored
    expect(promoted[2].char_start).toBeGreaterThan(0);
  });

  test("promoteRationaleQuotesToEvidence drops quotes not present in manuscript", () => {
    const rationale = '"this line is not in the manuscript at all anywhere"';
    const promoted = promoteRationaleQuotesToEvidence(
      [],
      rationale,
      MANUSCRIPT,
    );
    expect(promoted).toHaveLength(0);
  });
});

describe("Prose Control anchor floor (Fix 1)", () => {
  test("backfills to >=2 anchors when model emits only 1", () => {
    const before = [
      { snippet: "Baked dust", char_start: 0, char_end: 10 },
    ];
    const out = enforceProseControlAnchorFloor({
      evidence: before,
      recommendations: [
        {
          priority: "medium" as const,
          action: "Tighten cadence in the opening paragraph.",
          expected_impact: "Improves reader momentum.",
          anchor_snippet: "",
          source_pass: 3 as const,
          issue_family: "language_clarity" as never,
          strategic_lever: "scene_goal_clarity" as never,
          revision_granularity: "line" as never,
          mechanism: "x",
          specific_fix: "y",
          reader_effect: "z",
        },
      ],
      rationale: "",
      manuscriptText: MANUSCRIPT,
    });

    expect(out.evidence.length).toBeGreaterThanOrEqual(2);
    // Second anchor must be drawn from the manuscript
    expect(MANUSCRIPT.includes(out.evidence[1].snippet)).toBe(true);
    // The first recommendation must now carry a verbatim anchor_snippet
    expect(out.recommendations[0].anchor_snippet.length).toBeGreaterThan(0);
  });

  test("does not overwrite an existing anchor_snippet on a recommendation", () => {
    const out = enforceProseControlAnchorFloor({
      evidence: [
        { snippet: "Already anchored", char_start: 0, char_end: 16 },
      ],
      recommendations: [
        {
          priority: "high" as const,
          action: "Sharpen image clusters.",
          expected_impact: "Tighter texture.",
          anchor_snippet: "model-supplied verbatim quote",
          source_pass: 3 as const,
          issue_family: "language_clarity" as never,
          strategic_lever: "scene_goal_clarity" as never,
          revision_granularity: "line" as never,
          mechanism: "",
          specific_fix: "",
          reader_effect: "",
        },
      ],
      rationale: "",
      manuscriptText: MANUSCRIPT,
    });

    expect(out.recommendations[0].anchor_snippet).toBe(
      "model-supplied verbatim quote",
    );
  });
});

describe("Per-criterion score cap (Fix 3)", () => {
  test("maxLowConfidenceScoreFor returns 6 for proseControl, 5 for others", () => {
    expect(maxLowConfidenceScoreFor("proseControl")).toBe(6);
    expect(maxLowConfidenceScoreFor("dialogue")).toBe(
      QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
    );
    expect(maxLowConfidenceScoreFor("voice")).toBe(
      QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
    );
    expect(maxLowConfidenceScoreFor("concept")).toBe(
      QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
    );
  });
});

describe("Per-criterion moderate-min (Fix 3, confidence side)", () => {
  test("a thin-but-anchored proseControl emission lands at moderate, while a non-prose-control criterion with the same numeric confidence stays low", () => {
    // Use the regression case from the canonical evidence run
    // (docs/operations/evidence/runs/2026-04-14_..._postfix_t180b): proseControl
    // came back with 1 anchor + generic rationale + unanchored recommendations
    // and ended up at confidence ~45. With Fix 2 promoting a second anchor and
    // Fix 3 lowering MODERATE_MIN to 55 for proseControl, this case should
    // climb out of `low`.
    const sourceText =
      "The air smelled faintly of baked dust, cedar, and paper. " +
      "The wind moved through the cottonwoods like a slow breath.";

    const prose = computeCriterionConfidence(
      {
        key: "proseControl",
        score_0_10: 7,
        final_rationale:
          "Cadence and image density sustain observational rhythm across the paragraph.",
        evidence: [
          {
            snippet:
              "The air smelled faintly of baked dust, cedar, and paper.",
          },
          {
            snippet:
              "The wind moved through the cottonwoods like a slow breath.",
          },
        ],
        recommendations: [
          {
            action:
              "Trim hedges in the opening to keep cadence honest at the line level.",
            anchor_snippet:
              "The air smelled faintly of baked dust, cedar, and paper.",
          },
        ],
      },
      sourceText,
    );

    // proseControl-specific threshold (55) lets this clear moderate.
    expect(prose.confidence_score_0_100).toBeGreaterThanOrEqual(55);
    expect(prose.confidence_level).not.toBe("low");
  });
});

describe("End-to-end: parsePass3Response wires the floor", () => {
  function makePass(pass: 1 | 2): SinglePassOutput {
    return {
      pass,
      axis: pass === 1 ? "craft_execution" : "editorial_literary",
      model: "o3",
      prompt_version: "test",
      temperature: 0.2,
      generated_at: new Date().toISOString(),
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          "Pass rationale highlights specific manuscript grounding for testing only.",
        evidence: [
          {
            snippet: "Pass evidence snippet for " + key,
            char_start: 0,
            char_end: 30,
          },
        ],
        recommendations: [
          {
            priority: "medium" as const,
            action:
              "Tighten cadence in the opening paragraph because hedges diffuse tension.",
            expected_impact:
              "Reader momentum improves and tension stays crisp through the turn.",
            anchor_snippet: "",
            source_pass: pass,
            issue_family: "language_clarity" as never,
            strategic_lever: "scene_goal_clarity" as never,
            revision_granularity: "line" as never,
          },
        ],
        signal_strength: "SUFFICIENT" as const,
        confidence_level: "moderate" as const,
        status: "SCORABLE" as const,
      })),
    } as unknown as SinglePassOutput;
  }

  test("proseControl emerges with >=2 anchors and an anchored recommendation when Pass-3 emits only one anchor + rationale-stranded quote", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const synthesized = {
      criteria: CRITERIA_KEYS.map((key) => {
        if (key === "proseControl") {
          return {
            key,
            craft_score: 7,
            editorial_score: 7,
            final_score_0_10: 7,
            final_rationale:
              'The line "the wind moved through the cottonwoods like a slow breath" controls cadence cleanly.',
            evidence: [
              {
                snippet: "The air smelled faintly of baked dust",
                char_start: MANUSCRIPT.indexOf(
                  "The air smelled faintly of baked dust",
                ),
                char_end:
                  MANUSCRIPT.indexOf(
                    "The air smelled faintly of baked dust",
                  ) + "The air smelled faintly of baked dust".length,
              },
            ],
            recommendations: [
              {
                priority: "medium",
                action:
                  "Trim hedges in the opening paragraph because they diffuse tension before the turn.",
                expected_impact:
                  "Tighter prose increases reader momentum at the line level.",
                anchor_snippet: "",
                source_pass: 3,
                issue_family: "language_clarity",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "line",
                mechanism:
                  "the hedges diffuse tension before the turn",
                specific_fix:
                  "trim qualifiers and replace with concrete image",
                reader_effect: "momentum and immersion at the line level",
              },
            ],
            consequence_status: "landed",
          };
        }
        return {
          key,
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale:
            "Confirmed across both passes with concrete grounding.",
          evidence: [
            { snippet: "anchor for " + key, char_start: 0, char_end: 20 },
          ],
          recommendations: [
            {
              priority: "medium",
              action:
                "Specific fix for " +
                key +
                " because the prior beat undercuts payoff.",
              expected_impact:
                "Reader urgency and clarity improve through the turn.",
              anchor_snippet: "anchor for " + key,
              source_pass: 3,
              issue_family: "language_clarity",
              strategic_lever: "scene_goal_clarity",
              revision_granularity: "line",
              mechanism: "mech for " + key,
              specific_fix: "fix for " + key,
              reader_effect: "effect for " + key,
            },
          ],
          consequence_status: "landed",
        };
      }),
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary:
          "Strong line craft with revision pressure remaining in narrative drive, theme, pacing.",
        top_3_strengths: ["voice", "imagery", "cadence"],
        top_3_risks: ["pacing", "theme", "structure"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
        generated_at: new Date().toISOString(),
      },
    };

    const parsed = parsePass3Response(
      JSON.stringify(synthesized),
      pass1,
      pass2,
      "o3",
      MANUSCRIPT,
    );

    const prose = parsed.criteria.find((c) => c.key === "proseControl");
    expect(prose).toBeDefined();
    expect(prose!.evidence.length).toBeGreaterThanOrEqual(2);

    // The rationale-stranded quote must have been promoted into evidence with
    // a real char_start derived from the manuscript.
    const promoted = prose!.evidence.find((e) =>
      e.snippet.includes("cottonwoods"),
    );
    expect(promoted).toBeDefined();
    expect(promoted!.char_start).toBe(
      MANUSCRIPT.indexOf(
        "the wind moved through the cottonwoods like a slow breath",
      ),
    );

    // At least one proseControl recommendation must now carry a verbatim anchor.
    expect(
      prose!.recommendations.some(
        (r) => r.anchor_snippet && r.anchor_snippet.length > 0,
      ),
    ).toBe(true);
  });
});
