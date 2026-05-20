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

export type CoverageStrategy =
  | "full_text"
  | "sampled_beginning_middle_end"
  | "full_chunk_map_reduce"
  | "partial_chunk_map_reduce";

export type PassCoverageSummary = {
  route: "direct_window" | "chunk_map_reduce";
  fully_evaluated: boolean;
  chunk_ledger?: {
    expected_chunks: number;
    attempted_chunks: number;
    evaluated_chunks: number;
    failed_chunks: number;
    cap_applied: boolean;
  };
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
  coverage_summary?: PassCoverageSummary;
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
    /**
     * Causal explanation of why this problem exists (non-empty when anchor_snippet is
     * present; derived from action/expected_impact text or criterion-aware default).
     * For anchorless recommendations this may be "" — gate fires on the genuine generic content.
     */
    mechanism: string;
    /**
     * Concrete revision action (non-empty when anchor_snippet is present; derived from
     * action text or criterion-aware default). Not generic advice — a specific move.
     * For anchorless recommendations this may be "" — gate fires on the genuine generic content.
     */
    specific_fix: string;
    /**
     * Post-revision reader experience (non-empty when anchor_snippet is present; derived
     * from expected_impact text or criterion-aware default).
     * For anchorless recommendations this may be "" — gate fires on the genuine generic content.
     */
    reader_effect: string;
  }[];
  /** Deterministic confidence score derived from evidence support + explanation quality (0-100). */
  confidence_score_0_100?: number;
  /** Confidence bucket for user-facing trust rendering. */
  confidence_level?: "high" | "moderate" | "low";
  /** Explainability breadcrumbs for confidence classification. */
  confidence_reasons?: string[];
  /** Scorability semantics separated from confidence semantics. */
  scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
  technical_defects?: Array<{
    code: "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED" | "RECOMMENDATION_TRUNCATED";
    author_facing_reason: string;
    retryable: boolean;
  }>;
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
     * nearly_ready — one focused revision pass would materially improve requestability
     * not_yet — substantial issues prevent strong submission posture
     */
    submission_readiness: "queryable_now" | "nearly_ready" | "not_yet";
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
    strategy: CoverageStrategy;
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

export type DivergenceApparentState =
  | "agree"
  | "soft_divergence"
  | "hard_divergence"
  | "missing_or_invalid";

export type PreSynthesisCriterionState = {
  pass1_score: number | null;
  pass2_score: number | null;
  score_delta: number | null;
  raw_rationale_overlap_count: number;
  apparent_state: DivergenceApparentState;
};

export type DivergenceDiagnosticArtifact = {
  pass1_pass2_criterion_state_pre_synthesis: Record<string, PreSynthesisCriterionState>;
  comparison_packet_retained_ratio: number;
  pass3_criteria_count_by_state: Pass3CriteriaCountByState;
  divergence_collapse_detected: boolean;
};

export interface PacketProvenanceTelemetry {
  packet_source: 'long_form_chunks_canonical' | 'short_form_initial_text';
  packet_scope: 'criterion_comparison' | 'manuscript_summary' | 'divergence_packet';
  packet_evidence_origin: 'chunk_canonical_window' | 'short_form_full_text';
}

export type ManuscriptChunkEvidence = {
  chunk_index: number;
  content: string;
};

export type Pass2aCharacterLedgerEntry = {
  name: string;
  first_chunk_index: number;
  mention_count: number;
  sample_snippet: string;
};

export type Pass2aSceneIndexEntry = {
  chunk_index: number;
  scene_preview: string;
  named_entities: string[];
};

export type Pass2aTimelineAnchor = {
  chunk_index: number;
  anchor_type: "age" | "duration" | "sequence";
  anchor_text: string;
};

export type Pass2aStructuredContext = {
  character_ledger: Pass2aCharacterLedgerEntry[];
  scene_index: Pass2aSceneIndexEntry[];
  timeline_anchors: Pass2aTimelineAnchor[];
};

export type Pass3ReducerTelemetry = {
  schema_version: "1";
  prompt_version: string;
  criteria_count_by_state: Pass3CriteriaCountByState;
  chunk_count: number;
  packet_source: PacketProvenanceTelemetry['packet_source'];
  packet_scope: PacketProvenanceTelemetry['packet_scope'];
  packet_evidence_origin: PacketProvenanceTelemetry['packet_evidence_origin'];
  manuscript_words: number;
  chunks_created: number;
  chunks_consumed: number | null;
  chunk_coverage_pct: number | null;
  excerpt_count: number;
  evidence_count_by_criterion: Record<string, number>;
  comparison_packet_chars: number;
  representation_compression_ratio: number;
  criteria_with_zero_evidence: string[];
  system_prompt_chars: number;
  user_prompt_chars: number;
  max_output_tokens: number;
  // Phase 1 seed-band observational governance state
  // Bands (long-form only):
  //   ratio >= 0.10 → 'pass'
  //   0.05 <= ratio < 0.10 → 'warn'
  //   ratio < 0.05 → 'observe' (Phase 2 may convert to enforcement after calibration)
  //   short-form or null/non-finite ratio → null
  // NO 'hard_fail' state in Phase 1 — see PR_293_PHASE_2_PREVIEW_BRIEF.md
  compression_governance_state: 'pass' | 'warn' | 'observe' | null;
  divergence_diagnostics?: DivergenceDiagnosticArtifact;
  /**
   * True when Pass 3 detected truncation on the first GPT call and re-invoked
   * with an expanded token budget. Mirrors the Perplexity chunk scorer
   * length-retry pattern (PERPLEXITY_LENGTH_RETRY_MAX_TOKENS).
   */
  truncation_retry_fired?: boolean;
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

export type PipelineProviderTelemetryEntry = {
  job_id: string;
  pass: 1 | 2 | 3;
  provider: "openai" | "perplexity";
  model: string;
  request_id?: string;
  finish_reason?: string;
  usage?: CompletionUsage;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  success: boolean;
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

/**
 * External adjudication status — explicit, fail-closed contract for Pass 4.
 *
 * Every PipelineResult MUST carry this. Pass 4 "silently absent" (the original
 * bug that produced the Froggin Noggin completed-report-without-cross-check
 * artifact) is no longer representable.
 *
 * status semantics:
 *   - completed:        Perplexity returned a usable cross_check.
 *   - skipped:          Pass 4 did not run (no key in optional mode, etc.). Always carries a reason.
 *   - failed_soft:      Pass 4 attempted but failed; optional mode allows the eval to continue.
 *   - failed_blocking:  Pass 4 attempted/needed but failed; required/veto mode demands abort.
 *
 * mode is the EVAL_EXTERNAL_ADJUDICATION_MODE resolved at run time.
 */
export type ExternalAdjudicationMode = "optional" | "required" | "veto";

export type ExternalAdjudicationStatus =
  | {
      status: "cross_check_completed";
      mode: ExternalAdjudicationMode;
      cross_check_returned: true;
      packet_chars?: number;
      packet_compression_ratio?: number;
    }
  | {
      status: "skipped";
      mode: ExternalAdjudicationMode;
      cross_check_returned: false;
      reason: "no_api_key" | "adjudication_disabled" | string;
    }
  | {
      status: "failed_soft";
      mode: ExternalAdjudicationMode;
      cross_check_returned: false;
      reason: string;
      packet_chars?: number;
      packet_compression_ratio?: number;
    }
  | {
      status: "failed_blocking";
      mode: ExternalAdjudicationMode;
      cross_check_returned: false;
      reason: string;
      packet_chars?: number;
      packet_compression_ratio?: number;
    };

export type PipelineResultRouting = {
  pass1Model: string;
  pass2Model: string;
  pass3Model: string;
  pass3FallbackModel: string;
};

export type PipelineResult =
  | {
      ok: true;
      synthesis: SynthesisOutput;
      quality_gate: QualityGateResult;
      /** Populated when perplexityApiKey provided and cross-check succeeded */
      cross_check?: import("./perplexityCrossCheck").CrossCheckOutput;
      /** Always present after quality gate passes; undefined only if evaluatePass4Governance throws */
      pass4_governance?: import("@/lib/evaluation/governance/evaluatePass4Governance").GovernanceDecision;
      /**
       * Explicit Pass 4 execution outcome. Always present on the success path.
       * Drives processor persistence of progress.cross_check_status /
       * cross_check_reason / external_adjudication_mode and the report's
       * governance.transparency.external_adjudication block.
       */
      external_adjudication: ExternalAdjudicationStatus;
      /** Resolved pass-level model routing for audit traceability. */
      routing?: PipelineResultRouting;
      /** Pass-level provider telemetry captured during Pass 1/2/3 completion. */
      provider_telemetry?: PipelineProviderTelemetryEntry[];
      /** Recovery metadata: retry counts and fallback usage per pass. */
      recovery?: {
        retry_counts?: Partial<Record<"pass1" | "pass2" | "pass3", number>>;
        fallbacks?: Partial<Record<"pass3", boolean>>;
      };
      // longform_document removed from PipelineResult (fix/pass3b-async-dream-worker, issue #543).
      // Pass 3b is now an async post-completion job at /api/workers/process-dream.
      // The DREAM document is stored as a longform_document_v1 artifact in evaluation_artifacts
      // and fetched separately by the report page — never returned from runPipeline.
    }
  | {
      ok: false;
      error: string;
      error_code: string;
      failed_at: "pass1" | "pass2" | "pass3" | "pass4";
      /**
       * Pass 4 status snapshot. Present whenever the failure can be attributed
       * to (or annotated with) external adjudication. When failed_at==="pass4"
       * and the cause is a required/veto-mode external adjudication failure,
       * external_adjudication.status will be "failed_blocking".
       */
      external_adjudication?: ExternalAdjudicationStatus;
      /**
       * PR-B observability: full cross-check output when a Pass 4 governance
       * failure (PASS4_CANON_INVALID / PASS4_WEAK_AGREEMENT /
       * PASS4_DISPUTED_CRITERIA) blocks the pipeline. Lets the processor
       * persist progress.cross_check_output and audit_invalid_criteria before
       * markFailed runs, preserving the evidence that drove the block.
       */
      cross_check?: import("./perplexityCrossCheck").CrossCheckOutput;
      /**
       * PR-B observability: the governance decision (block code + audit context
       * including invalidCriteria, disputedCriteria, overallAgreement) that
       * caused the failure. Surfaced on the failure variant so the processor
       * does not have to re-derive it from cross_check.
       */
      pass4_governance?: import("@/lib/evaluation/governance/evaluatePass4Governance").GovernanceDecision;
      /** Resolved pass-level model routing for audit traceability. */
      routing?: PipelineResultRouting;
      /** Recovery metadata: retry counts and fallback usage per pass. */
      recovery?: {
        retry_counts?: Partial<Record<"pass1" | "pass2" | "pass3", number>>;
        fallbacks?: Partial<Record<"pass3", boolean>>;
      };
      failure_details?: {
        json_boundary?: {
          code: string;
          candidates_found?: number;
          raw_head?: string;
          raw_tail?: string;
          normalized_tail?: string;
          candidate_tail?: string;
        };
        manuscript_chunk_coverage?: {
          reason_codes: string[];
          chunk_coverage: {
            chunks_expected: number;
            chunks_processed_pass1: number;
            chunks_processed_pass2: number;
            chunks_processed_effective: number;
          };
          word_coverage: {
            words_submitted: number;
            words_analyzed: number;
            analyzed_ratio: number;
            threshold_ratio: number;
          };
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

// ════════════════════════════════════════════════════════════════════
// Pass 1A — Character Evidence Types
// Added: feat(pipeline)/pass1a-character-sweep
// ════════════════════════════════════════════════════════════════════

export type Pass1aAgeSignal =
  | "infant" | "toddler" | "child" | "preteen" | "teen"
  | "young_adult" | "adult" | "middle_aged" | "elderly"
  | null;

export type Pass1aGenderIdentity =
  | "man" | "woman" | "boy" | "girl"
  | "nonbinary" | "trans_man" | "trans_woman" | "genderfluid"
  | "unknown";

export type Pass1aRoleSignal =
  | "protagonist" | "co_protagonist" | "antagonist" | "secondary"
  | "mentor" | "foil" | "animal_companion" | "symbolic_force"
  | "collective_force" | "unknown";

export type Pass1aNarrativeWeightSignal =
  | "primary" | "major" | "supporting" | "recurring" | "minor" | "unknown";

export type Pass1aEvidenceType =
  | "appearance" | "choice" | "relationship" | "symbol"
  | "arc_shift" | "identity" | "ending_payoff";

export interface Pass1aCharacterChunkEntry {
  canonical_name: string;
  aliases: string[];
  pronouns: string[];
  age_signal: Pass1aAgeSignal;
  age_exact: number | null;
  life_stage_evidence: string | null;
  gender_identity: Pass1aGenderIdentity;
  lgbtq_signals: string[];
  racial_ethnic_signals: string[];
  skin_tone_signals: string[];
  language_signals: string[];
  religion_signals: string[];
  socioeconomic_signals: string[];
  nationality_signals: string[];
  disability_neuro_signals: string[];
  role_signal: Pass1aRoleSignal;
  narrative_weight_signal: Pass1aNarrativeWeightSignal;
  is_named: boolean;
  who_is_this: string;
  what_do_they_want: string | null;
  where_are_they: string | null;
  when_signal: string | null;
  why_signal: string | null;
  how_signal: string | null;
  arc_state_in_chunk: string;
  arc_pressure: string | null;
  arc_shift: string | null;
  is_ending_chunk: boolean;
  symbolic_objects: Array<{ object: string; function: string }>;
  relationship_signals: Array<{
    other_character: string;
    relationship_type: string;
    dynamic: string;
  }>;
  evidence_anchors: Array<{
    excerpt: string;
    evidence_type: Pass1aEvidenceType;
  }>;
}

export interface Pass1aChunkOutput {
  pass: "1a";
  axis: "character_evidence_sweep";
  chunk_index: number;
  characters: Pass1aCharacterChunkEntry[];
  prompt_version: string;
  generated_at: string;
}

export type CharacterArcEndingStatus =
  | "resolved" | "transformed" | "tragically_confirmed"
  | "intentionally_unresolved" | "underpaid"
  | "accidentally_abandoned" | "missing_from_ending";

export type CharacterReportAcknowledgementStatus =
  | "adequately_accounted_for"
  | "underweighted_in_report"
  | "omitted_from_report";

export interface CharacterArcLedgerEntry {
  canonical_name: string;
  aliases: string[];
  pronouns: string[];
  age_exact_first: number | null;
  age_exact_last: number | null;
  age_signal: Pass1aAgeSignal;
  gender_identity: Pass1aGenderIdentity;
  lgbtq_signals: string[];
  racial_ethnic_signals: string[];
  skin_tone_signals: string[];
  language_signals: string[];
  religion_signals: string[];
  socioeconomic_signals: string[];
  nationality_signals: string[];
  disability_neuro_signals: string[];
  role: Pass1aRoleSignal;
  narrative_weight_band: Pass1aNarrativeWeightSignal;
  is_named: boolean;
  who_is_this: string;
  what_do_they_want: string | null;
  primary_locations: string[];
  why_signal: string | null;
  how_signal: string | null;
  arc_start: string;
  arc_pressure: string;
  arc_turning_points: string[];
  arc_end_state: string;
  ending_status: CharacterArcEndingStatus;
  symbolic_objects: Array<{
    object: string;
    first_chunk: number;
    last_chunk: number;
    function: string;
    traced: boolean;
  }>;
  relational_engines: Array<{
    other_character: string;
    relationship_type: string;
    dynamic: string;
    chunk_span: [number, number];
  }>;
  evidence_anchors: Array<{
    chunk_index: number;
    excerpt: string;
    evidence_type: Pass1aEvidenceType;
  }>;
  report_acknowledgement_status: CharacterReportAcknowledgementStatus;
  warnings: Array<{
    type:
      | "pronoun_inconsistency" | "gender_conflict" | "role_underweighted"
      | "major_character_missing_from_report" | "arc_abandoned"
      | "ending_underpaid" | "alias_confusion" | "relational_engine_underweighted";
    message: string;
  }>;
  first_chunk_index: number;
  last_chunk_index: number;
  mention_count: number;

  // ── Recommendation Grounding Gate fields (added v2) ─────────────────────
  // Name-state ledger: valid name windows so Pass 3 never uses a name before
  // the story earns it (e.g. "Paul" only after the renaming scene).
  nameStates: Array<{
    name: string;
    validFromChunk: number;
    validUntilChunk: number | null; // null = valid through end
  }>;

  // Coping mechanisms: prevents Pass 3 from recommending "seed a ritual"
  // when one already exists in the ledger.
  copingMechanisms: Array<{
    description: string;
    firstAppearsChunk: number;
    frequency: "rare" | "recurring" | "dominant";
  }>;

  // Co-presence map: first shared chunk index for every relationship pair.
  // Pass 3 uses this to block recommendations that place two characters
  // together before they have met.
  coPresenceMap: Record<string, {
    firstSharedChunk: number;
    firstSharedChapterEstimate: string; // e.g. "Chapter 4" or "unknown"
  }>;
}

export interface SymbolPayoffEntry {
  object: string;
  attached_characters: string[];
  first_chunk: number;
  last_chunk: number;
  first_function: string;
  later_payoff: string | null;
  status: "resolved" | "active" | "dropped" | "intentionally_unresolved";
  traced: boolean;
}

export interface Pass1aCharacterLedger {
  schema_version: "pass1a_character_ledger_v1";
  prompt_version: string;
  job_id: string;
  generated_at: string;
  total_chunks_processed: number;
  entries: CharacterArcLedgerEntry[];
  coverage_summary: {
    protagonists: string[];
    co_protagonists: string[];
    antagonists: string[];
    major_secondary_characters: string[];
    animal_companions: string[];
    relational_engines: string[];
    symbol_payoff_items: SymbolPayoffEntry[];
    missing_or_underweighted: string[];
    ending_accountability_warnings: string[];
    hard_fail_triggers: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER LEDGER v2 — Time-Indexed Continuity System
// "Characters as timelines, not profiles."
//
// Six ledgers. Every field is evidence-backed, time-indexed, and usable as a
// deterministic blocker against bad recommendations.
// Schema version: character_ledger_v2
// ═══════════════════════════════════════════════════════════════════════════════

// ── Foundation types ──────────────────────────────────────────────────────────

export type EvidenceConfidence = "explicit" | "strong_inference" | "weak_inference";

/**
 * Every significant claim in the ledger must be grounded in text.
 * No field may be inferred without a quote and a chapter reference.
 */
export interface EvidenceBackedField<T = string> {
  value: T;
  confidence: EvidenceConfidence;
  evidenceQuote: string;       // verbatim or near-verbatim from manuscript
  chapterRef: string;          // e.g. "Chapter 4" or "chunk 12"
  sourceChunkId?: number;      // chunk index if available
}

export interface ChapterRef {
  label: string;               // "Chapter 4", "Opening", "MID-LATE", etc.
  chunkIndex?: number;
}

export type NarrativeRole =
  | "protagonist" | "co_protagonist" | "antagonist"
  | "mentor" | "foil" | "secondary" | "symbolic_force" | "collective_force"
  | "animal_companion" | "unknown";

export type ImportanceLevel = "primary" | "major" | "supporting" | "minor" | "background";

export type RelationshipType =
  | "captor_captive" | "protector_protected" | "father_son" | "father_daughter"
  | "romantic_partners" | "found_family" | "adversaries" | "uneasy_alliance"
  | "mentor_student" | "strangers" | "siblings" | "colleagues" | "unknown";

export type PowerDynamic = "dominant" | "subordinate" | "equal" | "shifting" | "unknown";

export type ObjectSymbolicStage =
  | "introduced" | "transferred" | "transformed" | "weaponized"
  | "lost" | "paid_off" | "unresolved";

// ── Recommendation Blockers ────────────────────────────────────────────────────

export type RecommendationBlockerType =
  | "chronology_violation"       // rec targets a chapter before the condition is valid
  | "co_presence_violation"      // rec places characters together before they have met
  | "name_state_violation"       // rec uses a name before the story earns it
  | "existing_feature_violation" // rec says "add X" but X already exists
  | "location_state_violation"   // rec places character at wrong location
  | "knowledge_state_violation"  // rec assumes character knows something they don't yet
  | "object_state_violation"     // rec references object transfer before it occurred
  | "terminal_state_violation";  // rec ignores that character has died/left the story

export interface RecommendationBlocker {
  type: RecommendationBlockerType;
  rule: string;         // human-readable enforcement rule
  validAfterChapter?: string;   // the chapter after which the rec would be valid
  involvedCharacters?: string[];
  involvedObjects?: string[];
}

// ── Contradiction Tracker ──────────────────────────────────────────────────────

export interface Contradiction {
  field: string;
  values: string[];
  chapters: string[];
  resolution: string;
  confidence: EvidenceConfidence;
}

// ══════════════════════════════════════════════════════════════════════════════
// LEDGER 1 — Character Identity Ledger
// Who the person is across the whole book.
// ══════════════════════════════════════════════════════════════════════════════

export interface CharacterIdentityLedgerEntry {
  characterId: string;                          // canonical stable ID
  canonicalName: string;                        // primary name used in report
  nameHistory: Array<{
    name: string;
    validFromChunk: number;
    validUntilChunk: number | null;             // null = valid through end
    reason?: string;                            // e.g. "renamed at embassy departure"
    confidence: EvidenceConfidence;
    evidenceQuote?: string;
  }>;
  aliases: string[];                            // all names/nicknames observed
  narrativeRole: NarrativeRole;
  importanceLevel: ImportanceLevel;
  firstAppearance: ChapterRef;
  lastAppearance: ChapterRef;
  firstChunkIndex: number;
  lastChunkIndex: number;
  finalStatus: "alive" | "dead" | "missing" | "transformed" | "unresolved";

  // Identity markers — optional, text-grounded only, never inferred
  identityMarkers?: {
    genderIdentity?: EvidenceBackedField;
    sexualOrientation?: EvidenceBackedField;
    ethnicity?: EvidenceBackedField[];
    nationality?: EvidenceBackedField[];
    religionOrFaithContext?: EvidenceBackedField;
    ageAtStart?: EvidenceBackedField<number>;
    ageAtEnd?: EvidenceBackedField<number>;
    lifeStage?: EvidenceBackedField;
    textuallyRelevant: boolean;                 // is identity plot-functional?
  };

  contradictions: Contradiction[];
  recommendationBlockers: RecommendationBlocker[];
}

// ══════════════════════════════════════════════════════════════════════════════
// LEDGER 2 — Character State Timeline
// Who they are at each time, place, psychological state.
// Indexed by chunk range — one entry per significant state change.
// ══════════════════════════════════════════════════════════════════════════════

export interface CharacterStateSnapshot {
  characterId: string;
  chunkRange: [number, number];                 // [fromChunk, toChunk]
  chapterRange: string;                         // "Chapter 4–7"
  nameUsed: string;                             // valid name for this range
  ageOrLifeStage: string | null;
  location: string | null;
  country: string | null;
  jobOrRole: string | null;
  legalStatus: string | null;                   // "captive" | "free" | "documented" | etc.
  healthState: string | null;
  psychologicalState: string | null;
  mobilityStatus: string | null;                // "captive" | "free movement" | "escorted" | etc.
  knowledgeState: string[];                     // what does this character know at this point?
  evidenceQuote: string;
  confidence: EvidenceConfidence;
}

// ══════════════════════════════════════════════════════════════════════════════
// LEDGER 3 — Relationship Ledger
// Who has met whom, when, where, and how the relationship evolves.
// This is the primary co-presence blocker.
// ══════════════════════════════════════════════════════════════════════════════

export interface RelationshipLedgerEntry {
  characterA: string;
  characterB: string;
  firstCoPresenceChunk: number;
  firstCoPresenceChapter: string;              // "Chapter 72" — the gate value
  invalidBeforeChapter: string;               // canonical blocker label
  firstSharedLocation: string | null;
  relationshipTypeStart: RelationshipType;
  relationshipTypeEnd: RelationshipType;
  powerDynamicTimeline: Array<{
    chunkRange: [number, number];
    dynamic: PowerDynamic;
    note?: string;
  }>;
  pivotMoments: Array<{
    chunkIndex: number;
    chapterRef: string;
    description: string;
    evidenceQuote: string;
  }>;
  sharedObjects: string[];                    // object IDs from Object Ledger
  sharedActivities: string[];                 // e.g. "ping-pong", "ball lessons"
  unresolvedLedger: string[];                 // promises/obligations still open at end
  recommendationBlocker: RecommendationBlocker; // the enforcement rule
}

// ══════════════════════════════════════════════════════════════════════════════
// LEDGER 4 — Psychology / Coping Ledger
// What rituals, habits, and coping behaviors each character has.
// THE primary blocker for "seed a ritual" recommendations.
// ══════════════════════════════════════════════════════════════════════════════

export interface CopingMechanismEntry {
  description: string;                         // "lines up pencils before answering"
  firstAppearsChunk: number;
  firstAppearsChapter: string;
  recurrenceChunks: number[];
  frequency: "rare" | "recurring" | "dominant";
  triggeredBy: string | null;                  // e.g. "stress", "confrontation"
  manifestsAs: string;                         // behavioral description
  psychologicalFunction: string;               // "maintains illusion of control"
  evidenceQuote: string;
  confidence: EvidenceConfidence;
}

export interface PsychologyLedgerEntry {
  characterId: string;
  coreFear?: EvidenceBackedField;
  coreDesire?: EvidenceBackedField;
  copingMechanisms: CopingMechanismEntry[];
  psychologicalArc: string;                    // one-phrase arc summary
  // Enforcement: if copingMechanisms.length > 0, "seed" recs are blocked
  seedingBlocked: boolean;                     // true when copingMechanisms.length > 0
  seedingBlockMessage: string;                 // injected into prompt as Gate 4 text
}

// ══════════════════════════════════════════════════════════════════════════════
// LEDGER 5 — Object / Symbol Attachment Ledger
// Where every significant object lives, who has it, and what it means.
// Evil eye, cell phone, crates, water, ping-pong, wood marks all live here.
// ══════════════════════════════════════════════════════════════════════════════

export interface ObjectTransferEvent {
  fromCharacter: string | null;               // null = introduced without owner
  toCharacter: string;
  chunkIndex: number;
  chapterRef: string;
  context: string;                            // "Raúl takes it from Michael"
  evidenceQuote: string;
  confidence: EvidenceConfidence;
}

export interface ObjectSymbolicStageEntry {
  stage: ObjectSymbolicStage;
  chunkRange: [number, number];
  chapterRange: string;
  function: string;
  evidenceQuote: string;
}

export interface ObjectLedgerEntry {
  objectId: string;                           // stable ID e.g. "evil_eye_keychain"
  objectName: string;                         // display name
  attachedCharacters: string[];               // all characters who hold/relate to it
  currentHolder: string | null;               // at last_chunk
  firstAppearanceChunk: number;
  firstAppearanceChapter: string;
  lastAppearanceChunk: number;
  ownershipPath: string[];                    // e.g. ["Michael", "Raúl", "Raúl's son"]
  transferEvents: ObjectTransferEvent[];
  symbolicFunctionByStage: ObjectSymbolicStageEntry[];
  payoffChunk: number | null;
  payoffChapter: string | null;
  payoffDescription: string | null;
  missedIfAbsentFromReport: boolean;          // true for high-value symbols
  status: "resolved" | "active" | "dropped" | "intentionally_unresolved";
  recommendationBlockers: RecommendationBlocker[];
}

// ══════════════════════════════════════════════════════════════════════════════
// LEDGER 6 — Terminal / Legacy Ledger
// Characters who age, die, disappear, or leave the story.
// Enables Narrative Closure to evaluate death and unresolved consequence.
// ══════════════════════════════════════════════════════════════════════════════

export interface TerminalLedgerEntry {
  characterId: string;
  terminalCondition: "death" | "departure" | "disappearance" | "transformation" | "open" | "unresolved";
  terminalChunk: number | null;
  terminalChapter: string | null;
  lastLucidChunk: number | null;
  whoIsPresent: string[];                     // characters present at terminal moment
  finalBeliefState: string | null;            // what does the character believe at end?
  promisesKept: string[];
  promisesUnkept: string[];
  objectsPresentAtExit: string[];             // object IDs
  legacyTransferredTo: string | null;         // who inherits their role/objects/arc
  finalRelationshipStates: Array<{
    withCharacter: string;
    state: string;
    evidenceQuote: string;
  }>;
  narrativeClosureStatus: "fully_resolved" | "partially_resolved" | "intentionally_open" | "underpaid";
  evidenceQuote: string;
  confidence: EvidenceConfidence;
}

// ══════════════════════════════════════════════════════════════════════════════
// MASTER CHARACTER LEDGER v2
// All six ledgers assembled into one envelope passed to Pass 3.
// ══════════════════════════════════════════════════════════════════════════════

export interface CharacterLedgerV2 {
  schema_version: "character_ledger_v2";
  prompt_version: string;
  job_id: string;
  generated_at: string;
  total_chunks_processed: number;

  // Six ledgers
  identityLedger: CharacterIdentityLedgerEntry[];
  stateTimelines: CharacterStateSnapshot[];   // all snapshots, all characters
  relationshipLedger: RelationshipLedgerEntry[];
  psychologyLedger: PsychologyLedgerEntry[];
  objectLedger: ObjectLedgerEntry[];
  terminalLedger: TerminalLedgerEntry[];

  // Validation query interface (populated at reduce time, used by Pass 3 prompt)
  validationQueries: {
    // isCharacterPresent(characterId, chunkIndex) → boolean
    characterPresenceIndex: Record<string, number[]>;  // characterId → [chunk indices]
    // haveCharactersMet(charA, charB, targetChunk) → boolean if firstCoPresenceChunk ≤ targetChunk
    coPresenceIndex: Record<string, Record<string, number>>;  // charA → charB → firstSharedChunk
    // isNameValidAtChunk(characterId, name, chunkIndex) → boolean
    nameStateIndex: Record<string, Array<{ name: string; validFromChunk: number; validUntilChunk: number | null }>>;
    // doesCopingMechanismExist(characterId) → boolean + list
    copingIndex: Record<string, string[]>;             // characterId → coping descriptions
    // isObjectAtLocation - object chunk range
    objectPresenceIndex: Record<string, [number, number]>; // objectId → [first, last] chunk
    // hasSymbolPaidOff(objectId) → boolean
    symbolPayoffIndex: Record<string, boolean>;
    // whatPromisesRemainUnkept(characterId) → string[]
    unresolvedPromisesIndex: Record<string, string[]>;
  };

  // Global recommendation blockers — injected verbatim into Pass 3 prompt
  activeBlockers: RecommendationBlocker[];

  // Integrity summary
  coverage_summary: {
    protagonists: string[];
    co_protagonists: string[];
    antagonists: string[];
    high_value_objects: string[];             // objectIds where missedIfAbsentFromReport=true
    unresolved_promises: string[];
    open_terminal_ledgers: string[];
    hard_fail_triggers: string[];
  };
}
