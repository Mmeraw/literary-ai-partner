/**
 * Regression test: synthesisToEvaluationResultV2 must enforce NA scope policy.
 *
 * Root cause: smoke test job 98b28735 failed with QG_FAILED / criteria_scope_aligned because
 * Pass 3B scored narrativeClosure and marketability on a 263-word micro_excerpt, but
 * synthesisToEvaluationResultV2 was not building criteriaPlan from scopeProfile — so
 * normalizeCriterion never saw plan=NA and let the scores through unchanged.
 *
 * Fix: synthesisToEvaluationResultV2 now resolves criteriaPlan from scopeProfile when
 * the caller does not supply one explicitly (resolvedCriteriaPlan = criteriaPlan ?? buildCriteriaPlanForScale).
 *
 * This test suite guards that contract permanently.
 */
import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SynthesisOutput } from "@/lib/evaluation/pipeline/types";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import type { SubmissionScopeProfile } from "@/lib/evaluation/pipeline/submissionScope";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeScopeProfile(
  inputScale: SubmissionScopeProfile["inputScale"],
  wordCount: number,
): SubmissionScopeProfile {
  return {
    inputScale,
    wordCount,
    chunkCount: 1,
    scorableCount: inputScale === "micro_excerpt" ? 11 : 13,
    confidenceCapSummary:
      inputScale === "micro_excerpt"
        ? "LOW"
        : inputScale === "light_chapter" || inputScale === "standard_chapter"
          ? "MODERATE"
          : "HIGH",
    scopePolicyVersion: "v1",
  };
}

/** Synthesis where Pass 3B naively scored ALL 13 criteria including NA ones */
function makeNaiveSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale: `Raw Pass 3B rationale for ${key}.`,
      pressure_points: ["Pressure point."],
      decision_points: ["Decision point."],
      consequence_status: "landed" as const,
      evidence: [{ snippet: `Evidence anchor for ${key}.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Revise ${key}.`,
          expected_impact: `Improves ${key}.`,
          anchor_snippet: `Anchor for ${key}.`,
          source_pass: 3 as const,
          issue_family: "scene_structure" as const,
          strategic_lever: "scene_goal_clarity" as const,
          revision_granularity: "scene" as const,
          mechanism: "inline reasoning",
          specific_fix: "add a concrete beat",
          reader_effect: "clearer consequence",
        },
      ],
      confidence_score_0_100: 80,
      confidence_level: "moderate" as const,
      confidence_reasons: ["evidence_present"],
      scorability_status: "scorable" as const,
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "Short excerpt with strong prose.",
      top_3_strengths: ["voice", "concept", "proseControl"],
      top_3_risks: ["narrativeClosure", "marketability", "dialogue"],
      submission_readiness: "needs_revision",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
    coverage_scope: {
      sourceChars: 1476,
      sourceWords: 263,
      analyzedChars: 1476,
      analyzedWords: 263,
      strategy: "full_text",
    },
  };
}

const BASE_IDS = {
  evaluation_run_id: "run-scope-na-test",
  job_id: "job-scope-na-test",
  manuscript_id: 6726,
  user_id: "ad336840-8820-4ac6-bffc-a058c5e0241f",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("synthesisToEvaluationResultV2 — NA scope enforcement via scopeProfile", () => {
  it("micro_excerpt: narrativeClosure must be NOT_APPLICABLE even when Pass 3B scored it", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      scopeProfile: makeScopeProfile("micro_excerpt", 263),
      sourceText: "Short lighthouse excerpt.",
      manuscriptText: "Short lighthouse excerpt.",
    });

    const nc = result.criteria.find((c) => c.key === "narrativeClosure");
    expect(nc).toBeDefined();
    expect(nc!.status).toBe("NOT_APPLICABLE");
    expect(nc!.scorable).toBe(false);
    expect(nc!.score_0_10).toBeNull();
    expect(nc!.signal_present).toBe(false);
  });

  it("micro_excerpt: marketability must be NOT_APPLICABLE even when Pass 3B scored it", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      scopeProfile: makeScopeProfile("micro_excerpt", 263),
      sourceText: "Short lighthouse excerpt.",
      manuscriptText: "Short lighthouse excerpt.",
    });

    const mk = result.criteria.find((c) => c.key === "marketability");
    expect(mk).toBeDefined();
    expect(mk!.status).toBe("NOT_APPLICABLE");
    expect(mk!.scorable).toBe(false);
    expect(mk!.score_0_10).toBeNull();
    expect(mk!.signal_present).toBe(false);
  });

  it("micro_excerpt: remaining 11 criteria remain SCORABLE", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      scopeProfile: makeScopeProfile("micro_excerpt", 263),
      sourceText: "Short lighthouse excerpt.",
      manuscriptText: "Short lighthouse excerpt.",
    });

    const naKeys = ["narrativeClosure", "marketability"];
    const scorable = result.criteria.filter((c) => !naKeys.includes(c.key));
    expect(scorable).toHaveLength(11);
    for (const c of scorable) {
      expect(c.status).not.toBe("NOT_APPLICABLE");
      expect(c.scorable).toBe(true);
    }
  });

  it("light_chapter (750-1999 words): narrativeClosure and marketability remain SCORABLE — no NA", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      scopeProfile: makeScopeProfile("light_chapter", 1200),
      sourceText: "A full chapter worth of text.",
      manuscriptText: "A full chapter worth of text.",
    });

    const nc = result.criteria.find((c) => c.key === "narrativeClosure");
    const mk = result.criteria.find((c) => c.key === "marketability");
    expect(nc!.status).not.toBe("NOT_APPLICABLE");
    expect(mk!.status).not.toBe("NOT_APPLICABLE");
    expect(nc!.scorable).toBe(true);
    expect(mk!.scorable).toBe(true);
  });

  it("standard_chapter (2000-5999 words): all 13 criteria remain SCORABLE — no NA", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      scopeProfile: makeScopeProfile("standard_chapter", 3500),
      sourceText: "A standard chapter worth of text.",
      manuscriptText: "A standard chapter worth of text.",
    });

    const naCount = result.criteria.filter((c) => c.status === "NOT_APPLICABLE").length;
    expect(naCount).toBe(0);
    expect(result.criteria).toHaveLength(13);
  });

  it("explicit criteriaPlan takes precedence over scopeProfile", () => {
    // If caller passes criteriaPlan explicitly, it wins — scopeProfile is ignored for plan resolution.
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      scopeProfile: makeScopeProfile("light_chapter", 1200), // would normally score all 13
      criteriaPlan: { narrativeClosure: "NA", marketability: "NA" }, // explicit override forces NA
      sourceText: "A chapter.",
      manuscriptText: "A chapter.",
    });

    const nc = result.criteria.find((c) => c.key === "narrativeClosure");
    const mk = result.criteria.find((c) => c.key === "marketability");
    expect(nc!.status).toBe("NOT_APPLICABLE");
    expect(mk!.status).toBe("NOT_APPLICABLE");
  });

  it("no scopeProfile and no criteriaPlan: all 13 criteria pass through as SCORABLE (backward compat)", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeNaiveSynthesis(),
      ids: BASE_IDS,
      // no scopeProfile, no criteriaPlan
      sourceText: "Text.",
      manuscriptText: "Text.",
    });

    const naCount = result.criteria.filter((c) => c.status === "NOT_APPLICABLE").length;
    // No plan → no NA enforcement → all scored
    expect(naCount).toBe(0);
  });
});
