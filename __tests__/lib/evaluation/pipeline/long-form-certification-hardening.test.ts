import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SynthesisOutput } from "@/lib/evaluation/pipeline/types";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import type { SubmissionScopeProfile } from "@/lib/evaluation/pipeline/submissionScope";

function makeFullManuscriptScopeProfile(): SubmissionScopeProfile {
  return {
    inputScale: "full_manuscript",
    wordCount: 29_519,
    chunkCount: 3,
    scorableCount: 13,
    confidenceCapSummary: "HIGH",
    scopePolicyVersion: "v1",
  };
}

function makeSampledLongFormSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale: `Criterion ${key} looked strong in the sampled packet.`,
      pressure_points: ["Pressure enters in the sampled opening material."],
      decision_points: ["A visible turn lands in the sampled packet."],
      consequence_status: "landed" as const,
      evidence: [{ snippet: `Sampled evidence for ${key}.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Revise ${key} in the sampled section with a more concrete beat.`,
          expected_impact: `Improves ${key} clarity in the analyzed sample.`,
          anchor_snippet: `Anchor for ${key}.`,
          source_pass: 3 as const,
          issue_family: "scene_structure" as const,
          strategic_lever: "scene_goal_clarity" as const,
          revision_granularity: "scene" as const,
          mechanism: "sampled reasoning only",
          specific_fix: "add a concrete beat",
          reader_effect: "clearer local consequence",
        },
      ],
      confidence_score_0_100: 72,
      confidence_level: "moderate" as const,
      confidence_reasons: ["sampled_packet_support"],
      scorability_status: "scorable" as const,
    })),
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary: "The sampled packet suggests a promising manuscript with targeted revision needs.",
      top_3_strengths: ["voice", "concept", "character"],
      top_3_risks: ["pacing", "dialogue", "closure"],
      submission_readiness: "close",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: true,
    coverage_scope: {
      sourceChars: 160_000,
      sourceWords: 29_519,
      analyzedChars: 40_000,
      analyzedWords: 6_263,
      strategy: "sampled_beginning_middle_end",
    },
  };
}

describe("synthesisToEvaluationResultV2 long-form certification hardening", () => {
  test("withholds manuscript-wide scoring for sampled long-form coverage", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeSampledLongFormSynthesis(),
      ids: {
        evaluation_run_id: "run-long-form-cert",
        job_id: "job-long-form-cert",
        manuscript_id: 4242,
        user_id: "00000000-0000-0000-0000-000000004242",
      },
      scopeProfile: makeFullManuscriptScopeProfile(),
      manuscriptText: "word ".repeat(29_519),
      sourceText: "word ".repeat(29_519),
      title: "Dominatus fixture",
    });

    expect(result.overview.overall_score_0_100).toBeNull();
    expect(result.overview.scored_criteria_count).toBe(0);
    expect(result.overview.one_paragraph_summary).toContain("coverage-limited");
    expect(result.recommendations.quick_wins).toHaveLength(0);
    expect(result.recommendations.strategic_revisions).toHaveLength(0);
    expect(result.criteria.every((criterion) => criterion.status === "INSUFFICIENT_SIGNAL")).toBe(true);
    expect(result.criteria.every((criterion) => criterion.score_0_10 === null)).toBe(true);
    expect(result.governance.warnings).toContain("LONG_FORM_CERTIFICATION_WITHHELD");
    expect(result.governance.transparency?.evaluation_scope).toEqual(
      expect.objectContaining({
        route: "LONG_FORM",
        input_scale: "full_manuscript",
        manuscript_wide_certifiable: false,
      }),
    );
    expect(result.governance.transparency?.coverage_summary).toEqual(
      expect.objectContaining({
        partial_evaluation: true,
        sampling_strategy: "sampled_beginning_middle_end",
        source_word_count: 29_519,
        analyzed_word_count: 6_263,
      }),
    );
  });
});