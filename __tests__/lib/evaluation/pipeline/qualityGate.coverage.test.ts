/**
 * Quality Gate — Coverage enforcement checks.
 *
 * Validates that QG_THIN_RATIONALE and QG_LOW_EVIDENCE_COVERAGE
 * block evaluations with placeholder scores/rationales.
 */

import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import {
  runQualityGate,
  QG_MIN_RATIONALE_LENGTH,
  QG_MIN_EVIDENCE_COVERED_CRITERIA,
  QG_MIN_EVIDENCE_SNIPPET_LENGTH,
} from "@/lib/evaluation/pipeline/qualityGate";
import type { SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";

export {};

function makeCriterion(
  key: CriterionKey,
  overrides: Partial<SynthesizedCriterion> = {},
): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale:
      "This criterion demonstrates strong craft with consistent voice and tonal authority throughout the chapter.",
    pressure_points: ["Opening scene tension"],
    decision_points: ["Narrator's choice to continue driving"],
    consequence_status: "landed",
    evidence: [
      { snippet: "The water hadn't just turned brown. It had been fed." },
    ],
    recommendations: [
      {
        priority: "medium",
        action:
          "Consider seeding an earlier water anomaly in the opening two hundred words to prime the reader for the ecological revelation.",
        expected_impact:
          "Strengthens the speculative thread and primes readers for eco-horror pay-off.",
        anchor_snippet: "The water hadn't just turned brown.",
        source_pass: 3,
      },
    ],
    ...overrides,
  };
}

function makeSynthesis(
  criteriaOverrides?: Partial<SynthesizedCriterion>[],
): SynthesisOutput {
  const criteria = CRITERIA_KEYS.map((key, i) =>
    makeCriterion(key, criteriaOverrides?.[i] ?? {}),
  );
  return {
    criteria,
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary:
        "A well-voiced chapter with atmospheric strength that needs one decision point to convert observation into escalation.",
      top_3_strengths: ["Voice", "Atmosphere", "Cliff backstory"],
      top_3_risks: ["Pacing", "Action deficit", "Dialogue underweight"],
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

describe("Quality Gate — coverage enforcement", () => {
  test("passes when all criteria have substantive rationale and evidence", () => {
    const synthesis = makeSynthesis();
    const result = runQualityGate(synthesis);

    const rationaleCheck = result.checks.find(
      (c) => c.check_id === "rationale_coverage",
    );
    const evidenceCheck = result.checks.find(
      (c) => c.check_id === "evidence_coverage",
    );

    expect(rationaleCheck).toBeDefined();
    expect(rationaleCheck!.passed).toBe(true);
    expect(evidenceCheck).toBeDefined();
    expect(evidenceCheck!.passed).toBe(true);
  });

  test("fails QG_THIN_RATIONALE when criteria have placeholder rationale", () => {
    const overrides = CRITERIA_KEYS.map((_, i) =>
      i >= 7 ? { final_rationale: "No analysis." } : {},
    );
    const synthesis = makeSynthesis(overrides);
    const result = runQualityGate(synthesis);

    const check = result.checks.find(
      (c) => c.check_id === "rationale_coverage",
    );
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.error_code).toBe("QG_THIN_RATIONALE");
    expect(result.pass).toBe(false);
  });

  test("fails QG_LOW_EVIDENCE_COVERAGE when too many criteria lack evidence", () => {
    const overrides = CRITERIA_KEYS.map((_, i) =>
      i >= 8 ? { evidence: [] } : {},
    );
    const synthesis = makeSynthesis(overrides);
    const result = runQualityGate(synthesis);

    const check = result.checks.find(
      (c) => c.check_id === "evidence_coverage",
    );
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.error_code).toBe("QG_LOW_EVIDENCE_COVERAGE");
    expect(result.pass).toBe(false);
  });

  test("allows up to threshold gap count without failing", () => {
    const maxPermittedGaps = CRITERIA_KEYS.length - QG_MIN_EVIDENCE_COVERED_CRITERIA;
    const overrides = CRITERIA_KEYS.map((_, i) =>
      i >= CRITERIA_KEYS.length - maxPermittedGaps ? { evidence: [] } : {},
    );
    const synthesis = makeSynthesis(overrides);
    const result = runQualityGate(synthesis);

    const check = result.checks.find(
      (c) => c.check_id === "evidence_coverage",
    );
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  test("detects short evidence snippets as non-substantive", () => {
    const overrides = CRITERIA_KEYS.map((_, i) =>
      i >= 8 ? { evidence: [{ snippet: "Short." }] } : {},
    );
    const synthesis = makeSynthesis(overrides);
    const result = runQualityGate(synthesis);

    const check = result.checks.find(
      (c) => c.check_id === "evidence_coverage",
    );
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.error_code).toBe("QG_LOW_EVIDENCE_COVERAGE");
  });

  test("exact threshold: rationale at exactly MIN length passes", () => {
    const exactRationale = "A".repeat(QG_MIN_RATIONALE_LENGTH);
    const overrides = CRITERIA_KEYS.map(() => ({
      final_rationale: exactRationale,
    }));
    const synthesis = makeSynthesis(overrides);
    const result = runQualityGate(synthesis);

    const check = result.checks.find(
      (c) => c.check_id === "rationale_coverage",
    );
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  test("exact threshold: evidence snippet at exactly MIN length passes", () => {
    const exactSnippet = "A".repeat(QG_MIN_EVIDENCE_SNIPPET_LENGTH);
    const overrides = CRITERIA_KEYS.map(() => ({
      evidence: [{ snippet: exactSnippet }],
    }));
    const synthesis = makeSynthesis(overrides);
    const result = runQualityGate(synthesis);

    const check = result.checks.find(
      (c) => c.check_id === "evidence_coverage",
    );
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });
});
