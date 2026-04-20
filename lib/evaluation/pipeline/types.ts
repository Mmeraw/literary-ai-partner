/**
 * Phase 2.7 — Evaluation Uplift: 4-Pass Pipeline
 * Type contracts for the dual-axis multi-pass evaluation pipeline.
 *
 * Non-Goals (see PHASE_2_7_SPEC.md §2):
 *   - no new DB tables, no schema migrations
 *   - no UI changes, no WAVE, no multi-chunk (2.8), no provider switching (2.10)
 */

import type { CriterionKey } from "@/schemas/criteria-keys";

// ── Recommendation semantic vocabulary ───────────────────────────────────────

/**
 * Broad craft/problem class. Controlled vocabulary — do not use free-form strings.
 * Add new values here before using them in Pass 3 output.
 */
export type IssueFamily =
  | "pacing"
  | "dialogue"
  | "closure"
  | "characterization"
  | "exposition"
  | "tension"
  | "prose_control"
  | "scene_structure"
  | "voice"
  | "market_positioning"
  | "concept"
  | "theme"
  | "worldbuilding";

/**
 * Higher-order editorial lever — the main semantic dedupe handle.
 * Two recommendations sharing the same strategic_lever are candidates for collapse.
 * Controlled vocabulary — do not use free-form strings.
 */
export type StrategicLever =
  | "momentum_visibility"
  | "dialogue_exposition_density"
  | "scene_goal_clarity"
  | "closure_state_lock"
  | "character_voice_differentiation"
  | "tension_escalation"
  | "exposition_load_reduction"
  | "prose_compression"
  | "market_signal_clarity"
  | "pov_rendering_precision"
  | "structural_commitment"
  | "thematic_grounding"
  | "sensory_specificity";

/**
 * Where the revision fix primarily operates.
 * Controls whether same-lever recommendations are truly distinct.
 */
export type RevisionGranularity = "line" | "beat" | "scene" | "chapter" | "manuscript";

// ── Evidence ─────────────────────────────────────────────────────────────────

export type EvidenceAnchor = {
  /** ≤200 chars, verbatim from manuscript text */
  snippet: string;
  char_start?: number;
  char_end?: number;
  segment_id?: string;
};

// ── Single-axis criterion result (Pass 1 or 2) ──────────────────────────────

export type AxisCriterionResult = {
  key: CriterionKey;
  /** Integer 0-10, no half-points (Canon) */
  score_0_10: number;
  rationale: string;
  evidence: EvidenceAnchor[];
  recommendations: {
    priority: "high" | "medium" | "low";
    /** 50-300 chars, must reference anchor_snippet */
    action: string;
    expected_impact: string;
    /** The specific text this recommendation targets */
    anchor_snippet: string;
    /** Broad craft/problem class (canonical vocabulary) */
    issue_family?: IssueFamily;
    /** Higher-order editorial lever — semantic dedupe handle (canonical vocabulary) */
    strategic_lever?: StrategicLever;
    /** Where the fix primarily operates */
    revision_granularity?: RevisionGranularity;
  }[];
};

// ── Pass 1 / Pass 2 output ───────────────────────────────────────────────────

export type SinglePassOutput = {
  pass: 1 | 2;
  axis: "craft_execution" | "editorial_literary";
  criteria: AxisCriterionResult[];
  model: string;
  prompt_version: string;
  temperature: number;
  generated_at: string; // ISO 8601
};

// ── Pass 3: Synthesized criterion ────────────────────────────────────────────

export type SynthesizedCriterion = {
  key: CriterionKey;
  craft_score: number;
  editorial_score: number;
  /** Reconciled score, not a simple average (spec §3.3) */
  final_score_0_10: number;
  /** |craft_score - editorial_score| */
  score_delta: number;
  /** Required when score_delta > 2 */
  delta_explanation?: string;
  final_rationale: string;
  /** Where narrative pressure enters or accumulates for this criterion */
  pressure_points: string[];
  /** Where a decision (or non-decision) is reached */
  decision_points: string[];
  /** Whether consequence lands now, is deferred, or dissipates */
  consequence_status: "landed" | "deferred" | "dissipated";
  /** Required when consequence_status is deferred */
  deferred_consequence_risk?: string;
  evidence: EvidenceAnchor[];
  recommendations: {
    priority: "high" | "medium" | "low";
    action: string;
    expected_impact: string;
    anchor_snippet: string;
    /** Which pass originated this recommendation */
    source_pass: 1 | 2 | 3;
    /** Broad craft/problem class (canonical vocabulary) */
    issue_family?: IssueFamily;
    /** Higher-order editorial lever — semantic dedupe handle (canonical vocabulary) */
    strategic_lever?: StrategicLever;
    /** Where the fix primarily operates */
    revision_granularity?: RevisionGranularity;
    /**
     * Deterministic collapse key for semantic dedup.
     * Format: issue_family:strategic_lever:revision_granularity
     * Built by buildRedundancyKey() after normalization.
     */
    redundancy_key?: string;
    /** Number of distinct evidence spans supporting this recommendation */
    evidence_span_count?: number;
  }[];
};

// ── Pass 3 output ────────────────────────────────────────────────────────────

export type SynthesisOutput = {
  criteria: SynthesizedCriterion[];
  overall: {
    /** Computed via Vol II-A §WCS */
    overall_score_0_100: number;
    verdict: "pass" | "revise" | "fail";
    /** ≤500 chars */
    one_paragraph_summary: string;
    top_3_strengths: string[];
    top_3_risks: string[];
    /**
     * Writer-facing submission readiness posture.
     * queryable_now — strong enough to submit
     * close — one focused revision pass would materially improve requestability
     * not_yet — substantial issues prevent strong submission posture
     */
    submission_readiness?: "queryable_now" | "close" | "not_yet";
  };
  metadata: {
    pass1_model: string;
    pass2_model: string;
    pass3_model: string;
    generated_at: string;
  };
  /** TRUTH ENFORCEMENT: Was manuscript truncated/sampled for evaluation? */
  partial_evaluation: boolean;
  /** Coverage metadata: proves system doesn't lie about what was analyzed */
  coverage_scope?: {
    sourceChars: number;
    sourceWords: number;
    analyzedChars: number;
    analyzedWords: number;
    strategy: "full_text" | "sampled_beginning_middle_end";
  };
};

// ── Pass 4: Quality gate result ──────────────────────────────────────────────

export type QualityGateCheck = {
  check_id: string;
  passed: boolean;
  error_code?: string;
  details?: string;
};

export type QualityGateResult = {
  pass: boolean;
  checks: QualityGateCheck[];
  warnings: string[];
};

// ── Completion capture / usage telemetry ───────────────────────────────────

export type CompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type PassCompletionCapture = {
  pass: 1 | 2 | 3;
  raw_text: string;
  model: string;
  usage?: CompletionUsage;
  finish_reason?: string;
  request_id?: string;
  generated_at: string;
};

// ── Pipeline result ──────────────────────────────────────────────────────────

export type PipelineResult =
  | {
      ok: true;
      synthesis: SynthesisOutput;
      quality_gate: QualityGateResult;
      /** Populated when perplexityApiKey provided and cross-check succeeded */
      cross_check?: import("./perplexityCrossCheck").CrossCheckOutput;
      /** Always present after quality gate passes; undefined only if evaluatePass4Governance throws */
      pass4_governance?: import("@/lib/evaluation/governance/evaluatePass4Governance").GovernanceDecision;
    }
  | {
      ok: false;
      error: string;
      error_code: string;
      failed_at: "pass1" | "pass2" | "pass3" | "pass4";
      failure_details?: {
        json_boundary?: {
          code: string;
          candidates_found?: number;
          raw_head?: string;
          raw_tail?: string;
          normalized_tail?: string;
          candidate_tail?: string;
        };
      };
    };
