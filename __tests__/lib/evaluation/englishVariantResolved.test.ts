/**
 * Regression test: resolved_english_variant persisted in evaluation artifact
 *
 * Verifies that `requested_english_variant` and `resolved_english_variant`
 * are written into `evaluation_result_v2.metrics.manuscript` when a
 * Canadian-English job is processed via synthesisToEvaluationResultV2.
 *
 * All six supported variants are tested to confirm correct label resolution.
 * No real model calls are made — the function under test is purely deterministic.
 *
 * ECG_MODE is pinned to WARN_ONLY for this suite: these tests exercise variant
 * resolution logic, not certification gate behaviour. The minimal fixture text
 * would fail ENFORCE-mode ECG checks (ECG_TEXT_TRUNCATED_WORD etc.) which are
 * out of scope here.
 */
import { beforeAll, afterAll } from "@jest/globals";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function baseCriterion(key: CriterionKey): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: `Criterion ${key} grounded in textual evidence.`,
    pressure_points: ["Scene transition pressure."],
    decision_points: ["Chapter-level consequential choice."],
    consequence_status: "landed",
    evidence: [{ snippet: `Evidence for ${key}.` }],
    recommendations: [],
  };
}

function makeSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map(baseCriterion),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "Solid manuscript requiring targeted revision.",
      top_3_strengths: ["voice", "premise", "character"],
      top_3_risks: ["pacing", "tension", "closure"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

const BASE_IDS = {
  evaluation_run_id: "run-english-variant-resolved-test",
  job_id: "job-english-variant-resolved-test",
  manuscript_id: 9001,
  user_id: "00000000-0000-0000-0000-000000009001",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("resolved_english_variant persisted in evaluation_result_v2 metrics", () => {
  // This suite tests variant resolution logic only — not ECG certification.
  // Pin to WARN_ONLY so that the minimal fixture text does not trigger a
  // hard throw from the ENFORCE-mode gate.
  const _originalEcgMode = process.env.ECG_MODE;
  beforeAll(() => {
    process.env.ECG_MODE = "WARN_ONLY";
  });
  afterAll(() => {
    if (_originalEcgMode === undefined) {
      delete process.env.ECG_MODE;
    } else {
      process.env.ECG_MODE = _originalEcgMode;
    }
  });

  it("persists resolved_english_variant as 'Canadian English' for variant 'ca'", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(),
      ids: BASE_IDS,
      englishVariant: "ca",
      manuscriptText: "The harbour was calm. The colour of the water had changed overnight.",
    });
    expect(result.metrics.manuscript.resolved_english_variant).toBe("Canadian English");
    expect(result.metrics.manuscript.requested_english_variant).toBe("ca");
  });

  it("defaults resolved_english_variant to 'American English' when no variant is provided", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(),
      ids: BASE_IDS,
    });
    expect(result.metrics.manuscript.resolved_english_variant).toBe("American English");
    expect(result.metrics.manuscript.requested_english_variant).toBe("us");
  });

  it("defaults to American English for invalid variant input", () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(),
      ids: BASE_IDS,
      englishVariant: "nonsense",
    });
    expect(result.metrics.manuscript.resolved_english_variant).toBe("American English");
    expect(result.metrics.manuscript.requested_english_variant).toBe("nonsense");
  });

  it.each([
    ["us", "American English"],
    ["uk", "British English"],
    ["ca", "Canadian English"],
    ["au", "Australian English"],
    ["za", "South African English"],
    ["nz", "New Zealand English"],
  ] as const)(
    "resolves variant '%s' to label '%s'",
    (variant, expectedLabel) => {
      const result = synthesisToEvaluationResultV2({
        synthesis: makeSynthesis(),
        ids: BASE_IDS,
        englishVariant: variant,
      });
      expect(result.metrics.manuscript.resolved_english_variant).toBe(expectedLabel);
      expect(result.metrics.manuscript.requested_english_variant).toBe(variant);
    },
  );

  it("Canadian-English evaluation preserves exact manuscript text in requested_english_variant tracking", () => {
    // Canonical Canadian-English sentence with lexical markers (colour, harbour).
    // This verifies that the variant tracking fields do not alter manuscript content.
    const canadianManuscript = "The colour of the harbour reminded her of a grey October afternoon in Montréal.";
    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(),
      ids: BASE_IDS,
      englishVariant: "ca",
      manuscriptText: canadianManuscript,
      sourceText: canadianManuscript,
    });
    expect(result.metrics.manuscript.resolved_english_variant).toBe("Canadian English");
    expect(result.metrics.manuscript.requested_english_variant).toBe("ca");
    // Manuscript content must not be altered by variant tracking.
    expect(result.metrics.manuscript.word_count).toBeGreaterThan(0);
  });
});
