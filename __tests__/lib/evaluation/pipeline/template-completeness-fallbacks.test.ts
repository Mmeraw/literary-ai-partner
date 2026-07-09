import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
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
      recommendations: [{
        action: `Strengthen the ${key} dimension by refining the underlying craft mechanics for deeper reader engagement.`,
        priority: "Optional" as const,
        evidence_anchor: `"Quoted anchor for ${key}" establishes concrete manuscript evidence.`,
        reader_consequence: "Deepens the reader's sense of consequence and emotional investment.",
      }, {
        action: `Elevate the ${key} criterion further by tightening the precision of scene-level execution across the middle act.`,
        priority: "Optional" as const,
        evidence_anchor: `"Second anchor for ${key}" provides additional evidence grounding.`,
        reader_consequence: "Sharpens the reader's experience of craft intentionality.",
      }],
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
  const previousEcgMode = process.env.ECG_MODE;

  beforeAll(() => {
    process.env.ECG_MODE = "WARN_ONLY";
  });

  afterAll(() => {
    if (previousEcgMode === undefined) {
      delete process.env.ECG_MODE;
      return;
    }

    process.env.ECG_MODE = previousEcgMode;
  });

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

  test("repairs short summary and thin theme rationale before template completeness gate", () => {
    const synthesis = makeTemplateReadySynthesis();
    synthesis.overall.one_paragraph_summary = "Too short.";
    synthesis.criteria = synthesis.criteria.map((criterion) =>
      criterion.key === "theme"
        ? {
            ...criterion,
            final_rationale: "Weak rationale.",
          }
        : criterion,
    );

    const result = synthesisToEvaluationResultV2({
      synthesis,
      ids: {
        evaluation_run_id: "run-template-repair",
        job_id: "job-template-repair",
        manuscript_id: 99,
        user_id: "00000000-0000-0000-0000-000000000099",
      },
      manuscriptText: "word ".repeat(2500),
      sourceText: "word ".repeat(2500),
      title: "Template Repair Regression",
      llmEnrichment: {
        trigger_warnings: ["violence"],
      },
    });

    const gate = validateTemplateCompleteness(result);
    const theme = result.criteria.find((criterion) => criterion.key === "theme");

    expect(gate.pass).toBe(true);
    expect(gate.violations.filter((v) => v.code === "MISSING_ONE_PARAGRAPH_SUMMARY")).toHaveLength(0);
    expect(gate.violations.filter((v) => v.code === "MISSING_RATIONALE" && v.criterion === "theme")).toHaveLength(0);
    expect(result.overview.one_paragraph_summary.length).toBeGreaterThanOrEqual(40);
    expect(theme?.rationale.length ?? 0).toBeGreaterThanOrEqual(40);
  });

  test("backfills missing strengths and risks to satisfy template completeness", () => {
    const synthesis = makeTemplateReadySynthesis();
    synthesis.overall.top_3_strengths = [];
    synthesis.overall.top_3_risks = [];

    const result = synthesisToEvaluationResultV2({
      synthesis,
      ids: {
        evaluation_run_id: "run-template-strength-risk-repair",
        job_id: "job-template-strength-risk-repair",
        manuscript_id: 77,
        user_id: "00000000-0000-0000-0000-000000000077",
      },
      manuscriptText: "word ".repeat(3500),
      sourceText: "word ".repeat(3500),
      title: "Strength Risk Repair",
      llmEnrichment: {
        trigger_warnings: ["violence"],
      },
    });

    const gate = validateTemplateCompleteness(result);

    expect(gate.pass).toBe(true);
    expect(result.overview.top_3_strengths.length).toBeGreaterThanOrEqual(3);
    expect(result.overview.top_3_risks.length).toBeGreaterThanOrEqual(3);
    expect(gate.violations.filter((v) => v.code === "INCOMPLETE_TOP_STRENGTHS")).toHaveLength(0);
    expect(gate.violations.filter((v) => v.code === "INCOMPLETE_TOP_RISKS")).toHaveLength(0);
  });
});
