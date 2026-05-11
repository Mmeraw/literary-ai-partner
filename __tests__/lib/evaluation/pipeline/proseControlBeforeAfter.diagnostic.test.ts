/**
 * Diagnostic-only "test" that prints the before/after confidence + gate
 * verdict for the canonical proseControl regression case from
 * docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180b/.
 *
 * This file is intentionally only a console.log harness — the real assertions
 * live in proseControlAnchorFloor.test.ts. We keep this one as a `.diagnostic`
 * file so it shows up in the PR but does not gate CI.
 */
import { describe, expect, test } from "@jest/globals";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";
import {
  promoteRationaleQuotesToEvidence,
  enforceProseControlAnchorFloor,
} from "@/lib/evaluation/pipeline/runPass3Synthesis";
import {
  maxLowConfidenceScoreFor,
  QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
} from "@/lib/evaluation/pipeline/qualityGate";

// Canonical regression input lifted from the evidence run.
// The model produced score 7, ONE generic anchor, and unanchored recommendations.
const MANUSCRIPT_EXCERPT =
  "The air smelled faintly of baked dust, cedar, and paper. " +
  "Outside, the wind moved through the cottonwoods like a slow breath. " +
  "Her hands rested on the table; she did not look up. " +
  "He had almost said it, and then the silence pulled them apart.";

const BEFORE_RATIONALE =
  "Craft evaluation notes effective prose but suggests areas for refinement, " +
  "while the editorial perspective highlights overall strength. The line " +
  '"the wind moved through the cottonwoods like a slow breath" controls cadence cleanly.';

const BEFORE_EVIDENCE = [
  {
    snippet: "The air smelled faintly of baked dust, cedar, and paper...",
    char_start: 54,
    char_end: 90,
  },
];

const BEFORE_RECOMMENDATIONS = [
  {
    priority: "medium" as const,
    action:
      "Streamline complex sentences to enhance clarity and maintain reader engagement throughout the narrative.",
    expected_impact:
      "This will improve overall readability and flow of the text.",
    anchor_snippet: "",
    source_pass: 3 as const,
    issue_family: "language_clarity" as never,
    strategic_lever: "scene_goal_clarity" as never,
    revision_granularity: "line" as never,
    mechanism: "",
    specific_fix: "",
    reader_effect: "",
  },
  {
    priority: "medium" as const,
    action:
      "Review for opportunities to tighten prose, enhancing clarity and maintaining reader engagement.",
    expected_impact:
      "More impactful writing that keeps the reader focused on the narrative.",
    anchor_snippet: "",
    source_pass: 3 as const,
    issue_family: "language_clarity" as never,
    strategic_lever: "scene_goal_clarity" as never,
    revision_granularity: "line" as never,
    mechanism: "",
    specific_fix: "",
    reader_effect: "",
  },
];

describe("Prose Control before/after diagnostic", () => {
  test("emits before/after numbers and the structural verdict", () => {
    // BEFORE: confidence as computed against the raw artifact.
    const before = computeCriterionConfidence(
      {
        key: "proseControl",
        score_0_10: 7,
        final_rationale: BEFORE_RATIONALE,
        evidence: BEFORE_EVIDENCE,
        recommendations: BEFORE_RECOMMENDATIONS,
      },
      MANUSCRIPT_EXCERPT,
    );

    // AFTER step 1 (Fix 2): promote the stranded quote out of the rationale.
    const promoted = promoteRationaleQuotesToEvidence(
      BEFORE_EVIDENCE,
      BEFORE_RATIONALE,
      MANUSCRIPT_EXCERPT,
    );

    // AFTER step 2 (Fix 1): enforce the anchor floor (≥2 anchors + ≥1 anchored
    // recommendation).
    const enforced = enforceProseControlAnchorFloor({
      evidence: promoted,
      recommendations: BEFORE_RECOMMENDATIONS,
      rationale: BEFORE_RATIONALE,
      manuscriptText: MANUSCRIPT_EXCERPT,
    });

    // AFTER step 3 (Fix 3, confidence side): re-score with the new evidence +
    // anchored recommendation; the per-criterion moderate-min (55) applies.
    const after = computeCriterionConfidence(
      {
        key: "proseControl",
        score_0_10: 7,
        final_rationale: BEFORE_RATIONALE,
        evidence: enforced.evidence,
        recommendations: enforced.recommendations,
      },
      MANUSCRIPT_EXCERPT,
    );

    const gateCap = maxLowConfidenceScoreFor("proseControl");

    // To make the regression delta explicit, compute the BEFORE confidence as
    // it would have been bucketed under the legacy global MODERATE_MIN=60.
    // Under the new per-criterion threshold (55), the same numeric score
    // (56) lands at "moderate" instead of "low".
    const beforeLegacyBucket: "low" | "moderate" | "high" =
      before.confidence_score_0_100 >= 85
        ? "high"
        : before.confidence_score_0_100 >= 60
          ? "moderate"
          : "low";

    const wouldDowngradeBefore_legacyThreshold =
      beforeLegacyBucket === "low" && 7 > QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE;
    const wouldDowngradeBefore =
      before.confidence_level === "low" && 7 > QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE;
    const wouldDowngradeAfter =
      after.confidence_level === "low" && 7 > gateCap;

    // Print a structured summary so reviewers can read it in the test output.
    // eslint-disable-next-line no-console
    console.log(
      "\n=== Prose Control before/after diagnostic ===\n" +
        JSON.stringify(
          {
            before_with_legacy_thresholds: {
              confidence_score_0_100: before.confidence_score_0_100,
              confidence_level_under_legacy_MODERATE_MIN_60: beforeLegacyBucket,
              evidence_count: BEFORE_EVIDENCE.length,
              anchored_recommendation_count: BEFORE_RECOMMENDATIONS.filter(
                (r) => r.anchor_snippet.length > 0,
              ).length,
              legacy_quality_gate_cap: QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
              would_downgrade_to_INSUFFICIENT_SIGNAL: wouldDowngradeBefore_legacyThreshold,
            },
            before_with_new_thresholds_no_post_processor: {
              confidence_score_0_100: before.confidence_score_0_100,
              confidence_level: before.confidence_level,
              would_downgrade_to_INSUFFICIENT_SIGNAL: wouldDowngradeBefore,
            },
            after: {
              confidence_score_0_100: after.confidence_score_0_100,
              confidence_level: after.confidence_level,
              scorability_status: after.scorability_status,
              evidence_count: enforced.evidence.length,
              anchored_recommendation_count: enforced.recommendations.filter(
                (r) => r.anchor_snippet.length > 0,
              ).length,
              quality_gate_cap: gateCap,
              would_downgrade_to_INSUFFICIENT_SIGNAL: wouldDowngradeAfter,
            },
          },
          null,
          2,
        ) +
        "\n=============================================\n",
    );

    // Lock the regression: the after-state MUST NOT trigger the downgrade.
    expect(wouldDowngradeAfter).toBe(false);
    expect(after.confidence_score_0_100).toBeGreaterThan(
      before.confidence_score_0_100,
    );
  });
});
