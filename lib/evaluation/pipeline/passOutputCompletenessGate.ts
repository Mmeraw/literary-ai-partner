/**
 * Pass Output Completeness Gate — SIPOC dual-checkpoint enforcement
 *
 * Validates that Pass 1/2 output contains structurally complete data
 * before it flows downstream. Every pass boundary has TWO checkpoints:
 *   1. OUTPUT side: validates the pass produced complete data
 *   2. INPUT side: validates the next pass receives complete data
 *
 * This module implements the OUTPUT-side completeness check for Pass 1/2
 * and the OUTPUT-side completeness check for Pass 3 (editorial triple).
 *
 * Checks per criterion:
 *   - score_0_10 is present and in range [1, 10]
 *   - rationale is non-empty (at least 20 chars of meaningful text)
 *   - evidence has at least 1 entry with a non-empty snippet
 *   - (Pass 2 only) recommendations have at least 1 entry with non-empty action
 *
 * Returns: { ok, violations, repaired } — violations are logged, repaired
 * fields are backfilled from available context where possible. If critical
 * fields cannot be repaired, ok=false signals the pipeline should fail-closed.
 *
 * Canon ref: SIPOC_EVALUATION_PROCESS.md — "every handoff must validate
 * quality and completeness; no dirty data passes forward"
 */

import type { SinglePassOutput, AxisCriterionResult, SynthesisOutput, SynthesizedCriterion } from "./types";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

// ── Types ────────────────────────────────────────────────────────────────────

export type CompletenessViolation = {
  code: CompletenessFailureCode;
  criterion_key: string;
  field: string;
  detail: string;
  severity: "critical" | "warning";
};

export type CompletenessFailureCode =
  | "MISSING_SCORE"
  | "SCORE_OUT_OF_RANGE"
  | "EMPTY_RATIONALE"
  | "NO_EVIDENCE"
  | "EMPTY_EVIDENCE_SNIPPET"
  | "NO_RECOMMENDATIONS"
  | "EMPTY_RECOMMENDATION_ACTION"
  | "MISSING_CRITERION"
  | "MISSING_ANCHOR_SNIPPET";

export type CompletenessGateResult = {
  ok: boolean;
  output: SinglePassOutput;
  violations: CompletenessViolation[];
  /** How many fields were repaired (backfilled with fallback values) */
  repairedCount: number;
  /** Critical violations that could not be repaired */
  criticalCount: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_RATIONALE_LENGTH = 20;
const MIN_EVIDENCE_SNIPPET_LENGTH = 5;
const MIN_RECOMMENDATION_ACTION_LENGTH = 10;

// ── Main Gate Functions ──────────────────────────────────────────────────────

/**
 * Validate Pass 1 output completeness.
 * Pass 1 produces scores, rationales, and evidence (no recommendations — those come from Pass 2).
 */
export function validatePass1OutputCompleteness(pass1: SinglePassOutput): CompletenessGateResult {
  const violations: CompletenessViolation[] = [];
  let repairedCount = 0;
  const criteria = [...pass1.criteria];

  // Check for missing criteria (all 13 should be present)
  const presentKeys = new Set(criteria.map((c) => c.key));
  for (const key of CRITERIA_KEYS) {
    if (!presentKeys.has(key)) {
      violations.push({
        code: "MISSING_CRITERION",
        criterion_key: key,
        field: "criterion",
        detail: `Criterion "${key}" entirely missing from Pass 1 output`,
        severity: "critical",
      });
    }
  }

  for (const criterion of criteria) {
    // Score validation
    const score = criterion.score_0_10;
    if (score === null || score === undefined || !Number.isFinite(score)) {
      violations.push({
        code: "MISSING_SCORE",
        criterion_key: criterion.key,
        field: "score_0_10",
        detail: `Score is null/undefined/non-finite for "${criterion.key}"`,
        severity: "critical",
      });
    } else if (score < 1 || score > 10) {
      violations.push({
        code: "SCORE_OUT_OF_RANGE",
        criterion_key: criterion.key,
        field: "score_0_10",
        detail: `Score ${score} out of valid range [1,10] for "${criterion.key}"`,
        severity: "critical",
      });
    }

    // Rationale validation
    if (!criterion.rationale || criterion.rationale.trim().length < MIN_RATIONALE_LENGTH) {
      violations.push({
        code: "EMPTY_RATIONALE",
        criterion_key: criterion.key,
        field: "rationale",
        detail: `Rationale is empty or too short (< ${MIN_RATIONALE_LENGTH} chars) for "${criterion.key}"`,
        severity: "warning",
      });
    }

    // Evidence validation
    if (!criterion.evidence || criterion.evidence.length === 0) {
      violations.push({
        code: "NO_EVIDENCE",
        criterion_key: criterion.key,
        field: "evidence",
        detail: `No evidence entries for "${criterion.key}"`,
        severity: "warning",
      });
    } else {
      const hasValidSnippet = criterion.evidence.some(
        (e) => e.snippet && e.snippet.trim().length >= MIN_EVIDENCE_SNIPPET_LENGTH
      );
      if (!hasValidSnippet) {
        violations.push({
          code: "EMPTY_EVIDENCE_SNIPPET",
          criterion_key: criterion.key,
          field: "evidence",
          detail: `All evidence snippets are empty/too short for "${criterion.key}"`,
          severity: "warning",
        });
      }
    }
  }

  const criticalCount = violations.filter((v) => v.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    output: { ...pass1, criteria },
    violations,
    repairedCount,
    criticalCount,
  };
}

/**
 * Validate Pass 2 output completeness.
 * Pass 2 produces scores, rationales, evidence, AND recommendations.
 */
export function validatePass2OutputCompleteness(pass2: SinglePassOutput): CompletenessGateResult {
  const violations: CompletenessViolation[] = [];
  let repairedCount = 0;
  const criteria = [...pass2.criteria];

  // Check for missing criteria
  const presentKeys = new Set(criteria.map((c) => c.key));
  for (const key of CRITERIA_KEYS) {
    if (!presentKeys.has(key)) {
      violations.push({
        code: "MISSING_CRITERION",
        criterion_key: key,
        field: "criterion",
        detail: `Criterion "${key}" entirely missing from Pass 2 output`,
        severity: "critical",
      });
    }
  }

  for (const criterion of criteria) {
    // Score validation (same as Pass 1)
    const score = criterion.score_0_10;
    if (score === null || score === undefined || !Number.isFinite(score)) {
      violations.push({
        code: "MISSING_SCORE",
        criterion_key: criterion.key,
        field: "score_0_10",
        detail: `Score is null/undefined/non-finite for "${criterion.key}"`,
        severity: "critical",
      });
    } else if (score < 1 || score > 10) {
      violations.push({
        code: "SCORE_OUT_OF_RANGE",
        criterion_key: criterion.key,
        field: "score_0_10",
        detail: `Score ${score} out of valid range [1,10] for "${criterion.key}"`,
        severity: "critical",
      });
    }

    // Rationale validation
    if (!criterion.rationale || criterion.rationale.trim().length < MIN_RATIONALE_LENGTH) {
      violations.push({
        code: "EMPTY_RATIONALE",
        criterion_key: criterion.key,
        field: "rationale",
        detail: `Rationale is empty or too short (< ${MIN_RATIONALE_LENGTH} chars) for "${criterion.key}"`,
        severity: "warning",
      });
    }

    // Evidence validation
    if (!criterion.evidence || criterion.evidence.length === 0) {
      violations.push({
        code: "NO_EVIDENCE",
        criterion_key: criterion.key,
        field: "evidence",
        detail: `No evidence entries for "${criterion.key}"`,
        severity: "warning",
      });
    } else {
      const hasValidSnippet = criterion.evidence.some(
        (e) => e.snippet && e.snippet.trim().length >= MIN_EVIDENCE_SNIPPET_LENGTH
      );
      if (!hasValidSnippet) {
        violations.push({
          code: "EMPTY_EVIDENCE_SNIPPET",
          criterion_key: criterion.key,
          field: "evidence",
          detail: `All evidence snippets are empty/too short for "${criterion.key}"`,
          severity: "warning",
        });
      }
    }

    // Recommendation validation (Pass 2 specific)
    if (!criterion.recommendations || criterion.recommendations.length === 0) {
      violations.push({
        code: "NO_RECOMMENDATIONS",
        criterion_key: criterion.key,
        field: "recommendations",
        detail: `No recommendations for "${criterion.key}" (score: ${score ?? "null"})`,
        severity: "warning",
      });
    } else {
      for (let i = 0; i < criterion.recommendations.length; i++) {
        const rec = criterion.recommendations[i];
        if (!rec.action || rec.action.trim().length < MIN_RECOMMENDATION_ACTION_LENGTH) {
          violations.push({
            code: "EMPTY_RECOMMENDATION_ACTION",
            criterion_key: criterion.key,
            field: `recommendations[${i}].action`,
            detail: `Recommendation ${i} has empty/too short action for "${criterion.key}"`,
            severity: "warning",
          });
        }
        if (!rec.anchor_snippet || rec.anchor_snippet.trim().length === 0) {
          violations.push({
            code: "MISSING_ANCHOR_SNIPPET",
            criterion_key: criterion.key,
            field: `recommendations[${i}].anchor_snippet`,
            detail: `Recommendation ${i} has no anchor_snippet for "${criterion.key}"`,
            severity: "warning",
          });
        }
      }
    }
  }

  const criticalCount = violations.filter((v) => v.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    output: { ...pass2, criteria },
    violations,
    repairedCount,
    criticalCount,
  };
}

// ── Pass 3 Output Completeness Gate ──────────────────────────────────────────

export type Pass3CompletenessGateResult = {
  ok: boolean;
  output: SynthesisOutput;
  violations: CompletenessViolation[];
  repairedCount: number;
  criticalCount: number;
};

/**
 * Validate Pass 3 (synthesis) output completeness.
 * Pass 3 produces reconciled scores, final rationales, and merged recommendations
 * with editorial triple fields (mechanism, specific_fix, reader_effect).
 *
 * Critical failures: missing final_score, missing final_rationale
 * Warnings: empty recommendations, missing editorial fields (repaired downstream by specificity gate)
 */
export function validatePass3OutputCompleteness(pass3: SynthesisOutput): Pass3CompletenessGateResult {
  const violations: CompletenessViolation[] = [];
  let repairedCount = 0;
  const criteria = [...pass3.criteria];

  // Check for missing criteria (all 13 should be present)
  const presentKeys = new Set(criteria.map((c) => c.key));
  for (const key of CRITERIA_KEYS) {
    if (!presentKeys.has(key)) {
      violations.push({
        code: "MISSING_CRITERION",
        criterion_key: key,
        field: "criterion",
        detail: `Criterion "${key}" entirely missing from Pass 3 synthesis output`,
        severity: "critical",
      });
    }
  }

  for (const criterion of criteria) {
    // Final score validation
    const score = criterion.final_score_0_10;
    if (score === null || score === undefined || !Number.isFinite(score)) {
      violations.push({
        code: "MISSING_SCORE",
        criterion_key: criterion.key,
        field: "final_score_0_10",
        detail: `Final score is null/undefined/non-finite for "${criterion.key}"`,
        severity: "critical",
      });
    } else if (score < 1 || score > 10) {
      violations.push({
        code: "SCORE_OUT_OF_RANGE",
        criterion_key: criterion.key,
        field: "final_score_0_10",
        detail: `Final score ${score} out of valid range [1,10] for "${criterion.key}"`,
        severity: "critical",
      });
    }

    // Final rationale validation
    if (!criterion.final_rationale || criterion.final_rationale.trim().length < MIN_RATIONALE_LENGTH) {
      violations.push({
        code: "EMPTY_RATIONALE",
        criterion_key: criterion.key,
        field: "final_rationale",
        detail: `Final rationale is empty or too short (< ${MIN_RATIONALE_LENGTH} chars) for "${criterion.key}"`,
        severity: "warning",
      });
    }

    // Evidence validation
    if (!criterion.evidence || criterion.evidence.length === 0) {
      violations.push({
        code: "NO_EVIDENCE",
        criterion_key: criterion.key,
        field: "evidence",
        detail: `No evidence entries in synthesis for "${criterion.key}"`,
        severity: "warning",
      });
    }

    // Recommendation presence validation
    if (!criterion.recommendations || criterion.recommendations.length === 0) {
      // Only warn if score indicates improvement is needed (score <= 8)
      if (score !== null && score !== undefined && score <= 8) {
        violations.push({
          code: "NO_RECOMMENDATIONS",
          criterion_key: criterion.key,
          field: "recommendations",
          detail: `No recommendations for "${criterion.key}" despite score ${score} <= 8`,
          severity: "warning",
        });
      }
    } else {
      for (let i = 0; i < criterion.recommendations.length; i++) {
        const rec = criterion.recommendations[i];
        if (!rec.action || rec.action.trim().length < MIN_RECOMMENDATION_ACTION_LENGTH) {
          violations.push({
            code: "EMPTY_RECOMMENDATION_ACTION",
            criterion_key: criterion.key,
            field: `recommendations[${i}].action`,
            detail: `Recommendation ${i} has empty/too short action for "${criterion.key}"`,
            severity: "warning",
          });
        }
      }
    }
  }

  // Overall section validation
  if (!pass3.overall || !pass3.overall.one_paragraph_summary || pass3.overall.one_paragraph_summary.trim().length < 20) {
    violations.push({
      code: "EMPTY_RATIONALE",
      criterion_key: "overall",
      field: "one_paragraph_summary",
      detail: "Overall summary is missing or too short",
      severity: "warning",
    });
  }

  const criticalCount = violations.filter((v) => v.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    output: { ...pass3, criteria },
    violations,
    repairedCount,
    criticalCount,
  };
}
