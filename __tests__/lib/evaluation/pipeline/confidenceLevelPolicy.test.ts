import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { maxLowConfidenceScore } from "@/lib/evaluation/pipeline/criterionConfidence";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import type { SynthesisOutput } from "@/lib/evaluation/pipeline/types";

function makeSynthesis(
  overrideCriteria?: SynthesisOutput["criteria"],
): SynthesisOutput {
  return {
    criteria:
      overrideCriteria ??
      CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 7,
        final_score_0_10: 7,
        score_delta: 0,
        final_rationale:
          `Strong ${key} execution shows adequate craft support, visible manuscript evidence, and reader-facing consequence across the evaluated scene material.`,
        pressure_points: ["Clear pressure and stakes remain visible throughout."],
        decision_points: ["A visible turn lands in the middle of the manuscript."],
        consequence_status: "landed" as const,
        evidence: [
          { snippet: `The ${key} beat lands clearly in the opening chapter.` },
        ],
        recommendations: [
          {
            priority: "medium" as const,
            action: `In chapter 2, tighten the ${key} turn by adding one concrete consequence beat so the reader can track the causal movement through the scene.`,
            expected_impact: `This creates a clearer ${key} arc across the manuscript and gives the reader stronger confidence in the revised scene logic.`,
            anchor_snippet: `The ${key} beat lands clearly in the opening chapter.`,
            source_pass: 3 as const,
            issue_family: "scene_structure" as const,
            strategic_lever: "scene_goal_clarity" as const,
            revision_granularity: "scene" as const,
            mechanism: "the turn is diffuse",
            specific_fix: "tighten one beat",
            reader_effect: "clearer momentum",
          },
        ],
        confidence_score_0_100: 72,
        confidence_level: "moderate" as const,
        confidence_reasons: [
          "Three or more evidence anchors support this criterion.",
        ],
        scorability_status: "scorable" as const,
      })),
    overall: {
      overall_score_0_100: 72,
      verdict: "conditional" as unknown as SynthesisOutput["overall"]["verdict"],
      one_sentence_pitch:
        "A craft-focused manuscript needs targeted scene revision to strengthen evidence, pacing, and reader confidence.",
      one_paragraph_pitch:
        "A craft-focused manuscript uses scene turns, textual anchors, and confidence signals to test whether the evaluation can preserve clear revision guidance. The draft remains conditional because several criteria need stronger evidence, pacing, and consequence before submission readiness.",
      one_paragraph_summary:
        "The manuscript delivers strong craft with targeted revision needs.",
      top_3_strengths: [
        "Voice gives the manuscript a clear atmospheric identity.",
        "Concept provides a focused premise for revision work.",
        "Character pressure creates concrete emotional stakes.",
      ],
      top_3_risks: [
        "Pacing may soften the pressure before the central turn lands.",
        "Dialogue may need sharper subtext to sustain reader confidence.",
        "Narrative closure may underdeliver without clearer consequence.",
      ],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-5.1",
      pass2_model: "gpt-5.1",
      pass3_model: "gpt-5.1",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

const BASE_IDS = {
  evaluation_run_id: "run-g5-policy-fixture",
  job_id: "job-g5-policy-fixture",
  manuscript_id: 40050,
  user_id: "00000000-0000-0000-0000-000000g5test",
};

const SOURCE_TEXT_WITH_SNIPPETS =
  CRITERIA_KEYS.map(
    (key) => `The ${key} beat lands clearly in the opening chapter.`,
  ).join(" ") + " word ".repeat(500);

const ECG_ENRICHMENT = {
  premise:
    "A craft-focused manuscript tests whether scene-level evidence, confidence signals, and revision guidance can preserve reader trust across a complete evaluation.",
  diagnosed_genre: "literary fiction",
  target_audience: "adult literary fiction readers",
};

function adapt(synthesis: SynthesisOutput) {
  return synthesisToEvaluationResultV2({
    synthesis,
    ids: BASE_IDS,
    sourceText: SOURCE_TEXT_WITH_SNIPPETS,
    manuscriptText: SOURCE_TEXT_WITH_SNIPPETS,
    title: "G5 Policy Fixture",
    llmEnrichment: ECG_ENRICHMENT,
  });
}

function assertLowConfidenceInvariant(result: ReturnType<typeof adapt>): void {
  for (const criterion of result.criteria) {
    const cap = maxLowConfidenceScore(criterion.key);
    if (criterion.confidence_level === "low") {
      expect(criterion.confidence_score_0_100).toBeLessThanOrEqual(cap);
    }
    if ((criterion.confidence_score_0_100 ?? 0) > cap) {
      expect(criterion.confidence_level).not.toBe("low");
    }
  }
}

describe("maxLowConfidenceScore — canonical ceiling per criterion key", () => {
  test("general keys return 59", () => {
    for (const key of ["character", "narrativeDrive", "voice", "pacing", "dialogue", "theme"]) {
      expect(maxLowConfidenceScore(key)).toBe(59);
    }
  });

  test("proseControl returns 54", () => {
    expect(maxLowConfidenceScore("proseControl")).toBe(54);
  });

  test("unknown and absent keys fall back to 59", () => {
    expect(maxLowConfidenceScore("unknownCriterionXYZ")).toBe(59);
    expect(maxLowConfidenceScore(null)).toBe(59);
    expect(maxLowConfidenceScore(undefined)).toBe(59);
  });

  test("ceilings remain below their moderate thresholds", () => {
    expect(maxLowConfidenceScore("character")).toBeLessThan(60);
    expect(maxLowConfidenceScore("proseControl")).toBeLessThan(55);
  });
});

describe("Global invariant — synthesisToEvaluationResultV2 output consistency", () => {
  test("no criterion exits with low confidence above the moderate threshold", () => {
    assertLowConfidenceInvariant(adapt(makeSynthesis()));
  });

  test("anchor-absent criteria remain within the low-confidence ceiling", () => {
    const criteria = CRITERIA_KEYS.map((key) => ({
      ...makeSynthesis().criteria.find((criterion) => criterion.key === key)!,
      craft_score: 5,
      editorial_score: 5,
      final_score_0_10: 5,
      consequence_status: "absent" as const,
      evidence: [{ snippet: "" }],
      confidence_score_0_100: 55,
      confidence_level: "moderate" as const,
      confidence_reasons: [],
    }));

    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(criteria),
      ids: BASE_IDS,
      sourceText: "Completely unrelated source material.",
      manuscriptText: "Completely unrelated source material.",
      title: "G5 Anchor-Absent Fixture",
      llmEnrichment: ECG_ENRICHMENT,
    });

    assertLowConfidenceInvariant(result);
  });

  test("mixed evidence levels preserve the invariant", () => {
    const criteria = makeSynthesis().criteria.map((criterion, index) => ({
      ...criterion,
      craft_score: index % 2 === 0 ? 8 : 3,
      editorial_score: index % 2 === 0 ? 8 : 3,
      final_score_0_10: index % 2 === 0 ? 8 : 3,
      evidence: index % 2 === 0 ? criterion.evidence : [],
      confidence_score_0_100: index % 2 === 0 ? 72 : 10,
      confidence_level: (index % 2 === 0 ? "moderate" : "low") as "moderate" | "low",
      confidence_reasons: [],
      scorability_status: (index % 2 === 0 ? "scorable" : "scorable_low_confidence") as
        | "scorable"
        | "scorable_low_confidence",
    }));

    assertLowConfidenceInvariant(adapt(makeSynthesis(criteria)));
  });
});

describe("enforceConfidenceLevelPolicy — structural presence in V2 adapter chain", () => {
  test("when the clamp reason fires, the score is within the canonical range", () => {
    const result = adapt(makeSynthesis());
    for (const criterion of result.criteria) {
      if ((criterion.confidence_reasons ?? []).includes("CONFIDENCE_LEVEL_SCORE_CLAMPED")) {
        expect(criterion.confidence_level).toBe("low");
        expect(criterion.confidence_score_0_100).toBeLessThanOrEqual(
          maxLowConfidenceScore(criterion.key),
        );
      }
    }
  });

  test("anchor absence does not add the score-clamped reason", () => {
    const criteria = CRITERIA_KEYS.map((key) => ({
      ...makeSynthesis().criteria.find((criterion) => criterion.key === key)!,
      craft_score: 5,
      editorial_score: 5,
      final_score_0_10: 5,
      consequence_status: "absent" as const,
      evidence: [{ snippet: "" }],
      confidence_score_0_100: 55,
      confidence_level: "moderate" as const,
      confidence_reasons: [],
    }));

    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(criteria),
      ids: BASE_IDS,
      sourceText: "Completely unrelated source material.",
      manuscriptText: "Completely unrelated source material.",
      title: "G5 No-Double-Cap Fixture",
      llmEnrichment: ECG_ENRICHMENT,
    });

    for (const criterion of result.criteria) {
      expect(criterion.confidence_reasons ?? []).not.toContain(
        "CONFIDENCE_LEVEL_SCORE_CLAMPED",
      );
    }
  });
});
