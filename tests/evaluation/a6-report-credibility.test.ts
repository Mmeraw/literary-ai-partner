import { describe, expect, test } from "@jest/globals";
import { buildA6Report } from "@/lib/evaluation/a6/buildA6Report";

describe("Phase 2.6 A6 report credibility", () => {
  const sourceText =
    'The river moved slowly through the valley. "You said you would be here," she whispered.';

  const anchors = [
    {
      anchor_id: "anchor_1",
      start_offset: 4,
      end_offset: 22,
      source_excerpt: sourceText.slice(4, 22),
    },
    {
      anchor_id: "anchor_2",
      start_offset: 43,
      end_offset: 86,
      source_excerpt: sourceText.slice(43, 86),
    },
  ];

  test("builds rubric, confidence, and provenance with valid anchor trace", () => {
    const report = buildA6Report({
      evaluation_id: "eval_a6_1",
      criteria: [
        {
          name: "narrative_cohesion",
          score: 8.5,
          max_score: 10,
          reasoning:
            "The scene progression is clear and the motion of the passage is easy to follow.",
          evidence_refs: ["anchor_1"],
        },
        {
          name: "tone_consistency",
          score: 8.9,
          max_score: 10,
          reasoning: "Dialogue tone and scene texture remain stylistically aligned.",
          evidence_refs: ["anchor_2"],
        },
      ],
      anchors,
      source_text: sourceText,
      commit_sha: "testsha123",
      model_version: "a6-test",
    });

    expect(report.criteria).toHaveLength(2);
    expect(report.provenance).toHaveLength(2);
    expect(report.criteria[0].reasoning.length).toBeGreaterThan(0);
    expect(report.criteria[0].evidence_refs).toEqual(["anchor_1"]);
    expect(report.criteria[0].confidence).toBeGreaterThan(0);
    expect(report.overall.confidence).toBeGreaterThan(0);
    expect(report.provenance[0].source_excerpt).toBe(sourceText.slice(4, 22));
  });

  test("fails closed when reasoning has no evidence refs", () => {
    expect(() =>
      buildA6Report({
        evaluation_id: "eval_a6_2",
        criteria: [
          {
            name: "clarity",
            score: 7.5,
            max_score: 10,
            reasoning: "The prose is mostly clear.",
            evidence_refs: [],
          },
        ],
        anchors,
        source_text: sourceText,
        commit_sha: "testsha123",
        model_version: "a6-test",
      }),
    ).toThrow("A6_MISSING_EVIDENCE_REFS");
  });

  test("fails closed when provenance anchor does not resolve to source text", () => {
    expect(() =>
      buildA6Report({
        evaluation_id: "eval_a6_3",
        criteria: [
          {
            name: "prose_control",
            score: 8,
            max_score: 10,
            reasoning: "Sentence rhythm is controlled throughout the passage.",
            evidence_refs: ["anchor_bad"],
          },
        ],
        anchors: [
          {
            anchor_id: "anchor_bad",
            start_offset: 0,
            end_offset: 5,
            source_excerpt: "WRONG",
          },
        ],
        source_text: sourceText,
        commit_sha: "testsha123",
        model_version: "a6-test",
      }),
    ).toThrow("A6_PHANTOM_ANCHOR");
  });

  test("confidence changes with evidence richness", () => {
    const rich = buildA6Report({
      evaluation_id: "eval_a6_4",
      criteria: [
        {
          name: "character_consistency",
          score: 8,
          max_score: 10,
          reasoning:
            "Character voice remains stable across narrated and spoken lines.",
          evidence_refs: ["anchor_1", "anchor_2"],
        },
      ],
      anchors,
      source_text: sourceText,
      commit_sha: "testsha123",
      model_version: "a6-test",
    });

    const thin = buildA6Report({
      evaluation_id: "eval_a6_5",
      criteria: [
        {
          name: "character_consistency",
          score: 8,
          max_score: 10,
          reasoning: "Stable.",
          evidence_refs: ["anchor_1"],
        },
      ],
      anchors: [anchors[0]],
      source_text: sourceText,
      commit_sha: "testsha123",
      model_version: "a6-test",
    });

    expect(rich.criteria[0].confidence).toBeGreaterThan(thin.criteria[0].confidence);
  });
});
