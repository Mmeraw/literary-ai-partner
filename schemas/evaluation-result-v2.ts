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
import type {
  DetectedMode,
  EvaluationMode,
  SectionModeOverride,
  VoicePreservationMode,
} from '@/lib/evaluation/modeDetection';
import type { ModeTelemetryEvent } from '@/lib/evaluation/modeGate';
import type { SlaeGroundingStatus } from '@/lib/revision/slae';

export type ScoreDenominatorPolicy = "full_canonical" | "scorable_only";

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

export type TechnicalDefectCode =
  | "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED"
  | "RECOMMENDATION_TRUNCATED"
  | "SCORE_LE8_EMPTY_RECOMMENDATIONS";

export type CriterionTechnicalDefect = {
  code: TechnicalDefectCode;
  author_facing_reason: string;
  retryable: boolean;
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
  model_emitted_score_unverified?: number;
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
    anchor_snippet?: string;
    mechanism?: string;
    specific_fix?: string;
    reader_effect?: string;
    symptom?: string;
    mistake_proofing?: string;
    issue_family?: string;
    strategic_lever?: string;
    revision_granularity?: string;
  }>;
  technical_defects?: CriterionTechnicalDefect[];
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
  score_denominator_policy?: ScoreDenominatorPolicy;
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
  detected_mode?: DetectedMode;
  confirmed_mode?: {
    evaluationMode: EvaluationMode;
    voicePreservationMode: VoicePreservationMode;
    sectionOverrides?: SectionModeOverride[];
  } | null;
  mode_telemetry?: ModeTelemetryEvent[];
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
      title?: string;
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
  /** Enrichment surfaces — computed algorithmically or via lightweight LLM extraction. */
  enrichment?: {
    /** 1–2 sentence elevator pitch of the manuscript's core dramatic situation. */
    premise?: string;
    /** Content advisory categories requiring reader warnings. */
    trigger_warnings?: string[];
    /** Pipeline-diagnosed publishing genre/category; must not be merely a work format such as "novel". */
    diagnosed_genre?: string;
    /** Pipeline-diagnosed likely audience/readership for the submitted text. */
    target_audience?: string;
    /** Flesch-Kincaid Grade Level computed from manuscript text. */
    reading_grade_level?: number;
    /** Percentage of text identified as quoted dialogue (0–100). */
    dialogue_percentage?: number;
    /** Percentage of text identified as narrative prose (0–100). */
    narrative_percentage?: number;
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
        weighting: "equal" | "weighted";
      };
      excellence_filter?: {
        verdict: "submission-ready" | "close-but-not-ready" | "not-yet-ready";
        blocking_criteria: string[];
      };
    };
    slae?: {
      grounding_status: SlaeGroundingStatus;
      blocked: boolean;
      reasons: string[];
    };
  };
};
