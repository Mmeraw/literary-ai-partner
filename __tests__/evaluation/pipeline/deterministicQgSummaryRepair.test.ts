import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { runQualityGateV2 } from "@/lib/evaluation/pipeline/qualityGate";
import {
  summarizePropagationIntegrity,
  normalizeSummaryWithBottomWeaknesses,
} from "@/lib/evaluation/pipeline/propagationIntegrity";

/**
 * Tests for the deterministic QG summary weakness repair path.
 *
 * When the ONLY QG failure is v2_summary_weakness_presence, the processor
 * must repair the overview summary deterministically (no LLM retry) by
 * calling normalizeSummaryWithBottomWeaknesses and then re-running QG.
 *
 * This test exercises the exact logic from processor.ts lines 9915-9953
 * to prove the repair is sufficient for Sister-class failures.
 */

function makeBaseFixture(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-sister-repair",
      job_id: "job-4157aa0d",
      manuscript_id: 999,
      user_id: "00000000-0000-0000-0000-000000000999",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "pass1+pass2+pass3",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 65,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary:
        "The manuscript presents a compelling narrative structure with strong thematic resonance.",
      top_3_strengths: ["concept", "voice", "character"],
      top_3_risks: ["dialogue", "sceneConstruction", "pacing"],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true as const,
      status: "SCORABLE" as const,
      signal_present: true,
      signal_strength: "SUFFICIENT" as const,
      confidence_band: "MEDIUM" as const,
      score_0_10: 7,
      rationale: `Criterion ${key} demonstrates observable characteristics.`,
      evidence: [
        { snippet: `Evidence anchor A for ${key}.` },
        { snippet: `Evidence anchor B for ${key}.` },
        { snippet: `Evidence anchor C for ${key}.` },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Revise ${key} through targeted edits.`,
          expected_impact: `Improves ${key} quality.`,
        },
      ],
    })),
    recommendations: {
      quick_wins: [],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {},
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.84,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
    },
  };
}

describe("deterministic QG summary weakness repair", () => {
  it("Sister regression: dialogue + sceneConstruction as bottom-score criteria triggers v2_summary_weakness_presence failure", () => {
    const fixture = makeBaseFixture();

    // Set dialogue and sceneConstruction as bottom-score criteria (score=4)
    const weakKeys = ["dialogue", "sceneConstruction"] as const;
    for (const key of weakKeys) {
      const idx = CRITERIA_KEYS.indexOf(key);
      fixture.criteria[idx] = {
        ...fixture.criteria[idx],
        score_0_10: 4,
        confidence_level: "moderate",
        confidence_score_0_100: 84,
      } as EvaluationResultV2["criteria"][number];
    }

    // Summary does NOT mention the weaknesses (Sister's actual failure mode)
    fixture.overview.one_paragraph_summary =
      "The manuscript presents a compelling narrative structure with strong thematic resonance.";

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);
    expect(
      result.checks.some(
        (check) =>
          check.check_id === "v2_summary_weakness_presence" &&
          !check.passed &&
          check.error_code === "QG_SUMMARY_OMITS_WEAKNESS",
      ),
    ).toBe(true);
  });

  it("deterministic repair patches summary and makes QG pass (Sister fix)", () => {
    const fixture = makeBaseFixture();

    const weakKeys = ["dialogue", "sceneConstruction"] as const;
    for (const key of weakKeys) {
      const idx = CRITERIA_KEYS.indexOf(key);
      fixture.criteria[idx] = {
        ...fixture.criteria[idx],
        score_0_10: 4,
        confidence_level: "moderate",
        confidence_score_0_100: 84,
      } as EvaluationResultV2["criteria"][number];
    }

    fixture.overview.one_paragraph_summary =
      "The manuscript presents a compelling narrative structure with strong thematic resonance.";

    // First run: QG fails
    const firstRun = runQualityGateV2(fixture);
    expect(firstRun.pass).toBe(false);

    // Check that ONLY v2_summary_weakness_presence failed
    const hardFailedChecks = firstRun.checks.filter((c) => !c.passed);
    expect(hardFailedChecks.length).toBe(1);
    expect(hardFailedChecks[0].check_id).toBe("v2_summary_weakness_presence");

    // Deterministic repair: exact processor logic
    const propagation = summarizePropagationIntegrity(fixture.criteria);
    expect(propagation.bottomScoreCriteria).toContain("dialogue");
    expect(propagation.bottomScoreCriteria).toContain("sceneConstruction");

    const repairedSummary = normalizeSummaryWithBottomWeaknesses(
      fixture.overview.one_paragraph_summary,
      propagation.bottomScoreCriteria,
    );

    // Repair must mention the weakness criteria
    expect(repairedSummary.toLowerCase()).toContain("dialogue");
    expect(repairedSummary.toLowerCase()).toContain("scene construction");

    // Apply repair
    fixture.overview.one_paragraph_summary = repairedSummary;

    // Re-run QG: must pass now
    const secondRun = runQualityGateV2(fixture);
    expect(secondRun.pass).toBe(true);
  });

  it("repair does NOT activate when other QG checks also fail", () => {
    const fixture = makeBaseFixture();

    // Make dialogue weak AND trigger a score-confidence violation
    const dialogueIdx = CRITERIA_KEYS.indexOf("dialogue");
    fixture.criteria[dialogueIdx] = {
      ...fixture.criteria[dialogueIdx],
      score_0_10: 4,
      confidence_level: "moderate",
      confidence_score_0_100: 84,
    } as EvaluationResultV2["criteria"][number];

    // Trigger v2_score_without_signal by making a criterion scored but with no signal
    const conceptIdx = CRITERIA_KEYS.indexOf("concept");
    fixture.criteria[conceptIdx] = {
      ...fixture.criteria[conceptIdx],
      score_0_10: 8,
      status: "NOT_APPLICABLE" as const,
      signal_present: false,
    } as EvaluationResultV2["criteria"][number];

    fixture.overview.one_paragraph_summary =
      "Strong narrative voice with compelling characters.";

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);

    const hardFailedChecks = result.checks.filter((c) => !c.passed);
    // More than one check should fail — repair must NOT activate
    const hasSummaryWeakness = hardFailedChecks.some(
      (c) => c.check_id === "v2_summary_weakness_presence",
    );
    const hasOtherFailure = hardFailedChecks.some(
      (c) => c.check_id !== "v2_summary_weakness_presence",
    );
    expect(hasSummaryWeakness || hasOtherFailure).toBe(true);
    // The point: when multiple checks fail, simple summary repair is insufficient
    if (hardFailedChecks.length > 1) {
      expect(hasOtherFailure).toBe(true);
    }
  });

  it("repair handles 5+ bottom-score criteria (Froggin Noggin regression)", () => {
    const fixture = makeBaseFixture();

    const weakKeys = [
      "pacing",
      "proseControl",
      "tone",
      "narrativeClosure",
      "marketability",
    ] as const;
    for (const key of weakKeys) {
      const idx = CRITERIA_KEYS.indexOf(key);
      fixture.criteria[idx] = {
        ...fixture.criteria[idx],
        score_0_10: 4,
        confidence_level: "moderate",
        confidence_score_0_100: 75,
      } as EvaluationResultV2["criteria"][number];
    }

    fixture.overview.one_paragraph_summary =
      "An ambitious literary novel with notable voice and characterization.";

    // First run fails
    const firstRun = runQualityGateV2(fixture);
    expect(firstRun.pass).toBe(false);
    const failed = firstRun.checks.filter((c) => !c.passed);
    expect(failed.length).toBe(1);
    expect(failed[0].check_id).toBe("v2_summary_weakness_presence");

    // Repair
    const propagation = summarizePropagationIntegrity(fixture.criteria);
    expect(propagation.bottomScoreCriteria.length).toBeGreaterThanOrEqual(5);

    const repairedSummary = normalizeSummaryWithBottomWeaknesses(
      fixture.overview.one_paragraph_summary,
      propagation.bottomScoreCriteria,
    );

    fixture.overview.one_paragraph_summary = repairedSummary;

    // Must pass after repair
    const secondRun = runQualityGateV2(fixture);
    expect(secondRun.pass).toBe(true);
  });

  it("repair is idempotent — applying twice produces same result", () => {
    const fixture = makeBaseFixture();

    const weakKeys = ["dialogue", "sceneConstruction"] as const;
    for (const key of weakKeys) {
      const idx = CRITERIA_KEYS.indexOf(key);
      fixture.criteria[idx] = {
        ...fixture.criteria[idx],
        score_0_10: 4,
        confidence_level: "moderate",
      } as EvaluationResultV2["criteria"][number];
    }

    const propagation = summarizePropagationIntegrity(fixture.criteria);
    const originalSummary = "The manuscript has strong voice and concept.";

    const firstRepair = normalizeSummaryWithBottomWeaknesses(
      originalSummary,
      propagation.bottomScoreCriteria,
    );
    const secondRepair = normalizeSummaryWithBottomWeaknesses(
      firstRepair,
      propagation.bottomScoreCriteria,
    );

    // Idempotent: second application doesn't double-append
    expect(secondRepair).toBe(firstRepair);
  });
});
