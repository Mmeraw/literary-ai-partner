import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SynthesisOutput } from "@/lib/evaluation/pipeline/types";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import { validateTemplateCompleteness } from "@/lib/evaluation/pipeline/templateCompletenessGate";

function makeTemplateReadySynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 9,
      editorial_score: 9,
      final_score_0_10: 9,
      score_delta: 0,
      final_rationale:
        `Criterion ${key} is grounded in line-specific evidence and defensible editorial reasoning across the submission.`,
      pressure_points: ["Pressure and consequence are visible at the scene level."],
      decision_points: ["A clear scene decision materially shifts trajectory."],
      consequence_status: "landed" as const,
      evidence: [{ snippet: `"Quoted anchor for ${key}" establishes concrete manuscript evidence.` }],
      recommendations: [],
      confidence_score_0_100: 86,
      confidence_level: "high" as const,
      confidence_reasons: ["evidence_density_strong"],
      scorability_status: "scorable" as const,
    })),
    overall: {
      overall_score_0_100: 91,
      verdict: "pass",
      one_paragraph_summary:
        "A polished submission with strong line-level control and coherent scene consequence, requiring only limited strategic refinement.",
      one_sentence_pitch:
        "A retired jeweler's final trip becomes a reckoning with loyalty, mortality, and what remains unforgiven.",
      top_3_strengths: [
        "Distinct narrative voice with controlled tonal shifts",
        "Consistent scene-level pressure and consequence",
        "Credible emotional escalation anchored in character behavior",
      ],
      top_3_risks: [
        "Late-act transitions occasionally compress too quickly",
        "Secondary thread resolution can feel underweighted",
        "Some thematic motifs repeat without added consequence",
      ],
      submission_readiness: "queryable_now",
    },
    metadata: {
      pass1_model: "gpt-5.1",
      pass2_model: "gpt-5.1",
      pass3_model: "gpt-5.1",
      generated_at: new Date().toISOString(),
      genre_expectation_context: {
        diagnosed_genre: "literary fiction",
        shelf_target_audience: "Adult readers of introspective literary fiction with dark humor and moral complexity.",
        dominant_craft_engine: "voice",
        expectation_profiles: ["voice_forward", "mood_forward"],
        genre_expectation_ids: ["literary_upmarket"],
        genre_expectation_labels: ["Literary / upmarket fiction"],
        resolution_notes: ["fixture"],
      },
    },
    partial_evaluation: false,
    coverage_scope: {
      sourceChars: 31000,
      sourceWords: 6146,
      analyzedChars: 31000,
      analyzedWords: 6146,
      strategy: "sampled_beginning_middle_end",
    },
  };
}

describe("synthesisToEvaluationResultV2 template completeness fallbacks", () => {
  test("backfills premise/genre/target audience when llm enrichment omits them", () => {
    const synthesis = makeTemplateReadySynthesis();

    const result = synthesisToEvaluationResultV2({
      synthesis,
      ids: {
        evaluation_run_id: "run-template-fallback",
        job_id: "job-template-fallback",
        manuscript_id: 42,
        user_id: "00000000-0000-0000-0000-000000000042",
      },
      manuscriptText: "word ".repeat(6146),
      sourceText: "word ".repeat(6146),
      title: "Diamonds Aren't Forever",
      llmEnrichment: {
        trigger_warnings: ["violence"],
      },
    });

    const gate = validateTemplateCompleteness(result);

    expect(gate.pass).toBe(true);
    expect(gate.violations.filter((v) => v.severity === "critical")).toHaveLength(0);

    expect(result.enrichment?.premise).toBe(synthesis.overall.one_sentence_pitch);
    expect(result.enrichment?.diagnosed_genre).toBe(
      synthesis.metadata.genre_expectation_context?.diagnosed_genre,
    );
    expect(result.enrichment?.target_audience).toBe(
      synthesis.metadata.genre_expectation_context?.shelf_target_audience,
    );

    expect(result.metrics.manuscript.genre).toBe(
      synthesis.metadata.genre_expectation_context?.diagnosed_genre,
    );
    expect(result.metrics.manuscript.target_audience).toBe(
      synthesis.metadata.genre_expectation_context?.shelf_target_audience,
    );
  });
});
