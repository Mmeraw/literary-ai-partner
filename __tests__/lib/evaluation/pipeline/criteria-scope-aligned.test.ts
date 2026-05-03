import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { EvaluationResultV2, EvaluationCriterionV2 } from "@/schemas/evaluation-result-v2";
import { runQualityGateV2 } from "@/lib/evaluation/pipeline/qualityGate";
import { scopePolicy } from "@/lib/evaluation/signal/scopePolicy";
import type { SubmissionScopeProfile } from "@/lib/evaluation/pipeline/submissionScope";

function makeScopeProfile(inputScale: SubmissionScopeProfile["inputScale"]): SubmissionScopeProfile {
  return {
    inputScale,
    wordCount: inputScale === "micro_excerpt" ? 500 : 30000,
    chunkCount: 1,
    scorableCount: inputScale === "micro_excerpt" ? 11 : 13,
    confidenceCapSummary: inputScale === "micro_excerpt" ? "LOW" : "HIGH",
    scopePolicyVersion: "v1",
  };
}

function makeScorableCriterion(key: CriterionKey): EvaluationCriterionV2 {
  return {
    key,
    scorable: true,
    status: "SCORABLE",
    signal_present: true,
    signal_strength: "SUFFICIENT",
    confidence_band: "MEDIUM",
    score_0_10: 7,
    rationale: `Criterion ${key} has sufficient observable manuscript evidence with mechanism-level analysis.`,
    evidence: [
      { snippet: `Anchor A for ${key} with criterion-specific evidence and narrative context.` },
      { snippet: `Anchor B for ${key} confirming the observed pattern across scene progression.` },
    ],
    recommendations: [
      {
        priority: "medium",
        action: `Revise ${key} by tightening the target beat and preserving reader-facing causal clarity.`,
        expected_impact: `Improves ${key} signal clarity and narrative coherence for the reader.`,
      },
    ],
  };
}

function makeNaCriterion(key: CriterionKey): EvaluationCriterionV2 {
  return {
    key,
    scorable: false,
    status: "NOT_APPLICABLE",
    signal_present: false,
    signal_strength: "NONE",
    confidence_band: "LOW",
    score_0_10: null,
    rationale: `Criterion ${key} is governed as not applicable for this submission scope.`,
    evidence: [],
    recommendations: [],
  };
}

function makeFixtureForScope(inputScale: SubmissionScopeProfile["inputScale"]): EvaluationResultV2 {
  const criteria = CRITERIA_KEYS.map((key) => {
    const policy = scopePolicy(inputScale, key);
    return policy.plan === "NA" ? makeNaCriterion(key) : makeScorableCriterion(key);
  });

  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-scope-shape",
      job_id: "job-scope-shape",
      manuscript_id: 9001,
      user_id: "00000000-0000-0000-0000-000000009001",
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
      scored_criteria_count: criteria.filter((c) => c.status === "SCORABLE").length,
      one_paragraph_summary: "The manuscript demonstrates clear strengths while preserving scope-governed applicability boundaries.",
      top_3_strengths: ["voice", "character", "dialogue"],
      top_3_risks: ["pacing", "theme", "narrativeClosure"],
    },
    criteria,
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

describe("runQualityGateV2 criteria_scope_aligned", () => {
  const originalScopeFlag = process.env.EVAL_SCOPE_PROFILE_ENABLED;

  beforeEach(() => {
    process.env.EVAL_SCOPE_PROFILE_ENABLED = "true";
  });

  afterEach(() => {
    process.env.EVAL_SCOPE_PROFILE_ENABLED = originalScopeFlag;
  });

  it("passes when all 13 criteria are present and shapes match scope policy", () => {
    const scopeProfile = makeScopeProfile("micro_excerpt");
    const fixture = makeFixtureForScope("micro_excerpt");

    const result = runQualityGateV2(fixture, undefined, scopeProfile);
    const countCheck = result.checks.find((check) => check.check_id === "v2_criteria_count");
    const shapeCheck = result.checks.find((check) => check.check_id === "criteria_scope_aligned");

    expect(countCheck?.passed).toBe(true);
    expect(shapeCheck?.passed).toBe(true);
    expect(shapeCheck?.error_code).toBeUndefined();
  });

  it("fails missing criterion with QG_CRITERIA_MISSING (criteria_complete responsibility)", () => {
    const scopeProfile = makeScopeProfile("micro_excerpt");
    const fixture = makeFixtureForScope("micro_excerpt");
    fixture.criteria = fixture.criteria.filter((criterion) => criterion.key !== "marketability");

    const result = runQualityGateV2(fixture, undefined, scopeProfile);
    const countCheck = result.checks.find((check) => check.check_id === "v2_criteria_count");

    expect(result.pass).toBe(false);
    expect(countCheck?.passed).toBe(false);
    expect(countCheck?.error_code).toBe("QG_CRITERIA_MISSING");
  });

  it("fails NA-policy criterion carrying score/scorable/status mismatch", () => {
    const scopeProfile = makeScopeProfile("micro_excerpt");
    const fixture = makeFixtureForScope("micro_excerpt");

    const narrativeClosureIndex = fixture.criteria.findIndex((criterion) => criterion.key === "narrativeClosure");
    fixture.criteria[narrativeClosureIndex] = makeScorableCriterion("narrativeClosure");

    const result = runQualityGateV2(fixture, undefined, scopeProfile);
    const shapeCheck = result.checks.find((check) => check.check_id === "criteria_scope_aligned");

    expect(result.pass).toBe(false);
    expect(shapeCheck?.passed).toBe(false);
    expect(shapeCheck?.error_code).toBe("QG_CRITERIA_SCOPE_SHAPE_MISMATCH");
  });

  it("fails non-NA criterion marked NOT_APPLICABLE", () => {
    const scopeProfile = makeScopeProfile("micro_excerpt");
    const fixture = makeFixtureForScope("micro_excerpt");

    const conceptIndex = fixture.criteria.findIndex((criterion) => criterion.key === "concept");
    fixture.criteria[conceptIndex] = makeNaCriterion("concept");

    const result = runQualityGateV2(fixture, undefined, scopeProfile);
    const shapeCheck = result.checks.find((check) => check.check_id === "criteria_scope_aligned");

    expect(result.pass).toBe(false);
    expect(shapeCheck?.passed).toBe(false);
    expect(shapeCheck?.error_code).toBe("QG_CRITERIA_SCOPE_SHAPE_MISMATCH");
  });
});
