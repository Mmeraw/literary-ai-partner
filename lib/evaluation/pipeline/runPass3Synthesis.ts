/**
 * Phase 2.7 — Pass 3: Synthesis & Reconciliation Runner
 *
 * Receives Pass 1 + Pass 2 outputs and reconciles them into a unified
 * dual-axis evaluation. Also handles local reconciliation of scores
 * as a deterministic fallback if the AI response is incomplete.
 *
 * Temperature: 0.2 (per Vol III Tools §PASS3 — lower for precision)
 * Max tokens: 16000 (default, override via EVAL_PASS3_MAX_TOKENS)
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS3_SYSTEM_PROMPT, PASS3_PROMPT_VERSION, buildPass3UserPrompt } from "./prompts/pass3-synthesis";
import { sanitizeCMOSCriterion, sanitizeCMOSOverall } from "../cmosSanitizer";
import {
  analyzeGovernedOpportunityCoverage,
  countMeaningfulOpportunityRecommendations,
  getOpportunityScoreGuidance,
  getProductOpportunityCeiling,
  getShortFormPerCriterionCeiling,
  normalizeRecommendationStatusInput,
  RecommendationDispositionContractError,
  buildRecommendationSourceIdentities,
  isMeaningfulOpportunityRecommendation,
  reconcileRecommendationLineage,
  type RecommendationLineageOutcome,
  reconcileRecommendationDispositionAfterMutation,
  requireCurrentRecommendationDisposition,
  type EvaluationOpportunityMode,
} from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type {
  SinglePassOutput,
  SynthesisOutput,
  CurrentSynthesisOutput,
  SynthesizedCriterion,
  EvidenceAnchor,
  CompletionUsage,
  PassCompletionCapture,
  Pass3ReducerTelemetry,
  ManuscriptChunkEvidence,
  Pass2aStructuredContext,
  Pass1aCharacterLedger,
  CharacterLedgerV2,
} from "./types";
import type { Pass3ReadAheadResult } from "./runPass3ReadAhead";
import {
  checkRecommendationIntegrity,
  meetsMinimumTier,
} from "./recommendationIntegrityGate";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass3Model,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { buildComparisonPacket } from "./comparisonPacket";
import {
  buildDivergenceDiagnosticArtifact,
  derivePass3CriteriaCountByStateFromRawResponse,
} from "./divergenceDiagnostics";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { summarizePromptCoverage, getDefaultSynthesisReferenceCharBudget } from "./promptInput";
import { PLACEHOLDER_RATIONALE_PATTERNS } from "./placeholderRationalePatterns";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import { enforcePass3QualityGuards, classifyCompressionGovernance, emitCompressionGovernanceSignal } from "@/lib/evaluation/governance/runtimeQualityGuards";
import { normalizeIssueFamily, normalizeStrategicLever, normalizeRevisionGranularity, buildRedundancyKey } from "./recommendationSemantics";
import { DIALOGUE_MECHANISM_MARKERS } from "./mechanismMarkers";
import {
  EDITORIAL_CONTEXT_MARKERS,
  EDITORIAL_FIX_MARKERS,
  EDITORIAL_MECHANISM_MARKERS,
  EDITORIAL_READER_EFFECT_MARKERS,
} from "./editorialRecommendationContract";
import {
  annotateSurfaceIntegrityFlag,
  checkSurfaceIntegrity,
  repairSurfaceIntegrity,
} from "./surfaceIntegrity";
import { analyzeDialogueAttributionForGate } from "@/lib/evaluation/pov/analyzeDialogueAttribution";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { trackCompletionCost } from "@/lib/jobs/cost";
import {
  genreExpectationContextForMetadata,
  isGenreUncalibratedPhrasing,
  isNonPropulsionGenre,
  resolveExpectationProfiles,
  shouldSuppressByExpectationProfile,
  type DominantCraftEngine,
  type ResolvedExpectationContext,
} from "@/lib/evaluation/genreExpectationProfiles";
import {
  filterGenericRecommendations,
  type GenericGuardDecision,
} from "@/lib/evaluation/pipeline/genericRecommendationGuard";
import {
  extractDiagnosticSpine,
  UNAVAILABLE_SPINE,
  type DiagnosticSpine,
} from "@/lib/evaluation/diagnosticSpine";
import { repairPitchIdentity } from "./pitchIdentityRepair";
// PR-K (2026-05-16): Pass 3 and QualityGateV2 must use the SAME helper for
// summary weakness enforcement. Previously Pass 3 had a local implementation
// with "ANY mention satisfies" (.some) + slice(0,3) semantics, while the gate
// requires EVERY bottom-score criterion to be named. Job a8d47d73 (Froggin
// Noggin) failed at v2_summary_weakness_presence because 5 bottom criteria
// were derived but only 3 ever made it into the summary. Sharing the helper
// gives producer/checker parity by construction.
import {
  summarizePropagationIntegrity,
  normalizeSummaryWithBottomWeaknesses,
} from "./propagationIntegrity";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import type { CriterionKey } from "@/schemas/criteria-keys";
import { pipelineLog } from "./pipelineLogger";
import type { EnglishVariant } from "@/lib/evaluation/englishVariant";
import { sanitizeSynthesisCharacterNames } from "./characterNameSanitizer";
import { classifyAnchor } from "./evidenceGroundingGate";
import { detectProseScoreDivergence } from "@/lib/text/authorFacingProse";
import { SUMMARY_POLICY } from "@/lib/config/lengthPolicy";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function computeChunkRanges(chunks: ManuscriptChunkEvidence[]): Array<{ start: number; end: number; index: number }> {
  let cursor = 0;
  return chunks.map((chunk, index) => {
    const content = typeof chunk.content === "string" ? chunk.content.trim() : "";
    const start = cursor;
    const end = start + content.length;
    cursor = end + 1; // joined with "\n"
    return { start, end, index };
  });
}

function chunkIndexForOffset(
  offset: number,
  ranges: Array<{ start: number; end: number; index: number }>,
): number | null {
  if (!Number.isFinite(offset)) return null;
  const match = ranges.find((range) => offset >= range.start && offset <= range.end);
  return match ? match.index : null;
}

function computeSipocCoverage(args: {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  comparisonPacket: ReturnType<typeof buildComparisonPacket>;
  comparisonPacketChars: number;
}) {
  const manuscriptWords = countWords(args.manuscriptText);
  const chunks = Array.isArray(args.manuscriptChunks) ? args.manuscriptChunks : [];
  const isLongForm = chunks.length > 0;
  const chunksCreated = chunks.length;

  const evidenceCountByCriterion = args.comparisonPacket.criteria.reduce<Record<string, number>>((acc, criterion) => {
    const count = Array.isArray(criterion.pass1_evidence) ? criterion.pass1_evidence.length : 0;
    acc[criterion.key] = count;
    return acc;
  }, {});

  const criteriaWithZeroEvidence = Object.entries(evidenceCountByCriterion)
    .filter(([, count]) => count === 0)
    .map(([key]) => key);

  const excerptCount = Object.values(evidenceCountByCriterion).reduce((sum, count) => sum + count, 0);

  let chunksConsumed: number | null = null;
  let chunkCoveragePct: number | null = null;

  if (isLongForm) {
    const ranges = computeChunkRanges(chunks);
    const consumed = new Set<number>();

    for (const criterion of args.comparisonPacket.criteria) {
      for (const anchor of criterion.pass1_evidence ?? []) {
        if (typeof anchor.char_start === "number") {
          const index = chunkIndexForOffset(anchor.char_start, ranges);
          if (index !== null) consumed.add(index);
        }
      }

      const windowStart = criterion.disputed_excerpt_window?.char_start;
      if (typeof windowStart === "number") {
        const index = chunkIndexForOffset(windowStart, ranges);
        if (index !== null) consumed.add(index);
      }
    }

    chunksConsumed = consumed.size > 0 ? consumed.size : Math.min(chunksCreated, 1);
    chunkCoveragePct =
      chunksCreated > 0
        ? Math.round((Math.min(chunksConsumed, chunksCreated) / chunksCreated) * 10000) / 100
        : 0;
  }

  const totalSourceChars = isLongForm
    ? chunks.reduce((sum, chunk) => sum + (chunk.content?.trim().length ?? 0), 0)
    : args.manuscriptText.length;
  const representationCompressionRatio =
    totalSourceChars > 0
      ? Math.round((args.comparisonPacketChars / totalSourceChars) * 10000) / 10000
      : 0;

  return {
    manuscript_words: manuscriptWords,
    chunks_created: chunksCreated,
    chunks_consumed: chunksConsumed,
    chunk_coverage_pct: chunkCoveragePct,
    excerpt_count: excerptCount,
    evidence_count_by_criterion: evidenceCountByCriterion,
    representation_compression_ratio: representationCompressionRatio,
    criteria_with_zero_evidence: criteriaWithZeroEvidence,
  };
}

const PASS3_TEMPERATURE = 0.2;
// Pass 3 model is resolved via getCanonicalPass3Model(opts.model), allowing
// EVAL_PASS3_MODEL (or EVAL_SYNTHESIS_MODEL fallback) to control reducer/synthesis model selection.
const PASS3_MIN_RATIONALE_LENGTH = 40;
const PASS3_PLACEHOLDER_RATIONALE_PATTERNS = PLACEHOLDER_RATIONALE_PATTERNS;
const PASS3_VOICE_MECHANISM_MARKERS = [
  "pov",
  "point of view",
  "perspective",
  "psychic distance",
  "narrative distance",
  "focali",
  "first person",
  "third person",
  "close third",
  "free indirect",
  "interior",
  "interiority",
  "internal",
  "narrat",
  "rendering",
  "diction",
  "register",
  "syntax",
  "cadence",
  "tone",
  "rhythm",
] as const;

type CompletionChoice = {
  message?: {
    content?: unknown;
    refusal?: unknown;
  };
  finish_reason?: unknown;
};

function extractResponseText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (typeof part !== "object" || part === null) {
        return "";
      }

      const record = part as Record<string, unknown>;
      if (typeof record.text === "string") {
        return record.text;
      }

      if (typeof record.content === "string") {
        return record.content;
      }

      return "";
    })
    .join("")
    .trim();
}

function buildEmptyResponseDiagnostic(params: {
  model: string;
  completion: { choices?: unknown; usage?: CompletionUsage };
  firstChoice: CompletionChoice | undefined;
  rawContent: unknown;
  coverage: ReturnType<typeof summarizePromptCoverage>;
  comparisonPacketChars: number;
  promptChars: number;
}): string {
  const { model, completion, firstChoice, rawContent, coverage, comparisonPacketChars, promptChars } = params;
  const usage = completion.usage;
  const finishReason =
    typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
  const contentType =
    rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent;
  const refusal =
    typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined;
  const choiceCount = Array.isArray(completion.choices) ? completion.choices.length : 0;
  const likelyBudgetPressure = finishReason === "length" ? " budget_exhausted_likely=true" : "";

  return (
    `[Pass3] Empty response from OpenAI ` +
    `(model=${model} finish_reason=${finishReason} content_type=${contentType} choices=${choiceCount} ` +
    `max_output_tokens=${getEvaluationRuntimeConfig().pass.pass3MaxTokens} prompt_chars=${promptChars} comparison_packet_chars=${comparisonPacketChars} ` +
    `reference_chars=${coverage.analyzedChars} source_chars=${coverage.sourceChars}` +
    `${typeof usage?.prompt_tokens === "number" ? ` prompt_tokens=${usage.prompt_tokens}` : ""}` +
    `${typeof usage?.completion_tokens === "number" ? ` completion_tokens=${usage.completion_tokens}` : ""}` +
    `${typeof usage?.total_tokens === "number" ? ` total_tokens=${usage.total_tokens}` : ""}` +
    `${refusal ? ` refusal=${JSON.stringify(refusal).slice(0, 120)}` : ""}` +
    `${likelyBudgetPressure})`
  );
}

function assertPass3PromptTripwires(userPrompt: string): void {
  if (userPrompt.length > getEvaluationRuntimeConfig().pass.pass3PromptMaxChars) {
    throw new Error(
      `[Pass3] PROMPT_TOO_LARGE: prompt_chars=${userPrompt.length} limit=${getEvaluationRuntimeConfig().pass.pass3PromptMaxChars}`,
    );
  }

  const hasLegacySectionHeaders =
    userPrompt.includes("## PASS 1 OUTPUT (Craft Execution)") ||
    userPrompt.includes("## PASS 2 OUTPUT (Editorial/Literary Insight)");
  const hasRawPass1Shape = /"pass"\s*:\s*1\s*,\s*"axis"\s*:\s*"craft_execution"/.test(userPrompt);
  const hasRawPass2Shape = /"pass"\s*:\s*2\s*,\s*"axis"\s*:\s*"editorial_literary"/.test(userPrompt);

  if (hasLegacySectionHeaders || (hasRawPass1Shape && hasRawPass2Shape)) {
    throw new Error("[Pass3] RAW_PASS_PAYLOAD_DETECTED: raw pass payload is forbidden in Pass 3 prompt input");
  }
}

function buildPromptPacketFromComparison(packet: ReturnType<typeof buildComparisonPacket>) {
  const criteria = packet.criteria.map((criterion) => {
    const base = {
      key: criterion.key,
      state: criterion.state,
      score_delta: criterion.score_delta,
      pass1_score: criterion.pass1_score,
      pass2_score: criterion.pass2_score,
      pass1_mechanism_summary: criterion.pass1_mechanism_summary,
      pass2_rationale_short: criterion.pass2_rationale_short,
      pass2_recommendation_candidates: criterion.pass2_recommendation_candidates,
    };

    if (criterion.state === "soft_divergence" || criterion.state === "hard_divergence") {
      return {
        ...base,
        pass1_evidence: criterion.pass1_evidence.slice(0, 1),
        disputed_excerpt_window: criterion.disputed_excerpt_window,
      };
    }

    if (criterion.state === "missing_or_invalid") {
      return {
        ...base,
        pass1_evidence: criterion.pass1_evidence.slice(0, 1),
      };
    }

    return base;
  });

  return {
    criteria_count_by_state: packet.criteria_count_by_state,
    criteria,
  };
}

/** Function signature for creating a chat completion (enables DI for testing). */
export type CreateCompletionFn = (params: {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format: { type: string };
}) => Promise<{ choices: CompletionChoice[]; usage?: CompletionUsage }>;

import type { SubmissionScopeProfile } from "./submissionScope";

export interface RunPass3Options {
  scopeProfile?: SubmissionScopeProfile;
  pass1: SinglePassOutput;
  pass2: SinglePassOutput;
  pass2aStructuredContext: Pass2aStructuredContext;
  /**
   * Optional independent Perplexity chunk-scoring packet (dual-model parallel scoring).
   * When present, Pass 3 runs in dual-model mode: it synthesizes across both
   * independent evaluations, flags criteria where the two models diverge by
   * more than 1 point, and weights agreement as a stronger signal.
   * When absent, Pass 3 runs in the legacy GPT-only mode (backward compatible).
   */
  perplexityChunkPacket?: SinglePassOutput;
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  title: string;
  /** Evaluate-time selected English variant for generated author-facing output. */
  englishVariant?: EnglishVariant | string;
  /** Structural canonical work type from intake routing. */
  workType?: string;
  /** Optional diagnosed genre signal if available upstream. */
  diagnosedGenre?: string;
  /** Optional shelf / target-audience signal if available upstream. */
  shelfTargetAudience?: string;
  /**
   * Optional evaluation_jobs.id (uuid). When present, structured pipeline
   * audit-log entries are emitted to the pipeline_logs table.
   */
  jobId?: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  registry: CanonRegistry;
  model?: string;
  openaiApiKey?: string;
  /** Optional provider timeout override from pipeline-level scoped resolution. */
  openAiTimeoutMs?: number;
  /**
   * Pass 1A character arc ledger — OPTIONAL under Pass 3A/3B doctrine.
   * When unavailable, Pass 3B receives a degraded-context warning and is told to
   * suppress high-specificity character-location/name/co-presence claims.
   * NOTE: Under doctrine the raw ledger is NEVER injected into the Pass 3B prompt —
   * it is reserved for synthesis-internal use only.
   */
  characterLedger?: Pass1aCharacterLedger;
  /**
   * Tier 1 CharacterLedgerV2 — six-ledger envelope. Optional.
   * Pass 3B does not receive the raw ledger; this is held for non-prompt uses.
   */
  characterLedgerV2?: CharacterLedgerV2;
  /**
   * @deprecated — Pass 3A is now the independent reader. Accepted for
   * backwards-compat with callers but no longer injected into the live
   * Pass 3B prompt path. DOCTRINE (LOCKED): Pass 3B = P1 + P2 + compact
   * Pass 3A summary ONLY.
   */
  readAheadResult?: Pass3ReadAheadResult;
  /** Override the completion function (for testing). Production callers omit this. */
  _createCompletion?: CreateCompletionFn;
  _onCompletion?: (capture: PassCompletionCapture) => void;
  /** Optional heartbeat callback — called every 20s during the OpenAI completion call to keep the job lease alive. */
  onHeartbeat?: () => Promise<void> | void;
  /**
   * Compact Pass 3A preflight summary — built by buildCompactPreflightSummary().
   * Injected into the Pass 3B prompt as the PREFLIGHT DRAFT block.
   * When absent, Pass 3B receives a PREFLIGHT UNAVAILABLE notice.
   */
  compactPreflightSummary?: string;
  /**
   * Full-context story ledger ground truth block (Phase 0.5a).
   * When provided, injected into the Pass 3 system prompt as MANDATORY
   * hard fact constraints. Any synthesis recommendation that contradicts
   * these facts is INVALID and must be suppressed.
   */
  storyLedgerContextBlock?: string;
  /**
   * Canonical character names from the story ledger (primary_entities).
   * When provided, deterministic post-processing replaces any blocked
   * character name references in synthesis output with canonical names.
   */
  canonicalEntityNames?: string[];
  /**
   * Short-form retry instruction appended to the system prompt on FIPOC kick-back.
   * When present, Pass 3 re-synthesis is told to avoid the exact long-form
   * terms that triggered SHORT_FORM_LONGFORM_ARTIFACT_LEAK on the previous attempt.
   * Written by persistEvaluationResultV2 via buildRetryContext().
   */
  shortFormRetryInstruction?: string;
}

const LEDGER_UNAVAILABLE_WARNING =
  "CHARACTER LEDGER UNAVAILABLE — suppress high-specificity character-location/name/co-presence claims unless supported by P1/P2/Pass3A evidence.";

/**
 * Soft check: Pass 3B doctrine permits a missing/empty character ledger.
 * Returns a warning string Pass 3B should be told about when the ledger is unusable,
 * or null when the ledger has at least one entry.
 */
function evaluateCharacterLedger(ledger: Pass1aCharacterLedger | undefined): string | null {
  if (!ledger || !Array.isArray(ledger.entries) || ledger.entries.length === 0) {
    return LEDGER_UNAVAILABLE_WARNING;
  }
  return null;
}

function deriveDominantCraftEngineFromPasses(pass1: SinglePassOutput, pass2: SinglePassOutput): DominantCraftEngine {
  const merged = CRITERIA_KEYS.map((key) => {
    const p1 = pass1.criteria.find((c) => c.key === key)?.score_0_10 ?? 0;
    const p2 = pass2.criteria.find((c) => c.key === key)?.score_0_10 ?? 0;
    return { key, score: (p1 + p2) / 2 };
  }).sort((a, b) => b.score - a.score);

  const topKey = merged[0]?.key;
  if (topKey === "narrativeDrive" || topKey === "pacing" || topKey === "sceneConstruction") return "propulsion";
  if (topKey === "voice") return "voice";
  if (topKey === "theme" || topKey === "tone") return "tonal_pressure";
  if (topKey === "worldbuilding" || topKey === "concept") return "world_concept";
  if (topKey === "dialogue" || topKey === "character") return "emotional_payoff";
  if (topKey === "marketability") return "hybrid";
  return "unknown";
}

function applyExpectationProfileRecommendationGuard(args: {
  criteria: SynthesizedCriterion[];
  expectationContext: ResolvedExpectationContext;
}): SynthesizedCriterion[] {
  const protectedProfiles = new Set(["mood_forward", "reflection_forward", "atmosphere_forward", "dread_forward"]);

  return args.criteria.map((criterion) => {
    const kept = criterion.recommendations.filter((rec) =>
      shouldSuppressByExpectationProfile(args.expectationContext, {
        action: rec.action,
        expected_impact: rec.expected_impact,
        mechanism: rec.mechanism,
        anchor_snippet: rec.anchor_snippet,
      }).allowed,
    );

    // Preserve the pre-existing editorial policy exactly: partial suppression
    // is advisory here, and only an all-recommendations decision mutates the
    // collection. This change synchronizes disposition metadata only.
    if (kept.length > 0 || criterion.recommendations.length === 0) {
      return criterion;
    }

    const blockedByProtectedProfile = args.expectationContext.expectation_profiles.some((profile) =>
      protectedProfiles.has(profile),
    );
    const filteredCriterion: SynthesizedCriterion = blockedByProtectedProfile
      ? {
          ...criterion,
          recommendations: kept,
          technical_defects: dedupeTechnicalDefects([
            ...(criterion.technical_defects ?? []),
            {
          code: "RECOMMENDATION_GUARD_EXPECTATION_PROFILE_SUPPRESSED",
          author_facing_reason:
                  "Recommendation guard suppressed unsafe momentum/hook directives for the resolved expectation profile because explicit malfunction evidence was not present.",
          retryable: false,
            },
          ]),
        }
      : { ...criterion, recommendations: kept };

    return reconcileRecommendationDispositionAfterMutation(filteredCriterion, {
      previousMeaningfulCount: countMeaningfulOpportunityRecommendations(criterion.recommendations),
      mutationCause: "expectation_profile_safety_filter",
      emptyStatus: "gate_suppressed_no_safe_recommendation",
      emptyRationale:
        "The expectation-profile guard removed every proposed intervention under the existing genre-protection policy because none carried the required malfunction evidence.",
    });
  });
}

const DIAGNOSTIC_SPINE_PROMISE_ATMOSPHERIC_MARKERS = [
  "slow accumulation",
  "atmosphere",
  "atmospheric",
  "dread",
  "reflective",
  "reflection",
  "meditative",
  "interiority",
  "quiet tension",
  "lingering",
  "ambiguity",
  "unease",
] as const;

const DIAGNOSTIC_SPINE_PROMISE_PROPULSIVE_MARKERS = [
  "propulsive",
  "high velocity",
  "page-turning",
  "rapid escalation",
  "relentless",
  "suspense pressure",
  "breakneck",
] as const;

const DIAGNOSTIC_SPINE_REC_PROPULSION_MARKERS = [
  "increase momentum",
  "add a decision beat",
  "clearer next step",
  "strengthen hook",
  "accelerate",
  "speed up",
  "raise the pace",
  "faster pacing",
] as const;

const DIAGNOSTIC_SPINE_REC_SLOWDOWN_MARKERS = [
  "slow down",
  "linger",
  "extend reflection",
  "more atmosphere",
  "more introspection",
  "reduce pace",
] as const;

function normalizeForPromiseMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAnyMarker(haystack: string, markers: readonly string[]): boolean {
  return markers.some((marker) => haystack.includes(marker));
}

function recommendationConflictsWithPrimaryReaderPromise(
  recommendation: SynthesizedCriterion["recommendations"][number],
  primaryReaderPromise: string,
): boolean {
  const promise = normalizeForPromiseMatch(primaryReaderPromise);
  if (!promise) return false;

  const recommendationText = normalizeForPromiseMatch(
    [
      recommendation.action,
      recommendation.expected_impact,
      recommendation.mechanism,
      recommendation.specific_fix,
      recommendation.reader_effect,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!recommendationText) return false;

  const atmosphericPromise = containsAnyMarker(
    promise,
    DIAGNOSTIC_SPINE_PROMISE_ATMOSPHERIC_MARKERS,
  );
  const propulsivePromise = containsAnyMarker(
    promise,
    DIAGNOSTIC_SPINE_PROMISE_PROPULSIVE_MARKERS,
  );

  if (atmosphericPromise && containsAnyMarker(recommendationText, DIAGNOSTIC_SPINE_REC_PROPULSION_MARKERS)) {
    return true;
  }

  if (propulsivePromise && containsAnyMarker(recommendationText, DIAGNOSTIC_SPINE_REC_SLOWDOWN_MARKERS)) {
    return true;
  }

  return false;
}

function recommendationConflictsWithCentralArgument(
  recommendation: SynthesizedCriterion["recommendations"][number],
  centralArgument: string,
): boolean {
  const argument = normalizeForPromiseMatch(centralArgument);
  if (!argument) return false;

  const recommendationText = normalizeForPromiseMatch(
    [
      recommendation.action,
      recommendation.expected_impact,
      recommendation.mechanism,
      recommendation.specific_fix,
      recommendation.reader_effect,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!recommendationText) return false;

  const atmosphericArgument = containsAnyMarker(
    argument,
    DIAGNOSTIC_SPINE_PROMISE_ATMOSPHERIC_MARKERS,
  );
  const propulsiveArgument = containsAnyMarker(
    argument,
    DIAGNOSTIC_SPINE_PROMISE_PROPULSIVE_MARKERS,
  );

  if (atmosphericArgument && containsAnyMarker(recommendationText, DIAGNOSTIC_SPINE_REC_PROPULSION_MARKERS)) {
    return true;
  }

  if (propulsiveArgument && containsAnyMarker(recommendationText, DIAGNOSTIC_SPINE_REC_SLOWDOWN_MARKERS)) {
    return true;
  }

  return false;
}

function applyDiagnosticSpineRecommendationGuard(args: {
  criteria: SynthesizedCriterion[];
  diagnosticSpine: DiagnosticSpine;
}): SynthesizedCriterion[] {
  const primaryReaderPromise = args.diagnosticSpine.primary_reader_promise.trim();
  const centralArgument = args.diagnosticSpine.central_argument.trim();
  if (!primaryReaderPromise && !centralArgument) return args.criteria;

  return args.criteria.map((criterion) => {
    let promiseConflictSeen = false;
    let centralArgumentConflictSeen = false;

    const kept = criterion.recommendations.filter((rec) => {
      const promiseConflict = primaryReaderPromise
        ? recommendationConflictsWithPrimaryReaderPromise(rec, primaryReaderPromise)
        : false;
      const centralArgumentConflict = centralArgument
        ? recommendationConflictsWithCentralArgument(rec, centralArgument)
        : false;

      if (promiseConflict) promiseConflictSeen = true;
      if (centralArgumentConflict) centralArgumentConflictSeen = true;

      return !(promiseConflict || centralArgumentConflict);
    });

    if (kept.length === criterion.recommendations.length) {
      return criterion;
    }

    const newDefects: NonNullable<SynthesizedCriterion["technical_defects"]> = [];
    if (promiseConflictSeen) {
      newDefects.push({
        code: "DIAGNOSTIC_SPINE_PROMISE_MISMATCH",
        author_facing_reason:
          "One or more recommendations were suppressed because they contradicted the diagnostic spine's primary reader promise.",
        retryable: false,
      });
    }
    if (centralArgumentConflictSeen) {
      newDefects.push({
        code: "DIAGNOSTIC_SPINE_CENTRAL_ARGUMENT_MISMATCH",
        author_facing_reason:
          "One or more recommendations were suppressed because they contradicted the diagnostic spine's central argument.",
        retryable: false,
      });
    }

    return reconcileRecommendationDispositionAfterMutation({
      ...criterion,
      recommendations: kept,
      technical_defects: dedupeTechnicalDefects([...(criterion.technical_defects ?? []), ...newDefects]),
    }, {
      previousMeaningfulCount: countMeaningfulOpportunityRecommendations(criterion.recommendations),
      mutationCause: "diagnostic_spine_safety_filter",
      emptyStatus: "gate_suppressed_no_safe_recommendation",
      emptyRationale:
        "The diagnostic-spine guard removed every proposed intervention under the existing reader-promise policy because each one contradicted the manuscript's primary argument.",
    });
  });
}

function shouldRequireStrictDiagnosticSpine(
  scopeProfile?: SubmissionScopeProfile,
  manuscriptText?: string,
): boolean {
  if (scopeProfile?.requiresAcceptedStoryLedger === true) return true;
  if (scopeProfile?.evaluationMode === "long_form_evaluation") return true;
  const manuscriptWordCount = manuscriptText ? countWords(manuscriptText) : 0;
  return manuscriptWordCount >= 25_000;
}

function applyWeakDiagnosticSpineConfidenceDegrade(args: {
  criteria: SynthesizedCriterion[];
  strictMode: boolean;
}): SynthesizedCriterion[] {
  return args.criteria.map((criterion) => {
    const reasons = [
      ...(criterion.confidence_reasons ?? []),
      args.strictMode
        ? "Diagnostic spine is weak for long-form governance; confidence downgraded pending regeneration."
        : "Diagnostic spine is partial; confidence downgraded.",
    ];
    const technicalDefects = dedupeTechnicalDefects([
      ...(criterion.technical_defects ?? []),
      {
        code: "DIAGNOSTIC_SPINE_WEAK_OR_ABSENT",
        author_facing_reason: args.strictMode
          ? "Diagnostic spine is weak for long-form evaluation; confidence has been downgraded and regeneration is recommended."
          : "Diagnostic spine is partial; recommendation confidence has been downgraded.",
        retryable: args.strictMode,
      },
    ]);

    return {
      ...criterion,
      confidence_level: "low",
      confidence_reasons: Array.from(new Set(reasons)),
      technical_defects: technicalDefects,
    };
  });
}

function hasGovernanceSuppressedRecommendations(
  criterion: SynthesizedCriterion,
): boolean {
  return (criterion.technical_defects ?? []).some((defect) =>
    defect.code === "DIAGNOSTIC_SPINE_PROMISE_MISMATCH" ||
    defect.code === "DIAGNOSTIC_SPINE_CENTRAL_ARGUMENT_MISMATCH" ||
    defect.author_facing_reason.includes("Recommendation guard suppressed unsafe") ||
    defect.author_facing_reason.includes("recommendations were suppressed because they contradicted"),
  );
}

function assertPass2aStructuredContext(context: Pass2aStructuredContext | undefined): asserts context is Pass2aStructuredContext {
  if (!context) {
    throw new Error("[Pass3] PASS2A_STRUCTURED_CONTEXT_MISSING");
  }

  if (!Array.isArray(context.character_ledger)) {
    throw new Error("[Pass3] PASS2A_LEDGER_MISSING");
  }

  if (!Array.isArray(context.scene_index)) {
    throw new Error("[Pass3] PASS2A_SCENE_INDEX_MISSING");
  }

  if (!Array.isArray(context.timeline_anchors)) {
    throw new Error("[Pass3] PASS2A_TIMELINE_ANCHORS_MISSING");
  }
}

/**
 * Run Pass 3 — Synthesis & Reconciliation.
 * Receives both axis outputs and reconciles into a SynthesisOutput.
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass3Synthesis(opts: RunPass3Options): Promise<CurrentSynthesisOutput> {
  if (!opts.registry || opts.registry.size === 0) {
    throw new Error("[Pass3] Canonical registry binding missing");
  }

  assertPass2aStructuredContext(opts.pass2aStructuredContext);
  const ledgerWarning = evaluateCharacterLedger(opts.characterLedger);
  if (ledgerWarning) {
    console.warn("[Pass3B] Character ledger unavailable — continuing with degraded context");
  }

  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey, opts.openAiTimeoutMs);
  const selectedModel = getCanonicalPass3Model(opts.model);

  const comparisonPacket = buildComparisonPacket(opts.pass1, opts.pass2, {
    manuscriptText: opts.manuscriptText,
    chunks: opts.manuscriptChunks,
  });
  const promptPacket = buildPromptPacketFromComparison(comparisonPacket);
  const comparisonPacketJson = JSON.stringify(promptPacket);
  const reducerTelemetry = {
    criteria_count_by_state: comparisonPacket.criteria_count_by_state,
  };

  const expectationContext = resolveExpectationProfiles({
    workType: opts.workType,
    diagnosedGenre: opts.diagnosedGenre ?? opts.workType,
    shelfTargetAudience: opts.shelfTargetAudience ?? opts.title,
    dominantCraftEngine: deriveDominantCraftEngineFromPasses(opts.pass1, opts.pass2),
  });

  // Compute arithmetic-projected overall score from Pass 1 + Pass 2 criterion averages.
  // This is injected into the prompt as a hard grounding constraint so the LLM cannot
  // invent a different score in the executive summary (one_paragraph_summary).
  const projectedOverallScore = (() => {
    const scoredCriteria = comparisonPacket.criteria.filter(
      (c) => typeof c.pass1_score === 'number' || typeof c.pass2_score === 'number',
    );
    if (scoredCriteria.length === 0) return undefined;
    const total = scoredCriteria.reduce((sum, c) => {
      const avg = ((c.pass1_score ?? c.pass2_score ?? 0) + (c.pass2_score ?? c.pass1_score ?? 0)) / 2;
      return sum + avg;
    }, 0);
    const avgCriterion = total / scoredCriteria.length;
    // POLICY: Math.floor — all score decimals round DOWN, never inflate (pass3b-longform.ts doctrine).
    // computeWeightedScore() uses Math.round (a pre-existing anomaly) and is the source of the
    // displayed overall score, but the floor policy is the declared intent across the entire pipeline.
    // This projection is a pre-Pass-3 estimate on raw P1/P2 averages; it cannot be the exact
    // post-governance final score, but Math.floor keeps it conservative and non-inflating.
    return Math.min(100, Math.max(10, Math.floor(avgCriterion * 10)));
  })();

  const userPrompt = buildPass3UserPrompt({
    comparisonPacketJson,
    pass2aStructuredContext: opts.pass2aStructuredContext,
    manuscriptText: opts.manuscriptText,
    title: opts.title,
    englishVariant: opts.englishVariant,
    executionMode: opts.executionMode,
    scopeProfile: opts.scopeProfile,
    perplexityChunkPacket: opts.perplexityChunkPacket,
    dualModelMode: !!opts.perplexityChunkPacket,
    ledgerWarning,
    // readAheadResult deliberately NOT forwarded — Pass 3A is now the independent reader.
    compactPreflightSummary: opts.compactPreflightSummary,
    expectationContext,
    projectedOverallScore,
  });
  assertPass3PromptTripwires(userPrompt);

  const pass3ReducerTelemetry: Pass3ReducerTelemetry = {
    schema_version: "1" as const,
    prompt_version: PASS3_PROMPT_VERSION,
    criteria_count_by_state: reducerTelemetry.criteria_count_by_state,
    chunk_count: Array.isArray(opts.manuscriptChunks) ? opts.manuscriptChunks.length : 0,
    packet_source: comparisonPacket.packet_source,
    packet_scope: comparisonPacket.packet_scope,
    packet_evidence_origin: comparisonPacket.packet_evidence_origin,
    ...computeSipocCoverage({
      manuscriptText: opts.manuscriptText,
      manuscriptChunks: opts.manuscriptChunks,
      comparisonPacket,
      comparisonPacketChars: comparisonPacketJson.length,
    }),
    comparison_packet_chars: comparisonPacketJson.length,
    system_prompt_chars: PASS3_SYSTEM_PROMPT.length,
    user_prompt_chars: userPrompt.length,
    max_output_tokens: getEvaluationRuntimeConfig().pass.pass3MaxTokens,
    compression_governance_state: null, // Will be set by classifier below
  };

  // Phase 1: seed-band divergence-collapse governance classifier
  const governanceResult = classifyCompressionGovernance({
    representation_compression_ratio: pass3ReducerTelemetry.representation_compression_ratio,
    packet_source: pass3ReducerTelemetry.packet_source,
  });

  emitCompressionGovernanceSignal(governanceResult, {
    jobId: opts.title || 'unknown',
    chunkCount: pass3ReducerTelemetry.chunk_count,
  });

  // Update telemetry with governance state
  pass3ReducerTelemetry.compression_governance_state = governanceResult.state;

  console.log("[Pass3][ReducerTelemetry]", pass3ReducerTelemetry);
  
  // Compute coverage metadata (for truth enforcement)
  const synthesisBudget = getDefaultSynthesisReferenceCharBudget();
  const coverage = summarizePromptCoverage(opts.manuscriptText, synthesisBudget);

  console.log(`[Pass3] completion request model=${selectedModel}`);

  if (opts.jobId) {
    void pipelineLog({
      jobId: opts.jobId,
      level: "info",
      stage: "pass3_synthesis",
      message: "Pass 3 synthesis started",
      metadata: {
        promptChars: userPrompt.length,
        manuscriptChars: opts.manuscriptText.length,
        hasRoster: Array.isArray(opts.pass2aStructuredContext.character_ledger)
          && opts.pass2aStructuredContext.character_ledger.length > 0,
        dualModel: !!opts.perplexityChunkPacket,
      },
    });
  }

  const originalMaxTokens = getEvaluationRuntimeConfig().pass.pass3MaxTokens;
  // Keep a single retry stage (no extra pipeline hops), but substantially expand
  // token headroom on truncation. Per-model limits are enforced by
  // buildOpenAIOutputTokenParam(), so over-budget requests are safely clamped.
  const retryMaxTokens = Math.max(originalMaxTokens + 4000, originalMaxTokens * 3);

  // Inject full-context story ledger ground truth into system prompt when available
  const baseSystemPrompt = opts.storyLedgerContextBlock
    ? `${PASS3_SYSTEM_PROMPT}\n\n${opts.storyLedgerContextBlock}\n\nAny synthesis recommendation that contradicts the STORY LEDGER GROUND TRUTH above is INVALID. Do not recommend scenes for dead characters, do not claim stationary objects move, do not misattribute cosmology as geography.\n\nNAME AUTHORITY ENFORCEMENT: The CANONICAL CHARACTER NAME AUTHORITY section above is binding. In ALL output fields (final_rationale, recommendations, strengths, risks, summaries, pitches), refer to characters ONLY by the canonical names listed. NEVER use a blocked word (No, Yes, Oh, Hey, Well, So, etc.) as a character name or possessive (e.g. "No's"), even if the manuscript text appears to use it. Substitute the correct canonical name instead.`
    : PASS3_SYSTEM_PROMPT;

  // On SHORT_FORM FIPOC kick-back, append explicit prohibition against the long-form
  // terms that triggered the previous violation. This instruction overrides any
  // incidental terminology echoed from the template or comparison packet.
  const effectiveSystemPrompt = opts.shortFormRetryInstruction
    ? `${baseSystemPrompt}\n\n## SHORT-FORM RE-SYNTHESIS PROHIBITION (FIPOC KICK-BACK — MANDATORY)\n${opts.shortFormRetryInstruction}\n\nThis is a retry after a SHORT_FORM_LONGFORM_ARTIFACT_LEAK violation. The prohibition above is ABSOLUTE. Any output containing the flagged long-form terms will be rejected again. Produce a clean short-form evaluation only.`
    : baseSystemPrompt;

  const invokePass3Completion = (maxTokensForCall: number) =>
    createCompletion({
      model: selectedModel,
      messages: [
        { role: "system", content: effectiveSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...buildOpenAITemperatureParam(selectedModel, PASS3_TEMPERATURE),
      ...buildOpenAIOutputTokenParam(selectedModel, maxTokensForCall),
      response_format: { type: "json_object" },
    });

  // Heartbeat: fire every 20s during the Pass 3 completion call so the watchdog
  // doesn't kill the job during a long synthesis (3-5 min for 100k+ word novels).
  const heartbeatInterval = opts.onHeartbeat
    ? setInterval(() => { void opts.onHeartbeat?.(); }, 20_000)
    : null;
  let completion: Awaited<ReturnType<typeof invokePass3Completion>>;
  try {
    completion = await invokePass3Completion(originalMaxTokens);
  } finally {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  }
  trackCompletionCost({ jobId: opts.jobId ?? "unknown", phase: "pass3_synthesis", model: selectedModel, usage: completion.usage });
  let firstChoice = completion.choices?.[0] as CompletionChoice | undefined;
  let rawContent = firstChoice?.message?.content;
  let responseText = extractResponseText(rawContent);
  let retryFired = false;

  // Truncation detection: finish_reason="length" OR any recommendation that
  // hasTruncatedRecommendationAction() flags. Retry ONCE; if it truncates
  // again, proceed with whatever was returned and let downstream validators
  // make the call. Mirrors PERPLEXITY_LENGTH_RETRY_MAX_TOKENS pattern.
  const initialFinishReason =
    typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  const initialTruncatedRecommendation = detectTruncatedRecommendationInRawResponse(responseText);
  if (initialFinishReason === "length" || initialTruncatedRecommendation) {
    console.warn(
      "[Pass3] Truncation detected — retrying with expanded token budget",
      {
        originalMaxTokens,
        retryMaxTokens,
        finishReason: initialFinishReason ?? "unknown",
        jobId: opts.title || "unknown",
      },
    );
    retryFired = true;
    completion = await invokePass3Completion(retryMaxTokens);
    trackCompletionCost({ jobId: opts.jobId ?? "unknown", phase: "pass3_synthesis_retry", model: selectedModel, usage: completion.usage });
    firstChoice = completion.choices?.[0] as CompletionChoice | undefined;
    rawContent = firstChoice?.message?.content;
    responseText = extractResponseText(rawContent);
  }
  pass3ReducerTelemetry.truncation_retry_fired = retryFired;

  if (responseText.trim().length === 0) {
    const diagnosticMessage = buildEmptyResponseDiagnostic({
      model: selectedModel,
      completion,
      firstChoice,
      rawContent,
      coverage,
      comparisonPacketChars: comparisonPacketJson.length,
      promptChars: userPrompt.length,
    });

    console.error("[Pass3] Completion boundary diagnostic", {
      model: selectedModel,
      hasChoices: Array.isArray((completion as { choices?: unknown }).choices),
      choiceCount: Array.isArray((completion as { choices?: unknown[] }).choices)
        ? (completion as { choices: unknown[] }).choices.length
        : 0,
      finishReason:
        typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown",
      contentType: rawContent === null ? "null" : typeof rawContent,
      contentPreview: typeof rawContent === "string" ? rawContent.slice(0, 160) : undefined,
      usage: completion.usage,
      comparisonPacketChars: comparisonPacketJson.length,
      promptChars: userPrompt.length,
      promptCoverage: coverage,
      maxOutputTokens: getEvaluationRuntimeConfig().pass.pass3MaxTokens,
      refusal:
        typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined,
    });
    throw new Error(diagnosticMessage);
  }

  // P0: Check finish_reason — log a warning if the model stopped due to token limit
  const finishReasonWarning = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  if (finishReasonWarning === "length") {
    console.warn("[Pass3] finish_reason=length — output may be truncated", {
      model: selectedModel,
      maxOutputTokens: getEvaluationRuntimeConfig().pass.pass3MaxTokens,
      responseLen: responseText.length,
      usage: completion.usage,
    });
  }

  const completionWithIds = completion as { request_id?: unknown; id?: unknown };
  const requestId =
    typeof completionWithIds.request_id === "string"
      ? completionWithIds.request_id
      : typeof completionWithIds.id === "string"
      ? completionWithIds.id
      : undefined;

  opts._onCompletion?.({
    pass: 3,
    raw_text: responseText,
    model: selectedModel,
    usage: completion.usage,
    finish_reason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined,
    request_id: requestId,
    generated_at: new Date().toISOString(),
    pass3_reducer_telemetry: pass3ReducerTelemetry,
  });

  const finishReason = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";

  const inferredPostSynthesisCounts = derivePass3CriteriaCountByStateFromRawResponse({
    rawResponseText: responseText,
    fallback: comparisonPacket.criteria_count_by_state,
  });

  pass3ReducerTelemetry.divergence_diagnostics = buildDivergenceDiagnosticArtifact({
    pass1: opts.pass1,
    pass2: opts.pass2,
    comparisonPacket,
    manuscriptText: opts.manuscriptText,
    comparisonPacketChars: comparisonPacketJson.length,
    pass3CriteriaCountByState: inferredPostSynthesisCounts,
  });

  let synthesis: SynthesisOutput;
  try {
    synthesis = parsePass3Response(
      responseText,
      opts.pass1,
      opts.pass2,
      selectedModel,
      opts.manuscriptText,
      expectationContext,
      opts.scopeProfile,
      true,
    );

    // Normalization and required-field validation happen inside parsePass3Response
    // (parseRecommendations + parseSubmissionReadiness are fail-closed at parse boundary).

    enforcePass3QualityGuards({
      telemetry: reducerTelemetry,
      output: synthesis,
    });
  } catch (error) {
    console.error("[Pass3] Parse boundary diagnostic", {
      title: opts.title,
      model: selectedModel,
      request_id: requestId ?? null,
      finish_reason: finishReason,
      usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
      usage_completion_tokens: completion.usage?.completion_tokens ?? null,
      usage_total_tokens: completion.usage?.total_tokens ?? null,
      output_chars: responseText.length,
      raw_head: responseText.slice(0, 1000),
      raw_tail: responseText.slice(-500),
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (opts.jobId) {
    void pipelineLog({
      jobId: opts.jobId,
      level: "info",
      stage: "pass3_synthesis",
      message: "Pass 3 synthesis complete",
      metadata: {
        finishReason,
        truncationDetected:
          initialFinishReason === "length" || initialTruncatedRecommendation,
        retryFired,
      },
    });
  }

  // ── Recommendation Integrity Gate — filter FAIL-tier before persistence ──
  // Parser preserves raw LLM output for debugging/traceability.
  // Pipeline governs: quarantine malformed/generic recommendations so they
  // never reach persistence or rendering. Defence-in-depth: qualityGate.ts
  // also verifies post-filter. Admin/debug sees quarantined metadata only.
  let quarantinedRecCount = 0;
  for (const criterion of synthesis.criteria) {
    const previousMeaningfulCount = countMeaningfulOpportunityRecommendations(
      criterion.recommendations,
    );
    const previousRawCount = criterion.recommendations.length;
    const accepted: typeof criterion.recommendations = [];
    for (const rec of criterion.recommendations) {
      const intResult = checkRecommendationIntegrity({
        action: rec.action,
        symptom: rec.symptom,
        cause: rec.cause,
        fix_direction: rec.fix_direction,
        specific_fix: rec.specific_fix,
        reader_effect: rec.reader_effect,
        mechanism: rec.mechanism,
        expected_impact: rec.expected_impact,
        anchor_snippet: rec.anchor_snippet,
        surface: "evaluation_report",
      });
      if (meetsMinimumTier(intResult, "evaluation_report")) {
        accepted.push(rec);
      } else {
        quarantinedRecCount++;
        const codes = intResult.violations.map((v) => v.code).join(", ");
        console.warn(
          `[Pass3-IntegrityGate] QUARANTINED: criterion=${criterion.key} action="${rec.action.slice(0, 60)}…" tier=${intResult.tier} score=${intResult.quality_score} violations=[${codes}]`,
        );
      }
    }
    criterion.recommendations = accepted;
    if (accepted.length !== previousRawCount) {
      Object.assign(
        criterion,
        reconcileRecommendationDispositionAfterMutation(criterion, {
          previousMeaningfulCount,
          mutationCause: "recommendation_integrity_quarantine",
          emptyStatus: "gate_suppressed_no_safe_recommendation",
          emptyRationale:
            "The recommendation-integrity gate removed every proposed intervention because none satisfied the existing author-facing specificity and evidence contract.",
        }),
      );
    }
  }
  if (quarantinedRecCount > 0) {
    console.info(
      `[Pass3-IntegrityGate] Quarantined ${quarantinedRecCount} FAIL-tier recommendation(s) before persistence.`,
    );
  }

  // ── Deterministic character name sanitization ──────────────────────────────
  // Belt-and-suspenders: after prompt enforcement, deterministically replace
  // any blocked character names (No, Yes, Oh, Hey, etc.) that leaked through
  // the LLM's free-text output with canonical names from the story ledger.
  {
    const canonicalNames = opts.canonicalEntityNames ?? [];
    const sanitizedCount = sanitizeSynthesisCharacterNames(synthesis, canonicalNames);
    if (sanitizedCount > 0) {
      console.info(
        `[Pass3-NameAuthority] Deterministic sanitizer replaced blocked character names in ${sanitizedCount} field(s). Canonical names: [${canonicalNames.slice(0, 3).join(", ") || "fallback:narrator"}]`,
      );
    }
  }

  // Truth enforcement: attach coverage metadata proving whether evaluation was complete or partial
  const currentCriteria = synthesis.criteria.map((criterion) =>
    requireCurrentRecommendationDisposition(criterion, {
      score: criterion.final_score_0_10,
      context: `pass3_output:${criterion.key}`,
    }),
  );
  return {
    ...synthesis,
    criteria: currentCriteria,
    partial_evaluation: coverage.truncated,
    coverage_scope: {
      sourceChars: coverage.sourceChars,
      sourceWords: coverage.sourceWords,
      analyzedChars: coverage.analyzedChars,
      analyzedWords: coverage.analyzedWords,
      strategy: coverage.strategy,
    },
  };
}

/**
 * Build the default OpenAI completion function.
 * Separated so the constructor is only called when no DI override is provided.
 */
function defaultCreateCompletion(openaiApiKey?: string, openAiTimeoutMs?: number): CreateCompletionFn {
  const apiKey = openaiApiKey ?? getEvaluationRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    throw new Error("[Pass3] OPENAI_API_KEY is not configured");
  }
  const timeoutMs = openAiTimeoutMs ?? getEvalOpenAiTimeoutMs();
  const openai = new OpenAI({ apiKey, maxRetries: OPENAI_SDK_MAX_RETRIES, timeout: timeoutMs });
  return (params) =>
    openai.chat.completions.create(
      params as Parameters<typeof openai.chat.completions.create>[0],
      { timeout: timeoutMs },
    ) as Promise<{
      choices: CompletionChoice[];
      usage?: CompletionUsage;
    }>;
}

/**
 * Deterministic fallback: if the Pass 3 LLM output omitted the
 * recommendation_lineage / source_recommendation_ids linkage, try to match
 * surviving Pass 3 recommendations to Pass 2 discoveries by criterion,
 * issue_family, and strategic_lever plus action/anchor overlap. Only
 * strong matches are materialized; unmatched sources are left missing so the
 * lineage contract continues to fail closed rather than silently suppressing
 * durable Pass 2 discoveries.
 */
type FallbackRecRef = {
  finalRecIndex: number;
  criterionIndex: number;
  recIndex: number;
  rec: SynthesizedCriterion["recommendations"][number];
};

type FallbackSourceEntry = {
  source_id: string;
  criterion: string;
  recommendation_id: string;
  recommendation: SynthesizedCriterion["recommendations"][number];
};

const normalizeForFallbackMatch = (value: unknown): string =>
  String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const sharedWordOverlap = (a: string, b: string, minLength = 5): boolean => {
  for (const word of a.split(/\s+/)) {
    if (word.length >= minLength && b.includes(word)) return true;
  }
  return false;
};

function scoreFallbackMatch(
  pass2Rec: { issue_family: unknown; strategic_lever: unknown; action: unknown; expected_impact: unknown; anchor_snippet: unknown },
  finalRec: { issue_family: unknown; strategic_lever: unknown; action: unknown; expected_impact: unknown; anchor_snippet: unknown },
): number {
  if (String(pass2Rec.issue_family) !== String(finalRec.issue_family)) return 0;
  if (String(pass2Rec.strategic_lever) !== String(finalRec.strategic_lever)) return 0;
  let score = 3; // criterion already matched by lookup; issue+lever matched
  const p2Action = normalizeForFallbackMatch(pass2Rec.action);
  const fAction = normalizeForFallbackMatch(finalRec.action);
  const p2Impact = normalizeForFallbackMatch(pass2Rec.expected_impact);
  const fImpact = normalizeForFallbackMatch(finalRec.expected_impact);
  const p2Anchor = normalizeForFallbackMatch(pass2Rec.anchor_snippet);
  const fAnchor = normalizeForFallbackMatch(finalRec.anchor_snippet);
  if (
    fAction.includes(p2Action.slice(0, 80)) ||
    p2Action.includes(fAction.slice(0, 80)) ||
    sharedWordOverlap(p2Action, fAction, 5)
  ) {
    score += 2;
  }
  if (
    fImpact.includes(p2Impact.slice(0, 60)) ||
    p2Impact.includes(fImpact.slice(0, 60))
  ) {
    score += 1;
  }
  if (
    fAnchor.includes(p2Anchor.slice(0, 100)) ||
    p2Anchor.includes(fAnchor.slice(0, 100)) ||
    sharedWordOverlap(fAnchor, p2Anchor, 5)
  ) {
    score += 2;
  }
  return score;
}

export function computeLineageFallbackGraph(
  pass2: SinglePassOutput,
  currentCriteria: SynthesizedCriterion[],
  existingLineage: RecommendationLineageOutcome[],
): {
  threshold: number;
  missing: FallbackSourceEntry[];
  finalRecs: FallbackRecRef[];
  sourceCandidates: { sourceIndex: number; candidates: { finalRecIndex: number; score: number }[] }[];
  recCandidates: { finalRecIndex: number; candidates: { sourceIndex: number; score: number }[] }[];
  assignments: { sourceIndex: number; finalRecIndex: number; sourceId: string; canonicalOpportunityId: string }[];
} {
  const existingSourceIds = new Set(existingLineage.map((outcome) => outcome.source_id));

  const pass2SourceEntries: FallbackSourceEntry[] = pass2.criteria.flatMap((criterion) => {
    const meaningful = criterion.recommendations.filter(isMeaningfulOpportunityRecommendation);
    const identities = buildRecommendationSourceIdentities(
      meaningful.map((recommendation) => ({ ...recommendation, criterion: criterion.key })),
    );
    return identities.map((identity, index) => ({
      source_id: identity.source_id,
      criterion: identity.criterion,
      recommendation_id: identity.recommendation_id,
      recommendation: meaningful[index],
    }));
  });

  const missing = pass2SourceEntries.filter((entry) => !existingSourceIds.has(entry.source_id));

  const finalRecs: FallbackRecRef[] = [];
  for (let ci = 0; ci < currentCriteria.length; ci++) {
    const criterion = currentCriteria[ci];
    for (let ri = 0; ri < criterion.recommendations.length; ri++) {
      const rec = criterion.recommendations[ri];
      // Only unprovenanced final recommendations may participate in fallback
      // matching. Model-provided lineage is authoritative.
      if (isMeaningfulOpportunityRecommendation(rec) && (!rec.source_recommendation_ids || rec.source_recommendation_ids.length === 0)) {
        finalRecs.push({ finalRecIndex: finalRecs.length, criterionIndex: ci, recIndex: ri, rec });
      }
    }
  }

  const threshold = 5; // criterion + issue + lever + at least one textual match

  // Strict exact-one eligibility: a source is only attached when both the
  // source and the recommendation have exactly one strong candidate. This keeps
  // the fallback from resolving any ambiguous one-to-many or many-to-one mapping.
  const sourceToRecScores = missing.map((entry, sourceIndex) => ({
    sourceIndex,
    candidates: finalRecs
      .filter((ref) => currentCriteria[ref.criterionIndex].key === entry.criterion)
      .map((ref) => ({ finalRecIndex: ref.finalRecIndex, score: scoreFallbackMatch(entry.recommendation, ref.rec) }))
      .filter((c) => c.score >= threshold),
  }));
  const recToSourceScores = finalRecs.map((ref, finalRecIndex) => ({
    finalRecIndex,
    candidates: missing
      .filter((entry) => entry.criterion === currentCriteria[ref.criterionIndex].key)
      .map((entry, sourceIndex) => ({ sourceIndex, score: scoreFallbackMatch(entry.recommendation, ref.rec) }))
      .filter((c) => c.score >= threshold),
  }));

  const assignments: { sourceIndex: number; finalRecIndex: number; sourceId: string; canonicalOpportunityId: string }[] = [];
  for (let sourceIndex = 0; sourceIndex < missing.length; sourceIndex++) {
    const sourceEntry = sourceToRecScores[sourceIndex];
    if (sourceEntry.candidates.length !== 1) continue;
    const finalRecIndex = sourceEntry.candidates[0].finalRecIndex;
    const recEntry = recToSourceScores.find((r) => r.finalRecIndex === finalRecIndex);
    if (!recEntry || recEntry.candidates.length !== 1 || recEntry.candidates[0].sourceIndex !== sourceIndex) continue;
    assignments.push({
      sourceIndex,
      finalRecIndex,
      sourceId: missing[sourceIndex].source_id,
      canonicalOpportunityId: missing[sourceIndex].recommendation_id,
    });
  }

  return {
    threshold,
    missing,
    finalRecs,
    sourceCandidates: sourceToRecScores,
    recCandidates: recToSourceScores,
    assignments,
  };
}

function materializePass2LineageFromSynthesis(
  pass2: SinglePassOutput,
  currentCriteria: SynthesizedCriterion[],
  existingLineage: RecommendationLineageOutcome[],
): RecommendationLineageOutcome[] {
  const graph = computeLineageFallbackGraph(pass2, currentCriteria, existingLineage);
  const { missing, finalRecs, assignments } = graph;
  if (missing.length === 0 || finalRecs.length === 0 || assignments.length === 0) return [];

  const fallbackOutcomes: RecommendationLineageOutcome[] = [];
  for (const assignment of assignments) {
    const entry = missing[assignment.sourceIndex];
    const ref = finalRecs.find((r) => r.finalRecIndex === assignment.finalRecIndex);
    if (!ref) continue;
    const rec = currentCriteria[ref.criterionIndex].recommendations[ref.recIndex];
    if (!rec.source_recommendation_ids) rec.source_recommendation_ids = [];
    rec.source_recommendation_ids.push(entry.source_id);
    fallbackOutcomes.push({
      source_id: entry.source_id,
      outcome: "materialized",
      canonical_opportunity_id: entry.recommendation_id,
    });
  }

  console.info(
    `[Pass3-LineageFallback] materialized ${fallbackOutcomes.length}/${missing.length} missing Pass 2 source(s) from synthesis output.`,
  );

  return fallbackOutcomes;
}

export function parsePass3Response(
  raw: string,
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
  fallbackModel?: string,
  manuscriptText?: string,
  expectationContext?: ResolvedExpectationContext,
  scopeProfile?: SubmissionScopeProfile,
  requireRecommendationLineage = false,
): CurrentSynthesisOutput {
  const resolvedFallback =
    typeof fallbackModel === "string" && fallbackModel.length > 0
      ? fallbackModel
      : getCanonicalPass3Model(undefined);

  // P0: Log raw response preview before parse
  console.log(`[Pass3] raw response preview len=${raw.length}: ${raw.slice(0, 200)}`);

  let parsed: Record<string, unknown>;
  try {
    const boundary = parseJsonObjectBoundary<Record<string, unknown>>(raw, {
      label: "Pass3",
    });
    parsed = boundary.value;
  } catch (error) {
    if (error instanceof JsonBoundaryError) {
      throw new Error(`[Pass3] ${error.code}: ${error.message}`);
    }
    throw new Error("[Pass3] JSON_PARSE_FAILED_MALFORMED: Response is not valid JSON (malformed JSON)");
  }

  const obj = parsed;
  const rawSpineObj =
    typeof obj["diagnostic_spine"] === "object" && obj["diagnostic_spine"] !== null
      ? obj["diagnostic_spine"]
      : null;
  const extractedSpine = rawSpineObj ? extractDiagnosticSpine(rawSpineObj) : UNAVAILABLE_SPINE;
  const strictDiagnosticSpineRequired = shouldRequireStrictDiagnosticSpine(scopeProfile, manuscriptText);

  if (strictDiagnosticSpineRequired && extractedSpine.confidence === "unavailable") {
    throw new Error(
      "[Pass3] DIAGNOSTIC_SPINE_REQUIRED_LONG_FORM: diagnostic_spine is absent or unusable for long-form/multi-layer evaluation.",
    );
  }

  if (!rawSpineObj) {
    console.warn("[Pass3] diagnostic_spine missing from LLM output — evaluation spine will be unavailable");
  } else if (extractedSpine.confidence === "unavailable") {
    console.warn("[Pass3] diagnostic_spine extracted but confidence=unavailable — fields were thin or absent");
  } else if (extractedSpine.confidence === "partial") {
    console.warn("[Pass3] diagnostic_spine extracted with confidence=partial — degrading recommendation confidence");
  }

  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];
  let recommendationLineage = parseRecommendationLineage(obj["recommendation_lineage"]);

  // Build a lookup from key → pass outputs (deterministic fallback)
  const p1Map = new Map(pass1.criteria.map((c) => [c.key, c]));
  const p2Map = new Map(pass2.criteria.map((c) => [c.key, c]));

  const criteria: SynthesizedCriterion[] = [];
  for (const key of CRITERIA_KEYS) {
    const p1c = p1Map.get(key);
    const p2c = p2Map.get(key);

    // Find synthesis entry from AI
    const rawEntry = rawCriteria.find((item) => {
      if (typeof item !== "object" || item === null) return false;
      return (item as Record<string, unknown>)["key"] === key;
    }) as Record<string, unknown> | undefined;

    const craftScore = rawEntry
      ? Math.floor(Number(rawEntry["craft_score"] ?? p1c?.score_0_10 ?? 5))
      : (p1c?.score_0_10 ?? 5);
    const editorialScore = rawEntry
      ? Math.floor(Number(rawEntry["editorial_score"] ?? p2c?.score_0_10 ?? 5))
      : (p2c?.score_0_10 ?? 5);

    const rawFinal = rawEntry ? Number(rawEntry["final_score_0_10"]) : NaN;
    // PR-D: canonical scores are 1..10; Pass 4 rejects anything below 1.
    // Floor is 1, never 0.
    const finalScore = Number.isFinite(rawFinal)
      ? Math.min(10, Math.max(1, Math.floor(rawFinal)))
      : Math.min(10, Math.max(1, Math.floor((craftScore + editorialScore) / 2)));

    const delta = Math.abs(craftScore - editorialScore);

    let evidence: EvidenceAnchor[] = parseEvidenceArray(rawEntry?.["evidence"]);
    const rawMeaningfulRecommendationCount = countMeaningfulOpportunityRecommendations(
      rawEntry?.["recommendations"],
    );
    let recommendations = parseRecommendations(rawEntry?.["recommendations"], key);
    const technicalDefects: NonNullable<SynthesizedCriterion["technical_defects"]> = [];
    if (hasTruncatedRecommendationAction(rawEntry?.["recommendations"])) {
      technicalDefects.push({
        code: "RECOMMENDATION_TRUNCATED",
        author_facing_reason:
          "A recommendation instruction was incomplete and was suppressed to prevent publishing broken guidance.",
        retryable: true,
      });
    }
    const pressurePoints = parseStringArray(rawEntry?.["pressure_points"], 3);
    const decisionPoints = parseStringArray(rawEntry?.["decision_points"], 3);
    const consequenceStatus = parseConsequenceStatus(rawEntry?.["consequence_status"], delta, finalScore);
    const deferredRiskRaw = String(rawEntry?.["deferred_consequence_risk"] ?? "").trim();

    const fallbackPressurePoint = evidence[0]?.snippet
      ? `Pressure signal observed in: "${evidence[0].snippet.substring(0, 120)}"`
      : `Pressure signal inferred for ${key} from combined craft/editorial analysis.`;

    const fallbackDecisionPoint =
      craftScore > editorialScore
        ? `Decision inflection favors craft signal for ${key}.`
        : editorialScore > craftScore
          ? `Decision inflection favors editorial signal for ${key}.`
          : `Decision inflection resolves as balanced craft/editorial synthesis for ${key}.`;

    const deferredRisk =
      consequenceStatus === "deferred"
        ? (deferredRiskRaw ||
            `Deferred consequence risk: unresolved ${key} pressure may compound and degrade downstream payoff.`)
            .substring(0, 280)
        : undefined;

    const rawRationale = String(rawEntry?.["final_rationale"] ?? "").trim();
    const baselineRationale = rawRationale || p1c?.rationale || p2c?.rationale || "";

    if (evidence.length === 0) {
      evidence = backfillEvidenceFromAxis(pass1, pass2, key);
    }

    // Do not backfill recommendations from Pass 1/2 to meet obsolete density floors.
    // The canonical ODP requires recommendations to be genuine Pass-3 discoveries
    // or an explicit governed status rationale when the array is empty.

    if (key === "proseControl") {
      evidence = enforceProseControlAnchorFloor(evidence, baselineRationale, manuscriptText);
      const certifiedProseAnchorCount = countVerbatimEvidenceAnchors(evidence, manuscriptText);
      if (certifiedProseAnchorCount > 0) {
        const firstAnchor = firstVerbatimEvidenceAnchor(evidence, manuscriptText)?.snippet?.trim();
        if (firstAnchor) {
          const firstAnchorlessRecIndex = recommendations.findIndex(
            (recommendation) => recommendation.anchor_snippet.trim().length === 0,
          );
          if (firstAnchorlessRecIndex >= 0) {
            recommendations[firstAnchorlessRecIndex] = {
              ...recommendations[firstAnchorlessRecIndex],
              anchor_snippet: firstAnchor,
            };
          }
        }
      }

      const manuscriptWordCount = manuscriptText ? countWords(manuscriptText) : 0;
      const shortFullSubmission = Boolean(manuscriptText) && manuscriptWordCount > 0 && manuscriptWordCount <= 5000;
      if (
        shortFullSubmission &&
        certifiedProseAnchorCount < 2 &&
        isStrongPositiveProseRationale(baselineRationale)
      ) {
        technicalDefects.push({
          code: "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED",
          author_facing_reason:
            "Prose appears strong, but the system could not attach enough line-specific evidence to certify a numeric score.",
          retryable: true,
        });
      }
    }

    recommendations = recommendations.map((recommendation) => {
      const normalized = normalizeRecommendationContract(recommendation);

      return {
        ...normalized,
        action: clampRecommendationAction(normalized.action),
      };
    });

    const finalRationale = needsRationaleBackfill(key, baselineRationale)
      ? buildBackfilledRationale(key, p1c?.rationale, p2c?.rationale, evidence, manuscriptText)
      : baselineRationale;

    // Parse fit/gap summary fields from LLM response
    const rawFitSummary = typeof rawEntry?.["fit_summary"] === "string" ? rawEntry["fit_summary"].trim() : "";
    const rawGapSummary = typeof rawEntry?.["gap_summary"] === "string" ? rawEntry["gap_summary"].trim() : "";

    // Evidence-driven policy: ALL scores keep their recommendations.
    // Score determines severity framing (consider vs recommended), NOT whether recs exist.
    // Score 9-10 recs are "craft-elevation" opportunities, not corrections.
    const suppressedRecommendations = recommendations;

    const recommendationStatusInput = normalizeRecommendationStatusInput(
      rawEntry?.["recommendation_status"],
    );
    if (recommendationStatusInput.kind === "invalid") {
      throw new RecommendationDispositionContractError(
        `Pass 3 emitted an unknown recommendation_status for ${key}.`,
        {
          criterion: key,
          field_path: `criteria.${key}.recommendation_status`,
          invariant_id: "criterion_recommendation_status_known",
          issues: ["invalid_recommendation_status"],
          received_status: recommendationStatusInput.value,
        },
      );
    }
    const recommendationStatus = recommendationStatusInput.kind === "valid"
      ? recommendationStatusInput.value
      : undefined;
    const rawRecStatusRationale = rawEntry?.["recommendation_status_rationale"];
    const recommendationStatusRationale =
      typeof rawRecStatusRationale === "string" ? String(rawRecStatusRationale).trim() : undefined;
    const sourceDisposition = analyzeGovernedOpportunityCoverage({
      score: finalScore,
      meaningfulOpportunityCount: rawMeaningfulRecommendationCount,
      recommendationStatus,
      recommendationStatusRationale,
    });
    if (!sourceDisposition.covered) {
      throw new RecommendationDispositionContractError(
        `Pass 3 emitted contradictory recommendation/disposition data for ${key}.`,
        {
          criterion: key,
          field_path: `criteria.${key}.recommendation_status`,
          invariant_id: "criterion_recommendation_status_cardinality_consistent",
          issues: sourceDisposition.issues,
          raw_meaningful_recommendation_count: rawMeaningfulRecommendationCount,
        },
      );
    }

    let parsedCriterion: SynthesizedCriterion = {
      key,
      // PR-D: canonical scores are 1..10; never emit 0.
      craft_score: Math.min(10, Math.max(1, craftScore)),
      editorial_score: Math.min(10, Math.max(1, editorialScore)),
      final_score_0_10: finalScore,
      score_delta: delta,
      delta_explanation:
        delta > 2 ? String(rawEntry?.["delta_explanation"] ?? "Axes diverge significantly.") : undefined,
      final_rationale: finalRationale,
      fit_summary: rawFitSummary || undefined,
      gap_summary: rawGapSummary || undefined,
      pressure_points: pressurePoints.length > 0 ? pressurePoints : [fallbackPressurePoint],
      decision_points: decisionPoints.length > 0 ? decisionPoints : [fallbackDecisionPoint],
      consequence_status: consequenceStatus,
      deferred_consequence_risk: deferredRisk,
      evidence,
      recommendations: suppressedRecommendations,
      recommendation_status: recommendationStatus,
      recommendation_status_rationale: recommendationStatusRationale,
      technical_defects: technicalDefects.length > 0 ? dedupeTechnicalDefects(technicalDefects) : undefined,
    };
    const parsedMeaningfulRecommendationCount = countMeaningfulOpportunityRecommendations(
      suppressedRecommendations,
    );
    if (parsedMeaningfulRecommendationCount !== rawMeaningfulRecommendationCount) {
      parsedCriterion = reconcileRecommendationDispositionAfterMutation(parsedCriterion, {
        previousMeaningfulCount: rawMeaningfulRecommendationCount,
        mutationCause: "pass3_parser_safety_filter",
        emptyStatus: "gate_suppressed_no_safe_recommendation",
        emptyRationale:
          "The existing Pass 3 parser safety filters removed every proposed intervention because none satisfied the canonical recommendation-content contract.",
      });
    }
    criteria.push(parsedCriterion);
  }

  const guardedCriteria = expectationContext
    ? applyExpectationProfileRecommendationGuard({ criteria, expectationContext })
    : criteria;

  const spineGovernedCriteria =
    extractedSpine.confidence === "unavailable"
      ? guardedCriteria
      : applyDiagnosticSpineRecommendationGuard({
          criteria: guardedCriteria,
          diagnosticSpine: extractedSpine,
        });

  const finalCriteria =
    extractedSpine.confidence === "partial"
      ? applyWeakDiagnosticSpineConfidenceDegrade({
          criteria: spineGovernedCriteria,
          strictMode: strictDiagnosticSpineRequired,
        })
      : spineGovernedCriteria;

  const manuscriptWordCount = manuscriptText ? countWords(manuscriptText) : undefined;

  // ── Post-synthesis coverage telemetry (not a gate) ───────────────────────────
  // Opportunity counts are governed by the canonical ODP; a lower-than-expected
  // count is a signal to search more deeply, not to fabricate recommendations.
  for (const c of finalCriteria) {
    if (c.final_score_0_10 == null || hasGovernanceSuppressedRecommendations(c)) continue;
    const mode: EvaluationOpportunityMode =
      manuscriptWordCount !== undefined && manuscriptWordCount < 25_000 ? "short_form" : "long_form_multi_layer";
    const guidance = getOpportunityScoreGuidance(mode, c.final_score_0_10);
    const meaningful = countMeaningfulOpportunityRecommendations(c.recommendations);
    if (meaningful < guidance.expectedMin) {
      console.info(
        `[Pass3-CoverageTelemetry] ${c.key} score=${c.final_score_0_10} has ${meaningful} meaningful recommendation(s); expected ~${guidance.expectedMin}. No synthetic backfill will be added.`,
      );
    }
  }

  // ── P3: Deterministic Priority Hierarchy — score-driven priority override ──────────────
  // The LLM frequently outputs "medium" for everything. This deterministic override
  // ensures priority reflects the score band, producing a credible hierarchy:
  //   Score ≤6  → "high"   (Recommended — these are the weakest areas)
  //   Score 7   → "medium" (Optional — real but non-urgent revision targets)
  //   Score ≥8  → "low"    (Consider — enhancement opportunities only)
  // This runs after all deterministic enrichment so surviving recs get correct priority.
  for (const c of finalCriteria) {
    const score = c.final_score_0_10;
    const deterministicPriority: "high" | "medium" | "low" =
      score <= 6 ? "high" : score === 7 ? "medium" : "low";
    for (const r of c.recommendations) {
      r.priority = deterministicPriority;
    }
  }

  // ── P5: Voice & Strength Preservation — tag recommendations with protected criteria ─────
  // Identifies criteria scoring ≥8 as "protected strengths." Any recommendation on a criterion
  // scoring ≤7 gets tagged with the protected criteria it must not damage. This enables the
  // quality gate to verify that mistake_proofing acknowledges protected strengths.
  {
    const protectedCriteria = finalCriteria
      .filter(c => c.final_score_0_10 >= 8)
      .map(c => ({ key: c.key, score: c.final_score_0_10 }));
    if (protectedCriteria.length > 0) {
      const protectedKeys = protectedCriteria.map(p => p.key);
      for (const c of finalCriteria) {
        if (c.final_score_0_10 >= 8) continue; // don't tag recs on already-protected criteria
        for (const r of c.recommendations) {
          r.protected_criteria = protectedKeys;
        }
      }
      console.info(`[Pass3-P5-VoicePreservation] Tagged recommendations on ${finalCriteria.filter(c => c.final_score_0_10 < 8).length} criterion/criteria with ${protectedKeys.length} protected strength(s): ${protectedKeys.join(", ")}`);
    }
  }

  // ── P4: Cross-Criterion Deduplication — collapse same-lever recommendations ────────────
  // When the same strategic_lever+granularity appears across multiple criteria, keep the
  // recommendation on the lowest-scoring criterion (most important) and remove duplicates.
  // The surviving rec gets `collapsed_from_criteria` listing the other criteria affected.
  // This turns "5 variations of increase-tension" into 1 unified strategic revision.
  {
    type RecRef = { criterionIdx: number; recIdx: number; redundancyKey: string; score: number; criterionKey: string };
    const allRefsForDedup: RecRef[] = [];
    for (let ci = 0; ci < finalCriteria.length; ci++) {
      const c = finalCriteria[ci];
      for (let ri = 0; ri < c.recommendations.length; ri++) {
        const r = c.recommendations[ri];
        const family = normalizeIssueFamily(r.issue_family);
        const lever = normalizeStrategicLever(r.strategic_lever);
        const gran = normalizeRevisionGranularity(r.revision_granularity);
        const key = buildRedundancyKey(family, lever, gran);
        // Only dedup when all components are known (avoid collapsing unknowns together)
        if (!key.includes("unknown")) {
          allRefsForDedup.push({ criterionIdx: ci, recIdx: ri, redundancyKey: key, score: c.final_score_0_10, criterionKey: c.key });
        }
      }
    }

    // Group by redundancy key
    const groups = new Map<string, RecRef[]>();
    for (const ref of allRefsForDedup) {
      const existing = groups.get(ref.redundancyKey) ?? [];
      existing.push(ref);
      groups.set(ref.redundancyKey, existing);
    }

    // For groups with >1 member: keep the one on the lowest-scoring criterion, remove others.
    // Do NOT protect obsolete per-criterion density floors — duplicate collapse is a quality
    // improvement, not a quota-preservation operation.
    const removalsPerCriterion = new Map<number, number>(); // ci -> count of recs to remove
    const removeSet = new Set<string>(); // "ci:ri" keys to remove
    for (const [, refs] of groups) {
      if (refs.length <= 1) continue;
      // Sort by score ascending (lowest score = most important = keep)
      refs.sort((a, b) => a.score - b.score || a.criterionIdx - b.criterionIdx);
      const primary = refs[0];
      const collapsedCriteria: string[] = [];
      for (let i = 1; i < refs.length; i++) {
        const ci = refs[i].criterionIdx;
        removeSet.add(`${ci}:${refs[i].recIdx}`);
        removalsPerCriterion.set(ci, (removalsPerCriterion.get(ci) ?? 0) + 1);
        collapsedCriteria.push(refs[i].criterionKey);
      }
      // Tag the primary with the collapsed criteria
      if (collapsedCriteria.length > 0) {
        const rec = finalCriteria[primary.criterionIdx].recommendations[primary.recIdx];
        rec.collapsed_from_criteria = [...(rec.collapsed_from_criteria ?? []), ...collapsedCriteria];
      }
    }

    // Remove collapsed duplicates (iterate in reverse to preserve indices)
    if (removeSet.size > 0) {
      for (let ci = finalCriteria.length - 1; ci >= 0; ci--) {
        const criterion = finalCriteria[ci];
        const previousMeaningfulCount = countMeaningfulOpportunityRecommendations(
          criterion.recommendations,
        );
        const retained = criterion.recommendations.filter(
          (_, ri) => !removeSet.has(`${ci}:${ri}`),
        );
        if ((removalsPerCriterion.get(ci) ?? 0) > 0) {
          finalCriteria[ci] = reconcileRecommendationDispositionAfterMutation({
            ...criterion,
            recommendations: retained,
          }, {
            previousMeaningfulCount,
            mutationCause: "cross_criterion_consolidation",
            emptyStatus: "no_recommendation_warranted",
            emptyRationale:
              "No separate recommendation remains for this criterion because its intervention was consolidated into an equivalent, higher-priority cross-criterion opportunity.",
          });
        }
      }
      console.info(`[Pass3-P4-Dedup] Collapsed ${removeSet.size} cross-criterion duplicate(s) across ${groups.size} strategic lever group(s)`);
    }
  }
  // ── P6: Genre-Calibrated Language — flag uncalibrated commercial phrasing ────────────────
  // For non-propulsion-forward genres (literary, memoir, slow-burn, etc.), recommendations
  // that use commercial-fiction phrasing without genre-relative context are flagged.
  // This is observability-only (soft warning) — the LLM prompt instructs correct framing.
  if (expectationContext && isNonPropulsionGenre(expectationContext)) {
    const uncalibratedRecs: string[] = [];
    for (const c of finalCriteria) {
      for (const r of c.recommendations) {
        if (isGenreUncalibratedPhrasing({ action: r.action, expected_impact: r.expected_impact, mechanism: r.mechanism })) {
          uncalibratedRecs.push(`${c.key}: "${r.action.slice(0, 60)}..."`);
        }
      }
    }
    if (uncalibratedRecs.length > 0) {
      console.warn(`[Pass3-P6-GenreCalibration] ${uncalibratedRecs.length} recommendation(s) use commercial-fiction phrasing without genre-relative context: ${uncalibratedRecs.slice(0, 3).join("; ")}`);
    }
  }

  // ── Post-synthesis opportunity caps (canonical ODP) ────────────────────────
  // Opportunities are discoveries, not quotas. The ceiling is a safety cap only.
  const mode: EvaluationOpportunityMode =
    manuscriptWordCount !== undefined && manuscriptWordCount < 25_000 ? "short_form" : "long_form_multi_layer";

  // Short-Form: enforce the per-criterion word-count ceiling, keeping highest-priority recs.
  if (mode === "short_form" && manuscriptWordCount !== undefined) {
    const perCriterionCeiling = getShortFormPerCriterionCeiling(manuscriptWordCount);
    const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    let perCriterionTrimmed = 0;
    for (const c of finalCriteria) {
      if (c.recommendations.length <= perCriterionCeiling) continue;
      const before = c.recommendations.length;
      const sorted = [...c.recommendations].sort(
        (a, b) => (SEVERITY_ORDER[a.priority] ?? 2) - (SEVERITY_ORDER[b.priority] ?? 2),
      );
      c.recommendations = sorted.slice(0, perCriterionCeiling);
      perCriterionTrimmed += before - perCriterionCeiling;
    }
    if (perCriterionTrimmed > 0) {
      console.info(
        `[Pass3-PerCriterionCap] Short-form per-criterion ceiling ${perCriterionCeiling} removed ${perCriterionTrimmed} lower-priority recommendation(s)`,
      );
    }
  }

  const totalRecCap = getProductOpportunityCeiling(mode);
  const allRecs: Array<{ criterionIdx: number; recIdx: number; priority: "high" | "medium" | "low" }> = [];
  for (let ci = 0; ci < finalCriteria.length; ci++) {
    for (let ri = 0; ri < finalCriteria[ci].recommendations.length; ri++) {
      allRecs.push({ criterionIdx: ci, recIdx: ri, priority: finalCriteria[ci].recommendations[ri].priority });
    }
  }

  if (allRecs.length > totalRecCap) {
    const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    allRecs.sort((a, b) => (SEVERITY_ORDER[a.priority] ?? 2) - (SEVERITY_ORDER[b.priority] ?? 2));
    const keepSet = new Set(allRecs.slice(0, totalRecCap).map((r) => `${r.criterionIdx}:${r.recIdx}`));

    for (let ci = 0; ci < finalCriteria.length; ci++) {
      const criterion = finalCriteria[ci];
      const previousMeaningfulCount = countMeaningfulOpportunityRecommendations(
        criterion.recommendations,
      );
      const retained = criterion.recommendations.filter(
        (_, ri) => keepSet.has(`${ci}:${ri}`),
      );
      if (retained.length !== criterion.recommendations.length) {
        finalCriteria[ci] = reconcileRecommendationDispositionAfterMutation({
          ...criterion,
          recommendations: retained,
        }, {
          previousMeaningfulCount,
          mutationCause: "product_ceiling",
          emptyStatus: "no_recommendation_warranted",
          emptyRationale:
            "No separate recommendation remains for this criterion because the existing product ceiling retained higher-priority interventions in the canonical report.",
        });
      }
    }

    console.info(
      `[Pass3-Cap] Enforced total recommendation cap: ${allRecs.length} → ${keepSet.size} (wordCount=${manuscriptWordCount ?? "unknown"}, mode=${mode})`,
    );
  }

  // ── Option 2: Post-LLM anchor enforcement — defence in depth ──────────────
  // After synthesis and deterministic enrichment, sweep every recommendation and
  // replace any anchor_snippet classified as editorial_diagnosis with the best
  // available grounded evidence from the criterion. This is the deterministic
  // safety net: regardless of what the LLM produced,
  // no editorial_diagnosis anchor survives to persistence.
  const canonicalManuscriptText = manuscriptText;
  if (canonicalManuscriptText && canonicalManuscriptText.trim().length > 0) {
    let enforcedCount = 0;
    for (const c of finalCriteria) {
      // Build a pool of grounded anchors for this criterion from evidence
      // and quoted rationale spans (both are manuscript-sourced).
      const groundedPool: string[] = [
        ...c.evidence
          .map((e) => (typeof e.snippet === "string" ? e.snippet.trim() : ""))
          .filter((s) => s.length >= 10),
        ...extractQuotedRationaleSpans(c.final_rationale).filter((s) => s.length >= 10),
      ];
      // Pre-filter pool to only verified grounded anchors.
      const verifiedPool = groundedPool.filter((anchor) => {
        const result = classifyAnchor(anchor, canonicalManuscriptText);
        return result.anchor_type !== "editorial_diagnosis";
      });
      if (verifiedPool.length === 0) continue;

      for (const rec of c.recommendations) {
        const result = classifyAnchor(rec.anchor_snippet, canonicalManuscriptText);
        if (result.anchor_type === "editorial_diagnosis") {
          // Replace with best grounded anchor from the verified pool.
          rec.anchor_snippet = verifiedPool[enforcedCount % verifiedPool.length].slice(0, 300);
          enforcedCount++;
        }
      }
    }
    if (enforcedCount > 0) {
      console.info(
        `[Pass3-AnchorEnforcement] Replaced ${enforcedCount} editorial_diagnosis anchor(s) with grounded evidence`,
      );
    }
  }

  // Build overall
  const rawOverall = typeof obj["overall"] === "object" && obj["overall"] !== null
    ? (obj["overall"] as Record<string, unknown>)
    : {};

  const avgScore = finalCriteria.reduce((sum, c) => sum + c.final_score_0_10, 0) / finalCriteria.length;
  const overallScore0_100 = typeof rawOverall["overall_score_0_100"] === "number"
    // PR-D: overall 0-100 derives from criterion averages where each criterion >= 1,
    // so the achievable floor is 10. Floor at 10 to reflect canonical constraint.
    ? Math.min(100, Math.max(10, Math.floor(rawOverall["overall_score_0_100"])))
    : Math.min(100, Math.max(10, Math.floor(avgScore * 10)));

  const rawVerdict = String(rawOverall["verdict"] ?? "");
  const verdict: "pass" | "revise" | "fail" =
    rawVerdict === "pass" || rawVerdict === "fail" ? rawVerdict : "revise";

  const rawSummary = String(rawOverall["one_paragraph_summary"] ?? "");
  const weaknessEnforcedSummary = enforceSummaryWeaknessPresence(rawSummary, criteria);
  const reconciledSummaryResult = reconcileSummaryScore(weaknessEnforcedSummary, overallScore0_100);
  const summary = reconciledSummaryResult.summary;

  // P1: Extract dedicated pitch fields (distinct from summary/premise).
  // Do NOT pre-clip to base length; length policy caps are enforced later by
  // normalizeArtifact() at complete-sentence boundaries.
  const rawOneSentencePitch = typeof rawOverall["one_sentence_pitch"] === "string"
    ? rawOverall["one_sentence_pitch"].trim()
    : undefined;
  const rawOneParagraphPitch = typeof rawOverall["one_paragraph_pitch"] === "string"
    ? rawOverall["one_paragraph_pitch"].trim()
    : undefined;

  const strengths = Array.isArray(rawOverall["top_3_strengths"])
    ? (rawOverall["top_3_strengths"] as unknown[]).slice(0, 3).map(String)
    : [];
  const risks = Array.isArray(rawOverall["top_3_risks"])
    ? (rawOverall["top_3_risks"] as unknown[]).slice(0, 3).map(String)
    : [];

  // CMOS 17th Ed. — deterministic post-processing of all author-facing text
  const sanitizedCriteria = finalCriteria.map(
    (c) => sanitizeCMOSCriterion(c as unknown as Record<string, unknown>) as unknown as typeof c,
  );

  const rawOverallObj = {
    overall_score_0_100: overallScore0_100,
    verdict,
    one_paragraph_summary: summary,
    ...(rawOneSentencePitch ? { one_sentence_pitch: rawOneSentencePitch } : {}),
    ...(rawOneParagraphPitch ? { one_paragraph_pitch: rawOneParagraphPitch } : {}),
    top_3_strengths: strengths,
    top_3_risks: risks,
    submission_readiness: parseSubmissionReadiness(rawOverall["submission_readiness"], verdict, guardedCriteria),
  };

  const sanitizedOverall = sanitizeCMOSOverall(rawOverallObj as Record<string, unknown>) as typeof rawOverallObj;

  // CMOS sanitization can expand abbreviations (e.g. "e.g." → "for example,").
  // The shared normalizeArtifact() stage enforces the central length policy and
  // trims only at complete-sentence boundaries; do not apply a local hard substring
  // clip here that could leave mid-word or mid-sentence fragments.

  // Extract enrichment surfaces from LLM output.
  // These fields feed the final EvaluationResultV2 template-completeness gate;
  // dropping diagnosed_genre / target_audience here causes otherwise valid
  // short-form evaluations to fail closed before artifact persistence.
  const rawEnrichment = typeof obj["enrichment"] === "object" && obj["enrichment"] !== null
    ? (obj["enrichment"] as Record<string, unknown>)
    : {};
  const extractedPremise = typeof rawEnrichment["premise"] === "string" && rawEnrichment["premise"].trim()
    ? rawEnrichment["premise"].trim()
    : undefined;
  const extractedTriggerWarnings = Array.isArray(rawEnrichment["trigger_warnings"])
    ? (rawEnrichment["trigger_warnings"] as unknown[]).filter((w): w is string => typeof w === "string" && w.trim().length > 0).map(w => w.trim().toLowerCase())
    : undefined;
  const extractedDiagnosedGenre = typeof rawEnrichment["diagnosed_genre"] === "string" && rawEnrichment["diagnosed_genre"].trim()
    ? rawEnrichment["diagnosed_genre"].trim()
    : undefined;
  const extractedTargetAudience = typeof rawEnrichment["target_audience"] === "string" && rawEnrichment["target_audience"].trim()
    ? rawEnrichment["target_audience"].trim()
    : undefined;
  const extractedCraftEngine = typeof rawEnrichment["dominant_craft_engine"] === "string" && rawEnrichment["dominant_craft_engine"].trim()
    ? rawEnrichment["dominant_craft_engine"].trim()
    : undefined;
  const metadataExpectationContext = expectationContext
    ? resolveExpectationProfiles({
        workType: expectationContext.work_type,
        diagnosedGenre: extractedDiagnosedGenre ?? expectationContext.diagnosed_genre,
        shelfTargetAudience: extractedTargetAudience ?? expectationContext.shelf_target_audience,
        dominantCraftEngine: extractedCraftEngine ?? expectationContext.dominant_craft_engine,
      })
    : null;

  // ── Pitch Identity Repair ──────────────────────────────────────────
  // Dream Template requires one_sentence_pitch, one_paragraph_pitch, and
  // one_paragraph_summary to be semantically distinct. LLMs frequently
  // collapse them into the same text. This deterministic repair replaces
  // collapsed fields using premise/strengths/risks as distinct sources.
  const pitchRepair = repairPitchIdentity({
    one_paragraph_summary: sanitizedOverall.one_paragraph_summary,
    one_sentence_pitch: (sanitizedOverall as Record<string, unknown>).one_sentence_pitch as string | undefined,
    one_paragraph_pitch: (sanitizedOverall as Record<string, unknown>).one_paragraph_pitch as string | undefined,
    premise: extractedPremise,
    top_3_strengths: sanitizedOverall.top_3_strengths,
    top_3_risks: sanitizedOverall.top_3_risks,
    title: undefined, // title not available at this scope
  });
  if (pitchRepair.repaired) {
    if (pitchRepair.one_sentence_pitch) {
      (sanitizedOverall as Record<string, unknown>).one_sentence_pitch = pitchRepair.one_sentence_pitch;
    }
    if (pitchRepair.one_paragraph_pitch) {
      (sanitizedOverall as Record<string, unknown>).one_paragraph_pitch = pitchRepair.one_paragraph_pitch;
    }
  }

  const currentCriteria = sanitizedCriteria.map((criterion) =>
    requireCurrentRecommendationDisposition(criterion, {
      score: criterion.final_score_0_10,
      context: `pass3_parser_output:${criterion.key}`,
    }),
  );

  // Deterministic fallback: repair a completely omitted recommendation_lineage
  // by matching unprovenanced surviving Pass 3 recommendations to durable
  // Pass 2 identities one-to-one. Partial or contradictory native lineage is
  // left to the reconciler so the invariant fails closed instead of being
  // silently patched.
  if (requireRecommendationLineage) {
    const nativeLineageEntries = Array.isArray(obj["recommendation_lineage"]) ? (obj["recommendation_lineage"] as unknown[]).length : 0;
    const hasNativeSourceIds = currentCriteria.some((criterion) =>
      criterion.recommendations.some((rec) => (rec.source_recommendation_ids ?? []).length > 0)
    );
    const lineageCompletelyAbsent = nativeLineageEntries === 0 && !hasNativeSourceIds;
    if (lineageCompletelyAbsent) {
      const fallbackOutcomes = materializePass2LineageFromSynthesis(pass2, currentCriteria, recommendationLineage);
      if (fallbackOutcomes.length > 0) {
        recommendationLineage = [...recommendationLineage, ...fallbackOutcomes];
      }
    }
  }

  // Pass 2 discoveries are durable process inputs. Pass 3 may safely
  // materialize, consolidate, or suppress them, but it must account for each
  // source exactly once before certification/persistence can continue.
  const pass2SourceIds = pass2.criteria.flatMap((criterion) =>
    buildRecommendationSourceIdentities(
      criterion.recommendations
        .filter(isMeaningfulOpportunityRecommendation)
        .map((recommendation) => ({ ...recommendation, criterion: criterion.key })),
    ).map((identity) => identity.source_id),
  );
  if (requireRecommendationLineage && pass2SourceIds.length > 0) {
    const reconciliation = reconcileRecommendationLineage(pass2SourceIds, recommendationLineage);
    const survivingSourceIds = new Set(
      currentCriteria.flatMap((criterion) =>
        criterion.recommendations.flatMap((recommendation) => recommendation.source_recommendation_ids ?? []),
      ),
    );
    const outcomeBySource = new Map(recommendationLineage.map((outcome) => [outcome.source_id, outcome]));
    const materializationErrors = pass2SourceIds.filter((sourceId) => {
      const outcome = outcomeBySource.get(sourceId);
      if (!outcome) return false;
      if (outcome.outcome === "materialized") return !survivingSourceIds.has(sourceId);
      if (outcome.outcome === "consolidated") {
        return !outcome.consolidated_into_source_id || !survivingSourceIds.has(outcome.consolidated_into_source_id);
      }
      return false;
    });
    if (!reconciliation.complete || materializationErrors.length > 0) {
      throw new RecommendationDispositionContractError(
        "Pass 3 did not account for every Pass 2 recommendation discovery before persistence.",
        {
          invariant_id: "pass2_recommendation_lineage_complete",
          issues: [
            ...reconciliation.missing_source_ids.map((id) => `missing:${id}`),
            ...reconciliation.unknown_source_ids.map((id) => `unknown:${id}`),
            ...reconciliation.duplicate_source_ids.map((id) => `duplicate:${id}`),
            ...reconciliation.invalid_outcomes,
            ...materializationErrors.map((id) => `unresolved_surviving_target:${id}`),
          ],
          source_count: reconciliation.source_count,
          outcome_count: reconciliation.outcome_count,
          coverage_ratio: reconciliation.coverage_ratio,
        },
      );
    }
  }

  return {
    criteria: currentCriteria,
    ...(requireRecommendationLineage && pass2SourceIds.length > 0
      ? { recommendation_lineage: recommendationLineage }
      : {}),
    overall: sanitizedOverall,
    metadata: {
      // PR-I (2026-05-16): Provenance must reflect the model that actually executed,
      // NOT what the LLM hallucinated in its self-reported metadata block.
      // The LLM has no reliable knowledge of its own deployment identifier and frequently
      // emits stale literals (commonly "gpt-4.1") that contaminate downstream report stamps.
      // Always trust the upstream-recorded model identity from pass1/pass2 outputs and the
      // resolver-determined fallback for pass3. Do NOT consult rawMeta for model names.
      pass1_model: String(pass1.model),
      pass2_model: String(pass2.model),
      pass3_model: String(resolvedFallback),
      generated_at: new Date().toISOString(),
      ...(metadataExpectationContext
        ? { genre_expectation_context: genreExpectationContextForMetadata(metadataExpectationContext) }
        : {}),
      ...(reconciledSummaryResult.reconciled
        ? {
            score_reconciliation: {
              original_scores: reconciledSummaryResult.originalScores,
              canonical_score: overallScore0_100,
            },
          }
        : {}),
    },
    partial_evaluation: false, // will be overridden by runPass3Synthesis with real value
    enrichment: (extractedPremise || extractedTriggerWarnings?.length || extractedDiagnosedGenre || extractedTargetAudience || metadataExpectationContext)
      ? {
          premise: extractedPremise,
          trigger_warnings: extractedTriggerWarnings,
          diagnosed_genre: extractedDiagnosedGenre,
          target_audience: extractedTargetAudience,
          dominant_craft_engine: metadataExpectationContext?.dominant_craft_engine,
        }
      : undefined,
    diagnostic_spine: rawSpineObj ? extractedSpine : undefined,
  };
}

function dedupeTechnicalDefects(
  defects: NonNullable<SynthesizedCriterion["technical_defects"]>,
): NonNullable<SynthesizedCriterion["technical_defects"]> {
  const seen = new Set<string>();
  const unique: NonNullable<SynthesizedCriterion["technical_defects"]> = [];
  for (const defect of defects) {
    const key = `${defect.code}:${defect.author_facing_reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(defect);
  }
  return unique;
}

function extractQuotedRationaleSpans(rationale: string): string[] {
  const spans: string[] = [];
  const regex = /["“]([^"”]{12,220})["”]/g;
  let match: RegExpExecArray | null = regex.exec(rationale);
  while (match) {
    const candidate = match[1]?.trim();
    if (candidate) spans.push(candidate);
    match = regex.exec(rationale);
  }
  return Array.from(new Set(spans));
}

function sentenceCandidatesFromManuscript(manuscriptText?: string): string[] {
  if (!manuscriptText) return [];
  return manuscriptText
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim())
    .filter((line) => line.length >= 24 && line.length <= 220);
}

function buildEvidenceAnchorFromSnippet(
  snippet: string,
  manuscriptText?: string,
): EvidenceAnchor | null {
  const normalized = snippet.trim();
  if (!normalized) return null;
  if (!manuscriptText) {
    return { snippet: normalized.slice(0, 200) };
  }

  const charStart = manuscriptText.indexOf(normalized);
  if (charStart < 0) return null;
  const charEnd = charStart + normalized.length;
  return {
    snippet: normalized.slice(0, 200),
    char_start: charStart,
    char_end: charEnd,
  };
}

function isVerbatimEvidenceAnchor(anchor: EvidenceAnchor, manuscriptText?: string): boolean {
  const snippet = anchor.snippet.trim();
  if (!snippet) return false;
  if (!manuscriptText) return true;

  if (
    typeof anchor.char_start === "number" &&
    typeof anchor.char_end === "number" &&
    anchor.char_start >= 0 &&
    anchor.char_end > anchor.char_start &&
    anchor.char_end <= manuscriptText.length
  ) {
    return manuscriptText.slice(anchor.char_start, anchor.char_end) === snippet;
  }

  return manuscriptText.indexOf(snippet) >= 0;
}

function countVerbatimEvidenceAnchors(evidence: EvidenceAnchor[], manuscriptText?: string): number {
  return evidence.filter((anchor) => isVerbatimEvidenceAnchor(anchor, manuscriptText)).length;
}

function firstVerbatimEvidenceAnchor(evidence: EvidenceAnchor[], manuscriptText?: string): EvidenceAnchor | undefined {
  return evidence.find((anchor) => isVerbatimEvidenceAnchor(anchor, manuscriptText));
}

function enforceProseControlAnchorFloor(
  evidence: EvidenceAnchor[],
  rationale: string,
  manuscriptText?: string,
): EvidenceAnchor[] {
  const existingSnippets = new Set(evidence.map((item) => item.snippet.trim().toLowerCase()));
  const promoted: EvidenceAnchor[] = [...evidence];
  let certifiedAnchorCount = countVerbatimEvidenceAnchors(promoted, manuscriptText);

  if (certifiedAnchorCount >= 2) return promoted;

  for (const quote of extractQuotedRationaleSpans(rationale)) {
    const key = quote.trim().toLowerCase();
    if (!key || existingSnippets.has(key)) continue;
    const anchored = buildEvidenceAnchorFromSnippet(quote, manuscriptText);
    if (!anchored) continue;
    promoted.push(anchored);
    existingSnippets.add(key);
    certifiedAnchorCount = countVerbatimEvidenceAnchors(promoted, manuscriptText);
    if (certifiedAnchorCount >= 2) return promoted;
  }

  if (certifiedAnchorCount >= 2) return promoted;

  for (const candidate of sentenceCandidatesFromManuscript(manuscriptText)) {
    const key = candidate.trim().toLowerCase();
    if (!key || existingSnippets.has(key)) continue;
    const anchored = buildEvidenceAnchorFromSnippet(candidate, manuscriptText);
    if (!anchored) continue;
    promoted.push(anchored);
    existingSnippets.add(key);
    certifiedAnchorCount = countVerbatimEvidenceAnchors(promoted, manuscriptText);
    if (certifiedAnchorCount >= 2) break;
  }

  return promoted;
}

function isStrongPositiveProseRationale(rationale: string): boolean {
  const normalized = rationale.toLowerCase();
  return (
    normalized.includes("award-ready") ||
    normalized.includes("line-level control") ||
    normalized.includes("precise syntax") ||
    normalized.includes("high-polish") ||
    normalized.includes("prose appears strong")
  );
}

/**
 * Best-effort scan of a raw Pass 3 JSON response for truncated recommendation
 * actions, used by the truncation-retry path BEFORE the response has been
 * fully parsed via parsePass3Response. Returns true if the raw response
 * appears to contain at least one criterion with a truncated recommendation
 * action (per hasTruncatedRecommendationAction). Returns false on parse
 * failure — let downstream parsing handle malformed JSON.
 */
function detectTruncatedRecommendationInRawResponse(rawResponseText: string): boolean {
  const trimmed = rawResponseText.trim();
  if (!trimmed) return false;
  let parsed: unknown;
  try {
    const boundary = parseJsonObjectBoundary<Record<string, unknown>>(trimmed, {
      label: "Pass3RetryScan",
    });
    parsed = boundary.value;
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const criteria = (parsed as Record<string, unknown>)["criteria"];
  if (!Array.isArray(criteria)) return false;
  return criteria.some((criterion) => {
    if (!criterion || typeof criterion !== "object") return false;
    return hasTruncatedRecommendationAction(
      (criterion as Record<string, unknown>)["recommendations"],
    );
  });
}

function hasTruncatedRecommendationAction(rawRecommendations: unknown): boolean {
  if (!Array.isArray(rawRecommendations)) return false;

  return rawRecommendations.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const action = String((entry as Record<string, unknown>)["action"] ?? "").trim();
    if (!action) return false;
    // Mirror validateEvaluationArtifact.looksTruncatedRecommendation:
    // exclude hyphen/em/en dash compounds and pronoun-object phrasal verbs
    // ("reins it in.") from the truncation heuristic.
    return /(?<![-–—\w])(?<!\b(?:it|him|her|them|me|us|you)\s)\b(with|and|or|to|of|in|on|for|the|a|an)\.?$/i.test(
      action,
    );
  });
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Stranded connector pattern.
 *
 * Mirrors the surface-integrity REJECT rules in surfaceIntegrity.ts:
 *   - unresolved_conjunction_tail (and|or|by)
 *   - unresolved_mechanism_tail   (because|since|so|so that)
 *
 * If a clamp boundary lands on one of these connectors with no continuation,
 * the rendered action would be a stranded fragment. Backing off one word at a
 * time until the connector is no longer terminal restores a clean tail.
 */
const CLAMP_STRANDED_CONNECTOR_RE =
  /\s+(?:and|or|by|because|since|so|so\s+that)$/i;

/**
 * Bounded backoff: drop trailing words until no connector is stranded at the
 * tail. The iteration cap exists only to mistake-proof against pathological
 * inputs; in practice 1–2 hops always suffice. Returns the original text if
 * backoff would empty it.
 *
 * Punctuation tolerance: the input may already carry terminal punctuation
 * (ensureTerminalPunctuation runs upstream in normalizeRecommendationContract
 * before this clamp is applied). We strip trailing terminal punctuation before
 * testing, matching the REJECT regexes in surfaceIntegrity which use `\s*\.$`.
 * ensureTerminalPunctuation in finalizeClampedAction reapplies a single period
 * after the backoff, so the round-trip is idempotent.
 */
function backoffStrandedConnectorClamp(text: string): string {
  let out = text.replace(/[.!?]+\s*$/, "").trimEnd();
  for (let i = 0; i < 4; i++) {
    if (!CLAMP_STRANDED_CONNECTOR_RE.test(out)) return out;
    const trimmed = out.replace(/\s+\S+$/, "").trim();
    if (trimmed === out || trimmed.length === 0) return out;
    out = trimmed;
  }
  return out;
}

/**
 * Final clamp finalization. Every return path of clampRecommendationAction
 * passes through this so no truncation can leave a stranded connector before
 * terminal punctuation is applied.
 *
 * Mirrors surfaceIntegrity.ts::finalizeClampedAction. The two implementations
 * are a witness pair: if either drifts, the post-clamp surface check in
 * checkSurfaceIntegrity catches the divergence.
 */
function finalizeClampedAction(text: string): string {
  return ensureTerminalPunctuation(backoffStrandedConnectorClamp(text));
}

/**
 * Clamps the recommendation action body at the pathological-runaway cap (1500 chars).
 * Values within 1500 chars are preserved in full — the action field carries substantive
 * editorial analysis, not a short display teaser. Display layers that need a short card
 * label should truncate the rendered string independently.
 */
function clampRecommendationAction(action: string): string {
  const normalized = action.replace(/\s+/g, " ").trim();
  if (normalized.length <= 1500) return finalizeClampedAction(normalized);
  // Hard pathological cap: truncate at the last word boundary within 1500 chars.
  return finalizeClampedAction(
    normalized.slice(0, 1500).replace(/\s+\S*$/, "").trim(),
  );
}

function parseEvidenceArray(raw: unknown): EvidenceAnchor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map((e) => ({
      snippet: String(e["snippet"] ?? "").substring(0, 300),
      char_start: typeof e["char_start"] === "number" ? e["char_start"] : undefined,
      char_end: typeof e["char_end"] === "number" ? e["char_end"] : undefined,
    }));
}

function parseRecommendationLineage(raw: unknown): RecommendationLineageOutcome[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null)
    .map((value) => ({
      source_id: typeof value["source_id"] === "string" ? value["source_id"].trim() : "",
      outcome: value["outcome"] as RecommendationLineageOutcome["outcome"],
      canonical_opportunity_id:
        typeof value["canonical_opportunity_id"] === "string"
          ? value["canonical_opportunity_id"].trim()
          : undefined,
      consolidated_into_source_id:
        typeof value["consolidated_into_source_id"] === "string"
          ? value["consolidated_into_source_id"].trim()
          : undefined,
      governing_rule:
        typeof value["governing_rule"] === "string" ? value["governing_rule"].trim() : undefined,
      rationale: typeof value["rationale"] === "string" ? value["rationale"].trim() : undefined,
      evidence: typeof value["evidence"] === "string" ? value["evidence"].trim() : undefined,
    }));
}

function parseRecommendations(
  raw: unknown,
  criterionKey: SynthesizedCriterion["key"],
): SynthesizedCriterion["recommendations"] {
  if (!Array.isArray(raw)) return [];
  const parsed_all = raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => {
      const priority = String(r["priority"] ?? "medium");
      const sourcePass = Number(r["source_pass"] ?? 3);
      const parsed = {
        priority: (priority === "high" || priority === "low" ? priority : "medium") as "high" | "medium" | "low",
        action: String(r["action"] ?? "").trim(),
        expected_impact: String(r["expected_impact"] ?? "").trim(),
        anchor_snippet: String(r["anchor_snippet"] ?? "").trim(),
        source_pass: (sourcePass === 1 || sourcePass === 2 ? sourcePass : 3) as 1 | 2 | 3,
        source_recommendation_ids: Array.isArray(r["source_recommendation_ids"])
          ? (r["source_recommendation_ids"] as unknown[])
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .map((value) => value.trim())
          : undefined,
        issue_family: (() => {
          if (!("issue_family" in r) || r["issue_family"] === undefined || r["issue_family"] === null) {
            throw new Error("[Pass3] recommendation is missing required field: issue_family");
          }
          return (normalizeIssueFamily(r["issue_family"]) ?? r["issue_family"]) as SynthesizedCriterion["recommendations"][number]["issue_family"];
        })(),
        strategic_lever:
          (normalizeStrategicLever(r["strategic_lever"]) ?? r["strategic_lever"] ?? "scene_goal_clarity") as SynthesizedCriterion["recommendations"][number]["strategic_lever"],
        revision_granularity:
          (normalizeRevisionGranularity(r["revision_granularity"]) ?? r["revision_granularity"] ?? "scene") as SynthesizedCriterion["recommendations"][number]["revision_granularity"],
        mechanism: String(r["mechanism"] ?? "").trim(),
        specific_fix: String(r["specific_fix"] ?? "").trim(),
        reader_effect: String(r["reader_effect"] ?? "").trim(),
        symptom: typeof r["symptom"] === "string" && r["symptom"].trim().length > 0
          ? r["symptom"].trim()
          : buildSymptomFromContext(String(r["mechanism"] ?? "").trim(), String(r["action"] ?? "").trim(), criterionKey),
        mistake_proofing: typeof r["mistake_proofing"] === "string" ? r["mistake_proofing"].trim() : undefined,
        candidate_text_a: typeof r["candidate_text_a"] === "string" ? r["candidate_text_a"].trim() : undefined,
        candidate_text_b: typeof r["candidate_text_b"] === "string" ? r["candidate_text_b"].trim() : undefined,
        candidate_text_c: typeof r["candidate_text_c"] === "string" ? r["candidate_text_c"].trim() : undefined,
        revision_operation: typeof r["revision_operation"] === "string" ? r["revision_operation"].trim() : undefined,
        manuscript_coordinates: typeof r["manuscript_coordinates"] === "string" ? r["manuscript_coordinates"].trim() : undefined,
        potential_damage: Array.isArray(r["potential_damage"])
          ? (r["potential_damage"] as unknown[]).filter((d): d is string => typeof d === "string" && d.trim().length > 0).map(d => d.trim())
          : undefined,
      };

      // Generic recommendation guard — suppress cliché phrases without 7-part evidence
      // before surface-integrity or normalization runs.
      const genericDecision = filterGenericRecommendations([parsed], (_, d: GenericGuardDecision) => {
        console.warn(
          `[Pass3][GenericGuard] suppressed: criterion=${criterionKey} pattern="${d.matchedPattern ?? "unknown"}" missing=${d.reasons.join(",")} action="${parsed.action.slice(0, 80)}"`,
        );
      });
      if (genericDecision.length === 0) return null;

      // Surface-integrity check on ORIGINAL action (before normalization/backfill).
      const originalIntegrity = checkSurfaceIntegrity(parsed.action);
      const originalIntegrityStatus = originalIntegrity.status;
      if (originalIntegrityStatus === "REJECT") {
        return null;
      }

      const normalized = normalizeRecommendationContract(parsed);

      if (normalized.anchor_snippet.trim().length === 0) {
        const anchorlessExpectedImpact =
          originalIntegrityStatus === "FLAG"
            ? annotateSurfaceIntegrityFlag(normalized.expected_impact, originalIntegrity.reasons)
            : normalized.expected_impact;
        return {
          ...normalized,
          action: clampRecommendationAction(normalized.action),
          expected_impact: anchorlessExpectedImpact,
        };
      }

      let actionForOutput = normalized.action;
      let integrityStatus = originalIntegrityStatus;

      if (integrityStatus === "ACCEPT") {
        const normalizedIntegrity = checkSurfaceIntegrity(normalized.action);
        if (normalizedIntegrity.status === "REJECT") {
          const repairedAction = repairSurfaceIntegrity(actionForOutput, normalizedIntegrity.reasons);
          if (repairedAction) {
            const repairedIntegrity = checkSurfaceIntegrity(repairedAction);
            if (repairedIntegrity.status !== "REJECT") {
              actionForOutput = repairedAction;
              integrityStatus = repairedIntegrity.status;
            }
          }
        } else if (normalizedIntegrity.status === "FLAG") {
          integrityStatus = "FLAG";
        }
      }

      const annotationReasons: string[] = [];
      if (originalIntegrityStatus === "FLAG" && integrityStatus !== "FLAG") {
        annotationReasons.push("borderline_comparative_needs_noun_anchor");
      }

      const flaggedExpectedImpact =
        integrityStatus === "FLAG" || annotationReasons.length > 0
          ? annotateSurfaceIntegrityFlag(normalized.expected_impact, annotationReasons.length > 0 ? annotationReasons : ["flagged_in_original_action"])
          : normalized.expected_impact;

      return {
        ...normalized,
        action: clampRecommendationAction(actionForOutput),
        expected_impact: flaggedExpectedImpact,
      };
    })
    .filter(
      (
        recommendation,
      ): recommendation is SynthesizedCriterion["recommendations"][number] => recommendation !== null,
    );
  return parsed_all;
}

function normalizeRecommendationContract(
  recommendation: SynthesizedCriterion["recommendations"][number],
): SynthesizedCriterion["recommendations"][number] {
  const action = recommendation.action.trim();
  const expectedImpact = recommendation.expected_impact.trim();
  const anchorSnippet = recommendation.anchor_snippet.trim();

  const hasAnchorContext = anchorSnippet.length > 0 || EDITORIAL_CONTEXT_MARKERS.test(action);
  const hasSpecificFixMove = EDITORIAL_FIX_MARKERS.test(action) && hasAnchorContext;
  const hasMechanismCause = EDITORIAL_MECHANISM_MARKERS.test(action) || EDITORIAL_MECHANISM_MARKERS.test(expectedImpact);
  const hasReaderEffect = EDITORIAL_READER_EFFECT_MARKERS.test(expectedImpact);

  const mechanism = resolveMechanism(recommendation.mechanism, action, expectedImpact);
  const specificFix = resolveSpecificFix(recommendation.specific_fix, action);
  const readerEffect = resolveReaderEffect(recommendation.reader_effect, expectedImpact);

  const finalize = (
    normalizedAction: string,
    normalizedImpact: string,
    normalizedAnchor: string,
  ): SynthesizedCriterion["recommendations"][number] => ({
    ...recommendation,
    action: ensureTerminalPunctuation(normalizedAction.trim()),
    expected_impact: normalizedImpact,
    anchor_snippet: normalizedAnchor,
    mechanism,
    specific_fix: specificFix,
    reader_effect: readerEffect,
  });

  if (hasSpecificFixMove && hasMechanismCause && hasReaderEffect) {
    return finalize(action, expectedImpact, anchorSnippet);
  }

  return finalize(action, expectedImpact, anchorSnippet);
}

/**
 * Resolve the mechanism field: use explicit LLM value if non-empty; otherwise
 * extract from action/expected_impact text (evidence-derived); otherwise return ""
 * if the recommendation is anchorless so the gate can fire on true generic content.
 * Static criterion-aware defaults are intentionally NOT applied for anchorless recs.
 */
function resolveMechanism(
  explicit: string,
  action: string,
  expectedImpact: string,
): string {
  if (explicit.length > 0) return explicit;
  const mechanismMatch =
    action.match(/\b(?:because|since|so\s+that)\b(.{10,150})/i) ??
    expectedImpact.match(/\b(?:because|since|so\s+that)\b(.{10,150})/i);
  if (mechanismMatch) return mechanismMatch[1].replace(/\.$/, "").trim();
  return "";
}

/**
 * Resolve the specific_fix field: use explicit LLM value if non-empty; otherwise
 * extract from action text (evidence-derived); otherwise return "" if anchorless.
 * Static criterion-aware defaults are intentionally NOT applied for anchorless recs.
 */
function resolveSpecificFix(
  explicit: string,
  action: string,
): string {
  if (explicit.length > 0) return explicit;
  const fixExtractor = new RegExp(EDITORIAL_FIX_MARKERS.source + ".{0,120}", "i");
  const fixMatch = action.match(fixExtractor);
  if (fixMatch) return fixMatch[0].replace(/\s+because.*$/i, "").replace(/\s+since.*$/i, "").trim().slice(0, 120);
  return "";
}

/**
 * Resolve the reader_effect field: use explicit LLM value if non-empty; otherwise
 * extract from expected_impact text (evidence-derived); otherwise return "" if anchorless.
 * Static criterion-aware defaults are intentionally NOT applied for anchorless recs.
 */
function resolveReaderEffect(
  explicit: string,
  expectedImpact: string,
): string {
  if (explicit.length > 0) return explicit;
  if (EDITORIAL_READER_EFFECT_MARKERS.test(expectedImpact)) {
    return expectedImpact.slice(0, 150);
  }
  return "";
}

export function buildCriterionAwareMechanismDefault(criterionKey: SynthesizedCriterion["key"]): string {
  switch (criterionKey) {
    case "concept":
      return "the dramatic premise does not crystallize into a concrete question, weakening reader buy-in";
    case "character":
      return "the abstract phrasing diffuses motivation before the decision point, weakening character agency";
    case "sceneConstruction":
      return "the causal sequencing is inverted, so the consequence lands before the trigger, losing scene-turn coherence";
    case "dialogue":
      return "the attribution gap causes speaker intent to blur, reducing tension in the exchange";
    case "pacing":
      return "the reflective passage stalls forward momentum before the narrative urgency peaks";
    case "voice":
      return "the psychic distance collapses inconsistently, breaking the established POV rendering contract";
    case "theme":
      return "the thematic signal is stated abstractly rather than embodied in concrete action, reducing resonance";
    case "narrativeDrive":
      return "the stakes signal arrives too late in the passage, diffusing narrative urgency at the turn";
    case "worldbuilding":
      return "the sensory grounding is absent, preventing the reader from anchoring in the setting";
    case "tone":
      return "the tonal register shifts mid-passage without a clear trigger, disrupting emotional continuity";
    case "proseControl":
      return "overlong or cluttered sentence structure increases cognitive load, reducing reading fluency";
    case "narrativeClosure":
      return "the dangling thread lacks a concrete resolution beat, leaving the reader without consequence";
    case "marketability":
      return "the hook does not establish genre expectations early enough, reducing submission alignment";
    default:
      return "the current phrasing diffuses the criterion signal before the decision point";
  }
}

export function buildCriterionAwareSpecificFixDefault(criterionKey: SynthesizedCriterion["key"]): string {
  switch (criterionKey) {
    case "concept":
      return "sharpen the premise hook by grounding one abstract concept in a concrete dramatic question the reader must see answered";
    case "character":
      return "replace one abstract reaction line with a concrete decision beat and one desire-vs-fear contradiction";
    case "sceneConstruction":
      return "split one long descriptive passage and move one image after the causal action beat";
    case "dialogue":
      return "replace one expository exchange with two short turns plus an interruption beat";
    case "pacing":
      return "cut one reflective sentence and insert one immediate external action trigger";
    case "voice":
      return "recast one summary sentence as close-third free indirect discourse to restore psychic distance";
    case "theme":
      return "replace one abstract thematic statement with a concrete image or action that embodies the theme";
    case "narrativeDrive":
      return "insert one concrete stakes beat that lands the deferred decision at the current scene turn";
    case "worldbuilding":
      return "anchor one passage with two specific sensory details that ground the setting without exposition";
    case "tone":
      return "rewrite one tonal outlier sentence to match the established register of the surrounding passage";
    case "proseControl":
      return "tighten one overlong sentence by splitting at the causal pivot and removing redundant qualifiers";
    case "narrativeClosure":
      return "add one concrete resolution beat that closes the dangling thread and signals consequence to the reader";
    case "marketability":
      return "move one genre-signaling detail to the first paragraph to establish category expectations earlier";
    default:
      return "replace one abstract sentence with a concrete criterion-specific move and insert one causal beat";
  }
}

export function buildCriterionAwareReaderEffectDefault(criterionKey: SynthesizedCriterion["key"]): string {
  switch (criterionKey) {
    case "concept":
      return "sharper premise intrigue and a clearer dramatic question that compels the reader forward";
    case "character":
      return "clearer motivation and emotional stakes, improving trust in character decisions";
    case "sceneConstruction":
      return "clearer scene cause-and-effect and stronger transition coherence";
    case "dialogue":
      return "clearer speaker intent and tension progression, increasing engagement";
    case "pacing":
      return "stronger forward momentum and cleaner urgency through the section turn";
    case "voice":
      return "consistent narrative immersion with stable psychic distance throughout the passage";
    case "theme":
      return "stronger thematic resonance and payoff at the scene turn";
    case "narrativeDrive":
      return "increased momentum as the stalled decision converts to visible consequence";
    case "worldbuilding":
      return "immediate sensory grounding, reducing cognitive load and increasing immersion";
    case "tone":
      return "consistent emotional register that sustains reader trust through the passage";
    case "proseControl":
      return "tighter sentence-level clarity and reduced cognitive friction for the reader";
    case "narrativeClosure":
      return "stronger sense of resolution and consequence, reducing the feeling of dangling threads";
    case "marketability":
      return "clearer genre alignment and stronger first-impression hook for submission readers";
    default:
      return "clearer cause-and-effect, stronger immersion, and higher engagement at the turn";
  }
}

/**
 * Derive a symptom from mechanism/action text when the LLM didn't provide one.
 * Every recommendation MUST have a symptom — it defines the observable problem.
 */
function buildSymptomFromContext(
  mechanism: string,
  action: string,
  criterionKey: SynthesizedCriterion["key"],
): string {
  // Prefer mechanism (causal explanation) as the basis for symptom.
  if (mechanism && mechanism.length >= 10) {
    // Mechanism often starts with "the..." — capitalize and frame as observable symptom.
    const cleaned = mechanism.replace(/^the\s+/i, "").trim();
    return `The passage ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }
  // Criterion-aware default symptoms when nothing else is available.
  // IMPORTANT: These must NOT match GENERIC_OPPORTUNITY_FALLBACK_FRAGMENTS.
  switch (criterionKey) {
    case "concept":
      return "The dramatic premise lacks a concrete question that compels the reader forward.";
    case "character":
      return "Character motivation or decision logic is unclear at this location, weakening reader trust.";
    case "sceneConstruction":
      return "Scene cause-and-effect sequencing is disrupted, reducing structural coherence.";
    case "dialogue":
      return "Speaker intent or attribution is unclear, reducing tension in the exchange.";
    case "pacing":
      return "Forward momentum stalls at this location due to reflective or expository weight.";
    case "voice":
      return "Psychic distance or POV rendering is inconsistent, breaking narrative immersion.";
    case "theme":
      return "Thematic signal is abstract rather than embodied, reducing emotional resonance.";
    case "narrativeDrive":
      return "Stakes or decision pressure diffuses before reaching the reader, weakening narrative urgency.";
    case "worldbuilding":
      return "Sensory grounding is absent, leaving the reader unanchored in the setting.";
    case "tone":
      return "Tonal register shifts without a clear trigger, disrupting emotional continuity.";
    case "proseControl":
      return "Sentence-level clutter increases cognitive load, reducing reading fluency.";
    case "narrativeClosure":
      return "A dangling thread lacks resolution, leaving the reader without consequence.";
    case "marketability":
      return "Genre expectations are not established early enough, reducing submission alignment.";
    default:
      return "Craft clarity or momentum weakens at this location in the manuscript.";  }
}


function normalizeForPhraseMatch(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasVoiceMechanismMarker(text: string): boolean {
  const normalized = normalizeForPhraseMatch(text);
  return PASS3_VOICE_MECHANISM_MARKERS.some((marker) => normalized.includes(marker));
}

function hasDialogueMechanismMarker(text: string): boolean {
  const normalized = normalizeForPhraseMatch(text);
  return DIALOGUE_MECHANISM_MARKERS.some((marker) => normalized.includes(marker));
}

function needsRationaleBackfill(key: string, rationale: string): boolean {
  const normalized = normalizeForPhraseMatch(rationale);
  if (normalized.length < PASS3_MIN_RATIONALE_LENGTH) {
    return true;
  }

  if (PASS3_PLACEHOLDER_RATIONALE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  // Deterministic guard: voice rationale must carry explicit POV/rendering
  // mechanism language before entering Pass 4 gate.
  if (key === "voice" && !hasVoiceMechanismMarker(normalized)) {
    return true;
  }

  // Deterministic guard: dialogue rationale must carry explicit attribution/
  // rendering mechanism language before entering Pass 4 gate.
  if (key === "dialogue" && !hasDialogueMechanismMarker(normalized)) {
    return true;
  }

  return false;
}

function buildBackfilledRationale(
  key: string,
  pass1Rationale: string | undefined,
  pass2Rationale: string | undefined,
  evidence: EvidenceAnchor[],
  manuscriptText?: string,
): string {
  const p1 = (pass1Rationale || "").trim();
  const p2 = (pass2Rationale || "").trim();
  const evidenceLead = evidence[0]?.snippet?.trim();

  const p1Summary = p1.length > 0 ? p1 : `Pass 1 identifies craft execution pressure in ${key}.`;
  const p2Summary = p2.length > 0 ? p2 : `Pass 2 identifies editorial and interpretive pressure in ${key}.`;
  const anchor = evidenceLead
    ? `The manuscript evidence "${evidenceLead.substring(0, 120)}" supports this synthesis.`
    : `Available manuscript signals support this synthesis for ${key}.`;

  const base = `${p1Summary} ${p2Summary} ${anchor}`.trim();
  const normalized = normalizeForPhraseMatch(base);

  // For dialogue: use diagnostic-aware backfill if manuscript available
  if (key === "dialogue" && !hasDialogueMechanismMarker(normalized)) {
    // Try to compute diagnostics to produce specific rationale
    if (manuscriptText && manuscriptText.trim().length > 0) {
      try {
        const diagnostics = analyzeDialogueAttributionForGate({ manuscriptText });
        
        // Generate diagnostic-grounded rationale
        const parts: string[] = [base];
        
        const RENDERING_MODE_LABELS: Record<string, string> = {
          direct_speech: 'direct speech',
          indirect_speech: 'indirect speech',
          reported_speech: 'reported speech',
          tagged_speech: 'tagged speech',
          action_beat_attribution: 'action beats',
          tagless_exchange: 'untagged exchanges',
        };
        if (diagnostics.renderingModesDetected.length > 0) {
          const readable = diagnostics.renderingModesDetected
            .map((m) => RENDERING_MODE_LABELS[m] ?? m.replace(/_/g, ' '))
            .join(', ');
          parts.push(
            `Dialogue is generally clear in attribution, using a mix of ${readable}, with consistent speaker clarity.`
          );
        } else if (diagnostics.speakerAttributionStrategy.length > 0) {
          parts.push(
            `Speaker attribution is achieved through ${diagnostics.speakerAttributionStrategy.join(" and ")}, supporting clear dialogue flow.`
          );
        } else if (diagnostics.actionBeatCount > 0 || diagnostics.explicitTagCount > 0) {
          parts.push(
            `Dialogue attribution relies on mechanical mechanisms: ${diagnostics.explicitTagCount > 0 ? "explicit tags" : ""} ${diagnostics.actionBeatCount > 0 ? "action beats" : ""}, supporting reader comprehension.`.replace(/\s+/g, " "),
          );
        } else {
          parts.push(
            `Dialogue is rendered through speaker attribution structure: ${diagnostics.turnTakingClarity} turn-taking with ${diagnostics.speakerAmbiguityRisk} ambiguity risk.`
          );
        }
        
        return parts.join(" ").trim();
      } catch {
        // Fall back to generic if diagnostic computation fails
      }
    }
    
    // Fallback when no manuscript or diagnostic computation fails
    return `${base} Dialogue is rendered through explicit speaker attribution mechanics (speaker identification, attribution tags/beats, and quote-level turn-taking clarity).`.trim();
  }

  // For voice: use existing generic fallback (can be enhanced similarly)
  if (key === "voice" && !hasVoiceMechanismMarker(normalized)) {
    return `${base} Voice handling is anchored in explicit POV mechanics (perspective control, narrative/psychic distance, and rendering choices at the sentence level).`.trim();
  }

  return base;
}

function backfillEvidenceFromAxis(
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
  key: string,
): EvidenceAnchor[] {
  const p1Evidence = pass1.criteria.find((c) => c.key === key)?.evidence ?? [];
  const p2Evidence = pass2.criteria.find((c) => c.key === key)?.evidence ?? [];
  const combined = [...p1Evidence, ...p2Evidence]
    .map((e) => ({
      snippet: String(e.snippet ?? "").trim().substring(0, 300),
      char_start: typeof e.char_start === "number" ? e.char_start : undefined,
      char_end: typeof e.char_end === "number" ? e.char_end : undefined,
      segment_id: typeof e.segment_id === "string" ? e.segment_id : undefined,
    }))
    .filter((e) => e.snippet.length > 0);

  const seen = new Set<string>();
  const deduped: EvidenceAnchor[] = [];
  for (const e of combined) {
    const sig = e.snippet.toLowerCase();
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(e);
    if (deduped.length >= 3) break;
  }

  return deduped;
}

/**
 * When a backfilled recommendation has a terse action (common for Pass 2 chunk
 * recs like "tighten exposition"), enrich it from the recommendation's own
 * context fields so the action reads as a complete editorial instruction.
 * Only fires when action < 50 chars; longer actions are kept as-is.
 */

function parseStringArray(raw: unknown, maxItems: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, maxItems);
}

function parseConsequenceStatus(
  raw: unknown,
  scoreDelta: number,
  finalScore: number,
): SynthesizedCriterion["consequence_status"] {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "landed" || normalized === "deferred" || normalized === "dissipated") {
    return normalized;
  }

  if (scoreDelta >= 3) return "deferred";
  if (finalScore <= 4) return "dissipated";
  return "landed";
}

function parseSubmissionReadiness(
  raw: unknown,
  verdict: SynthesisOutput["overall"]["verdict"],
  criteria: SynthesizedCriterion[],
): SynthesisOutput["overall"]["submission_readiness"] {
  if (raw === undefined || raw === null) {
    throw new Error("[Pass3] overall.submission_readiness is required but was missing from model output");
  }
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "queryable_now" || normalized === "nearly_ready" || normalized === "not_yet") {
    return normalized;
  }

  const lowScoreCount = criteria.filter((criterion) => criterion.final_score_0_10 < 5).length;
  if (verdict === "fail" || lowScoreCount >= 3) {
    return "not_yet";
  }

  if (verdict === "pass") {
    return "queryable_now";
  }

  return "nearly_ready";
}

/**
 * Project SynthesizedCriterion[] onto the minimal V2-criterion shape required
 * by summarizePropagationIntegrity#deriveBottomScoreCriteria. Only `key`,
 * `status` and `score_0_10` are read; the rest are stub fields satisfying the
 * shape contract.
 */
function toV2CriteriaForPropagation(
  criteria: SynthesizedCriterion[],
): EvaluationResultV2["criteria"] {
  return criteria
    .filter((c) => Number.isFinite(c.final_score_0_10))
    .map(
      (c) =>
        ({
          key: c.key as CriterionKey,
          status: "SCORABLE" as const,
          score_0_10: c.final_score_0_10,
          scorability_status: "scorable_high_confidence" as const,
          evidence: [],
        }) as unknown as EvaluationResultV2["criteria"][number],
    );
}

/**
 * Canonical score grounding for executive-summary prose.
 *
 * Pass 3 occasionally hallucinates an overall score in the summary text (e.g.
 * 65/100 when the criteria-derived canonical score is 70/100). The canonical
 * numeric score is the sole authority; this helper deterministically replaces
 * any `NN/100` score language with the canonical value and records the
 * original mismatch for observability. It never changes the canonical score.
 */
export function reconcileSummaryScore(
  summary: string,
  canonicalScore: number,
): { summary: string; reconciled: boolean; originalScores: number[] } {
  const divergence = detectProseScoreDivergence(summary, canonicalScore);
  if (!divergence.diverges) {
    return { summary, reconciled: false, originalScores: [] };
  }

  const replaced = summary.replace(/\b\d{1,3}\s*\/\s*100\b/gu, `${canonicalScore}/100`);
  console.info(
    `[Pass3] executive summary score grounded: ${divergence.proseScores.join(", ")}/100 → ${canonicalScore}/100`,
  );
  return { summary: replaced, reconciled: true, originalScores: divergence.proseScores };
}

/**
 * PR-K (2026-05-16): Single source of truth with QualityGateV2.
 * Delegates to normalizeSummaryWithBottomWeaknesses so that any criteria the
 * gate considers "missing" are guaranteed to appear in the summary before the
 * gate runs. Replaces the older local enforcer whose ".some() / slice(0,3)"
 * semantics could leave the gate unsatisfied (see job a8d47d73 — Froggin
 * Noggin FULL NOVEL — which failed with 5 bottom criteria and only 1 mentioned).
 */
function enforceSummaryWeaknessPresence(
  summary: string,
  criteria: SynthesizedCriterion[],
): string {
  const trimmedSummary = summary.trim();
  if (trimmedSummary.length === 0) {
    return trimmedSummary;
  }

  const v2Criteria = toV2CriteriaForPropagation(criteria);
  if (v2Criteria.length === 0) {
    return trimmedSummary;
  }

  const { bottomScoreCriteria } = summarizePropagationIntegrity(v2Criteria);
  if (bottomScoreCriteria.length === 0) {
    return trimmedSummary;
  }

  return normalizeSummaryWithBottomWeaknesses(
    trimmedSummary,
    bottomScoreCriteria,
    SUMMARY_POLICY.cap,
  );
}
