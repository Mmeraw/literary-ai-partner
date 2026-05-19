import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { validateEvaluationArtifact } from "@/lib/evaluation/validateEvaluationArtifact";

function makeValidArtifact(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-mutation-test",
      job_id: "job-mutation-test",
      manuscript_id: 1,
      user_id: "00000000-0000-0000-0000-000000000001",
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "mutation-test",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 70,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: "summary",
      top_3_strengths: [],
      top_3_risks: [],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true,
      status: "SCORABLE",
      signal_present: true,
      signal_strength: "SUFFICIENT",
      confidence_band: "MEDIUM",
      score_0_10: 7,
      rationale: `Rationale for ${key}`,
      evidence: [{ snippet: `Evidence for ${key}` }],
      recommendations: [],
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
      confidence: 0.8,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
    },
  };
}

describe("validateEvaluationArtifact (boundary structural validator)", () => {
  test("accepts non-scorable V2 criteria with null scores", () => {
    const artifact = makeValidArtifact();
    artifact.criteria[0] = {
      ...artifact.criteria[0],
      scorable: false,
      status: "INSUFFICIENT_SIGNAL",
      signal_strength: "WEAK",
      score_0_10: null,
      model_emitted_score_unverified: 7,
      insufficient_signal_reason: {
        looked_for: ["CERTIFIED_ANCHORS_FOR_HIGH_CONFIDENCE_SCORING"],
        not_found: ["LOW_CONFIDENCE_HIGH_SCORE_WITHOUT_CERTIFIED_ANCHORS"],
      },
    } as EvaluationResultV2["criteria"][number];
    artifact.overview.scored_criteria_count = CRITERIA_KEYS.length - 1;

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(true);
  });

  test("rejects legacy-like criteria missing status at the V2 boundary", () => {
    const artifact = makeValidArtifact();
    artifact.criteria[0] = {
      ...artifact.criteria[0],
      status: undefined as never,
      score_0_10: 7,
    } as unknown as EvaluationResultV2["criteria"][number];

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_SCORE_OUT_OF_RANGE" }),
      );
    }
  });

  test("rejects a missing canonical criterion", () => {
    const artifact = makeValidArtifact();
    artifact.criteria = artifact.criteria.filter((criterion) => criterion.key !== "narrativeDrive");

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "CRITERION_MISSING",
          path: "$.criteria.narrativeDrive",
        }),
      );
    }
  });

  test("rejects score above 10", () => {
    const artifact = makeValidArtifact();
    artifact.criteria[0].score_0_10 = 11;

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_SCORE_OUT_OF_RANGE" }),
      );
    }
  });

  test("rejects non-integer score", () => {
    const artifact = makeValidArtifact();
    artifact.criteria[0].score_0_10 = 5.5;

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_SCORE_NOT_INTEGER" }),
      );
    }
  });

  test("rejects empty evidence", () => {
    const artifact = makeValidArtifact();
    artifact.criteria[0].evidence = [{ snippet: "   " }];

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_EVIDENCE_MISSING" }),
      );
    }
  });

  test("rejects non-canonical criteria keys", () => {
    const artifact = makeValidArtifact();
    artifact.criteria.push({
      ...(artifact.criteria[0] as EvaluationResultV2["criteria"][number]),
      key: "fakeKey" as (typeof artifact.criteria)[number]["key"],
    });

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_NON_CANONICAL_KEY" }),
      );
    }
  });

  test("rejects truncated recommendation actions", () => {
    const artifact = makeValidArtifact();
    artifact.criteria[0].recommendations = [
      {
        priority: "medium",
        action: "merge 'The cycle is not a circle; it's a network.' with the.",
        expected_impact: "Improves forward motion.",
      },
    ];

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_RECOMMENDATION_TRUNCATED" }),
      );
    }
  });

  test("accepts complete recommendation ending in a hyphenated compound noun (load-in)", () => {
    // Regression: looksTruncatedRecommendation was falsely matching 'in' inside 'load-in.'
    const artifact = makeValidArtifact();
    const narrativeDrive = artifact.criteria.find((c) => c.key === "narrativeDrive")!;
    narrativeDrive.recommendations = [
      {
        priority: "medium",
        action:
          "To sustain momentum at the end of Chapter 1, tighten one reflective paragraph into two punchy beats before the load-in.",
        expected_impact: "Sharpens the scene transition.",
      },
    ];

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(true);
  });

  test("accepts complete recommendations ending in other compound nouns (drive-in, check-in, run-on)", () => {
    const artifact = makeValidArtifact();
    const narrativeDrive = artifact.criteria.find((c) => c.key === "narrativeDrive")!;
    const compoundEndings = [
      "Revise the climactic scene at the drive-in.",
      "Cut the redundant check-in.",
      "Shorten the run-on.",
      "Rewrite the walk-in.",
      "Tighten the hold-on.",
    ];
    for (const action of compoundEndings) {
      narrativeDrive.recommendations = [{ priority: "medium", action, expected_impact: "Cleaner prose." }];
      const result = validateEvaluationArtifact(artifact);
      expect(result.ok).toBe(true);
    }
  });

  test("still rejects bare-preposition truncations even when a hyphenated word appears earlier in the sentence", () => {
    // A hyphen mid-sentence (check-in) must NOT suppress detection when the sentence
    // genuinely ends with a dangling preposition/conjunction.
    const artifact = makeValidArtifact();
    artifact.criteria[0].recommendations = [
      {
        priority: "medium",
        // Ends with 'for' — a genuine truncation despite 'check-in' earlier in sentence
        action: "Revise the check-in scene and trim the exposition for",
        expected_impact: "Better engagement.",
      },
    ];

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "CRITERION_RECOMMENDATION_TRUNCATED" }),
      );
    }
  });
  test("rejects uncertified long-form manuscript-wide scores", () => {
    const artifact = makeValidArtifact();
    artifact.governance.transparency = {
      evaluation_scope: {
        route: "LONG_FORM",
        input_scale: "full_manuscript",
        manuscript_wide_certifiable: false,
        reason_codes: ["LONG_FORM_PARTIAL_EVALUATION", "LONG_FORM_SAMPLED_COVERAGE"],
        criterion_scope_policy_version: "v0.2",
      },
      coverage_summary: {
        partial_evaluation: true,
        sampling_strategy: "sampled_beginning_middle_end",
        source_word_count: 29519,
        analyzed_word_count: 6263,
        source_char_count: 160000,
        analyzed_char_count: 40000,
      },
    };

    const result = validateEvaluationArtifact(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE" }),
      );
    }
  });
});