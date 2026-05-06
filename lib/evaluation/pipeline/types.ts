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

// ── Dialogue Attribution Diagnostics (FR-1: Canonical shared type) ───────────

/**
 * Structured diagnostic signals for dialogue attribution and rendering.
 * Single source of truth imported by: quality gate, Pass 3 backfill, fallback logic, tests.
 * Prevents lexical-semantic mismatch between enforcement layers.
 * Canonical import: lib/evaluation/pipeline/types.ts
 */
export type DialogueAttributionDiagnostics = {
  /** Count of quoted speech segments in manuscript */
  quotedSpeechCount: number;
  /** Number of dialogue turn transitions */
  dialogueTurnCount: number;
  /** Explicit attribution tags (said, asked, replied, etc.) */
  explicitTagCount: number;
  /** Action beats adjacent to or replacing attribution */
  actionBeatCount: number;
  /** Attribution tag frequency per 1000 words */
  tagDensity: number;
  /** Action beat frequency per 1000 words */
  actionBeatDensity: number;
  /** Speaker identification clarity across narrative */
  turnTakingClarity: "clear" | "mixed" | "unclear";
  /** Risk of speaker confusion or ambiguity */
  speakerAmbiguityRisk: "low" | "medium" | "high";
  /** Observable rendering techniques found in dialogue */
  renderingModesDetected: Array<
    | "direct_speech"
    | "indirect_speech"
    | "reported_speech"
    | "interiority_during_dialogue"
    | "action_beat_attribution"
    | "tagged_speech"
    | "tagless_exchange"
  >;
  /** How the manuscript attributes or renders speaker identity */
  speakerAttributionStrategy: Array<
    | "explicit_tags"
    | "action_beats"
    | "voice_differentiation"
    | "alternating_turns"
    | "contextual_anchoring"
  >;
  /** Human-readable summary of dialogue attribution mechanisms */
  diagnosticSummary: string;
};


// ── Single-axis criterion result (Pass 1 or 2) ──────────────────────────────

export type AxisCriterionResult = {
  key: CriterionKey;
  /** Integer 0-10, no half-points (Canon) */
  score_0_10: number;
  /** Deterministic parser/validator reason codes from pass boundary enforcement. */
  reason_codes?: string[];
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
    issue_family: IssueFamily;
    /** Higher-order editorial lever — semantic dedupe handle (canonical vocabulary) */
    strategic_lever: StrategicLever;
    /** Where the fix primarily operates */
    revision_granularity: RevisionGranularity;
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
    issue_family: IssueFamily;
    /** Higher-order editorial lever — semantic dedupe handle (canonical vocabulary) */
    strategic_lever: StrategicLever;
    /** Where the fix primarily operates */
    revision_granularity: RevisionGranularity;
    /**
     * Deterministic collapse key for semantic dedup.
     * Format: issue_family:strategic_lever:revision_granularity
     * Built by buildRedundancyKey() after normalization.
     */
    redundancy_key?: string;
    /** Number of distinct evidence spans supporting this recommendation */
    evidence_span_count?: number;
  }[];
  /** Deterministic confidence score derived from evidence support + explanation quality (0-100). */
  confidence_score_0_100?: number;
  /** Confidence bucket for user-facing trust rendering. */
  confidence_level?: "high" | "moderate" | "low";
  /** Explainability breadcrumbs for confidence classification. */
  confidence_reasons?: string[];
  /** Scorability semantics separated from confidence semantics. */
  scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
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
    submission_readiness: "queryable_now" | "close" | "not_yet";
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
  diagnostics?: unknown;
};

export type EditorialDiagnosticClassification =
  | "generic_feedback"
  | "missing_symptom"
  | "missing_mechanism"
  | "missing_fix"
  | "missing_reader_effect"
  | "missing_anchor"
  | "duplicate_reasoning";

export type EditorialActionApplied = "block" | "warn" | "none";

export type EditorialDiagnostic = {
  signal_id: string;
  criterion: CriterionKey;
  action: string;
  expected_impact: string;
  anchor_snippet: string;
  evaluation_route: "recommendation_editorial_quality";
  missing_fields: string[];
  classification: EditorialDiagnosticClassification;
  action_applied: EditorialActionApplied;
  gate_check_id: "recommendation_editorial_quality";
  error_code?: "QG_EDITORIAL_GENERIC_FEEDBACK";
  failure_reason: string;
  recommended_fix_path: string;
  recommendation_index?: number;
};

export type EditorialDiagnosticsSummary = {
  reportVersion: 4;
  total_diagnostics: number;
  rule_fire_counts: Record<EditorialDiagnosticClassification, number>;
  block_reason_histogram: Record<EditorialDiagnosticClassification, number>;
};

export type QualityGateResult = {
  pass: boolean;
  checks: QualityGateCheck[];
  warnings: string[];
  editorial_diagnostics?: EditorialDiagnostic[];
  editorial_diagnostics_summary?: EditorialDiagnosticsSummary;
};

// ── Completion capture / usage telemetry ───────────────────────────────────

export type CompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type Pass3CriteriaCountByState = {
  agree: number;
  soft_divergence: number;
  hard_divergence: number;
  missing_or_invalid: number;
};

export type ManuscriptChunkEvidence = {
  chunk_index: number;
  content: string;
};

export type Pass3ReducerTelemetry = {
  schema_version: "1";
  prompt_version: string;
  criteria_count_by_state: Pass3CriteriaCountByState;
  chunk_count: number;
  comparison_packet_chars: number;
  system_prompt_chars: number;
  user_prompt_chars: number;
  max_output_tokens: number;
};

export type PassCompletionCapture = {
  pass: 1 | 2 | 3;
  raw_text: string;
  model: string;
  usage?: CompletionUsage;
  finish_reason?: string;
  request_id?: string;
  generated_at: string;
  pass3_reducer_telemetry?: Pass3ReducerTelemetry;
};

// ── Phase 2.7 Gate Diagnostics (audit-only, not user-visible) ───────────────

/**
 * Per-criterion diagnostic record for the independence check.
 * Stored in quality_gate_diagnostics_v1 evaluation artifact.
 * classification is a placeholder for post-rerun triage (A/B/C).
 */
export type QualityGateCriterionDiagnostic = {
  criterion_key: string;
  pass1_rationale: string;
  pass2_rationale: string;
  /** All unique non-evidence n-grams from Pass 2 rationale that appear in Pass 1 rationale */
  overlap_4grams: string[];
  observed_overlap_count: number;
  threshold_n: number;
  threshold_min: number;
  /** Placeholder for post-rerun classification: true_overlap | generic_overlap | false_positive */
  classification: null;
};

/**
 * Full gate diagnostic payload attached to PipelineResult (ok: false) at pass4.
 * Consumed by the processor to persist audit artifacts.
 * Must NOT be passed to markFailed (too large) — processor reads directly from PipelineResult.
 */
export type GateDiagnostics = {
  schema_version: "gate_diagnostics_v1";
  failed_at: "pass4";
  error_code: string;
  generated_at: string;
  /** Per-criterion independence diagnostics (empty when failure is not QG_INDEPENDENCE_VIOLATION) */
  per_criterion: QualityGateCriterionDiagnostic[];
  /** Raw Pass 1 output as emitted — audit-only, not normalized for report UI */
  pass1_output: SinglePassOutput;
  /** Raw Pass 2 output as emitted — audit-only, not normalized for report UI */
  pass2_output: SinglePassOutput;
  /** Pass 3 synthesis output — audit-only, not normalized for report UI */
  pass3_output: SynthesisOutput;
  /** Sanitized provider trace (model IDs, prompt versions, temperatures — no raw LLM text) */
  provider_call_trace: Array<{
    pass: 1 | 2;
    model: string;
    prompt_version: string;
    temperature: number;
    generated_at: string;
  }>;
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
        llr_diagnostic_snapshot?: {
          stage: "post_convergence" | "pre_artifact_generation";
          blocked_rule_ids: string[];
          convergence_result: SynthesisOutput;
        };
        pass2_independence?: {
          failed_keys: string[];
          rewritten_keys: string[];
          threshold_n: number;
          threshold_min: number;
          per_failed_criterion: Array<{
            criterion_key: string;
            initial_overlap_count: number;
            post_rewrite_overlap_count: number;
          }>;
        };
        quality_gate_checks?: Array<{
          check_id: string;
          error_code?: string;
          details?: string;
          diagnostics?: unknown;
          /**
           * Compact per-criterion diagnostic array — signals that structured diagnostics
           * are available. Written to pipeline_failure_diagnostics in job progress so
           * /admin/pipeline-health can return diagnosticStatus="available".
           * Full data lives in quality_gate_diagnostics_v1 evaluation artifact.
           * Only present for independence check failures (QG_INDEPENDENCE_VIOLATION).
           */
          per_criterion_diagnostic?: Array<{
            criterion_key: string;
            observed_overlap_count: number;
            threshold_n: number;
            threshold_min: number;
            classification: null;
          }>;
        }>;
        /**
         * Signal that audit-grade gate diagnostic artifacts were initiated for this job.
         * Present for any Phase 2.7 gate failure where pass outputs are available.
         * Allows /admin/pipeline-health diagnosticStatus to return "available" for all
         * gate failure types (not only QG_INDEPENDENCE_VIOLATION).
         */
        gate_diagnostics_version?: "gate_diagnostics_v1";
      };
      /**
       * Full gate diagnostic payload for artifact persistence (Phase 2.7 audit).
       * Present only when failed_at="pass4" and pass1/pass2/pass3 outputs are available.
       * Processor MUST NOT pass this to markFailed — too large for the 4KB progress limit.
       * Processor reads this directly from PipelineResult to persist audit artifacts.
       */
      gate_diagnostics?: GateDiagnostics;
    };

// ── Artifact Validation Layer ─────────────────────────────────────────────────
// GOVERNANCE: ArtifactValidationResult is pipeline-internal ONLY.
// It MUST NOT be conflated with JobStatus (queued|running|complete|failed).

export type ArtifactGateResult = "PASS" | "HOLD" | "FAIL";

export type ArtifactReasonCode =
  | "CRIT-MISSING-ALL"       // no criteria at all
  | "CRIT-MISSING-1"         // wrong count or missing expected keys
  | "SCORE-NON-INTEGER-1"    // non-integer score
  | "SCORE-OUT-OF-RANGE-1"   // <0 or >10
  | "EVIDENCE-MISSING-1"     // empty/whitespace evidence
  | "REASONING-MISSING-1"    // empty/whitespace reasoning
  | "INTERP-MISSING-1"       // empty/whitespace interpretation
  | "SCORE-NORM-1"           // ledger inconsistent with criteria
  | "EFG-MISMATCH-1";        // verdict or blockers don't match deterministic builder

export interface CriterionEvaluation {
  key: CriterionKey;
  final_score_0_10: number;
  reasoning: string;
  evidence: string;
  interpretation: string;
}

export interface ArtifactScoreLedger {
  rawTotal: number;
  maxTotal: number;
  normalized: number;
  weighting: "equal" | "weighted";
}

export type SubmissionReadiness =
  | "submission-ready"
  | "close-but-not-ready"
  | "not-yet-ready";

export interface ExcellenceFilterFooter {
  verdict: SubmissionReadiness;
  blockingCriteria: CriterionKey[];
}

export interface EvaluationArtifact {
  criteria: CriterionEvaluation[];
  ledger: ArtifactScoreLedger;
  efg: ExcellenceFilterFooter;
}

export interface ArtifactValidationSummary {
  result: ArtifactGateResult;
  reasonCodes: ArtifactReasonCode[];
}

// ── Advisory Plan Layer ───────────────────────────────────────────────────────

export type AdvisorySeverity = "blocking" | "advisory";

export type AdvisoryLane =
  | "clarify_premise_hook"
  | "increase_escalation_consequence"
  | "deepen_character_pressure"
  | "tighten_voice_control"
  | "strengthen_scene_turns"
  | "increase_dialogue_subtext"
  | "dramatize_theme"
  | "sharpen_environmental_function"
  | "compress_pacing_drag"
  | "tighten_line_level_prose"
  | "stabilize_tonal_contract"
  | "strengthen_promise_delivery"
  | "clarify_market_positioning";

export interface AdvisoryPlanItem {
  criterion: CriterionKey;
  score: number;
  severity: AdvisorySeverity;
  advisoryLane: AdvisoryLane;
  requiredRevisionScope: "line" | "beat" | "scene" | "chapter" | "manuscript";
}
