/**
 * Phase 2.7 — Orchestrator: runPipeline
 *
 * Coordinates Pass 1 → Pass 2 → Pass 3 → Pass 4 (Quality Gate).
 * Also provides synthesisToEvaluationResult() adapter to preserve
 * downstream compatibility with EvaluationResultV1.
 *
 * Pipeline invariants (spec §7):
 *   1. Pass 2 NEVER receives Pass 1 output (independence guarantee)
 *   2. Quality gate is deterministic code, not AI
 *   3. Fails closed — any pass failure → job FAILED, no artifact persisted
 *   4. All 13 criteria must appear in output
 *   5. Scores are integers 0-10
 */

import { runPass1 as defaultRunPass1 } from "./runPass1";
import { runPass2 as defaultRunPass2 } from "./runPass2";
import { runPass3Synthesis as defaultRunPass3 } from "./runPass3Synthesis";
import { recordProviderTelemetry, ProviderTelemetryEntry } from "./providerTelemetry";
import { enforcePass2LexicalIndependence, PASS2_INDEPENDENCE_FAIL_THRESHOLD } from "./pass2IndependenceGuard";
// runPass3bLongform runtime import removed — now called from /api/workers/process-dream (issue #543)
import type { LongformDreamDocument } from "./runPass3bLongform";
// Pass 4 cross-check call retired (feat/dual-model-parallel-scoring).
// CrossCheckOutput is kept as a type-only import because PipelineResult and
// the synthesis adapters still reference it for back-compat; the runtime
// runPerplexityCrossCheck function is no longer called.
import type { CrossCheckOutput } from "./perplexityCrossCheck";
import { runPerplexityChunkScorer } from "./perplexityChunkScorer";
// evaluatePass4Governance is no longer invoked but its GovernanceDecision
// type is still exposed on PipelineResult for back-compat.
import {
  runQualityGate as defaultRunQualityGate,
  summarizeQualityGateFailures,
} from "./qualityGate";
import { buildScoreLedger } from "./buildScoreLedger";
import { buildExcellenceFilter } from "./buildExcellenceFilter";
import { buildAdvisoryPlan } from "./buildAdvisoryPlan";
import { computeCriterionConfidence } from "./criterionConfidence";
import type {
  PipelineResult,
  SinglePassOutput,
  SynthesisOutput,
  QualityGateResult,
  ManuscriptChunkEvidence,
  QualityGateCriterionDiagnostic,
  GateDiagnostics,
  CoverageStrategy,
} from "./types";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { detectModeFromManuscript } from "@/lib/evaluation/modeDetection";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS1_PROMPT_VERSION } from "./prompts/pass1-craft";
import { PASS2_PROMPT_VERSION } from "./prompts/pass2-editorial";
import { PASS3_PROMPT_VERSION } from "./prompts/pass3-synthesis";
import { buildCompactPreflightSummary } from "./runPass3Preflight";
import { buildLedgerBlockForPrompt } from "./buildLedgerBlock";
import type { Pass3PreflightDraft } from "./types";
import {
  normalizeCriterion,
  computeWeightedScore,
  type CriteriaPlanMap,
} from "@/lib/evaluation/signal/criterionObservability";
import {
  classifySubmissionScope,
  countWords,
  type SubmissionScopeProfile,
} from "./submissionScope";
import { summarizePromptCoverage, getDefaultPassInputCharBudget } from "./promptInput";
import { getEvalPassTimeoutMs } from "@/lib/evaluation/config";
import {
  buildCriteriaPlanForScale,
  scopePolicy,
} from "@/lib/evaluation/signal/scopePolicy";
import {
  buildCoverageLimitedSummary,
  computeManuscriptCertification,
  downgradeCriterionForUncertifiedLongForm,
  criterionClaimScope,
} from "@/lib/evaluation/signal/manuscriptClaimPolicy";
import type { RunPass1Options } from "./runPass1";
import type { RunPass2Options } from "./runPass2";
import type { RunPass3Options } from "./runPass3Synthesis";
import type { RunPass3bOptions } from "./runPass3bLongform";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  loadGovernanceInjectionMap,
  getGovernanceCheckpointById,
  getLlrCheckpointForStage,
} from "@/lib/governance/injectionMap";
import type { GovernanceCheckpoint, GovernanceInjectionMap } from "@/lib/governance/injectionMap";
import {
  evaluateLessonsLearnedRules as defaultEvaluateLessonsLearnedRules,
  deriveLessonsLearnedEnforcementDecision as defaultDeriveLessonsLearnedEnforcementDecision,
} from "@/lib/governance/lessonsLearned";
import {
  emitLatencyTrace,
  finishLatencyStage,
  startLatencyStage,
} from "@/lib/observability/latencyTrace";
import { JsonBoundaryError } from "@/lib/llm/jsonParseBoundary";
import { buildPass2aStructuredContext } from "./buildPass2aStructuredContext";
import { runPass1a } from "./runPass1a";
import type { RunPass1aResult } from "./runPass1a";
import { reduceCharacterEvidence, buildCharacterLedgerV2 } from "./characterReducer";
import type { Pass1aCharacterLedger, CharacterLedgerV2 } from "./types";
import {
  normalizeSummaryWithBottomWeaknesses,
  summarizePropagationIntegrity,
} from "./propagationIntegrity";
import {
  getCanonicalPass1Model,
  getCanonicalPass2Model,
  getCanonicalPass3Model,
  getCanonicalPass3FallbackModel,
  getExternalAdjudicationMode,
} from "@/lib/evaluation/policy";
import type { PipelineResultRouting, ExternalAdjudicationStatus, ExternalAdjudicationMode } from "./types";
import {
  ChunkRoutingNotEngagedError,
  ManuscriptExceedsHardCeilingError,
} from "./failures";
import { getConfiguredChunkCap } from "./chunkCap";

// Below this word count we evaluate as a single structural unit (one chunk).
// Above this, the chunked path MUST engage — see runPipeline guard below.
const STRUCTURAL_CHUNKING_THRESHOLD_WORDS = 3_000;

// Hard manuscript ceiling for defense-in-depth. Primary check is at job intake
// in processEvaluationJob; this catches programmatic callers exercising
// runPipeline directly (stress harness, future map-reduce callers).
const HARD_MANUSCRIPT_CEILING_WORDS = 300_000;
import type {
  RuleEvaluationInput,
  RuleStage,
  LessonsLearnedReport,
  EnforcementDecision,
} from "@/lib/governance/lessonsLearned";
import type { GovernanceDecision } from "@/lib/evaluation/governance/evaluatePass4Governance";

// Pass 4 governance result type — derived from evaluatePass4Governance return
type Pass4GovernanceResult = GovernanceDecision;

// Feature flag: enable submission scope governance (default: false)
const ENABLE_SCOPE = process.env.EVAL_SCOPE_PROFILE_ENABLED === "true";

export interface RunPipelineOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  workType: string;
  title: string;
  jobId?: string;
  onHeartbeat?: (stage: string) => Promise<void> | void;
  model?: string;
  openaiApiKey?: string;
  /** Optional: Perplexity API key. When provided, enables Pass 4 cross-check via sonar-reasoning-pro. */
  perplexityApiKey?: string;
  /** Per-pass timeout. Defaults to 60s. */
  _passTimeoutMs?: number;
  /** Per-pass provider timeout override forwarded to pass runners. */
  _openAiTimeoutMs?: number;
  /** Maximum accepted manuscript size. Defaults to 1,000,000 chars. */
  _maxManuscriptChars?: number;
  /**
   * Dependency injection for runner functions (testing only).
   * Production callers omit this entirely.
   */
  _runners?: {
    runPass1?: (opts: RunPass1Options) => Promise<SinglePassOutput>;
    runPass2?: (opts: RunPass2Options) => Promise<SinglePassOutput>;
    runPass3Synthesis?: (opts: RunPass3Options) => Promise<SynthesisOutput>;
    runQualityGate?: (
      synthesis: SynthesisOutput,
      pass1: SinglePassOutput,
      pass2: SinglePassOutput,
      manuscriptText?: string,
    ) => QualityGateResult;
    /** Injected for testing — overrides the real runPass3bLongform call. */
    runPass3bLongform?: (opts: RunPass3bOptions) => Promise<LongformDreamDocument>;
    /** Injected for testing — overrides the real runPass1a (character ledger) call. */
    runPass1a?: (opts: Parameters<typeof runPass1a>[0]) => Promise<RunPass1aResult>;
  };
  /** Dependency injection for registry loader (testing only). */
  _registryLoader?: () => CanonRegistry;
  /** Dependency injection for governance injection map loader (testing only). */
  _governanceInjectionMapLoader?: () => GovernanceInjectionMap;
  manuscriptId?: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  /** Dependency injection for lessons-learned engine (testing only). */
  _lessonsLearned?: {
    evaluateRules?: (input: RuleEvaluationInput, stage?: RuleStage) => LessonsLearnedReport;
    deriveDecision?: (report: LessonsLearnedReport, stage?: RuleStage) => EnforcementDecision;
  };
  /** Computed submission scope profile (optionally injected for testing). */
  _scopeProfile?: SubmissionScopeProfile;
  /**
   * Called immediately after the Pass 1A character ledger (V1 + V2) is built,
   * before Pass 3 runs. Fires non-blocking — pipeline never waits on this.
   * Use this to persist the ledger artifact independently of Pass 1/2/3 outcome.
   * Errors are swallowed; never throws.
   */
  _onLedgerReady?: (ledger: Pass1aCharacterLedger, ledgerV2: CharacterLedgerV2) => Promise<void> | void;
  /**
   * Pre-built character ledger from phase_1a invocation.
   * When provided, runPipeline skips Pass 1A entirely and uses this ledger directly.
   * This is the multi-phase workflow path: phase_1a built the ledger in its own
   * Vercel invocation; phase_2 injects it here so Pass 3 has full character grounding.
   * When absent (phase_2 path without ledger), Pass 1+2 run without ledger grounding.
   */
  _prebuiltCharacterLedger?: {
    ledger: Pass1aCharacterLedger;
    ledgerV2: CharacterLedgerV2;
  };
  /**
   * Pre-built Pass 3A preflight draft from phase_1a invocation.
   * When provided, runPipeline builds a compact summary and injects it into Pass 3B.
   * When absent, Pass 3B receives a PREFLIGHT UNAVAILABLE notice and synthesizes
   * from Pass 1 + Pass 2 only.
   */
  _prebuiltPreflightDraft?: Pass3PreflightDraft;
  /**
   * Author corrections block built from accepted_story_ledger_v1.governance_rail.
   * When present, injected into Pass 2 (and Pass 3B if applicable) as MANDATORY
   * author input that takes precedence over AI extraction.
   */
  _authorCorrectionsBlock?: string | null;
}

const DEFAULT_MAX_MANUSCRIPT_CHARS = 3_000_000;

// Per-chunk char ceiling for the Pass 1 prompt window. Mirrors the 95% factor
// used by the upstream chunker post-condition in lib/evaluation/processor.ts
// (added in PR #471). Same invariant, enforced at the runPipeline boundary so
// callers that bypass processEvaluationJob (stress harness, future map-reduce
// callers) cannot smuggle oversized chunks past Pass 1 dispatch.
const CHUNK_BUDGET_RATIO = 0.95;

// Minimum viable Pass 1 input. A single-token chunk is structurally garbage:
// no prose context, no scene, no anchor — the LLM will hallucinate a healthy
// response off of nothing. 32 chars ≈ ~6 words, the smallest unit that can
// carry meaningful prose (one short sentence). Below this floor we fail
// closed instead of feeding the runner uninterpretable input.
const MIN_VIABLE_CHUNK_CHARS = 32;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function nowMs(): number {
  return Date.now();
}

/**
 * Type guard / extractor for the per_criterion_diagnostic payload in a quality gate check's
 * diagnostics field. Returns the typed array when present, otherwise undefined.
 */
function extractPerCriterionDiagnostic(
  diagnostics: unknown
): QualityGateCriterionDiagnostic[] | undefined {
  if (
    diagnostics === null ||
    typeof diagnostics !== "object"
  ) {
    return undefined;
  }
  const d = diagnostics as Record<string, unknown>;
  if (Array.isArray(d.per_criterion_diagnostic)) {
    return d.per_criterion_diagnostic as QualityGateCriterionDiagnostic[];
  }
  return undefined;
}

type PipelineTimings = {
  total_ms?: number;
  pass1_ms?: number;
  pass2_ms?: number;
  pass3_ms?: number;
  pass4_ms?: number;
};

type GovernanceConfidenceDerivation = {
  confidence: number;
  confidenceLabel: "high" | "medium" | "low" | "withheld";
  confidenceReasons: string[];
};

type Pass2aCoverageAuthority = {
  authority: "pass2a";
  chunkRouted: boolean;
  fullCoverage: boolean;
  partialCoverage: boolean;
  technicalDefect: boolean;
  reasonCodes: string[];
  sourceChars: number;
  sourceWords: number;
  analyzedChars: number;
  analyzedWords: number;
  strategy: CoverageStrategy;
  expectedChunks: number | null;
  materializedChunks: number | null;
  pass1EvaluatedChunks: number | null;
  pass2EvaluatedChunks: number | null;
  collationSucceeded: boolean;
};

const MANUSCRIPT_CHUNK_COVERAGE_MIN_RATIO = 0.99;

function buildChunkCoverageFailure(
  coverage: Pass2aCoverageAuthority,
): {
  message: string;
  details: {
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
} | null {
  if (!coverage.chunkRouted) {
    return null;
  }

  const expectedChunks = coverage.expectedChunks ?? 0;
  const pass1Processed = coverage.pass1EvaluatedChunks ?? 0;
  const pass2Processed = coverage.pass2EvaluatedChunks ?? 0;
  const effectiveProcessed = Math.min(pass1Processed, pass2Processed);

  const wordsSubmitted = Math.max(coverage.sourceWords, 0);
  const wordsAnalyzed = Math.max(coverage.analyzedWords, 0);
  const analyzedRatio = wordsSubmitted > 0 ? wordsAnalyzed / wordsSubmitted : 1;

  const chunkMismatch = effectiveProcessed !== expectedChunks;
  const coverageDeficit = analyzedRatio < MANUSCRIPT_CHUNK_COVERAGE_MIN_RATIO;

  if (!chunkMismatch && !coverageDeficit) {
    return null;
  }

  const details = {
    reason_codes: Array.from(
      new Set([
        ...coverage.reasonCodes,
        ...(chunkMismatch ? ["CHUNK_COUNT_MISMATCH"] : []),
        ...(coverageDeficit ? ["WORD_COVERAGE_BELOW_MIN"] : []),
      ]),
    ),
    chunk_coverage: {
      chunks_expected: expectedChunks,
      chunks_processed_pass1: pass1Processed,
      chunks_processed_pass2: pass2Processed,
      chunks_processed_effective: effectiveProcessed,
    },
    word_coverage: {
      words_submitted: wordsSubmitted,
      words_analyzed: wordsAnalyzed,
      analyzed_ratio: Number(analyzedRatio.toFixed(6)),
      threshold_ratio: MANUSCRIPT_CHUNK_COVERAGE_MIN_RATIO,
    },
  };

  return {
    message:
      `Manuscript chunk coverage incomplete: processed ${effectiveProcessed}/${expectedChunks} chunks ` +
      `with analyzed ratio ${details.word_coverage.analyzed_ratio} (< ${MANUSCRIPT_CHUNK_COVERAGE_MIN_RATIO}).`,
    details,
  };
}

function derivePass2aCoverageAuthority(args: {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  pass1: SinglePassOutput;
  pass2: SinglePassOutput;
}): Pass2aCoverageAuthority {
  const sourceChars = args.manuscriptText.length;
  const sourceWords = countWords(args.manuscriptText);
  const chunkCount = Array.isArray(args.manuscriptChunks) ? args.manuscriptChunks.length : 0;
  const chunkRouted = chunkCount > 1;

  const collationSucceeded =
    args.pass1.criteria.length === CRITERIA_KEYS.length &&
    args.pass2.criteria.length === CRITERIA_KEYS.length;

  if (!chunkRouted) {
    const promptCoverage = summarizePromptCoverage(args.manuscriptText);
    const pass1WindowFull = args.pass1.coverage_summary?.fully_evaluated ?? !promptCoverage.truncated;
    const pass2WindowFull = args.pass2.coverage_summary?.fully_evaluated ?? !promptCoverage.truncated;
    const fullCoverage = !promptCoverage.truncated && pass1WindowFull && pass2WindowFull && collationSucceeded;
    const reasonCodes: string[] = [];

    if (promptCoverage.truncated) {
      reasonCodes.push("PROMPT_WINDOW_TRUNCATED");
    }
    if (!pass1WindowFull) {
      reasonCodes.push("PASS1_DIRECT_WINDOW_INCOMPLETE");
    }
    if (!pass2WindowFull) {
      reasonCodes.push("PASS2_DIRECT_WINDOW_INCOMPLETE");
    }
    if (!collationSucceeded) {
      reasonCodes.push("PASS2A_COLLATION_FAILED");
    }

    return {
      authority: "pass2a",
      chunkRouted,
      fullCoverage,
      partialCoverage: !fullCoverage,
      technicalDefect: false,
      reasonCodes,
      sourceChars,
      sourceWords,
      analyzedChars: fullCoverage ? sourceChars : promptCoverage.analyzedChars,
      analyzedWords: fullCoverage ? sourceWords : promptCoverage.analyzedWords,
      strategy: fullCoverage ? "full_text" : "sampled_beginning_middle_end",
      expectedChunks: null,
      materializedChunks: null,
      pass1EvaluatedChunks: null,
      pass2EvaluatedChunks: null,
      collationSucceeded,
    };
  }

  const expectedChunks = chunkCount;
  const materializedChunks = chunkCount;

  const pass1Ledger = args.pass1.coverage_summary?.chunk_ledger;
  const pass2Ledger = args.pass2.coverage_summary?.chunk_ledger;

  const pass1EvaluatedChunks = pass1Ledger?.evaluated_chunks ?? null;
  const pass2EvaluatedChunks = pass2Ledger?.evaluated_chunks ?? null;

  const pass1ChunkMode = args.pass1.coverage_summary?.route === "chunk_map_reduce";
  const pass2ChunkMode = args.pass2.coverage_summary?.route === "chunk_map_reduce";

  const chunkCap = getConfiguredChunkCap();
  const capApplied =
    Boolean(pass1Ledger?.cap_applied) ||
    Boolean(pass2Ledger?.cap_applied) ||
    expectedChunks > chunkCap;

  const pass1AllChunks = pass1ChunkMode && pass1EvaluatedChunks === expectedChunks;
  const pass2AllChunks = pass2ChunkMode && pass2EvaluatedChunks === expectedChunks;
  const fullCoverage = pass1AllChunks && pass2AllChunks && !capApplied && collationSucceeded;

  const reasonCodes: string[] = [];
  if (!pass1ChunkMode) reasonCodes.push("PASS1_NOT_CHUNK_ROUTED");
  if (!pass2ChunkMode) reasonCodes.push("PASS2_NOT_CHUNK_ROUTED");
  if (capApplied) reasonCodes.push("CHUNK_CAP_APPLIED");
  if (!pass1AllChunks) reasonCodes.push("PASS1_CHUNK_EVALUATION_INCOMPLETE");
  if (!pass2AllChunks) reasonCodes.push("PASS2_CHUNK_EVALUATION_INCOMPLETE");
  if (!collationSucceeded) reasonCodes.push("PASS2A_COLLATION_FAILED");

  const evaluatedFloor = Math.max(
    0,
    Math.min(
      expectedChunks,
      pass1EvaluatedChunks ?? expectedChunks,
      pass2EvaluatedChunks ?? expectedChunks,
    ),
  );
  const evaluatedRatio = expectedChunks > 0 ? evaluatedFloor / expectedChunks : 0;

  return {
    authority: "pass2a",
    chunkRouted,
    fullCoverage,
    partialCoverage: !fullCoverage,
    technicalDefect: !fullCoverage && reasonCodes.some((code) => code.includes("COLLATION") || code.includes("NOT_CHUNK")),
    reasonCodes,
    sourceChars,
    sourceWords,
    analyzedChars: fullCoverage ? sourceChars : Math.floor(sourceChars * evaluatedRatio),
    analyzedWords: fullCoverage ? sourceWords : Math.floor(sourceWords * evaluatedRatio),
    strategy: fullCoverage ? "full_chunk_map_reduce" : "partial_chunk_map_reduce",
    expectedChunks,
    materializedChunks,
    pass1EvaluatedChunks,
    pass2EvaluatedChunks,
    collationSucceeded,
  };
}

function logPipelineTimings(
  stage: "success" | "failure",
  meta: {
    manuscriptId?: string;
    title: string;
    workType: string;
    failedAt?: "pass1" | "pass2" | "pass3" | "pass4";
    errorCode?: string;
    timings: PipelineTimings;
  },
): void {
  console.log("[Pipeline][Timings]", {
    stage,
    manuscript_id: meta.manuscriptId ?? null,
    title: meta.title,
    work_type: meta.workType,
    failed_at: meta.failedAt ?? null,
    error_code: meta.errorCode ?? null,
    ...meta.timings,
  });
}

function hasTextualAnchorSignal(criterion: EvaluationResultV2["criteria"][number]): boolean {
  if (/["“”][^"“”]{8,}["“”]/.test(criterion.rationale ?? "")) {
    return true;
  }

  return criterion.evidence.some((anchor) => {
    const snippet = (anchor.snippet ?? "").trim();
    if (/["“”][^"“”]{8,}["“”]/.test(snippet)) {
      return true;
    }

    return snippet.length >= 20;
  });
}

function enforceTextualAnchorConfidence(
  criterion: EvaluationResultV2["criteria"][number],
): EvaluationResultV2["criteria"][number] {
  if (hasTextualAnchorSignal(criterion)) {
    return criterion;
  }

  const existingReasons = Array.isArray(criterion.confidence_reasons)
    ? criterion.confidence_reasons
    : [];

  return {
    ...criterion,
    confidence_band: "LOW",
    confidence_level: "low",
    confidence_score_0_100: Math.min(criterion.confidence_score_0_100 ?? 100, 45),
    confidence_reasons: Array.from(new Set([...existingReasons, "NO_TEXTUAL_ANCHOR"])),
    scorability_status:
      criterion.scorability_status === "non_scorable"
        ? "non_scorable"
        : "scorable_low_confidence",
  };
}

function deriveGovernanceConfidenceFromCriteria(
  criteria: EvaluationResultV2["criteria"],
  propagation: ReturnType<typeof summarizePropagationIntegrity>,
): GovernanceConfidenceDerivation {
  const low = criteria.filter((c) => c.confidence_level === "low").length;
  const moderate = criteria.filter((c) => c.confidence_level === "moderate").length;
  const missing = criteria.filter((c) => c.evidence.length === 0).length;
  const weak = criteria.filter((c) => c.status === "SCORABLE" && c.evidence.length < 2).length;

  let confidenceLabel: GovernanceConfidenceDerivation["confidenceLabel"] = "high";
  if (propagation.upstreamIntegrity === "weak" || low >= 5 || missing >= 4) {
    confidenceLabel = "low";
  } else if (
    propagation.upstreamIntegrity === "mixed" ||
    low >= 3 ||
    moderate >= 4 ||
    weak >= 4
  ) {
    confidenceLabel = "medium";
  }

  const confidence =
    confidenceLabel === "high" ? 0.9 : confidenceLabel === "medium" ? 0.7 : 0.55;

  const confidenceReasons = [
    ...propagation.reasons,
    `low=${low}`,
    `moderate=${moderate}`,
    `missing=${missing}`,
    `weak=${weak}`,
  ];

  return {
    confidence,
    confidenceLabel,
    confidenceReasons,
  };
}

type ChunkGuardFailure = {
  error: string;
  error_code: "CHUNK_BUDGET_OVERFLOW" | "PIPELINE_INPUT_INVALID";
};

/**
 * Structural invariants on pre-materialized chunks reaching runPipeline.
 *
 * Strengthens the chunker post-condition added in PR #471 so it also catches
 * chunks that arrive via opts.manuscriptChunks (i.e. without flowing through
 * processEvaluationJob's chunker call). Without this guard, callers that
 * inject pre-built chunks — the stress harness, future map-reduce callers,
 * any caller exercising runPipeline directly — can push oversized or
 * trivially-small chunks straight into Pass 1.
 *
 * Two structural checks, both unconditional (no env toggle, no feature flag):
 *   - upper bound: chunk.content.length must fit Pass 1's prompt window.
 *   - lower bound: chunk.content.trim().length must clear MIN_VIABLE_CHUNK_CHARS.
 *
 * Idempotent: safe to call multiple times on the same input.
 */
function validateManuscriptChunks(
  chunks: ManuscriptChunkEvidence[],
): ChunkGuardFailure | null {
  if (chunks.length === 0) return null;
  const charBudget = getDefaultPassInputCharBudget();
  const budgetCeiling = Math.floor(charBudget * CHUNK_BUDGET_RATIO);

  for (const chunk of chunks) {
    const trimmedLen = chunk.content.trim().length;
    if (trimmedLen < MIN_VIABLE_CHUNK_CHARS) {
      return {
        error:
          `Pipeline input invalid: chunk ${chunk.chunk_index} has ` +
          `trimmed_char_count=${trimmedLen} below MIN_VIABLE_CHUNK_CHARS=${MIN_VIABLE_CHUNK_CHARS}. ` +
          `Undersized chunks cannot produce a faithful Pass 1 evaluation — failing closed before dispatch.`,
        error_code: "PIPELINE_INPUT_INVALID",
      };
    }

    const rawLen = chunk.content.length;
    if (rawLen > budgetCeiling) {
      const ratio = charBudget > 0 ? rawLen / charBudget : 0;
      return {
        error:
          `Chunker post-condition violated: chunk ${chunk.chunk_index} has ` +
          `char_count=${rawLen} which exceeds 95% of inputCharBudget (${charBudget}, ` +
          `ratio=${ratio.toFixed(3)}). Pass 1 cannot complete within the prompt window — ` +
          `failing closed before dispatch.`,
        error_code: "CHUNK_BUDGET_OVERFLOW",
      };
    }
  }
  return null;
}

function validatePipelineInput(opts: RunPipelineOptions): string | null {
  const manuscriptText = opts.manuscriptText?.trim();
  const workType = opts.workType?.trim();
  const title = opts.title?.trim();
  const maxChars = opts._maxManuscriptChars ?? DEFAULT_MAX_MANUSCRIPT_CHARS;

  if (!manuscriptText) return "manuscriptText is required";
  if (!workType) return "workType is required";
  if (!title) return "title is required";
  if (!Number.isInteger(maxChars) || maxChars <= 0) return "_maxManuscriptChars must be a positive integer";
  if (manuscriptText.length > maxChars) {
    return `manuscriptText exceeds max length (${manuscriptText.length} > ${maxChars})`;
  }

  if (opts._passTimeoutMs !== undefined && (!Number.isInteger(opts._passTimeoutMs) || opts._passTimeoutMs <= 0)) {
    return "_passTimeoutMs must be a positive integer";
  }

  if (opts._openAiTimeoutMs !== undefined && (!Number.isInteger(opts._openAiTimeoutMs) || opts._openAiTimeoutMs <= 0)) {
    return "_openAiTimeoutMs must be a positive integer";
  }

  return null;
}

function normalizeRecommendationAction(action: string): string {
  return action.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeRecommendationsPreGate(synthesis: SynthesisOutput): {
  synthesis: SynthesisOutput;
  removedCount: number;
} {
  const seenActions = new Set<string>();
  let removedCount = 0;

  const criteria = synthesis.criteria.map((criterion) => {
    const recommendations = criterion.recommendations.filter((rec) => {
      const normalizedAction = normalizeRecommendationAction(rec.action);
      if (!normalizedAction) return true;
      if (seenActions.has(normalizedAction)) {
        removedCount += 1;
        return false;
      }
      seenActions.add(normalizedAction);
      return true;
    });

    return {
      ...criterion,
      recommendations,
    };
  });

  return {
    synthesis: {
      ...synthesis,
      criteria,
    },
    removedCount,
  };
}

/**
 * Run the full 4-pass evaluation pipeline.
 *
 * Returns PipelineResult — a discriminated union:
 *   { ok: true,  synthesis, quality_gate }
 *   { ok: false, error, error_code, failed_at }
 */
export async function runPipeline(opts: RunPipelineOptions): Promise<PipelineResult> {
  const inputValidationError = validatePipelineInput(opts);
  if (inputValidationError) {
    return {
      ok: false,
      error: `Pipeline input validation failed: ${inputValidationError}`,
      error_code: "PIPELINE_INPUT_INVALID",
      failed_at: "pass1",
    };
  }

  if (Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 0) {
    const chunkGuardFailure = validateManuscriptChunks(opts.manuscriptChunks);
    if (chunkGuardFailure) {
      return {
        ok: false,
        error: chunkGuardFailure.error,
        error_code: chunkGuardFailure.error_code,
        failed_at: "pass1",
      };
    }
  }

  // Hard manuscript ceiling — defense in depth. Primary check is at intake.
  const pipelineManuscriptWords = countWords(opts.manuscriptText);
  if (pipelineManuscriptWords > HARD_MANUSCRIPT_CEILING_WORDS) {
    const err = new ManuscriptExceedsHardCeilingError(
      `Manuscript exceeds evaluation capacity (${pipelineManuscriptWords} words > ${HARD_MANUSCRIPT_CEILING_WORDS}). ` +
      `Please split into volumes.`,
      {
        code: 'MANUSCRIPT_EXCEEDS_HARD_CEILING',
        manuscript_words: pipelineManuscriptWords,
        hard_ceiling_words: HARD_MANUSCRIPT_CEILING_WORDS,
      },
    );
    return {
      ok: false,
      error: err.message,
      error_code: err.code,
      failed_at: "pass1",
    };
  }

  // Fail-closed: above the structural chunking threshold, Pass 1 MUST receive
  // chunks. The silent fallback to `direct_window` is a bug class that has
  // caused 12-minute PASS1_TIMEOUT failures on long manuscripts. Refuse to
  // dispatch — surface a typed, diagnosable error to the caller instead.
  if (pipelineManuscriptWords >= STRUCTURAL_CHUNKING_THRESHOLD_WORDS) {
    const chunkCount = opts.manuscriptChunks?.length ?? 0;
    if (chunkCount <= 1) {
      const err = new ChunkRoutingNotEngagedError(
        `Manuscript has ${pipelineManuscriptWords} words (≥ ${STRUCTURAL_CHUNKING_THRESHOLD_WORDS}) but ` +
        `received ${chunkCount} chunk(s). Chunk-routed evaluation did not engage; ` +
        `refusing to fall back to direct_window which would silently timeout.`,
        {
          code: 'CHUNK_ROUTING_NOT_ENGAGED',
          manuscript_words: pipelineManuscriptWords,
          chunk_count: chunkCount,
          manuscript_chars: opts.manuscriptText.length,
        },
      );
      return {
        ok: false,
        error: err.message,
        error_code: err.code,
        failed_at: "pass1",
      };
    }
  }

  const passTimeoutMs = opts._passTimeoutMs ?? getEvalPassTimeoutMs();
  const pipelineStartMs = nowMs();
  const timings: PipelineTimings = {};
  const latencyJobId = String(opts.jobId ?? opts.manuscriptId ?? 'pipeline-only');

  // Resolve per-pass routing once at pipeline start for audit traceability.
  const pipelineRouting: PipelineResultRouting = {
    pass1Model: getCanonicalPass1Model(opts.model),
    pass2Model: getCanonicalPass2Model(opts.model),
    pass3Model: getCanonicalPass3Model(opts.model),
    pass3FallbackModel: getCanonicalPass3FallbackModel(opts.model),
  };

  const _runPass1 = opts._runners?.runPass1 ?? defaultRunPass1;
  const _runPass2 = opts._runners?.runPass2 ?? defaultRunPass2;
  const _runPass3 = opts._runners?.runPass3Synthesis ?? defaultRunPass3;
  const _runQualityGate = opts._runners?.runQualityGate ?? defaultRunQualityGate;
  const _runPass1a = opts._runners?.runPass1a ?? runPass1a;
  const _loadRegistry = opts._registryLoader ?? loadCanonicalRegistry;
  const _loadGovernanceInjectionMap = opts._governanceInjectionMapLoader ?? loadGovernanceInjectionMap;
  const _evaluateLessonsLearned = opts._lessonsLearned?.evaluateRules ?? defaultEvaluateLessonsLearnedRules;
  const _deriveLessonsLearnedDecision =
    opts._lessonsLearned?.deriveDecision ?? defaultDeriveLessonsLearnedEnforcementDecision;

  // ── Submission Scope Classification (Feature Flagged) ──────────────────
  // If ENABLE_SCOPE is true, compute scope profile once and thread through all passes.
  // This is the single source of truth for input scale, confidence caps, and criterion applicability.
  let scopeProfile: SubmissionScopeProfile | null = null;
  if (ENABLE_SCOPE) {
    try {
      scopeProfile = opts._scopeProfile ?? classifySubmissionScope(
        opts.manuscriptText,
        opts.manuscriptChunks?.length ?? 1,
      );

      if (!scopeProfile) {
        throw new Error("SCOPE_PROFILE_MISSING");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Scope classification failed: ${errorMsg}`,
        error_code: "SCOPE_CLASSIFICATION_FAILED",
        failed_at: "pass1",
      };
    }
  }

  let governanceInjectionMap: GovernanceInjectionMap;
  try {
    governanceInjectionMap = _loadGovernanceInjectionMap();
  } catch (err) {
    return {
      ok: false,
      error: `Governance injection map invalid: ${String(err instanceof Error ? err.message : err)}`,
      error_code: "GOVERNANCE_INJECTION_MAP_INVALID",
      failed_at: "pass1",
    };
  }

  const checkpointContext = (checkpoint: GovernanceCheckpoint): string => {
    return ` [checkpoint=${checkpoint.id} authority=${checkpoint.authority}]`;
  };

  const llrContextBase = {
    manuscript_id: opts.manuscriptId ?? `pipeline:${opts.title}`,
    execution_mode: opts.executionMode ?? "TRUSTED_PATH",
    metadata: {
      trace_id: `llr-${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  };

  const enforceLessonsLearnedStage = (
    stage: RuleStage,
    failedAt: "pass1" | "pass2" | "pass3" | "pass4",
    input: Omit<RuleEvaluationInput, "metadata" | "execution_mode" | "manuscript_id">,
  ): PipelineResult | null => {
    const report = _evaluateLessonsLearned(
      {
        ...llrContextBase,
        ...input,
      },
      stage,
    );
    const decision = _deriveLessonsLearnedDecision(report, stage);
    const checkpoint = getLlrCheckpointForStage(stage, governanceInjectionMap);

    if (decision.action === "BLOCK") {
      const blockedRuleIds = report.results
        .filter((r) => !r.passed && r.severity === "ERROR")
        .map((r) => r.rule_id);
      const failedRules = blockedRuleIds.join(", ");

      const llrDiagnosticSnapshot =
        (stage === "post_convergence" || stage === "pre_artifact_generation") &&
        typeof pass3Output !== "undefined"
          ? {
              stage,
              blocked_rule_ids: blockedRuleIds,
              convergence_result: pass3Output,
            }
          : undefined;

      return {
        ok: false,
        error: `Lessons-learned enforcement blocked at ${stage}: ${decision.reason}${failedRules ? ` (rules: ${failedRules})` : ""}${checkpointContext(checkpoint)}`,
        error_code: checkpoint.blockErrorCode ?? `LLR_${stage.toUpperCase()}_BLOCK`,
        failed_at: failedAt,
        ...(llrDiagnosticSnapshot
          ? {
              failure_details: {
                llr_diagnostic_snapshot: llrDiagnosticSnapshot,
              },
            }
          : {}),
      };
    }

    return null;
  };

  let registry: CanonRegistry;
  const registryBindingCheckpoint = getGovernanceCheckpointById("CANON_REGISTRY_BINDING", governanceInjectionMap);
  const canonGateCheckpoint = getGovernanceCheckpointById("CANON_GATE", governanceInjectionMap);
  try {
    registry = _loadRegistry();
  } catch (err) {
    return {
      ok: false,
      error: `Canonical registry binding failed: ${String(err instanceof Error ? err.message : err)}${checkpointContext(registryBindingCheckpoint)}`,
      error_code: registryBindingCheckpoint.blockErrorCode ?? "CANON_REGISTRY_BIND_FAILED",
      failed_at: "pass1",
    };
  }

  if (registry.size === 0) {
    return {
      ok: false,
      error: `Canonical registry binding failed: registry empty${checkpointContext(canonGateCheckpoint)}`,
      error_code: canonGateCheckpoint.blockErrorCode ?? "CANON_REGISTRY_EMPTY",
      failed_at: "pass1",
    };
  }

  let pass1Output: SinglePassOutput;
  let pass2Output: SinglePassOutput;
  let pass3Output: SynthesisOutput;
  // Provider call telemetry for Pass 1, 2, 3
  const providerTelemetry: ProviderTelemetryEntry[] = [];
  // Pass 4 state — owned exclusively by runPipeline(), passed explicitly to adapter
  let crossCheckResult: CrossCheckOutput | undefined;
  let pass4Governance: Pass4GovernanceResult | undefined;

  // ── Pass 1 + Pass 2: Parallel execution ────────────────────────────────
  //
  // INDEPENDENCE GUARANTEE
  // Pass 2 receives ONLY manuscript text (see _runPass2 signature — no Pass 1
  // parameter exists). It never reads or depends on Pass 1 output, making true
  // parallel execution safe by construction. Any future change that introduces
  // a data dependency between Pass 1 and Pass 2 MUST convert this back to
  // sequential await and update this comment.
  //
  // FAILURE PRECEDENCE RULE (binding)
  // We use Promise.allSettled (never Promise.all) so both passes always run to
  // completion regardless of the other's outcome.
  //   • Only Pass 1 fails  → return Pass 1 failure. Pass 2 result discarded.
  //   • Only Pass 2 fails  → return Pass 2 failure. Pass 1 result discarded.
  //   • Both fail          → Pass 1 failure is the canonical return value.
  //                          Pass 2 failure is logged at ERROR level for audit.
  //                          Both error_code values appear in the log.
  //   • Both succeed       → proceed to Pass 3 synthesis (sequential, by
  //                          design — Pass 3 requires both outputs).
  //
  // This precedence rule is deterministic and must not be changed without
  // updating both this comment and the audit log structure below.
  const pass1StartMs = nowMs();
  const pass2StartMs = nowMs();
  const pass1StartedAt = startLatencyStage({
    jobId: latencyJobId,
    stage: 'pass1',
    metadata: {
      model: opts.model ?? null,
      manuscript_length_bucket:
        opts.manuscriptText.length >= 200_000
          ? '200k+'
          : opts.manuscriptText.length >= 50_000
            ? '50k-199k'
            : 'lt50k',
    },
  });
  const pass2StartedAt = startLatencyStage({
    jobId: latencyJobId,
    stage: 'pass2',
    metadata: {
      model: opts.model ?? null,
      manuscript_length_bucket:
        opts.manuscriptText.length >= 200_000
          ? '200k+'
          : opts.manuscriptText.length >= 50_000
            ? '50k-199k'
            : 'lt50k',
    },
  });

  // Pass 1 and Pass 2 run in parallel with no outer withTimeout wrapper.
  // Each pass manages its own per-chunk 240s timeout + retry loop internally.
  // A blunt outer kill was causing PASS1_TIMEOUT / PASS2_TIMEOUT on jobs that
  // were making valid progress — just slow. The SLA watchdog in processor.ts
  // is the backstop if a pass truly hangs forever.

  // Build ledger grounding block for P1 + P2 injection (from phase_1a prebuilt ledger).
  // buildLedgerBlockForPrompt is fail-soft — returns "" when ledger is absent.
  const ledgerBlockForP1P2 = opts._prebuiltCharacterLedger
    ? buildLedgerBlockForPrompt(
        opts._prebuiltCharacterLedger.ledger,
        opts._prebuiltCharacterLedger.ledgerV2,
      )
    : "";

  // Build compact preflight summary for Pass 3B injection (from phase_1a prebuilt preflight).
  const compactPreflightSummary = opts._prebuiltPreflightDraft
    ? buildCompactPreflightSummary(opts._prebuiltPreflightDraft)
    : undefined;

  const pass1Promise = _runPass1({
      manuscriptText: opts.manuscriptText,
      manuscriptChunks: opts.manuscriptChunks,
      workType: opts.workType,
      title: opts.title,
      executionMode: opts.executionMode,
      openaiApiKey: opts.openaiApiKey,
      jobId: opts.jobId,
      openAiTimeoutMs: opts._openAiTimeoutMs,
      registry,
      scopeProfile: scopeProfile ?? undefined,
      // phase_2: 3 concurrent chunks (P1+P2 parallel, peak=6 total)
      _chunkConcurrency: opts._prebuiltCharacterLedger ? 3 : undefined,
      // Inject ledger grounding block from phase_1a when available
      characterLedgerBlock: ledgerBlockForP1P2 || undefined,
      _onCompletion: (capture) => {
        providerTelemetry.push(
          recordProviderTelemetry({
            capture,
            jobId: opts.jobId,
            provider: "openai",
            startedAt: pass1StartedAt,
          })
        );
      },
    })
    .then((value) => {
      timings.pass1_ms = nowMs() - pass1StartMs;
      finishLatencyStage({
        jobId: latencyJobId,
        stage: 'pass1',
        startedAt: pass1StartedAt,
        state: 'completed',
      });
      return value;
    })
    .catch((error) => {
      timings.pass1_ms = nowMs() - pass1StartMs;
      finishLatencyStage({
        jobId: latencyJobId,
        stage: 'pass1',
        startedAt: pass1StartedAt,
        state: 'failed',
        metadata: {
          finish_reason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    });

  const pass2Promise = _runPass2({
      manuscriptText: opts.manuscriptText,
      manuscriptChunks: opts.manuscriptChunks,
      workType: opts.workType,
      title: opts.title,
      executionMode: opts.executionMode,
      model: opts.model,
      openaiApiKey: opts.openaiApiKey,
      manuscriptId: opts.manuscriptId,
      jobId: opts.jobId,
      openAiTimeoutMs: opts._openAiTimeoutMs,
      registry,
      scopeProfile: scopeProfile ?? undefined,
      // phase_2: 3 concurrent chunks (P1+P2 parallel, peak=6 total)
      _chunkConcurrency: opts._prebuiltCharacterLedger ? 3 : undefined,
      // Inject ledger grounding block from phase_1a when available
      characterLedgerBlock: ledgerBlockForP1P2 || undefined,
      // Inject author corrections block from accepted_story_ledger_v1.governance_rail
      authorCorrectionsBlock: opts._authorCorrectionsBlock ?? undefined,
      _onCompletion: (capture) => {
        providerTelemetry.push(
          recordProviderTelemetry({
            capture,
            jobId: opts.jobId,
            provider: "openai",
            startedAt: pass2StartedAt,
          })
        );
      },
    })
    .then((value) => {
      timings.pass2_ms = nowMs() - pass2StartMs;
      finishLatencyStage({
        jobId: latencyJobId,
        stage: 'pass2',
        startedAt: pass2StartedAt,
        state: 'completed',
      });
      return value;
    })
    .catch((error) => {
      timings.pass2_ms = nowMs() - pass2StartMs;
      finishLatencyStage({
        jobId: latencyJobId,
        stage: 'pass2',
        startedAt: pass2StartedAt,
        state: 'failed',
        metadata: {
          finish_reason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    });

  // ── Pass 1A: Character Evidence Sweep ──────────────────────────────────────
  // Multi-phase workflow: Pass 1A runs in its own Vercel invocation (phase_1a)
  // with a fresh 720s execution window. The prebuilt ledger is injected via
  // opts._prebuiltCharacterLedger when called from the phase_2 resume path.
  //
  // Phase 2 path: _prebuiltCharacterLedger injected from phase_1a.
  // If absent (phase_2 without ledger), Pass 1A runs after Pass 1+2 to avoid
  // rate-limit collision (96 concurrent chunk calls starve Pass 1A).
  //
  // Pass 1A independence: receives ONLY manuscript text — never sees P1/P2 output.
  let pass1aSettled: PromiseSettledResult<RunPass1aResult>;

  // ── Perplexity chunk sweep (dual-model parallel scoring) ─────────────
  const pplxChunkSweepPromise = runPerplexityChunkScorer({
    manuscriptText: opts.manuscriptText,
    manuscriptChunks: opts.manuscriptChunks,
    workType: opts.workType,
    title: opts.title,
    perplexityApiKey: opts.perplexityApiKey,
    jobId: latencyJobId,
  });

  await opts.onHeartbeat?.("parallel_passes_started");

  // Pass 1 and Pass 2 run in parallel — independence is preserved.
  const [pass1Settled, pass2Settled] = await Promise.allSettled([pass1Promise, pass2Promise]);

  await opts.onHeartbeat?.("parallel_passes_settled");

  if (opts._prebuiltCharacterLedger) {
    // Phase_1a already ran in its own invocation — use the pre-built ledger directly.
    // Synthesize a fulfilled PromiseSettledResult from the prebuilt data.
    const prebuilt = opts._prebuiltCharacterLedger;
    // We need to reconstruct a RunPass1aResult from the prebuilt ledger.
    // Pass 1A chunk outputs are not available in the prebuilt path — but
    // reduceCharacterEvidence + buildCharacterLedgerV2 have already been run.
    // We mark this as a synthetic settled result with empty chunkOutputs
    // (the ledger is already fully built and injected separately below).
    pass1aSettled = {
      status: 'fulfilled',
      value: { chunkOutputs: [] as any[], _prebuiltLedger: prebuilt } as any,
    };
    console.log("[Pipeline][Pass1A] Using pre-built character ledger from phase_1a invocation");
  } else {
    // Single-invocation path: run Pass 1A sequentially after Pass 1+2.
    const pass1aPromise = _runPass1a({
      manuscriptText: opts.manuscriptText,
      manuscriptChunks: opts.manuscriptChunks,
      workType: opts.workType,
      title: opts.title,
      openaiApiKey: opts.openaiApiKey,
      jobId: opts.jobId,
    });
    pass1aSettled = await Promise.allSettled([pass1aPromise]).then(r => r[0]);
    await opts.onHeartbeat?.("pass1a_settled");
  }


  const normalizePassFailure = (pass: "pass1" | "pass2" | "pass3", reason: unknown) => {
    const message = String(reason instanceof Error ? reason.message : reason);
    const timeoutCode =
      pass === "pass1" ? "PASS1_TIMEOUT" : pass === "pass2" ? "PASS2_TIMEOUT" : "PASS3_TIMEOUT";
    if (reason instanceof JsonBoundaryError) {
      const prefix = pass === "pass1" ? "PASS1" : pass === "pass2" ? "PASS2" : "PASS3";
      return {
        message,
        errorCode: `${prefix}_${reason.code}`,
        failedAt: pass,
        failureDetails: {
          json_boundary: {
            code: reason.code,
            candidates_found: reason.candidatesFound,
            raw_head: reason.raw.slice(0, 1000),
            raw_tail: reason.raw.slice(-500),
            normalized_tail: reason.normalized.slice(-250),
            candidate_tail: reason.candidate?.slice(-250),
          },
        },
      } as const;
    }
    const genericCode = pass === "pass1" ? "PASS1_FAILED" : pass === "pass2" ? "PASS2_FAILED" : "PASS3_FAILED";
    const failedAt = pass;
    return {
      message,
      errorCode: message.includes("timed out") ? timeoutCode : genericCode,
      failedAt,
      failureDetails: undefined,
    } as const;
  };

  const pass1Failed = pass1Settled.status === "rejected";
  const pass2Failed = pass2Settled.status === "rejected";

  // ── Failure routing (implements the FAILURE PRECEDENCE RULE above) ────────
  if (pass1Failed && pass2Failed) {
    // DUAL-FAILURE BRANCH: Pass 1 failure is canonical per the precedence rule.
    // Both failures are logged here — this log is the sole audit record of
    // the secondary (Pass 2) failure and must not be removed.
    const pass1Failure = normalizePassFailure("pass1", pass1Settled.reason);
    const pass2Failure = normalizePassFailure("pass2", pass2Settled.reason);

    console.error("[Pipeline] Parallel pass dual failure", {
      manuscript_id: opts.manuscriptId ?? null,
      title: opts.title,
      work_type: opts.workType,
      pass1: {
        error_code: pass1Failure.errorCode,
        error: pass1Failure.message,
      },
      pass2: {
        error_code: pass2Failure.errorCode,
        error: pass2Failure.message,
      },
      timings,
    });

    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: pass1Failure.failedAt,
      errorCode: pass1Failure.errorCode,
      timings,
    });

    return {
      ok: false,
      error: `${pass1Failure.message} | secondary: ${pass2Failure.message}`,
      error_code: pass1Failure.errorCode,
      failed_at: pass1Failure.failedAt,
      failure_details: pass1Failure.failureDetails,
    };
  }

  if (pass1Failed) {
    const failure = normalizePassFailure("pass1", pass1Settled.reason);
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: failure.failedAt,
      errorCode: failure.errorCode,
      timings,
    });
    return {
      ok: false,
      error: failure.message,
      error_code: failure.errorCode,
      failed_at: failure.failedAt,
      failure_details: failure.failureDetails,
    };
  }

  if (pass2Failed) {
    const failure = normalizePassFailure("pass2", pass2Settled.reason);
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: failure.failedAt,
      errorCode: failure.errorCode,
      timings,
    });
    return {
      ok: false,
      error: failure.message,
      error_code: failure.errorCode,
      failed_at: failure.failedAt,
      failure_details: failure.failureDetails,
    };
  }

  pass1Output = pass1Settled.value;
  pass2Output = pass2Settled.value;

  // ── Pass 2 Lexical Independence Guard ──────────────────────────────────
  // Detects and rewrites true_overlap between Pass 2 and Pass 1 rationale.
  // Rewrite trigger: observed_overlap_count >= 5.
  // Fail-closed threshold: observed_overlap_count >= 6 after one rewrite.
  // This guard fires AFTER both passes complete (no LLM call; deterministic).
  {
    const independenceResult = enforcePass2LexicalIndependence(pass1Output, pass2Output);
    if (independenceResult.rewriteApplied) {
      console.log("[Pipeline][Pass2IndependenceGuard] Independence rewrite applied", {
        manuscript_id: opts.manuscriptId ?? null,
        rewritten_keys: independenceResult.rewrittenKeys,
        failed_keys: independenceResult.failedKeys,
      });
    }
    if (!independenceResult.ok) {
      timings.total_ms = nowMs() - pipelineStartMs;
      logPipelineTimings("failure", {
        manuscriptId: opts.manuscriptId,
        title: opts.title,
        workType: opts.workType,
        failedAt: "pass2",
        errorCode: "PASS2_INDEPENDENCE_REWRITE_FAILED",
        timings,
      });
      return {
        ok: false,
        error: `Pass 2 lexical independence guard failed after rewrite: criteria still have overlap counts >= ${PASS2_INDEPENDENCE_FAIL_THRESHOLD} after one rewrite attempt (keys: ${independenceResult.failedKeys.join(", ")})`,
        error_code: "PASS2_INDEPENDENCE_REWRITE_FAILED",
        failed_at: "pass2",
        failure_details: {
          pass2_independence: {
            failed_keys: independenceResult.failedKeys,
            rewritten_keys: independenceResult.rewrittenKeys,
            threshold_n: independenceResult.threshold_n,
            threshold_min: independenceResult.threshold_min,
            per_failed_criterion: independenceResult.perFailedCriterion,
          },
        },
      };
    }
    pass2Output = independenceResult.output;
  }

  {
    const llrResult = enforceLessonsLearnedStage("post_structural", "pass1", {
      structural_result: pass1Output,
      registry,
    });
    if (llrResult) return llrResult;
  }

  {
    const llrResult = enforceLessonsLearnedStage("post_diagnostic", "pass2", {
      structural_result: pass1Output,
      diagnostic_result: pass2Output,
      registry,
    });
    if (llrResult) return llrResult;
  }

  const pass2aCoverage = derivePass2aCoverageAuthority({
    manuscriptText: opts.manuscriptText,
    manuscriptChunks: opts.manuscriptChunks,
    pass1: pass1Output,
    pass2: pass2Output,
  });

  console.log("[Pipeline][Pass2aCoverageAuthority]", {
    manuscript_id: opts.manuscriptId ?? null,
    title: opts.title,
    ...pass2aCoverage,
  });

  const coverageFailure = buildChunkCoverageFailure(pass2aCoverage);
  if (coverageFailure) {
    return {
      ok: false,
      error: coverageFailure.message,
      error_code: "MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE",
      failed_at: "pass2",
      failure_details: {
        manuscript_chunk_coverage: coverageFailure.details,
      },
    };
  }

  const pass2aStructuredContext = buildPass2aStructuredContext({
    manuscriptText: opts.manuscriptText,
    manuscriptChunks: opts.manuscriptChunks,
  });

  // ── Resolve Pass 1A → reduce to character ledger (MANDATORY) ─────────
  // Every novel has at least one character. A missing ledger is a pipeline
  // failure, not a graceful degradation case. Pass 3 cannot run without it.
  //
  // Two paths:
  //   A. Prebuilt (multi-phase): opts._prebuiltCharacterLedger carries all 6
  //      ledgers already assembled by the phase_1a invocation. Use directly.
  //   B. Single-invocation: pass1aSettled holds fresh chunk outputs; build all
  //      6 ledgers now via reduceCharacterEvidence + buildCharacterLedgerV2.
  let characterLedger: Pass1aCharacterLedger;
  let characterLedgerV2: CharacterLedgerV2 | undefined;

  if (opts._prebuiltCharacterLedger) {
    // Path A: all 6 ledgers (identity, state-timelines, relationship,
    // psychology/coping, object, terminal) already built by phase_1a.
    // Wire them in directly — no re-build needed.
    characterLedger  = opts._prebuiltCharacterLedger.ledger;
    characterLedgerV2 = opts._prebuiltCharacterLedger.ledgerV2;
    console.log("[Pipeline][Pass1A] Pre-built ledger injected (all 6 ledgers ready)", {
      manuscript_id: opts.manuscriptId ?? null,
      entries: characterLedger.entries.length,
      v2_identity: characterLedgerV2.identityLedger?.length ?? 0,
      v2_state_timelines: characterLedgerV2.stateTimelines?.length ?? 0,
      v2_relationship: characterLedgerV2.relationshipLedger?.length ?? 0,
      v2_psychology: characterLedgerV2.psychologyLedger?.length ?? 0,
      v2_object: characterLedgerV2.objectLedger?.length ?? 0,
      v2_terminal: characterLedgerV2.terminalLedger?.length ?? 0,
      v2_active_blockers: characterLedgerV2.activeBlockers?.length ?? 0,
    });
  } else {
    // Path B: resolve from fresh pass1aSettled result.
    if (pass1aSettled.status === "rejected") {
      const reason = pass1aSettled.reason instanceof Error
        ? pass1aSettled.reason.message
        : String(pass1aSettled.reason);
      console.error("[Pipeline][Pass1A] Sweep failed — cannot proceed to Pass 3", {
        manuscript_id: opts.manuscriptId ?? null,
        error: reason,
      });
      timings.total_ms = nowMs() - pipelineStartMs;
      logPipelineTimings("failure", {
        manuscriptId: opts.manuscriptId,
        title: opts.title,
        workType: opts.workType,
        failedAt: "pass1",
        errorCode: "PASS1A_LEDGER_MISSING",
        timings,
      });
      return {
        ok: false,
        error: `Pass 1A character sweep failed — ${reason}`,
        error_code: "PASS1A_LEDGER_MISSING",
        failed_at: "pass1",
      };
    }

    const pass1aResult = pass1aSettled.value;
    if (pass1aResult.chunkOutputs.length === 0) {
      // Soft-skip: the character ledger is an enrichment layer, not the paid product.
      // Pass 3 can run without it (lower confidence, no WAVE). Build an empty sentinel
      // so the pipeline continues — WAVE gate will skip with CHARACTER_LEDGER_V2_MISSING.
      console.warn("[Pipeline][Pass1A] Sweep produced zero chunk outputs — continuing without character ledger (WAVE will be skipped)", {
        manuscript_id: opts.manuscriptId ?? null,
      });
      characterLedger = {
        schema_version: "pass1a_character_ledger_v1",
        prompt_version: "empty_sentinel",
        job_id: opts.jobId ?? "unknown",
        generated_at: new Date().toISOString(),
        total_chunks_processed: 0,
        entries: [],
        coverage_summary: {
          protagonists: [],
          co_protagonists: [],
          antagonists: [],
          major_secondary_characters: [],
          animal_companions: [],
          relational_engines: [],
          symbol_payoff_items: [],
          missing_or_underweighted: [],
          ending_accountability_warnings: [],
          hard_fail_triggers: [],
        },
      };
      characterLedgerV2 = undefined;
    } else {

    const totalChunks = Array.isArray(opts.manuscriptChunks) ? opts.manuscriptChunks.length : 1;

    characterLedger = reduceCharacterEvidence({
      chunkOutputs: pass1aResult.chunkOutputs,
      jobId: opts.jobId ?? "unknown",
      totalChunksInManuscript: totalChunks,
    });

    // Build all 6 ledgers (identity, state-timelines, relationship,
    // psychology/coping, object, terminal) + 7 validation indices,
    // active blockers, negative knowledge states, evidence coverage.
    characterLedgerV2 = buildCharacterLedgerV2({
      ledger: characterLedger,
      chunkOutputs: pass1aResult.chunkOutputs,
      jobId: opts.jobId ?? "unknown",
      totalChunksInManuscript: totalChunks,
    });

    // Fire-and-forget artifact write (non-blocking)
    if (opts._onLedgerReady) {
      void Promise.resolve()
        .then(() => opts._onLedgerReady!(characterLedger, characterLedgerV2!))
        .catch((err: unknown) => {
          console.warn("[Pipeline][Pass1A] _onLedgerReady callback failed (non-fatal)", {
            manuscript_id: opts.manuscriptId ?? null,
            job_id: opts.jobId ?? null,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
    } // end else (chunkOutputs.length > 0)
  } // end if/else (_prebuiltCharacterLedger)

  console.log("[Pipeline][Pass1A] Character ledger ready (V1 + V2)", {
    manuscript_id: opts.manuscriptId ?? null,
    entries: characterLedger.entries.length,
    protagonists: characterLedger.coverage_summary.protagonists,
    co_protagonists: characterLedger.coverage_summary.co_protagonists,
    symbol_items: characterLedger.coverage_summary.symbol_payoff_items.length,
    hard_fail_triggers: characterLedger.coverage_summary.hard_fail_triggers.length,
    // characterLedgerV2 may be undefined if Pass 1A produced zero chunk outputs
    v2_active_blockers: characterLedgerV2?.activeBlockers?.length ?? 0,
    v2_suppress_blockers: characterLedgerV2?.activeBlockers?.filter((b) => b.severity === "suppress").length ?? 0,
    v2_relationship_pairs: characterLedgerV2?.relationshipLedger?.length ?? 0,
    v2_objects_tracked: characterLedgerV2?.objectLedger?.length ?? 0,
    v2_available: !!characterLedgerV2,
  });

  // Resolve the parallel Perplexity chunk sweep before kicking off Pass 3.
  // The Pass 3 collator can run in either single-model (GPT-only) or
  // dual-model mode depending on whether the Perplexity packet is available.
  const pplxChunkOutput = await pplxChunkSweepPromise;
  if (pplxChunkOutput) {
    console.log(
      "[Pipeline][DualModel] Perplexity chunk packet available for Pass 3",
      {
        manuscript_id: opts.manuscriptId ?? null,
        title: opts.title,
        criteria_count: pplxChunkOutput.criteria.length,
      },
    );
  } else {
    console.log(
      "[Pipeline][DualModel] Perplexity chunk packet absent — Pass 3 will run in GPT-only mode",
      {
        manuscript_id: opts.manuscriptId ?? null,
        title: opts.title,
      },
    );
  }

  // ── Pass 3: Synthesis & Reconciliation ─────────────────────────────────
  const pass3StartMs = nowMs();
  const pass3StartedAt = startLatencyStage({
    jobId: latencyJobId,
    stage: 'pass3',
    metadata: {
      model: opts.model ?? null,
      dual_model_mode: pplxChunkOutput !== null,
    },
  });
  await opts.onHeartbeat?.("pass3_started");
  try {
    pass3Output = await withTimeout(
      _runPass3({
        pass1: pass1Output,
        pass2: pass2Output,
        pass2aStructuredContext,
        characterLedger: characterLedger,
        characterLedgerV2: characterLedgerV2,
        // Pass 3A preflight draft compact summary — undefined = PREFLIGHT UNAVAILABLE fallback
        compactPreflightSummary,
        manuscriptText: opts.manuscriptText,
        manuscriptChunks: opts.manuscriptChunks,
        title: opts.title,
        jobId: opts.jobId,
        executionMode: opts.executionMode,
        model: opts.model,
        openaiApiKey: opts.openaiApiKey,
        openAiTimeoutMs: opts._openAiTimeoutMs,
        registry,
        scopeProfile: scopeProfile ?? undefined,
        perplexityChunkPacket: pplxChunkOutput ?? undefined,
        _onCompletion: (capture) => {
          providerTelemetry.push(
            recordProviderTelemetry({
              capture,
              jobId: opts.jobId,
              provider: "openai",
              startedAt: pass3StartedAt,
            })
          );
        },
        onHeartbeat: opts.onHeartbeat ? () => opts.onHeartbeat!("pass3_synthesis_heartbeat") : undefined,
      }),
      passTimeoutMs,
      "Pass 3",
    );
    timings.pass3_ms = nowMs() - pass3StartMs;
    finishLatencyStage({
      jobId: latencyJobId,
      stage: 'pass3',
      startedAt: pass3StartedAt,
      state: 'completed',
    });
  } catch (err) {
    timings.pass3_ms = nowMs() - pass3StartMs;
    finishLatencyStage({
      jobId: latencyJobId,
      stage: 'pass3',
      startedAt: pass3StartedAt,
      state: 'failed',
      metadata: {
        finish_reason: err instanceof Error ? err.message : String(err),
      },
    });

    const failure = normalizePassFailure("pass3", err);
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: failure.failedAt,
      errorCode: failure.errorCode,
      timings,
    });
    return {
      ok: false,
      error: failure.message,
      error_code: failure.errorCode,
      failed_at: failure.failedAt,
      failure_details: failure.failureDetails,
    };
  }

  {
    pass3Output = {
      ...pass3Output,
      partial_evaluation: pass2aCoverage.partialCoverage,
      coverage_scope: {
        sourceChars: pass2aCoverage.sourceChars,
        sourceWords: pass2aCoverage.sourceWords,
        analyzedChars: pass2aCoverage.analyzedChars,
        analyzedWords: pass2aCoverage.analyzedWords,
        strategy: pass2aCoverage.strategy,
      },
    };

    const criteriaForDerivedPlans = pass3Output.criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    }));

    const scoreLedger = buildScoreLedger({
      criteria: criteriaForDerivedPlans,
    });
    const excellenceFilter = buildExcellenceFilter({
      criteria: criteriaForDerivedPlans,
    });
    const advisoryPlan = buildAdvisoryPlan({
      criteria: criteriaForDerivedPlans,
    });

    console.log("[Pipeline][DerivedEvaluationPlans]", {
      manuscript_id: opts.manuscriptId ?? null,
      title: opts.title,
      score_ledger: scoreLedger,
      excellence_filter: excellenceFilter,
      advisory_plan_count: advisoryPlan.length,
      blocking_advisory_count: advisoryPlan.filter((item) => item.severity === "blocking").length,
    });

    const llrPostConvergence = enforceLessonsLearnedStage("post_convergence", "pass3", {
      structural_result: pass1Output,
      diagnostic_result: pass2Output,
      convergence_result: pass3Output,
      registry,
    });
    if (llrPostConvergence) return llrPostConvergence;

    const llrPreArtifactGeneration = enforceLessonsLearnedStage("pre_artifact_generation", "pass4", {
      structural_result: pass1Output,
      diagnostic_result: pass2Output,
      convergence_result: pass3Output,
      registry,
    });
    if (llrPreArtifactGeneration) return llrPreArtifactGeneration;
  }

  // ── Pass 4: Quality Gate (deterministic) ───────────────────────────────
  const dedupeResult = dedupeRecommendationsPreGate(pass3Output);
  pass3Output = dedupeResult.synthesis;
  if (dedupeResult.removedCount > 0) {
    console.log("[Pipeline][PreGate] recommendation dedupe applied", {
      manuscript_id: opts.manuscriptId ?? null,
      title: opts.title,
      removed_recommendations: dedupeResult.removedCount,
    });
  }

  const pass4StartMs = nowMs();
  const qualityGateStartedAt = startLatencyStage({
    jobId: latencyJobId,
    stage: 'quality_gate',
  });
  await opts.onHeartbeat?.("quality_gate_started");
  const qualityGate = _runQualityGate(pass3Output, pass1Output, pass2Output, opts.manuscriptText, scopeProfile ?? undefined);
  await opts.onHeartbeat?.("quality_gate_completed");
  timings.pass4_ms = nowMs() - pass4StartMs;
  if (!qualityGate.pass) {
    finishLatencyStage({
      jobId: latencyJobId,
      stage: 'quality_gate',
      startedAt: qualityGateStartedAt,
      state: 'failed',
      metadata: {
        finish_reason: 'quality_gate_failed',
      },
    });

    const qualityGateCheckpoint = getGovernanceCheckpointById("QUALITY_GATE", governanceInjectionMap);
    const failedChecks = qualityGate.checks.filter((c) => !c.passed);
    const errorCode = failedChecks[0]?.error_code ?? "QG_UNKNOWN";
    const details = failedChecks.map((c) => c.details ?? c.error_code).join("; ");
    const qualityGateTelemetry = summarizeQualityGateFailures(qualityGate.checks);

    console.warn("[Pipeline][QualityGate] failure", {
      manuscript_id: opts.manuscriptId ?? null,
      work_type: opts.workType,
      title: opts.title,
      ...qualityGateTelemetry,
      warning_count: qualityGate.warnings.length,
      warning_samples: qualityGate.warnings.slice(0, 5),
      failed_check_details: failedChecks.slice(0, 5).map((check) => ({
        check_id: check.check_id,
        error_code: check.error_code ?? "QG_UNKNOWN",
        details: check.details,
      })),
    });

    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: "pass4",
      errorCode,
      timings,
    });

    return {
      ok: false,
      error: `Quality gate failed: ${details}${checkpointContext(qualityGateCheckpoint)}`,
      error_code: errorCode,
      failed_at: "pass4",
      failure_details: {
        // Compact per-criterion diagnostics for job progress (fits within 4KB markFailed limit).
        // Full diagnostic data is in gate_diagnostics below — processor persists it as artifacts.
        quality_gate_checks: failedChecks.map((c) => {
          const perCriterionFull = extractPerCriterionDiagnostic(c.diagnostics);
          const compactCriterionDiagnostic = perCriterionFull?.map((d) => ({
            criterion_key: d.criterion_key,
            observed_overlap_count: d.observed_overlap_count,
            threshold_n: d.threshold_n,
            threshold_min: d.threshold_min,
            classification: d.classification,
          }));
          return {
            check_id: c.check_id,
            error_code: c.error_code,
            details: c.details,
            ...(compactCriterionDiagnostic !== undefined
              ? { per_criterion_diagnostic: compactCriterionDiagnostic }
              : {}),
          };
        }),
        // Signal that structured gate diagnostic artifacts will be persisted for this failure.
        // Enables /admin/pipeline-health to return diagnosticStatus="available" for any
        // Phase 2.7 gate failure type (not only QG_INDEPENDENCE_VIOLATION).
        ...(pass1Output && pass2Output && pass3Output
          ? { gate_diagnostics_version: "gate_diagnostics_v1" as const }
          : {}),
      },
      // Full diagnostic payload for artifact persistence.
      // Processor reads this directly — do NOT forward to markFailed (too large for 4KB limit).
      ...(pass1Output && pass2Output && pass3Output
        ? {
            gate_diagnostics: {
              schema_version: "gate_diagnostics_v1" as const,
              failed_at: "pass4" as const,
              error_code: errorCode,
              generated_at: new Date().toISOString(),
              per_criterion: (() => {
                // Collect from all checks that have per_criterion_diagnostic
                const allDiag: QualityGateCriterionDiagnostic[] = [];
                for (const c of qualityGate.checks) {
                  const d = extractPerCriterionDiagnostic(c.diagnostics);
                  if (d !== undefined) {
                    allDiag.push(...d);
                  }
                }
                return allDiag;
              })(),
              pass1_output: pass1Output,
              pass2_output: pass2Output,
              pass3_output: pass3Output,
              provider_call_trace: [
                {
                  pass: 1 as const,
                  model: pass1Output.model,
                  prompt_version: pass1Output.prompt_version,
                  temperature: pass1Output.temperature,
                  generated_at: pass1Output.generated_at,
                },
                {
                  pass: 2 as const,
                  model: pass2Output.model,
                  prompt_version: pass2Output.prompt_version,
                  temperature: pass2Output.temperature,
                  generated_at: pass2Output.generated_at,
                },
              ],
            } satisfies GateDiagnostics,
          }
        : {}),
    };
  }

  finishLatencyStage({
    jobId: latencyJobId,
    stage: 'quality_gate',
    startedAt: qualityGateStartedAt,
    state: 'completed',
  });

  // ── Pass 4: RETIRED ────────────────────────────────────────────────────
  // Pass 4 (post-synthesis Perplexity cross-check + adjudication governance)
  // is retired in favor of dual-model parallel scoring. Perplexity now scores
  // every chunk alongside GPT during Pass 1+2 and feeds the Pass 3 collator
  // as an independent second packet. The previous post-hoc adjudicator is no
  // longer called — see feat/dual-model-parallel-scoring.
  //
  // crossCheckResult and pass4Governance remain typed as optional on
  // PipelineResult so existing consumers (processor, report adapter) continue
  // to compile; they are always undefined in this path. external_adjudication
  // is preserved (now reflecting the dual-model sweep state) so report
  // surfaces that already render the "external adjudication" banner stay
  // backward-compatible.
  const adjudicationMode: ExternalAdjudicationMode = getExternalAdjudicationMode();
  const externalAdjudication: ExternalAdjudicationStatus = pplxChunkOutput
    ? {
        status: "cross_check_completed",
        mode: adjudicationMode,
        cross_check_returned: true,
      }
    : {
        status: "skipped",
        mode: adjudicationMode,
        cross_check_returned: false,
        reason: "pass4_retired_dual_model_parallel_scoring",
      };

  emitLatencyTrace({
    job_id: latencyJobId,
    stage: 'pass4_cross_check',
    state: 'skipped',
    started_at: new Date().toISOString(),
    metadata: {
      finish_reason: 'pass4_retired',
      dual_model_parallel: pplxChunkOutput !== null,
      adjudication_mode: adjudicationMode,
    },
  });

  timings.total_ms = nowMs() - pipelineStartMs;
  logPipelineTimings("success", {
    manuscriptId: opts.manuscriptId,
    title: opts.title,
    workType: opts.workType,
    timings,
  });

  // ── Pass 3b — REMOVED from main pipeline ────────────────────────────────
  // Pass 3b (DREAM long-form synthesis) was decoupled from the main worker
  // in fix/pass3b-async-dream-worker to prevent 800s Vercel timeout on
  // full-novel evaluations (issue #543).
  //
  // The DREAM worker at /api/workers/process-dream picks up completed
  // long-form jobs and persists the longform_document_v1 artifact
  // asynchronously after the main evaluation succeeds.

  return {
    ok: true,
    synthesis: pass3Output,
    quality_gate: qualityGate,
    cross_check: crossCheckResult,
    pass4_governance: pass4Governance,
    external_adjudication: externalAdjudication,
    routing: pipelineRouting,
    provider_telemetry: providerTelemetry,
    characterLedgerV2: characterLedgerV2,
  };
}

// ── EvaluationResultV1 Adapter ────────────────────────────────────────────────

export interface SynthesisToEvaluationResultOptions {
  synthesis: SynthesisOutput;
  title?: string;
  ids: {
    evaluation_run_id: string;
    job_id?: string;
    manuscript_id: number;
    project_id?: number;
    user_id: string;
  };
  /** Pass 4 cross-check result — must be threaded from runPipeline(), never inferred */
  crossCheckResult?: CrossCheckOutput;
  /** Pass 4 governance decision — must be threaded from runPipeline(), never inferred */
  pass4Governance?: Pass4GovernanceResult;
  /**
   * Explicit Pass 4 execution outcome — must be threaded from runPipeline(),
   * never inferred. Drives report.governance.transparency.external_adjudication
   * and blocks long-form certification when status !== "cross_check_completed" in required mode.
   */
  externalAdjudication?: ExternalAdjudicationStatus;
  /** Governed applicability map (R/O/NA/C). NA values are converted to NOT_APPLICABLE in v2. */
  criteriaPlan?: CriteriaPlanMap;
  /** Optional passage-level coverage hints for observability classification. */
  passageCoverageRatio?: number;
  sentenceCount?: number;
  /** Optional source text for deterministic anchor/source matching in confidence computation. */
  sourceText?: string;
  /** Optional manuscript text for metrics enrichment when the caller has it available. */
  manuscriptText?: string;
  scopeProfile?: SubmissionScopeProfile;
}

const DEFAULT_ADAPTER_CONFIDENCE = 0.85;
const INCOMPLETE_CRITERIA_WARNING = "INCOMPLETE_CRITERIA_SET";
const PLACEHOLDER_CLUSTER_THRESHOLD = 5;

function isThinText(value: string | undefined, minWords = 6): boolean {
  const text = value?.trim() ?? "";
  if (!text) return true;
  return text.split(/\s+/).filter(Boolean).length < minWords;
}

function looksPlaceholderRationale(rationale: string): boolean {
  const normalized = rationale.toLowerCase();
  return [
    "did not provide a specific score",
    "did not provide specific score",
    "did not provide specific analysis",
    "did not provide a specific analysis",
    "no specific score",
    "no specific analysis",
    "insufficient information",
    "insufficient evidence",
    "unable to assess",
  ].some((pattern) => normalized.includes(pattern));
}

function assessCriteriaCompleteness(criteria: EvaluationResultV1["criteria"]): {
  warnings: string[];
  confidence: number;
} {
  const presentKeys = new Set(criteria.map((c) => c.key));
  const missingKeys = CRITERIA_KEYS.filter((key) => !presentKeys.has(key));

  const zeroScoreCount = criteria.filter((c) => c.score_0_10 === 0).length;

  const placeholderKeys = criteria
    .filter((criterion) => {
      const placeholderRationale = looksPlaceholderRationale(criterion.rationale);
      const thinEvidence =
        criterion.evidence.length === 0 || criterion.evidence.every((e) => isThinText(e.snippet, 4));
      const thinRecommendations =
        criterion.recommendations.length === 0 ||
        criterion.recommendations.every(
          (r) => isThinText(r.action) || isThinText(r.expected_impact),
        );

      return (
        (criterion.score_0_10 === 0 && placeholderRationale) ||
        (placeholderRationale && thinEvidence) ||
        (criterion.score_0_10 === 0 && thinEvidence && thinRecommendations)
      );
    })
    .map((c) => c.key);

  const hasPlaceholderCluster =
    placeholderKeys.length >= PLACEHOLDER_CLUSTER_THRESHOLD && zeroScoreCount >= PLACEHOLDER_CLUSTER_THRESHOLD;

  if (missingKeys.length === 0 && !hasPlaceholderCluster) {
    return {
      warnings: [],
      confidence: DEFAULT_ADAPTER_CONFIDENCE,
    };
  }

  const warnings: string[] = [];

  if (missingKeys.length > 0) {
    warnings.push(
      `${INCOMPLETE_CRITERIA_WARNING}: missing_keys=${missingKeys.join(",")} expected=${CRITERIA_KEYS.length} actual=${criteria.length}`,
    );
  }

  if (hasPlaceholderCluster) {
    warnings.push(
      `${INCOMPLETE_CRITERIA_WARNING}: placeholder_cluster_count=${placeholderKeys.length} zero_score_count=${zeroScoreCount} sample=${placeholderKeys
        .slice(0, 5)
        .join(",")}`,
    );
  }

  const confidence = Math.max(
    0,
    DEFAULT_ADAPTER_CONFIDENCE - (missingKeys.length > 0 ? 0.2 : 0) - (hasPlaceholderCluster ? 0.15 : 0),
  );

  return {
    warnings,
    confidence,
  };
}

/**
 * Map a SynthesisOutput (Phase 2.7 pipeline result) to EvaluationResultV1
 * so that downstream code (phase2.ts, report UI, A6 credibility) works unchanged.
 */
export function synthesisToEvaluationResult(
  opts: SynthesisToEvaluationResultOptions,
): EvaluationResultV1 {
  const { synthesis, ids, crossCheckResult, pass4Governance } = opts;

  const criteria: EvaluationResultV1["criteria"] = synthesis.criteria.map((c) => {
    const confidence = computeCriterionConfidence(
      {
        key: c.key,
        final_score_0_10: c.final_score_0_10,
        final_rationale: c.final_rationale,
        evidence: c.evidence,
        recommendations: c.recommendations,
      },
      opts.sourceText,
    );

    return {
      key: c.key,
      score_0_10: c.final_score_0_10,
      confidence_score_0_100: confidence.confidence_score_0_100,
      confidence_level: confidence.confidence_level,
      confidence_reasons: confidence.confidence_reasons,
      scorability_status: confidence.scorability_status,
      rationale: c.final_rationale,
      evidence: c.evidence.map((e) => ({
        snippet: e.snippet,
        ...(e.char_start !== undefined || e.char_end !== undefined
          ? {
              location: {
                char_start: e.char_start,
                char_end: e.char_end,
                segment_id: e.segment_id,
              },
            }
          : {}),
      })),
      recommendations: c.recommendations.map((r) => ({
        priority: r.priority,
        action: r.action,
        expected_impact: r.expected_impact,
      })),
    };
  });

  // Derive quick_wins (high-priority recs from all criteria)
  const quick_wins = synthesis.criteria
    .flatMap((c) =>
      c.recommendations
        .filter((r) => r.priority === "high")
        .map((r) => ({
          action: r.action,
          why: r.expected_impact,
          effort: "medium" as const,
          impact: "high" as const,
        })),
    )
    .slice(0, 5);

  // Derive strategic_revisions (medium-priority recs)
  const strategic_revisions = synthesis.criteria
    .flatMap((c) =>
      c.recommendations
        .filter((r) => r.priority === "medium")
        .map((r) => ({
          action: r.action,
          why: r.expected_impact,
          effort: "medium" as const,
          impact: "medium" as const,
        })),
    )
    .slice(0, 5);

  const completenessAssessment = assessCriteriaCompleteness(criteria);

  const governanceWarnings = [...completenessAssessment.warnings];

  if (crossCheckResult?.warnings?.length) {
    governanceWarnings.push(...crossCheckResult.warnings);
  }

  if (pass4Governance && !pass4Governance.ok && pass4Governance.message) {
    governanceWarnings.push(pass4Governance.message);
  }

  return {
    schema_version: "evaluation_result_v1",
    score_denominator_policy: "full_canonical",
    ids,
    generated_at: synthesis.metadata.generated_at,
    engine: {
      model: synthesis.metadata.pass3_model,
      provider: "openai",
      prompt_version: `${PASS1_PROMPT_VERSION}+${PASS2_PROMPT_VERSION}+${PASS3_PROMPT_VERSION}`,
    },
    overview: {
      verdict: synthesis.overall.verdict,
      overall_score_0_100: synthesis.overall.overall_score_0_100,
      one_paragraph_summary: synthesis.overall.one_paragraph_summary,
      top_3_strengths: synthesis.overall.top_3_strengths,
      top_3_risks: synthesis.overall.top_3_risks,
    },
    criteria,
    recommendations: {
      quick_wins,
      strategic_revisions,
    },
    metrics: {
      manuscript: {
        title: opts.title?.trim() || undefined,
        word_count: opts.manuscriptText ? countWords(opts.manuscriptText) : undefined,
        char_count: opts.manuscriptText?.length,
      },
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: completenessAssessment.confidence,
      warnings: governanceWarnings,
      limitations: ["Single-chunk evaluation; multi-chunk synthesis in Phase 2.8"],
      policy_family: "multi-pass-dual-axis",
      // Pass 4 governance data is returned on PipelineResult, not stored on EvaluationResultV1
      // Callers who need it read it from the pipeline success result directly.
    },
  };
}

/**
 * Map SynthesisOutput to EvaluationResultV2 using governed applicability +
 * observability normalization at the synthesis boundary.
 */
export function synthesisToEvaluationResultV2(
  opts: SynthesisToEvaluationResultOptions,
): EvaluationResultV2 {
  const {
    synthesis,
    ids,
    crossCheckResult,
    pass4Governance,
    externalAdjudication,
    criteriaPlan,
    passageCoverageRatio,
    sentenceCount,
    sourceText,
  } = opts;

  // Derive criteria plan from scope profile when caller does not supply one explicitly.
  // This is the critical NA-enforcement gate: micro_excerpt → narrativeClosure + marketability
  // must be NOT_APPLICABLE. Without this, Pass 3B scores them and qualityGateV2 hard-fails.
  const resolvedCriteriaPlan: CriteriaPlanMap | undefined =
    criteriaPlan ??
    (opts.scopeProfile?.inputScale
      ? buildCriteriaPlanForScale(opts.scopeProfile.inputScale)
      : undefined);

  const detectedMode = detectModeFromManuscript(opts.manuscriptText || "");

  const criteria = synthesis.criteria
    .map((c) =>
      normalizeCriterion(
        {
          key: c.key,
          score_0_10: c.final_score_0_10,
          rationale: c.final_rationale,
          evidence: c.evidence.map((e) => ({
            snippet: e.snippet,
            location:
              e.char_start !== undefined || e.char_end !== undefined || e.segment_id !== undefined
                ? {
                    char_start: e.char_start,
                    char_end: e.char_end,
                    segment_id: e.segment_id,
                  }
                : undefined,
          })),
          recommendations: c.recommendations.map((r) => ({
            priority: r.priority,
            action: r.action,
            expected_impact: r.expected_impact,
            anchor_snippet: r.anchor_snippet,
          })),
          technical_defects: c.technical_defects,
        },
        {
          criteriaPlan: resolvedCriteriaPlan,
          passageCoverageRatio,
          sentenceCount,
          sourceText,
        },
      ),
    )
    .map(enforceTextualAnchorConfidence);

  const baseCertification = computeManuscriptCertification({
    inputScale: opts.scopeProfile?.inputScale,
    partialEvaluation: synthesis.partial_evaluation,
    coverageScope: synthesis.coverage_scope,
    hasSynthesisCriteria: synthesis.criteria.length === CRITERIA_KEYS.length,
  });

  // PR #506 — External adjudication truth gate.
  //
  // If Pass 4 was required by mode and did not complete (skipped / failed_soft /
  // failed_blocking), the manuscript MUST NOT be fully certified. This closes
  // the Froggin Noggin loophole where a completed-with-cross_check_status=null
  // report could masquerade as a successful premium adjudicated evaluation.
  const externalAdjudicationBlocksCertification =
    externalAdjudication !== undefined &&
    externalAdjudication.status !== "cross_check_completed" &&
    (externalAdjudication.mode === "required" ||
      externalAdjudication.mode === "veto");

  const certificationReasonCodes = externalAdjudicationBlocksCertification
    ? [
        ...baseCertification.reasonCodes,
        `external_adjudication_${externalAdjudication!.status}_in_${externalAdjudication!.mode}_mode`,
      ]
    : baseCertification.reasonCodes;

  const certification = externalAdjudicationBlocksCertification
    ? {
        ...baseCertification,
        manuscriptWideCertifiable: false,
        reasonCodes: certificationReasonCodes,
      }
    : baseCertification;

  const governedCriteria =
    certification.route === "LONG_FORM" && !certification.manuscriptWideCertifiable
      ? criteria.map((criterion) =>
          criterionClaimScope(opts.scopeProfile?.inputScale, criterion.key) === "MANUSCRIPT_WIDE"
            ? downgradeCriterionForUncertifiedLongForm(criterion, certification.reasonCodes)
            : criterion,
        )
      : criteria;

  const weighted = computeWeightedScore(governedCriteria);
  const propagation = summarizePropagationIntegrity(governedCriteria);

  const derivedConfidence = deriveGovernanceConfidenceFromCriteria(criteria, propagation);

  const quick_wins = criteria
    .flatMap((c) =>
      c.recommendations
        .filter((r) => r.priority === "high")
        .map((r) => ({
          action: r.action,
          why: r.expected_impact,
          effort: "medium" as const,
          impact: "high" as const,
        })),
    )
    .slice(0, 5);

  const strategic_revisions = criteria
    .flatMap((c) =>
      c.recommendations
        .filter((r) => r.priority === "medium")
        .map((r) => ({
          action: r.action,
          why: r.expected_impact,
          effort: "medium" as const,
          impact: "medium" as const,
        })),
    )
    .slice(0, 5);

  const coverageLimited =
    certification.route === "LONG_FORM" && !certification.manuscriptWideCertifiable;

  const overviewSummary = normalizeSummaryWithBottomWeaknesses(
    coverageLimited
      ? buildCoverageLimitedSummary(synthesis.coverage_scope)
      : synthesis.overall.one_paragraph_summary,
    propagation.bottomScoreCriteria,
  );

  const quickWins = coverageLimited ? [] : quick_wins;
  const strategicRevisions = coverageLimited ? [] : strategic_revisions;

  const observabilityWarnings: string[] = [];
  if (weighted.scored_count === 0) {
    observabilityWarnings.push("LOW_EVALUABILITY_COVERAGE: no criteria were scorable for this submission window");
  } else if (weighted.scored_count < 7) {
    observabilityWarnings.push(
      `LOW_EVALUABILITY_COVERAGE: scored_criteria_count=${weighted.scored_count}/${weighted.total_count}`,
    );
  }

  if (crossCheckResult?.warnings?.length) {
    observabilityWarnings.push(...crossCheckResult.warnings);
  }
  if (pass4Governance && !pass4Governance.ok && pass4Governance.message) {
    observabilityWarnings.push(pass4Governance.message);
  }

  if (propagation.upstreamIntegrity !== "strong") {
    observabilityWarnings.push(
      `PROPAGATION_${propagation.upstreamIntegrity.toUpperCase()}: low=${propagation.lowConfidenceCount} moderate=${propagation.moderateConfidenceCount} missingEvidence=${propagation.missingEvidenceCount}`,
    );
  }

  const governanceWarnings: string[] = [];
  if (propagation.upstreamIntegrity === "mixed") {
    governanceWarnings.push("CONFIDENCE VARIES ACROSS THIS REPORT");
  } else if (propagation.upstreamIntegrity === "weak") {
    governanceWarnings.push("CONFIDENCE IS CONSTRAINED BY WEAK UPSTREAM EVIDENCE");
  }

  if (coverageLimited) {
    governanceWarnings.push("LONG_FORM_CERTIFICATION_WITHHELD");
  }

  // PR #506 — surface Pass 4 status as a governance warning so the UI banner
  // cannot present a non-completed adjudicated evaluation as fully certified.
  if (externalAdjudication && externalAdjudication.status !== "cross_check_completed") {
    governanceWarnings.push(
      `EXTERNAL_ADJUDICATION_${externalAdjudication.status.toUpperCase()}` +
        ` (mode=${externalAdjudication.mode}` +
        ("reason" in externalAdjudication && externalAdjudication.reason
          ? `, reason=${externalAdjudication.reason})`
          : ")"),
    );
  }

  return {
    schema_version: "evaluation_result_v2",
    score_denominator_policy: "full_canonical",
    ids,
    generated_at: synthesis.metadata.generated_at,
    engine: {
      model: synthesis.metadata.pass3_model,
      provider: "openai",
      prompt_version: `${PASS1_PROMPT_VERSION}+${PASS2_PROMPT_VERSION}+${PASS3_PROMPT_VERSION}`,
    },
    detected_mode: detectedMode,
    confirmed_mode: null,
    mode_telemetry: [],
    overview: {
      verdict: synthesis.overall.verdict,
      overall_score_0_100: weighted.overall_score_0_100,
      scored_criteria_count: weighted.scored_count,
      one_paragraph_summary: overviewSummary,
      top_3_strengths: coverageLimited ? [] : synthesis.overall.top_3_strengths,
      top_3_risks: coverageLimited ? ["coverage_limited_long_form_evaluation"] : synthesis.overall.top_3_risks,
    },
    criteria: governedCriteria,
    recommendations: {
      quick_wins: quickWins,
      strategic_revisions: strategicRevisions,
    },
    metrics: {
      manuscript: {
        title: opts.title?.trim() || undefined,
        word_count: opts.manuscriptText ? countWords(opts.manuscriptText) : undefined,
        char_count: opts.manuscriptText?.length,
      },
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence:
        weighted.scored_count === 0
          ? 0.55
          : derivedConfidence.confidence,
      confidence_label: weighted.scored_count === 0 ? "withheld" : derivedConfidence.confidenceLabel,
      confidence_reasons:
        weighted.scored_count === 0
          ? ["no_scorable_criteria"]
          : derivedConfidence.confidenceReasons,
      warnings: governanceWarnings,
      limitations: ["Single-chunk evaluation; multi-chunk synthesis in Phase 2.8"],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: observabilityWarnings,
      transparency: {
        evaluation_scope: {
          route: certification.route,
          input_scale: opts.scopeProfile?.inputScale,
          manuscript_wide_certifiable: certification.manuscriptWideCertifiable,
          reason_codes: certification.reasonCodes,
          criterion_scope_policy_version: "v0.2",
        },
        coverage_summary: {
          partial_evaluation: synthesis.partial_evaluation,
          sampling_strategy: synthesis.coverage_scope?.strategy,
          source_word_count: synthesis.coverage_scope?.sourceWords,
          analyzed_word_count: synthesis.coverage_scope?.analyzedWords,
          source_char_count: synthesis.coverage_scope?.sourceChars,
          analyzed_char_count: synthesis.coverage_scope?.analyzedChars,
        },
        propagation_summary: {
          low_confidence_count: propagation.lowConfidenceCount,
          moderate_confidence_count: propagation.moderateConfidenceCount,
          weak_evidence_count: propagation.weakEvidenceCount,
          missing_evidence_count: propagation.missingEvidenceCount,
          scorable_low_confidence_count: propagation.scorableLowConfidenceCount,
          bottom_score_criteria: propagation.bottomScoreCriteria,
          upstream_integrity: propagation.upstreamIntegrity,
          authority_level: propagation.authorityLevel,
          reasons: propagation.reasons,
        },
        // PR #506 — Froggin Noggin Pass 4 provenance truth. Always emitted when
        // runPipeline has computed an externalAdjudication status (which it now
        // always does on the success path). Allows the report surface to render
        // "External Adjudication: Completed · Required Mode · Perplexity · 29,568-char
        // evidence packet" without inferring anything from missing fields.
        ...(externalAdjudication
          ? {
              external_adjudication: {
                status: externalAdjudication.status,
                mode: externalAdjudication.mode,
                cross_check_returned: externalAdjudication.cross_check_returned,
                ...(externalAdjudication.status !== "cross_check_completed" && "reason" in externalAdjudication
                  ? { reason: externalAdjudication.reason }
                  : {}),
                ...("packet_chars" in externalAdjudication && externalAdjudication.packet_chars !== undefined
                  ? { packet_chars: externalAdjudication.packet_chars }
                  : {}),
                ...("packet_compression_ratio" in externalAdjudication && externalAdjudication.packet_compression_ratio !== undefined
                  ? { packet_compression_ratio: externalAdjudication.packet_compression_ratio }
                  : {}),
              },
            }
          : {}),
      },
    },
  };
}
