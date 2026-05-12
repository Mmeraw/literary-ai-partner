import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";

function makePass(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: key === "proseControl" ? 8 : 7,
      rationale: `Rationale for ${key}`,
      evidence: [
        {
          snippet: `Evidence for ${key}`,
        },
      ],
      recommendations: [
        {
          priority: "medium",
          action: `Revise ${key} with a concrete line-level move near the turn to sharpen specificity and momentum.`,
          expected_impact: `Improves ${key} clarity and reader engagement at the turn.`,
          anchor_snippet: `Anchor for ${key}`,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
    model: "gpt-4o",
    prompt_version: `pass${pass}`,
    temperature: 0.2,
    generated_at: new Date().toISOString(),
  };
}

function rawCriterion(key: CriterionKey, overrides: Record<string, unknown> = {}) {
  return {
    key,
    craft_score: key === "proseControl" ? 8 : 7,
    editorial_score: key === "proseControl" ? 8 : 7,
    final_score_0_10: key === "proseControl" ? 8 : 7,
    final_rationale: `Criterion ${key} rationale.`,
    evidence: [{ snippet: `Evidence for ${key}` }],
    recommendations: [
      {
        priority: "medium",
        action: `Revise ${key} with a concrete line-level move near the turn to sharpen specificity and momentum.`,
        expected_impact: `Improves ${key} clarity and reader engagement at the turn.`,
        anchor_snippet: `Anchor for ${key}`,
        source_pass: 3,
        issue_family: "scene_structure",
        strategic_lever: "scene_goal_clarity",
        revision_granularity: "scene",
        mechanism: "the abstract phrasing diffuses the signal before the decision point",
        specific_fix: "replace one abstract sentence with a concrete sensory beat",
        reader_effect: "clearer cause-and-effect and stronger momentum",
      },
    ],
    ...overrides,
  };
}

describe("prose control anchor floor hardening", () => {
  it("promotes rationale quotes to proseControl evidence and backfills anchor_snippet", () => {
    const manuscriptText = [
      "The river carried no visible grief.",
      "The river will not publish reasons. It will publish results.",
      "It's memory with teeth.",
    ].join(" ");

    const criteria = CRITERIA_KEYS.map((key) =>
      key === "proseControl"
        ? rawCriterion(key, {
            evidence: [],
            final_rationale:
              'Prose appears strong and award-ready, with line-level control in "The river carried no visible grief." and "The river will not publish reasons. It will publish results."',
            recommendations: [
              {
                priority: "medium",
                action: "Anchor/location: paragraph starting 'The cycle is not a circle; it\'s a network.'; Specific revision move: merge 'The cycle is not a circle; it\'s a network.' with the.",
                expected_impact: "Reduces reiteration and improves flow.",
                anchor_snippet: "",
                source_pass: 3,
                issue_family: "prose_control",
                strategic_lever: "prose_compression",
                revision_granularity: "line",
                mechanism: "",
                specific_fix: "",
                reader_effect: "",
              },
            ],
          })
        : rawCriterion(key),
    );

    const synthesis = parsePass3Response(
      JSON.stringify({
        criteria,
        overall: {
          overall_score_0_100: 78,
          verdict: "revise",
          one_paragraph_summary: "Summary",
          top_3_strengths: ["voice", "concept", "theme"],
          top_3_risks: ["pacing", "dialogue", "closure"],
          submission_readiness: "close",
        },
      }),
      makePass(1),
      makePass(2),
      "gpt-4o",
      manuscriptText,
    );

    const prose = synthesis.criteria.find((criterion) => criterion.key === "proseControl");
    expect(prose).toBeDefined();
    expect((prose?.evidence ?? []).length).toBeGreaterThanOrEqual(2);
    expect(
      prose?.recommendations.some((recommendation) => recommendation.anchor_snippet.trim().length > 0),
    ).toBe(true);
    expect(prose?.technical_defects).toContainEqual(
      expect.objectContaining({ code: "RECOMMENDATION_TRUNCATED", retryable: true }),
    );
  });

  it("emits prose-control anchor extraction technical defect on short full submission when underfilled", () => {
    const manuscriptText = "This short chapter is fully submitted and carries strong prose claims but no quote overlap.";

    const criteria = CRITERIA_KEYS.map((key) =>
      key === "proseControl"
        ? rawCriterion(key, {
            evidence: [{ snippet: "single weak anchor" }],
            final_rationale:
              "Prose appears strong with award-ready quality and precise syntax, but anchoring remains underfilled.",
          })
        : rawCriterion(key),
    );

    const synthesis = parsePass3Response(
      JSON.stringify({
        criteria,
        overall: {
          overall_score_0_100: 77,
          verdict: "revise",
          one_paragraph_summary: "Summary",
          top_3_strengths: ["voice", "concept", "theme"],
          top_3_risks: ["pacing", "dialogue", "closure"],
          submission_readiness: "close",
        },
      }),
      makePass(1),
      makePass(2),
      "gpt-4o",
      manuscriptText,
    );

    const prose = synthesis.criteria.find((criterion) => criterion.key === "proseControl");
    expect(prose?.technical_defects).toContainEqual(
      expect.objectContaining({
        code: "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED",
        retryable: true,
      }),
    );
  });
});
