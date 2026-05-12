import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { validateEvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { runQualityGateV2 } from "@/lib/evaluation/pipeline/qualityGate";
import type { EvaluationArtifact } from "@/lib/evaluation/pipeline/types";
import { buildScoreLedger } from "@/lib/evaluation/pipeline/buildScoreLedger";
import { buildExcellenceFilter } from "@/lib/evaluation/pipeline/buildExcellenceFilter";

function makeBaseV2Fixture(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-qg-v2",
      job_id: "job-qg-v2",
      manuscript_id: 101,
      user_id: "00000000-0000-0000-0000-000000000101",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "pass1+pass2+pass3",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 70,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: "The chapter demonstrates solid craft with targeted revision opportunities.",
      top_3_strengths: ["voice", "character", "dialogue"],
      top_3_risks: ["pacing", "theme", "closure"],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true as const,
      status: "SCORABLE" as const,
      signal_present: true,
      signal_strength: "SUFFICIENT" as const,
      confidence_band: "MEDIUM" as const,
      score_0_10: 7,
      rationale: `Criterion ${key} is observable with manuscript-grounded evidence and coherent synthesis rationale.`,
      evidence: [
        { snippet: `Evidence anchor A for ${key} with sufficient textual detail.` },
        { snippet: `Evidence anchor B for ${key} to satisfy minimum observability thresholds.` },
        { snippet: `Evidence anchor C for ${key} ensuring deterministic gate compliance.` },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Strengthen ${key} through targeted revision anchored to existing scenes.`,
          expected_impact: `Improves ${key} consistency and reader clarity.`,
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
      confidence: 0.85,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
    },
  };
}

function makeArtifactFixtureFromV2(result: EvaluationResultV2): EvaluationArtifact {
  const criteria = result.criteria.map((criterion) => ({
    key: criterion.key,
    final_score_0_10: criterion.score_0_10 ?? 0,
    reasoning: criterion.rationale,
    evidence: criterion.evidence.map((e) => `"${e.snippet}"`).join(" | "),
    interpretation: criterion.rationale,
  }));

  const scoreLedger = buildScoreLedger({
    criteria: criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  const efg = buildExcellenceFilter({
    criteria: criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  return {
    criteria,
    ledger: scoreLedger,
    efg,
  };
}

describe("runQualityGateV2 integration", () => {
  it("passes a canonical EvaluationResultV2 fixture", () => {
    const fixture = makeBaseV2Fixture();
    const artifact = makeArtifactFixtureFromV2(fixture);
    const validation = validateEvaluationResultV2(fixture);
    expect(validation.valid).toBe(true);

    const result = runQualityGateV2(fixture, artifact);
    expect(result.pass).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.artifactGate.verdict).toBe("PASS");
  });

  it("fails when non-scorable criteria carry numeric scores", () => {
    const fixture = makeBaseV2Fixture();
    const artifact = makeArtifactFixtureFromV2(fixture);
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      scorable: false,
      status: "NOT_APPLICABLE",
      signal_strength: "NONE",
      score_0_10: null,
    } as EvaluationResultV2["criteria"][number];
    fixture.criteria[1] = {
      ...fixture.criteria[1],
      scorable: false,
      status: "NO_SIGNAL",
      signal_strength: "NONE",
      score_0_10: 4,
      insufficient_signal_reason: {
        looked_for: ["scene-level evidence"],
        not_found: ["observable signal"],
      },
    } as EvaluationResultV2["criteria"][number];

    const result = runQualityGateV2(fixture, artifact);
    expect(result.pass).toBe(false);
    expect(result.checks.some((check) => check.check_id === "v2_score_without_signal" && !check.passed)).toBe(true);
  });

  it("fails closed when artifact gate verdict is FAIL", () => {
    const fixture = makeBaseV2Fixture();
    const artifact = makeArtifactFixtureFromV2(fixture);

    artifact.criteria = [];
    artifact.ledger = {
      rawTotal: 0,
      maxTotal: 130,
      normalized: 0,
      weighting: "equal",
    };
    artifact.efg = {
      verdict: "not-yet-ready",
      blockingCriteria: ["concept"],
    };

    const result = runQualityGateV2(fixture, artifact);
    expect(result.pass).toBe(false);
    expect(result.artifactGate.verdict).toBe("FAIL");
    expect(
      result.checks.some(
        (check) => check.check_id === "v2_artifact_gate" && !check.passed,
      ),
    ).toBe(true);
  });

  it("allows HOLD artifact verdict with warning-only behavior", () => {
    const fixture = makeBaseV2Fixture();
    const artifact = makeArtifactFixtureFromV2(fixture);

    artifact.criteria[0].evidence = "";

    const result = runQualityGateV2(fixture, artifact);
    expect(result.pass).toBe(true);
    expect(result.artifactGate.verdict).toBe("HOLD");
    expect(result.warnings.some((w) => w.includes("[ArtifactGate:HOLD]"))).toBe(true);
  });

  it("rejects non-canonical signal values via schema contract", () => {
    const fixture = makeBaseV2Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      signal_strength: "MODERATE" as never,
    };

    const validation = validateEvaluationResultV2(fixture);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("NONE|WEAK") || error.includes("SUFFICIENT|STRONG"))).toBe(true);
  });

  it("treats scorable_low_confidence below anchor threshold as warning-only", () => {
    const fixture = makeBaseV2Fixture();
    const proseControlIndex = CRITERIA_KEYS.indexOf("proseControl");

    fixture.criteria[proseControlIndex] = {
      ...fixture.criteria[proseControlIndex],
      evidence: [],
      score_0_10: 5,
      scorability_status: "scorable_low_confidence",
      confidence_level: "low",
      confidence_score_0_100: 25,
    } as EvaluationResultV2["criteria"][number];
    fixture.overview.one_paragraph_summary =
      "The chapter maintains voice strength, while prose control remains the primary weakness to revise.";

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(
      result.checks.some(
        (check) => check.check_id === "v2_scored_anchor_threshold" && check.passed,
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("LOW_CONFIDENCE_SCORABLE_CRITERIA:"),
      ),
    ).toBe(true);
  });

  it("still hard-fails fully scorable criteria below anchor threshold", () => {
    const fixture = makeBaseV2Fixture();
    const proseControlIndex = CRITERIA_KEYS.indexOf("proseControl");

    fixture.criteria[proseControlIndex] = {
      ...fixture.criteria[proseControlIndex],
      evidence: [],
      scorability_status: "scorable",
      confidence_level: "high",
      confidence_score_0_100: 90,
    } as EvaluationResultV2["criteria"][number];

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);
    expect(
      result.checks.some(
        (check) => check.check_id === "v2_scored_anchor_threshold" && !check.passed,
      ),
    ).toBe(true);
  });

  it("treats SCORABLE criteria with missing scorability_status as fully scorable and hard-fails under threshold", () => {
    const fixture = makeBaseV2Fixture();
    const proseControlIndex = CRITERIA_KEYS.indexOf("proseControl");

    fixture.criteria[proseControlIndex] = {
      ...fixture.criteria[proseControlIndex],
      evidence: [],
      confidence_level: "high",
      confidence_score_0_100: 90,
      // Intentionally absent to validate legacy/default behavior.
      scorability_status: undefined,
    } as EvaluationResultV2["criteria"][number];

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);
    expect(
      result.checks.some(
        (check) => check.check_id === "v2_scored_anchor_threshold" && !check.passed,
      ),
    ).toBe(true);
  });

  it("does not emit low-confidence warning for non_scorable criteria", () => {
    const fixture = makeBaseV2Fixture();
    const narrativeClosureIndex = CRITERIA_KEYS.indexOf("narrativeClosure");

    fixture.criteria[narrativeClosureIndex] = {
      ...fixture.criteria[narrativeClosureIndex],
      scorable: false,
      status: "NO_SIGNAL",
      signal_present: false,
      signal_strength: "NONE",
      score_0_10: null,
      evidence: [],
      scorability_status: "non_scorable",
      insufficient_signal_reason: {
        looked_for: ["closure payoff cues"],
        not_found: ["insufficient narrative endpoint evidence"],
      },
    } as EvaluationResultV2["criteria"][number];

    fixture.overview.scored_criteria_count = CRITERIA_KEYS.length - 1;

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("LOW_CONFIDENCE_SCORABLE_CRITERIA:"),
      ),
    ).toBe(false);
  });

  it("handles mixed scorable states distinctly in one gate run", () => {
    const fixture = makeBaseV2Fixture();
    const worldbuildingIndex = CRITERIA_KEYS.indexOf("worldbuilding");
    const dialogueIndex = CRITERIA_KEYS.indexOf("dialogue");
    const narrativeClosureIndex = CRITERIA_KEYS.indexOf("narrativeClosure");

    fixture.criteria[worldbuildingIndex] = {
      ...fixture.criteria[worldbuildingIndex],
      evidence: [{ snippet: "One sufficient worldbuilding anchor to satisfy threshold." }],
      scorability_status: "scorable",
      confidence_level: "high",
      confidence_score_0_100: 90,
    } as EvaluationResultV2["criteria"][number];

    fixture.criteria[dialogueIndex] = {
      ...fixture.criteria[dialogueIndex],
      evidence: [],
      score_0_10: 5,
      scorability_status: "scorable_low_confidence",
      confidence_level: "low",
      confidence_score_0_100: 30,
    } as EvaluationResultV2["criteria"][number];

    fixture.criteria[narrativeClosureIndex] = {
      ...fixture.criteria[narrativeClosureIndex],
      scorable: false,
      status: "NO_SIGNAL",
      signal_present: false,
      signal_strength: "NONE",
      score_0_10: null,
      evidence: [],
      scorability_status: "non_scorable",
      insufficient_signal_reason: {
        looked_for: ["closure payoff cues"],
        not_found: ["insufficient narrative endpoint evidence"],
      },
    } as EvaluationResultV2["criteria"][number];

    fixture.overview.scored_criteria_count = CRITERIA_KEYS.length - 1;
    fixture.overview.one_paragraph_summary =
      "The draft is coherent overall, but dialogue remains the weakest criterion and needs targeted revision.";

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("LOW_CONFIDENCE_SCORABLE_CRITERIA:"),
      ),
    ).toBe(true);
  });

  it("downgrades low-confidence criteria exceeding score cap to non-certified without failing the whole job", () => {
    const fixture = makeBaseV2Fixture();
    const conceptIndex = CRITERIA_KEYS.indexOf("concept");
    const dialogueIndex = CRITERIA_KEYS.indexOf("dialogue");
    const originalConceptScore = 8;
    // DEFENSIVE: Deep-clone to detect any future regression to in-place mutation.
    // If this were a direct reference, the test would pass silently even if
    // runQualityGateV2 mutates the criterion object in place.
    const originalDialogueCriterion = structuredClone(
      fixture.criteria[dialogueIndex],
    );

    fixture.criteria[conceptIndex] = {
      ...fixture.criteria[conceptIndex],
      score_0_10: originalConceptScore,
      confidence_level: "low",
      confidence_score_0_100: 22,
    } as EvaluationResultV2["criteria"][number];

    const originalFixtureSnapshot = structuredClone(fixture);

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);

    expect(fixture).toEqual(originalFixtureSnapshot);
    expect(result.downgradedResult).toBeDefined();

    const downgraded = result.downgradedResult?.criteria[conceptIndex];
    expect(downgraded).toBeDefined();
    expect(downgraded.status).toBe("INSUFFICIENT_SIGNAL");
    expect(downgraded.scorable).toBe(false);
    expect(downgraded.score_0_10).toBeNull();
    expect(downgraded.model_emitted_score_unverified).toBe(originalConceptScore);
    expect(downgraded.insufficient_signal_reason).toEqual({
      looked_for: ["CERTIFIED_ANCHORS_FOR_HIGH_CONFIDENCE_SCORING"],
      not_found: ["LOW_CONFIDENCE_HIGH_SCORE_WITHOUT_CERTIFIED_ANCHORS"],
    });

    const unchangedDialogue = result.downgradedResult?.criteria[dialogueIndex];
    expect(unchangedDialogue).toEqual(originalDialogueCriterion);
    expect(unchangedDialogue.status).toBe("SCORABLE");
    expect(unchangedDialogue.score_0_10).toBe(7);

    expect(
      result.checks.some(
        (check) =>
          check.check_id === "v2_fidelity_score_confidence_alignment" &&
          !check.passed &&
          check.error_code === "QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH",
      ),
    ).toBe(true);
  });

  it("allows proseControl score 6 at low confidence due to per-criterion cap", () => {
    const fixture = makeBaseV2Fixture();
    const proseControlIndex = CRITERIA_KEYS.indexOf("proseControl");

    fixture.criteria[proseControlIndex] = {
      ...fixture.criteria[proseControlIndex],
      score_0_10: 6,
      confidence_level: "low",
      confidence_score_0_100: 45,
    } as EvaluationResultV2["criteria"][number];

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(result.downgradedResult).toBeUndefined();
    expect(
      result.checks.some(
        (check) =>
          check.check_id === "v2_fidelity_score_confidence_alignment" && check.passed,
      ),
    ).toBe(true);
  });

  it("downgrades proseControl score above cap and tags technical defect", () => {
    const fixture = makeBaseV2Fixture();
    const proseControlIndex = CRITERIA_KEYS.indexOf("proseControl");

    fixture.criteria[proseControlIndex] = {
      ...fixture.criteria[proseControlIndex],
      score_0_10: 7,
      confidence_level: "low",
      confidence_score_0_100: 42,
    } as EvaluationResultV2["criteria"][number];

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(result.downgradedResult).toBeDefined();

    const downgraded = result.downgradedResult?.criteria[proseControlIndex];
    expect(downgraded?.status).toBe("INSUFFICIENT_SIGNAL");
    expect(downgraded?.technical_defects).toContainEqual(
      expect.objectContaining({
        code: "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED",
        retryable: true,
      }),
    );
  });

  it("keeps structural fatal checks fail-closed for missing criteria", () => {
    const fixture = makeBaseV2Fixture();
    fixture.criteria = fixture.criteria.slice(0, CRITERIA_KEYS.length - 1);
    fixture.overview.scored_criteria_count = fixture.criteria.length;

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);
    expect(result.downgradedResult).toBeUndefined();
    expect(
      result.checks.some(
        (check) => check.check_id === "v2_criteria_count" && !check.passed,
      ),
    ).toBe(true);
  });

  it("fails when summary omits bottom-score weakness cluster", () => {
    const fixture = makeBaseV2Fixture();
    const weakKeys = ["pacing", "theme", "narrativeClosure"] as const;

    for (const key of weakKeys) {
      const idx = CRITERIA_KEYS.indexOf(key);
      fixture.criteria[idx] = {
        ...fixture.criteria[idx],
        score_0_10: 4,
        confidence_level: "moderate",
      } as EvaluationResultV2["criteria"][number];
    }

    fixture.overview.one_paragraph_summary =
      "The chapter demonstrates strong atmosphere and voice with clear progression.";

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

  it("fails propagation integrity when upstream is weak but presentation remains high-authority", () => {
    const fixture = makeBaseV2Fixture();
    const lowConfidenceKeys = [
      "concept",
      "narrativeDrive",
      "character",
      "theme",
      "pacing",
    ] as const;

    for (const key of lowConfidenceKeys) {
      const idx = CRITERIA_KEYS.indexOf(key);
      fixture.criteria[idx] = {
        ...fixture.criteria[idx],
        score_0_10: 5,
        confidence_level: "low",
        confidence_score_0_100: 20,
      } as EvaluationResultV2["criteria"][number];
    }

    fixture.governance.warnings = [];

    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(false);
    expect(
      result.checks.some(
        (check) =>
          check.check_id === "v2_propagation_integrity" &&
          !check.passed &&
          check.error_code === "QG_PROPAGATION_INTEGRITY",
      ),
    ).toBe(true);
  });
});
