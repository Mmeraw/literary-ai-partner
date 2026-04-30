/**
 * EvaluationResult Schema v2
 *
 * Canonical doctrine:
 * - Evaluation is constrained by evidence, not schema.
 * - Applicability is determined by system governance.
 * - Observability is determined by manuscript evidence.
 *
 * Schema version: evaluation_result_v2
 * Created: 2026-04-16
 */

import { CRITERIA_KEYS, CriterionKey } from './criteria-keys';

export type SignalStrength = "NONE" | "WEAK" | "SUFFICIENT" | "STRONG";

/**
 * IMPORTANT: NOT_APPLICABLE is GOVERNED (criteria_plan / MDM / eval mode),
 * and must not be invented by model output.
 */
export type CriterionStatus =
  | "NOT_APPLICABLE"
  | "NO_SIGNAL"
  | "INSUFFICIENT_SIGNAL"
  | "SCORABLE";

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type InsufficientSignalReason = {
  looked_for: string[];
  not_found: string[];
  evidence_span?: {
    char_start?: number;
    char_end?: number;
  } | null;
};

export type ScoreAdjustmentV2 = {
  reason: "AUTHORITY_CAP_APPLIED";
  composite_0_10: number;
  threshold_0_10: number;
  original_overall_0_100: number;
  capped_overall_0_100: number;
  inputs: {
    voice: number;
    proseControl: number;
    tone: number;
  };
};

type CriterionBase = {
  key: CriterionKey;
  signal_present: boolean;
  signal_strength: SignalStrength;
  confidence_band: ConfidenceBand;
  confidence_score_0_100?: number;
  confidence_level?: "high" | "moderate" | "low";
  confidence_reasons?: string[];
  scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
  rationale: string;
  evidence: Array<{
    snippet: string;
    location?: {
      segment_id?: string;
      char_start?: number;
      char_end?: number;
    };
    note?: string;
  }>;
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    expected_impact: string;
  }>;
};

export type ScorableCriterionV2 = CriterionBase & {
  scorable: true;
  status: "SCORABLE";
  signal_strength: "SUFFICIENT" | "STRONG";
  score_0_10: number;
  insufficient_signal_reason?: never;
};

export type NonScorableCriterionV2 = CriterionBase & {
  scorable: false;
  status: "NO_SIGNAL" | "INSUFFICIENT_SIGNAL";
  signal_strength: "NONE" | "WEAK";
  score_0_10: null;
  insufficient_signal_reason: InsufficientSignalReason;
};

export type NotApplicableCriterionV2 = CriterionBase & {
  scorable: false;
  status: "NOT_APPLICABLE";
  score_0_10: null;
  insufficient_signal_reason?: never;
};

export type EvaluationCriterionV2 =
  | ScorableCriterionV2
  | NonScorableCriterionV2
  | NotApplicableCriterionV2;

export type EvaluationResultV2 = {
  schema_version: "evaluation_result_v2";
  ids: {
    evaluation_run_id: string;
    job_id?: string;
    manuscript_id: number;
    project_id?: number;
    user_id: string;
  };
  generated_at: string;
  engine: {
    model: string;
    provider: "openai" | "anthropic" | "other";
    prompt_version: string;
  };
  overview: {
    verdict: "pass" | "revise" | "fail";
    /**
     * Null when zero criteria are scorable. This prevents aggregate fake-zero.
     */
    overall_score_0_100: number | null;
    scored_criteria_count: number;
    one_paragraph_summary: string;
    top_3_strengths: string[];
    top_3_risks: string[];
  };
  criteria: EvaluationCriterionV2[];
  /** Deterministic score adjustments applied at artifact finalization boundaries. */
  score_adjustments?: ScoreAdjustmentV2[];
  recommendations: {
    quick_wins: Array<{
      action: string;
      why: string;
      effort: "low" | "medium" | "high";
      impact: "low" | "medium" | "high";
    }>;
    strategic_revisions: Array<{
      action: string;
      why: string;
      effort: "low" | "medium" | "high";
      impact: "low" | "medium" | "high";
    }>;
  };
  metrics: {
    manuscript: {
      word_count?: number;
      char_count?: number;
      genre?: string;
      target_audience?: string;
    };
    processing: {
      segment_count?: number;
      total_tokens_estimated?: number;
      runtime_ms?: number;
    };
  };
  artifacts: Array<{
    type:
      | "evaluation_report"
      | "query_letter"
      | "synopsis"
      | "one_page"
      | "pitch_deck"
      | "scene_list"
      | "revision_plan";
    artifact_id: string;
    title: string;
    status: "ready" | "pending" | "failed";
    created_at?: string;
  }>;
  governance: {
    confidence: number;
    confidence_label?: "high" | "medium" | "low" | "withheld";
    confidence_reasons?: string[];
    warnings: string[];
    limitations: string[];
    policy_family: string;
    observability_warnings?: string[];
    transparency?: {
      final_work_type_used?: string;
      matrix_version?: string;
      criteria_plan?: {
        R?: Array<string>;
        O?: Array<string>;
        NA?: Array<string>;
        C?: Array<string>;
      };
      repro_anchor?: string;
      artifact_validation_result?: "PASS" | "HOLD" | "FAIL";
      artifact_reason_codes?: string[];
      artifact_validated_at?: string;
      artifact_validation_mode?: "log" | "enforce";
      score_ledger?: {
        raw_total: number;
        max_total: number;
        normalized_total: number;
        weighting: "equal";
      };
      excellence_filter?: {
        verdict: "submission-ready" | "close-but-not-ready" | "not-yet-ready";
        blocking_criteria: string[];
      };
      propagation_summary?: {
        low_confidence_count: number;
        moderate_confidence_count: number;
        weak_evidence_count: number;
        missing_evidence_count: number;
        scorable_low_confidence_count: number;
        bottom_score_criteria: string[];
        upstream_integrity: "strong" | "mixed" | "weak";
        authority_level: "normal" | "constrained" | "blocked";
        reasons: string[];
      };
    };
  };
};

export function isEvaluationResultV2(obj: unknown): obj is EvaluationResultV2 {
  if (!obj || typeof obj !== "object") return false;
  const result = obj as Partial<EvaluationResultV2>;

  return (
    result.schema_version === "evaluation_result_v2" &&
    typeof result.ids === "object" &&
    typeof result.overview === "object" &&
    Array.isArray(result.criteria) &&
    Array.isArray(result.artifacts)
  );
}

export function validateEvaluationResultV2(
  result: EvaluationResultV2,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (result.schema_version !== "evaluation_result_v2") {
    errors.push(`Invalid schema_version: ${result.schema_version}`);
  }

  if (!result.ids.evaluation_run_id) errors.push("Missing ids.evaluation_run_id");
  if (!result.ids.manuscript_id) errors.push("Missing ids.manuscript_id");
  if (!result.ids.user_id) errors.push("Missing ids.user_id");

  if (!Array.isArray(result.criteria)) {
    errors.push("criteria must be an array");
    return { valid: false, errors };
  }

  if (result.criteria.length !== CRITERIA_KEYS.length) {
    errors.push(`Expected ${CRITERIA_KEYS.length} criteria, got ${result.criteria.length}`);
  }

  // Full-coverage + uniqueness check (no duplicates, no omissions)
  const seen = new Set<CriterionKey>();
  for (const [idx, c] of result.criteria.entries()) {
    if (!CRITERIA_KEYS.includes(c.key)) {
      errors.push(`criteria[${idx}].key invalid: ${String(c.key)}`);
      continue;
    }

    if (seen.has(c.key)) {
      errors.push(`Duplicate criterion key: ${c.key}`);
    }
    seen.add(c.key);

    if (c.confidence_score_0_100 !== undefined) {
      if (
        typeof c.confidence_score_0_100 !== "number" ||
        c.confidence_score_0_100 < 0 ||
        c.confidence_score_0_100 > 100
      ) {
        errors.push(`criteria[${idx}].confidence_score_0_100 must be 0-100 when present`);
      }
    }

    if (
      c.confidence_level !== undefined &&
      c.confidence_level !== "high" &&
      c.confidence_level !== "moderate" &&
      c.confidence_level !== "low"
    ) {
      errors.push(`criteria[${idx}].confidence_level invalid: ${String(c.confidence_level)}`);
    }

    if (
      c.scorability_status !== undefined &&
      c.scorability_status !== "scorable" &&
      c.scorability_status !== "scorable_low_confidence" &&
      c.scorability_status !== "non_scorable"
    ) {
      errors.push(`criteria[${idx}].scorability_status invalid: ${String(c.scorability_status)}`);
    }

    if (c.confidence_reasons !== undefined && !Array.isArray(c.confidence_reasons)) {
      errors.push(`criteria[${idx}].confidence_reasons must be an array when present`);
    }

    if (!c.rationale || c.rationale.trim().length === 0) {
      errors.push(`criteria[${idx}].rationale is empty`);
    }

    if (c.status === "SCORABLE") {
      if (c.scorable !== true) {
        errors.push(`criteria[${idx}] SCORABLE must have scorable=true`);
      }
      if (typeof c.score_0_10 !== "number" || !Number.isInteger(c.score_0_10) || c.score_0_10 < 0 || c.score_0_10 > 10) {
        errors.push(`criteria[${idx}] SCORABLE score_0_10 must be integer 0-10`);
      }
      if (c.signal_strength !== "SUFFICIENT" && c.signal_strength !== "STRONG") {
        errors.push(`criteria[${idx}] SCORABLE must have SUFFICIENT|STRONG signal_strength`);
      }
      if ((c as unknown as NonScorableCriterionV2).insufficient_signal_reason) {
        errors.push(`criteria[${idx}] SCORABLE must not carry insufficient_signal_reason`);
      }
    }

    if (c.status === "NO_SIGNAL" || c.status === "INSUFFICIENT_SIGNAL") {
      const nsStatus: string = c.status;
      if (c.scorable !== false) {
        errors.push(`criteria[${idx}] ${nsStatus} must have scorable=false`);
      }
      if (c.score_0_10 !== null) {
        errors.push(`criteria[${idx}] ${nsStatus} must have score_0_10=null`);
      }
      if (c.signal_strength !== "NONE" && c.signal_strength !== "WEAK") {
        errors.push(`criteria[${idx}] ${nsStatus} must have NONE|WEAK signal_strength`);
      }
      const reason = (c as unknown as NonScorableCriterionV2).insufficient_signal_reason;
      if (!reason || !Array.isArray(reason.looked_for) || reason.looked_for.length === 0 || !Array.isArray(reason.not_found)) {
        errors.push(`criteria[${idx}] ${c.status} must include structured insufficient_signal_reason`);
      }
    }

    if (c.status === "NOT_APPLICABLE") {
      if (c.scorable !== false) {
        errors.push(`criteria[${idx}] NOT_APPLICABLE must have scorable=false`);
      }
      if (c.score_0_10 !== null) {
        errors.push(`criteria[${idx}] NOT_APPLICABLE must have score_0_10=null`);
      }
      if (c.signal_strength !== "NONE") {
        errors.push(`criteria[${idx}] NOT_APPLICABLE must have signal_strength=NONE`);
      }
      if ((c as unknown as NonScorableCriterionV2).insufficient_signal_reason) {
        errors.push(`criteria[${idx}] NOT_APPLICABLE must not carry insufficient_signal_reason`);
      }
    }
  }

  for (const canonKey of CRITERIA_KEYS) {
    if (!seen.has(canonKey)) {
      errors.push(`Missing canonical criterion key: ${canonKey}`);
    }
  }

  const scoredCount = result.criteria.filter((c) => c.status === "SCORABLE").length;
  if (result.overview.scored_criteria_count !== scoredCount) {
    errors.push(
      `overview.scored_criteria_count (${result.overview.scored_criteria_count}) does not match actual scored criteria (${scoredCount})`,
    );
  }

  if (scoredCount === 0) {
    if (result.overview.overall_score_0_100 !== null) {
      errors.push("overview.overall_score_0_100 must be null when scored_criteria_count is 0");
    }
  } else {
    if (
      typeof result.overview.overall_score_0_100 !== "number" ||
      result.overview.overall_score_0_100 < 0 ||
      result.overview.overall_score_0_100 > 100
    ) {
      errors.push("overview.overall_score_0_100 must be 0-100 when scored criteria exist");
    }
  }

  if (!result.governance || typeof result.governance.confidence !== "number" || result.governance.confidence < 0 || result.governance.confidence > 1) {
    errors.push("governance.confidence must be 0.0-1.0");
  }

  if (
    result.governance?.confidence_label !== undefined &&
    result.governance.confidence_label !== "high" &&
    result.governance.confidence_label !== "medium" &&
    result.governance.confidence_label !== "low" &&
    result.governance.confidence_label !== "withheld"
  ) {
    errors.push("governance.confidence_label invalid");
  }

  if (
    result.governance?.confidence_reasons !== undefined &&
    !Array.isArray(result.governance.confidence_reasons)
  ) {
    errors.push("governance.confidence_reasons must be an array when present");
  }

  const propagationSummary = result.governance?.transparency?.propagation_summary;
  if (propagationSummary !== undefined) {
    if (
      typeof propagationSummary.low_confidence_count !== "number" ||
      typeof propagationSummary.moderate_confidence_count !== "number" ||
      typeof propagationSummary.weak_evidence_count !== "number" ||
      typeof propagationSummary.missing_evidence_count !== "number" ||
      typeof propagationSummary.scorable_low_confidence_count !== "number"
    ) {
      errors.push("governance.transparency.propagation_summary count fields must be numbers");
    }

    if (!Array.isArray(propagationSummary.bottom_score_criteria)) {
      errors.push("governance.transparency.propagation_summary.bottom_score_criteria must be an array");
    }

    if (
      propagationSummary.upstream_integrity !== "strong" &&
      propagationSummary.upstream_integrity !== "mixed" &&
      propagationSummary.upstream_integrity !== "weak"
    ) {
      errors.push("governance.transparency.propagation_summary.upstream_integrity invalid");
    }

    if (
      propagationSummary.authority_level !== "normal" &&
      propagationSummary.authority_level !== "constrained" &&
      propagationSummary.authority_level !== "blocked"
    ) {
      errors.push("governance.transparency.propagation_summary.authority_level invalid");
    }

    if (!Array.isArray(propagationSummary.reasons)) {
      errors.push("governance.transparency.propagation_summary.reasons must be an array");
    }

    if (
      propagationSummary.upstream_integrity === "weak" &&
      result.governance?.confidence_label === "high"
    ) {
      errors.push("governance.confidence_label cannot be high when propagation upstream_integrity is weak");
    }
  }

  return { valid: errors.length === 0, errors };
}
