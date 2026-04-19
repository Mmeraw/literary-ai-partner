/**
 * Phase 2.7 — Evaluation Uplift: 4-Pass Pipeline
 * Type contracts for the dual-axis multi-pass evaluation pipeline.
 *
 * Non-Goals (see PHASE_2_7_SPEC.md §2):
 *   - no new DB tables, no schema migrations
 *   - no UI changes, no WAVE, no multi-chunk (2.8), no provider switching (2.10)
 */

import type { CriterionKey } from "@/schemas/criteria-keys";

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
  verdict_status?: "valid" | "partial";
  confidence?: "full" | "reduced";
  warnings?: string[];
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
