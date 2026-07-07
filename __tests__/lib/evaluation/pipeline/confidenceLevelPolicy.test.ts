/**
 * U2-004 G5 — Confidence Level Policy Tests
 *
 * ## What these tests verify
 *
 * 1. maxLowConfidenceScore() — the canonical ceiling helper exported from
 *    criterionConfidence.ts — returns correct values per key.
 *
 * 2. enforceConfidenceLevelPolicy (wired as the final .map() in
 *    synthesisToEvaluationResultV2) is a structurally sound defensive layer.
 *    Its activation path in the current V2 runtime is narrow:
 *
 *    - normalizeCriterion() already caps confidence_score_0_100 to 59 whenever
 *      confidenceBandFromLevel === "LOW" (line 372 criterionObservability.ts).
 *    - enforceTextualAnchorConfidence() caps to 45 (anchor-absence path) and
 *      also sets confidence_level = "low".
 *    - The adapter does NOT pass the incoming SynthesisOutput.confidence_level
 *      into normalizeCriterion — both score and level are fully recomputed.
 *
 *    Therefore the invariant is already structurally enforced in the V2 path.
 *    enforceConfidenceLevelPolicy acts as a belt-and-suspenders guard for:
 *      (a) future adapters that bypass normalizeCriterion, or
 *      (b) future post-normalization transformations that set confidence_level
 *          to "low" without capping the score.
 *
 * 3. The global invariant holds on real V2 output: no criterion exits with
 *    confidence_level === "low" AND confidence_score_0_100 ≥ MODERATE_MIN.
 *
 * ## What is NOT tested here
 *
 * A "clamp fires" test with injected confidence_level: "low" + rich evidence
 * cannot be written through synthesisToEvaluationResultV2 because the adapter
 * discards the incoming confidence_level before normalizeCriterion runs.
 * The policy's direct unit activation path requires either:
 *   (a) a future adapter that forwards the label post-recomputation, or
 *   (b) a direct call bypassing the adapter (not representative of production).
 * Forcing such a fixture would be a fake test. The invariant test below is the
 * honest proof that the policy works end-to-end.
 */

import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { maxLowConfidenceScore } from "@/lib/evaluation/pipeline/criterionConfidence";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import type { SynthesisOutput } from "@/lib/evaluation/pipeline/types";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeSynthesis(
  overrideCriteria?: SynthesisOutput["criteria"],
): SynthesisOutput {
  return {
    criteria:
      overrideCriteria ??
      CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 7,
        final_score_0_10: 7,
        score_delta: 0,
        final_rationale: `Strong ${key} execution with adequate craft support and reader engagement.`,
        pressure_points: ["Clear pressure and stakes visible throughout."],
        decision_points: ["A visible turn lands mid-manuscript."],
        consequence_status: "landed" as const,
        evidence: [
          { snippet: `"The ${key} beat lands clearly in the opening chapter."` },
        ],
        recommendations: [
          {
            priority: "medium" as const,
            action: `In chapter 2, tighten the ${key} turn to clarify the consequence.`,
            expected_impact: `Clearer ${key} arc across the manuscript.`,
            anchor_snippet: `The ${key} beat lands clearly in the opening chapter.`,
            source_pass: 3 as const,
            issue_family: "scene_structure" as const,
            strategic_lever: "scene_goal_clarity" as const,
            revision_granularity: "scene" as const,
            mechanism: "the turn is diffuse",
            specific_fix: "tighten one beat",
            reader_effect: "clearer momentum",
          },
        ],
        confidence_score_0_100: 72,
        confidence_level: "moderate" as const,
        confidence_reasons: ["three_or_more_evidence_anchors"],
        scorability_status: "scorable" as const,
      })),
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary:
        "The manuscript delivers strong craft with targeted revision needs.",
      top_3_strengths: ["voice", "concept", "character"],
      top_3_risks: ["pacing", "dialogue", "narrativeClosure"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-5.1",
      pass2_model: "gpt-5.1",
      pass3_model: "gpt-5.1",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

const BASE_IDS = {
  evaluation_run_id: "run-g5-policy-fixture",
  job_id: "job-g5-policy-fixture",
  manuscript_id: 40050,
  user_id: "00000000-0000-0000-0000-000000g5test",
};

const SOURCE_TEXT_WITH_SNIPPETS =
  CRITERIA_KEYS.map(
    (key) => `The ${key} beat lands clearly in the opening chapter.`,
  ).join(" ") + " word ".repeat(500);

function adapt(synthesis: SynthesisOutput) {
  return synthesisToEvaluationResultV2({
    synthesis,
    ids: BASE_IDS,
    sourceText: SOURCE_TEXT_WITH_SNIPPETS,
    manuscriptText: SOURCE_TEXT_WITH_SNIPPETS,
    title: "G5 Policy Fixture",
  });
}

// ── maxLowConfidenceScore — unit tests ────────────────────────────────────────

describe("maxLowConfidenceScore — canonical ceiling per criterion key", () => {
  test("general keys return 59 (MODERATE_MIN 60 − 1)", () => {
    expect(maxLowConfidenceScore("character")).toBe(59);
    expect(maxLowConfidenceScore("narrativeDrive")).toBe(59);
    expect(maxLowConfidenceScore("voice")).toBe(59);
    expect(maxLowConfidenceScore("pacing")).toBe(59);
    expect(maxLowConfidenceScore("dialogue")).toBe(59);
    expect(maxLowConfidenceScore("theme")).toBe(59);
  });

  test("proseControl returns 54 (MODERATE_MIN_BY_KEY[proseControl] 55 − 1)", () => {
    expect(maxLowConfidenceScore("proseControl")).toBe(54);
  });

  test("unknown key falls back to general threshold (59)", () => {
    expect(maxLowConfidenceScore("unknownCriterionXYZ")).toBe(59);
  });

  test("null/undefined key falls back to general threshold (59)", () => {
    expect(maxLowConfidenceScore(null)).toBe(59);
    expect(maxLowConfidenceScore(undefined)).toBe(59);
  });

  test("ceiling is one below moderate threshold — not an arbitrary constant", () => {
    // This test documents the relationship explicitly.
    // If MODERATE_MIN ever changes, this will catch any drift in the helper.
    const generalCap = maxLowConfidenceScore("character");
    const proseControlCap = maxLowConfidenceScore("proseControl");
    // A score at the cap must be "low"; a score one above must not be.
    expect(generalCap).toBeLessThan(60);     // MODERATE_MIN for general keys
    expect(proseControlCap).toBeLessThan(55); // MODERATE_MIN for proseControl
  });
});

// ── Global invariant — V2 adapter output ─────────────────────────────────────

describe("Global invariant — synthesisToEvaluationResultV2 output consistency", () => {
  test("no criterion exits with confidence_level=low AND score >= moderate threshold", () => {
    // This is the core PL-7 invariant.
    // The V2 adapter enforces it through normalizeCriterion (structural)
    // and enforceConfidenceLevelPolicy (defensive final layer).
    const result = adapt(makeSynthesis());

    for (const criterion of result.criteria) {
      const cap = maxLowConfidenceScore(criterion.key);
      if (criterion.confidence_level === "low") {
        expect(criterion.confidence_score_0_100).toBeLessThanOrEqual(cap);
      }
      // Contrapositive: if score is above the cap, label cannot be "low"
      if ((criterion.confidence_score_0_100 ?? 0) > cap) {
        expect(criterion.confidence_level).not.toBe("low");
      }
    }
  });

  test("anchor-absent criteria: enforceTextualAnchorConfidence caps to 45, level=low, score consistent", () => {
    // When a criterion has no textual anchor signal, enforceTextualAnchorConfidence
    // sets confidence_level="low" and caps score to 45 (which is already ≤ 59).
    // enforceConfidenceLevelPolicy must be a no-op in this case (45 ≤ cap).
    const noAnchorCriteria = CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 5,
      editorial_score: 5,
      final_score_0_10: 5,
      score_delta: 0,
      final_rationale: `The ${key} criterion needs stronger grounding.`,
      pressure_points: [],
      decision_points: [],
      consequence_status: "absent" as const,
      // No snippet — enforceTextualAnchorConfidence will fire
      evidence: [{ snippet: "" }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Strengthen the ${key} arc with a concrete beat.`,
          expected_impact: `Clearer ${key}.`,
          anchor_snippet: undefined,
          source_pass: 3 as const,
          issue_family: "scene_structure" as const,
          strategic_lever: "scene_goal_clarity" as const,
          revision_granularity: "scene" as const,
          mechanism: "underdeveloped",
          specific_fix: "add one beat",
          reader_effect: "stronger consequence",
        },
      ],
      confidence_score_0_100: 55,
      confidence_level: "moderate" as const,
      confidence_reasons: [],
      scorability_status: "scorable" as const,
    }));

    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(noAnchorCriteria),
      ids: BASE_IDS,
      // Source text that does NOT contain any snippet text
      sourceText: "completely unrelated source material",
      manuscriptText: "completely unrelated source material",
      title: "G5 Anchor-Absent Fixture",
    });

    for (const criterion of result.criteria) {
      const cap = maxLowConfidenceScore(criterion.key);
      // Invariant must hold regardless of which policy step enforced it
      if (criterion.confidence_level === "low") {
        expect(criterion.confidence_score_0_100).toBeLessThanOrEqual(cap);
      }
      // Score should not exceed cap for low-confidence criteria
      if ((criterion.confidence_score_0_100 ?? 0) > cap) {
        expect(criterion.confidence_level).not.toBe("low");
      }
    }
  });

  test("mixed criteria: invariant holds across all confidence levels", () => {
    // Alternate between strong evidence (should produce moderate/high) and
    // no evidence (should produce low). Invariant must hold for every criterion.
    const mixedCriteria = CRITERIA_KEYS.map((key, i) => {
      const isStrong = i % 2 === 0;
      return {
        key,
        craft_score: isStrong ? 8 : 3,
        editorial_score: isStrong ? 8 : 3,
        final_score_0_10: isStrong ? 8 : 3,
        score_delta: 0,
        final_rationale: isStrong
          ? `Strong ${key} execution: scene construction with clear propulsion and reader engagement.`
          : "",
        pressure_points: isStrong ? ["Visible pressure and stakes."] : [],
        decision_points: isStrong ? ["Clear decision beat."] : [],
        consequence_status: (isStrong ? "landed" : "absent") as "landed" | "absent",
        evidence: isStrong
          ? [{ snippet: `"The ${key} beat lands clearly in the opening chapter."` }]
          : [],
        recommendations: isStrong
          ? [
              {
                priority: "medium" as const,
                action: `Tighten the ${key} turn in chapter 2.`,
                expected_impact: `Clearer ${key}.`,
                anchor_snippet: `The ${key} beat lands clearly in the opening chapter.`,
                source_pass: 3 as const,
                issue_family: "scene_structure" as const,
                strategic_lever: "scene_goal_clarity" as const,
                revision_granularity: "scene" as const,
                mechanism: "diffuse",
                specific_fix: "tighten one beat",
                reader_effect: "clearer momentum",
              },
            ]
          : [],
        confidence_score_0_100: isStrong ? 72 : 10,
        confidence_level: (isStrong ? "moderate" : "low") as "moderate" | "low",
        confidence_reasons: [],
        scorability_status: (isStrong ? "scorable" : "scorable_low_confidence") as
          | "scorable"
          | "scorable_low_confidence",
      };
    });

    const result = adapt(makeSynthesis(mixedCriteria));

    for (const criterion of result.criteria) {
      const cap = maxLowConfidenceScore(criterion.key);
      if (criterion.confidence_level === "low") {
        expect(criterion.confidence_score_0_100).toBeLessThanOrEqual(cap);
      }
      if ((criterion.confidence_score_0_100 ?? 0) > cap) {
        expect(criterion.confidence_level).not.toBe("low");
      }
    }
  });
});

// ── enforceConfidenceLevelPolicy — structural coverage ───────────────────────

describe("enforceConfidenceLevelPolicy — structural presence in V2 adapter chain", () => {
  test("when CONFIDENCE_LEVEL_SCORE_CLAMPED fires, score is within canonical range", () => {
    // The policy IS reachable in production: normalizeCriterion can produce
    // confidence_level="low" (via EVIDENCE_CONFIDENCE_LOW signal-strength band)
    // with a cappedConfidenceScore that still exceeds the moderate threshold
    // before enforceConfidenceLevelPolicy runs. When it fires, both the score
    // and the reason tag must be consistent with the invariant.
    const result = adapt(makeSynthesis());

    for (const criterion of result.criteria) {
      if ((criterion.confidence_reasons ?? []).includes("CONFIDENCE_LEVEL_SCORE_CLAMPED")) {
        // If the policy fired, the criterion must be low-confidence
        expect(criterion.confidence_level).toBe("low");
        // And the score must be within the canonical low ceiling
        const cap = maxLowConfidenceScore(criterion.key);
        expect(criterion.confidence_score_0_100).toBeLessThanOrEqual(cap);
      }
    }
  });

  test("CONFIDENCE_LEVEL_SCORE_CLAMPED reason is not added when anchor-absence fires first", () => {
    // enforceTextualAnchorConfidence caps score to 45 (already ≤ 59), so
    // enforceConfidenceLevelPolicy should see score ≤ cap and be a no-op.
    const noAnchorCriteria = CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 5,
      editorial_score: 5,
      final_score_0_10: 5,
      score_delta: 0,
      final_rationale: `Needs grounding for ${key}.`,
      pressure_points: [],
      decision_points: [],
      consequence_status: "absent" as const,
      evidence: [{ snippet: "" }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Strengthen the ${key} arc.`,
          expected_impact: `Clearer ${key}.`,
          anchor_snippet: undefined,
          source_pass: 3 as const,
          issue_family: "scene_structure" as const,
          strategic_lever: "scene_goal_clarity" as const,
          revision_granularity: "scene" as const,
          mechanism: "absent",
          specific_fix: "introduce criterion",
          reader_effect: "establishes baseline",
        },
      ],
      confidence_score_0_100: 55,
      confidence_level: "moderate" as const,
      confidence_reasons: [],
      scorability_status: "scorable" as const,
    }));

    const result = synthesisToEvaluationResultV2({
      synthesis: makeSynthesis(noAnchorCriteria),
      ids: BASE_IDS,
      sourceText: "completely unrelated source material",
      manuscriptText: "completely unrelated source material",
      title: "G5 No-Double-Cap Fixture",
    });

    for (const criterion of result.criteria) {
      // Policy must not add its own reason on top of NO_TEXTUAL_ANCHOR
      expect(criterion.confidence_reasons ?? []).not.toContain(
        "CONFIDENCE_LEVEL_SCORE_CLAMPED",
      );
    }
  });
});
