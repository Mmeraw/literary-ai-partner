/**
 * Evaluation Processor
 * 
 * Core logic for processing evaluation jobs.
 * Replaces Base44 workflow with Next.js/Vercel implementation.
 * 
 * ─────────────────────────────────────────────────────────────────────
 * GOVERNANCE AUTHORITY CHAIN
 * ─────────────────────────────────────────────────────────────────────
 * 
 * This processor enforces the WAVE Readiness Layer canonical authority
 * as defined in docs/WAVE_REVISION_GUIDE_CANON.md.
 * 
 * Authority Chain:
 * 1. WAVE Readiness Layer Guide (docs/WAVE_REVISION_GUIDE_CANON.md) — canonical
 * 2. 13 Criteria Registry (schemas/criteria-keys.ts) — WAVE tiers
 * 3. Evaluation Processor (this file) — enforcement logic
 * 4. Phase 2 (lib/evaluation/phase2.ts) — artifact persistence
 * 5. Report UI — canonical output
 * 
 * If this processor's output conflicts with WAVE canon, the processor is wrong.
 * 
 * ─────────────────────────────────────────────────────────────────────
 * OPERATIONAL MODES
 * ─────────────────────────────────────────────────────────────────────
 * 
 * Real AI Evaluation (OPENAI_API_KEY configured):
 * • Calls the canonical pipeline model (EVAL_OPENAI_MODEL, default gpt-5.1) with manuscript content
 * • Returns structured EvaluationResultV2 with criterion-specific analysis
 * • Marks governance.warnings with "Real AI analysis" only
 * 
 * Fail-Closed Behavior (no mock fallback in production paths):
 * • Missing OPENAI_API_KEY causes immediate job failure
 * • OpenAI/validation/persistence errors fail job with explicit last_error
 * • No silent fallback artifacts are permitted
 * 
 * ─────────────────────────────────────────────────────────────────────
 * 13 CRITERIA ENFORCEMENT
 * ─────────────────────────────────────────────────────────────────────
 * 
 * All evaluation results must include all 13 criteria from CRITERIA_KEYS:
 * 1. concept
 * 2. narrativeDrive
 * 3. character
 * 4. voice
 * 5. sceneConstruction
 * 6. dialogue
 * 7. theme
 * 8. worldbuilding
 * 9. pacing
 * 10. proseControl
 * 11. tone
 * 12. narrativeClosure
 * 13. marketability
 * 
 * Any result missing or inventing criteria fails validation.
 * ─────────────────────────────────────────────────────────────────────
 */

import { createHash, randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import { WAVE_GUIDE_SUMMARY, WAVE_GUIDE_VERSION } from './WAVE_GUIDE';
import { stableSourceHash, upsertEvaluationArtifact } from './artifactPersistence';
import { persistEvaluationResultV2 } from './persistEvaluationResultV2';
import {
  runPipeline,
  synthesisToEvaluationResultV2,
} from '@/lib/evaluation/pipeline/runPipeline';
import type { ProviderTelemetryEntry } from '@/lib/evaluation/pipeline/providerTelemetry';
import { classifySubmissionScope, countWords } from '@/lib/evaluation/pipeline/submissionScope';
import { runQualityGateV2, QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE } from '@/lib/evaluation/pipeline/qualityGate';
import {
  summarizePropagationIntegrity,
  normalizeSummaryWithBottomWeaknesses,
} from '@/lib/evaluation/pipeline/propagationIntegrity';
import {
  validateTemplateCompleteness,
  TEMPLATE_COMPLETENESS_USER_MESSAGE,
  TEMPLATE_COMPLETENESS_FAILURE_CODE,
} from '@/lib/evaluation/pipeline/templateCompletenessGate';
import {
  buildScoreLedger,
  computeAuthorityComposite,
} from '@/lib/evaluation/pipeline/buildScoreLedger';
import { buildExcellenceFilter } from '@/lib/evaluation/pipeline/buildExcellenceFilter';
import { mapEvaluationResultV2ToGovernanceEnvelope } from '@/lib/governance/evaluationBridge';
import {
  getCanonicalPipelineModel,
  getCanonicalPass2Model,
  getExternalAdjudicationMode,
} from '@/lib/evaluation/policy';
import {
  assertEvalTimeoutConfig,
  getEvalOpenAiTimeoutMs,
  getEvalPassTimeoutMs,
} from '@/lib/evaluation/config';
import { getEvaluationRuntimeConfig, resolveEvaluationRuntimeConfig } from '@/lib/config/evaluationRuntimeConfig';
import {
  LONG_FORM_TIMEOUT_FLOOR_MS,
  resolveScopedEvaluationTimeouts,
  type TimeoutScopeInputScale,
} from '@/lib/config/evaluationRuntimeConfig';
import {
  classifyQueuedHardStop,
  decideSplitBrainRecovery,
  classifySplitBrain,
  isMaxAgeKillSwitchExpired,
  partitionMaxAgeKillSwitchCandidates,
  resolveProviderBudget,
  type QueueHardStopCandidate,
} from '@/lib/evaluation/hardStopGovernance';
import {
  MAJOR_TECHNICAL_ISSUE_PUBLIC_MESSAGE,
  sendEvaluationFailureSupportAlert,
  sendEvaluationMajorIssueUserAlert,
  sendRecoverySupportAlert,
  shouldAlertSupportForRecoveryAction,
  toUserSafeRecoveryMessage,
} from '@/lib/evaluation/recoverySupportAlertMailer';
import {
  emitLatencyTrace,
  finishLatencyStage,
  startLatencyStage,
} from '@/lib/observability/latencyTrace';
import {
  assertValidJobStatusTransition,
  normalizeEvaluationJobStatus,
} from '@/lib/evaluation/status';
import { JOB_STATUS, PHASES, type JobStatus } from '@/lib/jobs/types';
import { summarizePromptCoverage } from '@/lib/evaluation/pipeline/promptInput';
import { detectContextContamination } from '@/lib/evaluation/governance/contextContaminationGuard';
import { assertClaimedJobsContract } from '@/lib/jobs/contracts/claimEvaluationJobs.contract';
import { finalizeJobFailure } from '@/lib/jobs/jobStore.supabase';
import {
  ProcessorLeaseLostError,
  finalizeProcessorFailureWithLeaseGuard,
  isProcessorLeaseLostError,
} from '@/lib/evaluation/processorLeaseFailureFinalizer';
import {
  selectResumeCheckpoint,
  type RuntimeArtifactRow,
} from '@/lib/evaluation/phase-architecture-v2/checklistRuntimeWiring';
import { ensureChunksFromText } from '@/lib/manuscripts/chunks';
import {
  selectChunkerConfig,
  selectChunkerBracket,
} from '@/lib/manuscripts/chunking';
import { ManuscriptExceedsHardCeilingError } from '@/lib/evaluation/pipeline/failures';
import { classifyPhase1aFailure } from '@/lib/evaluation/pipeline/phase1aFailureClassification';
import {
  buildNonEvaluativeWarning,
  stripNonEvaluativeSections,
} from '@/lib/manuscripts/nonEvaluativeSections';
import type { ManuscriptChunkEvidence, SinglePassOutput, Pass1aCharacterLedger, CharacterLedgerV2, Pass3PreflightDraft, Pass1aChunkOutput } from '@/lib/evaluation/pipeline/types';
import { runPass1a, type Pass1aChunkCacheArtifact } from '@/lib/evaluation/pipeline/runPass1a';
import { runPass3Preflight } from '@/lib/evaluation/pipeline/runPass3Preflight';
import { reduceCharacterEvidence, buildCharacterLedgerV2 } from '@/lib/evaluation/pipeline/characterReducer';
import { buildStoryLayerFromLedger } from '@/lib/evaluation/phase1a/buildStoryLayerFromLedger';
import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';
import { buildLedgerQualityReport } from '@/lib/evaluation/phase1a/buildLedgerQualityReport';
import { buildSeedConsistencyReport } from '@/lib/evaluation/seed/seedConsistencyReport';
import {
  buildTwoPassSeedBlock,
  filterContaminatedEntities,
  parseSeedValidationFromChunkOutput,
  computeSeedDriftScore,
  type SeedValidationPassAResult,
} from '@/lib/evaluation/seed/twoPassSeedValidation';
import { writePhase1aReviewGateArtifacts, extractStoryLayers } from '@/lib/evaluation/phase1a/storyLayerArtifactWriters';
import { buildReviewGateHandoff } from '@/lib/evaluation/phase-architecture-v2/reviewGateHandoff';
import { STORY_LEDGER_APPROVAL_ENABLED } from '@/lib/evaluation/reviewGate/containmentMode';
import {
  buildSemanticSeedSourceHash,
  generateSemanticSeedArtifacts,
} from '@/lib/evaluation/seed/semanticSeedGenerator';
import {
  generateFullContextStoryLedger,
  buildLedgerSeedContextBlock,
  assessLedgerQuality,
  type FullContextStoryLedger,
} from '@/lib/evaluation/seed/fullContextStoryLedger';
import { inferWorkTypeFromWordCount } from '@/lib/evaluation/seed/benchmarkContextBuilder';
import {
  generateEditorialDreamSeed,
} from '@/lib/evaluation/seed/editorialDreamSeedGenerator';
import type {
  Pass3AStatus,
  PhaseV2ArtifactSet,
  PhaseV2Progress,
} from '@/lib/evaluation/phase-architecture-v2/gateValidity';
import {
  shouldFlagStoryLedgerLaneMapWarning,
  type StoryLedgerExtensions,
} from '@/lib/evaluation/phase1a/storyLedgerExtensions';
import {
  isPipelineEnabled,
  pipelineDisabledResponse,
  type PipelineSkipResult,
} from '@/lib/config/pipelineGuard';
import { pipelineLog } from '@/lib/evaluation/pipeline/pipelineLogger';
import { createRevisionSession } from '@/lib/revision/sessions';
import { executeWaveLayer } from '@/lib/pipeline/wave-execution-layer';
import { executeWaveModules } from '@/lib/revision/wave-executor';
import {
  getPhaseStartTimestamps,
  getPhaseCompleteTimestamps,
  buildWritablePatch,
  FORBIDDEN_PATCH_COLUMNS,
  type PhaseName,
} from '@/lib/evaluation/phaseTimestamps';
import { buildPhaseLogPatch } from '@/lib/evaluation/phaseLog';
import { getConfiguredAppBaseUrl } from '@/lib/jobs/triggerWorker';
import { normalizeEnglishVariant, resolvedEnglishVariantLabel } from '@/lib/evaluation/englishVariant';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE Phase 3 constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum manuscript word count for WAVE eligibility */
const WAVE_MIN_WORDS = 25_000;

/**
 * User-facing Story Ledger Review Gate is long-form only.
 * Short-form/chapter evaluations may still build internal Story Layer artifacts,
 * but must not block on author approval UI.
 */
const STORY_LEDGER_USER_GATE_MIN_WORDS = 25_000;

/** Minimum per-criterion score (0-10) for WAVE eligibility — no red criteria */
const WAVE_MIN_CRITERION_SCORE = 6.0;

// DB bootstrap — intentionally reads process.env directly (not evaluation config).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getProcessorRuntimeDeps() {
  assertEvalTimeoutConfig();
  const runtimeConfig = getEvaluationRuntimeConfig();
  return {
    runtimeConfig,
    openaiApiKey: runtimeConfig.openaiApiKey,
    perplexityApiKey: runtimeConfig.perplexityApiKey ?? "",
    evalDebugEnabled: runtimeConfig.evalDebugEnabled,
    evalMinManuscriptWords: runtimeConfig.minManuscriptWords,
    openAiModel: runtimeConfig.model,
    staleRunningMinutes: runtimeConfig.staleRunningMinutes,
    frozenHeartbeatSecs: runtimeConfig.frozenHeartbeatSecs,
    evalWorkerBatchSize: getValidatedWorkerBatchSize(runtimeConfig.worker.batchSize, 5),
    evalContextContaminationGuardEnabled: runtimeConfig.contextContaminationGuardEnabled,
    evalPassTimeoutMs: getEvalPassTimeoutMs(),
    evalOpenAiTimeoutMs: getEvalOpenAiTimeoutMs(),
  };
}

const EVALUATION_PROGRESS_TOTAL_UNITS = 100;

// ─── Pipeline stabilization delays ──────────────────────────────────────────
// Deliberate pauses between pipeline steps so the DB, cache, and worker
// claims have time to commit and propagate. Without these, rapid-fire
// self-chains cause thrashing where the worker re-enters before the
// previous write is visible, leading to stale reads and wasted invocations.
const STABILIZE_MS = 5_000;           // standard pause between steps
const STABILIZE_SELF_CHAIN_MS = 10_000; // longer pause before self-chain kick
const stabilize = (ms: number = STABILIZE_MS) =>
  new Promise<void>(r => setTimeout(r, ms));

// Below this word count we evaluate as a single structural unit (one chunk).
// Above this, the adaptive chunker engages and emits chapter-aligned chunks.
const STRUCTURAL_CHUNKING_THRESHOLD_WORDS = 3_000;

// Hard manuscript ceiling. Above this, we fail-closed before any AI call.
// The website upload page displays this as the supported max.
const HARD_MANUSCRIPT_CEILING_WORDS = 300_000;

// Vercel hard-kill wall-clock limit. Vercel terminates the process at 800s
// regardless of what the function is doing. We must self-chain before this.
const VERCEL_HARD_LIMIT_MS = 800_000;

// Minimum budget required before starting an expensive operation (e.g.,
// Pass 1+2 chunk sweep, Perplexity sweep, Pass 3 synthesis). If the remaining
// budget is below this threshold, the processor self-chains to a fresh
// invocation instead of starting work that will be killed mid-flight.
const BUDGET_SAFETY_MARGIN_MS = 120_000;

type ChunkRoutingTelemetry = {
  enabled: boolean;
  route: 'long_form' | 'short_form';
  trigger_reason?: 'word_threshold' | 'prompt_budget_exceeded';
  threshold_words: number;
  prompt_budget_chars: number;
  source_manuscript_words: number;
  source_manuscript_chars: number;
  chunk_storage_words?: number;
  chunk_storage_chars?: number;
  overlap_words?: number;
  overlap_chars?: number;
  manuscript_words: number;
  manuscript_chars: number;
  chunk_count: number;
  // Adaptive bracket diagnostics — see selectChunkerConfig in chunking.ts
  bracket: 'small' | 'mid' | 'large' | 'sub_threshold';
  chunk_target_chars: number;
  chunk_max_chars_config: number;
  // Long-form chunk materialization proof fields (populated only on long_form route)
  ensure_chunks_returned_count?: number;
  persisted_chunk_count?: number;
  chunk_source?: 'processor_resolved_text';
  verified_at?: string;
  // Largest chunk size — surfaced for the CHUNK_BUDGET_OVERFLOW post-condition.
  max_chunk_chars?: number;
  max_chunk_index?: number;
}

type FinalTextProvenance = {
  final_text_source: 'long_form_post_chunk_canonical' | 'short_form_initial_text';
  post_chunk_reresolved: boolean;
  canonical_path_used: 'resolveManuscriptText.post_chunk_reconstruct' | 'resolveManuscriptText.initial';
};

export function getValidatedWorkerBatchSize(raw: unknown, fallback = 5): number {
  const parsed =
    typeof raw === 'number'
      ? raw
      : Number.parseFloat(String(raw ?? ''));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const normalized = Math.trunc(parsed);
  return normalized >= 1 && normalized <= 5 ? normalized : fallback;
}

export function shouldRequireStoryLedgerReviewGate(manuscriptWords: number | null | undefined): boolean {
  return typeof manuscriptWords === 'number'
    && Number.isFinite(manuscriptWords)
    && manuscriptWords >= STORY_LEDGER_USER_GATE_MIN_WORDS;
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';
  const details = typeof record.details === 'string' ? record.details : '';
  const combined = `${message} ${details}`;

  const schemaCacheMissing =
    code === 'PGRST204' && combined.includes(columnName) && combined.includes('schema cache');
  const postgresMissing = code === '42703' && combined.includes(columnName);

  return schemaCacheMissing || postgresMissing;
}

const PASS3A_STATUS_VALUES: Pass3AStatus[] = [
  'not_started',
  'running',
  'map_done',
  'reduce_running',
  'done',
  'degraded',
  'failed',
];

function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function coercePass3aStatus(value: unknown): Pass3AStatus | undefined {
  return isNonEmptyTrimmedString(value) && PASS3A_STATUS_VALUES.includes(value as Pass3AStatus)
    ? (value as Pass3AStatus)
    : undefined;
}

export function toPhaseV2ArtifactSet(
  rows: Array<{
    artifact_type?: unknown;
    id?: unknown;
    artifact_id?: unknown;
    content?: unknown;
    source_hash?: unknown;
  }> | null | undefined,
): PhaseV2ArtifactSet {
  const artifactRefsByType = new Map<string, { artifact_id?: string | null; source_hash?: string | null }>();
  let ledgerQualityGateReadyStatus:
      | 'reviewable'
      | 'blocked'
      | 'blocked_retryable_technical'
      | 'blocked_content_hard_fail'
      | 'repair_required'
      | null = null;
  let ledgerQualityHardFailPresent: boolean | null = null;
  let pass3PreflightReducerStatus: 'ok' | 'failed' | 'legacy' | null = null;
  let pass3PreflightAuthority: string | null = null;

  for (const row of rows ?? []) {
    if (!row || typeof row !== 'object' || typeof row.artifact_type !== 'string') {
      continue;
    }

    const contentRecord =
      row.content && typeof row.content === 'object' ? (row.content as Record<string, unknown>) : null;
    const envelopeArtifactId =
      contentRecord && typeof contentRecord.artifact_id === 'string' ? contentRecord.artifact_id : null;
    const rowArtifactId = typeof row.artifact_id === 'string' ? row.artifact_id : null;
    const rowId = typeof row.id === 'string' ? row.id : null;
    const sourceHash = typeof row.source_hash === 'string' ? row.source_hash : null;

    artifactRefsByType.set(row.artifact_type, {
      artifact_id: envelopeArtifactId ?? rowArtifactId ?? rowId,
      source_hash: sourceHash,
    });

    if (row.artifact_type === 'ledger_quality_report_v1' && contentRecord) {
      const qualityReportRecord =
        contentRecord.quality_report && typeof contentRecord.quality_report === 'object'
          ? (contentRecord.quality_report as Record<string, unknown>)
          : contentRecord;
      const gateReadyStatus = qualityReportRecord.gate_ready_status;
      const hardFailPresent = qualityReportRecord.hard_fail_present;

      ledgerQualityGateReadyStatus =
        gateReadyStatus === 'reviewable'
        || gateReadyStatus === 'blocked'
        || gateReadyStatus === 'blocked_retryable_technical'
        || gateReadyStatus === 'blocked_content_hard_fail'
        || gateReadyStatus === 'repair_required'
          ? gateReadyStatus
          : null;
      ledgerQualityHardFailPresent = typeof hardFailPresent === 'boolean' ? hardFailPresent : null;
    }

    if (row.artifact_type === 'pass3_preflight_draft_v1' && contentRecord) {
      const reducerStatus = contentRecord.reducer_status;
      const preflightAuthority = contentRecord.preflight_authority;

      pass3PreflightReducerStatus =
        reducerStatus === 'ok' || reducerStatus === 'failed'
          ? reducerStatus
          : 'legacy';
      pass3PreflightAuthority = typeof preflightAuthority === 'string' ? preflightAuthority : null;
    }
  }

  return {
    pass1a_story_layer_v1: artifactRefsByType.get('pass1a_story_layer_v1') ?? null,
    ledger_quality_report_v1: artifactRefsByType.get('ledger_quality_report_v1') ?? null,
    pass3_preflight_draft_v1: artifactRefsByType.get('pass3_preflight_draft_v1') ?? null,
    accepted_story_ledger_v1: artifactRefsByType.get('accepted_story_ledger_v1') ?? null,
    pass12_handoff_v1: artifactRefsByType.get('pass12_handoff_v1') ?? null,
    ledger_quality_gate_ready_status: ledgerQualityGateReadyStatus,
    ledger_quality_hard_fail_present: ledgerQualityHardFailPresent,
    pass3_preflight_reducer_status: pass3PreflightReducerStatus,
    pass3_preflight_authority: pass3PreflightAuthority,
  };
}

export function derivePhaseV2ReviewGateProgress(
  progressState: Record<string, unknown>,
  pass3PreflightSignal: {
    hasPass3PreflightArtifact: boolean;
    reducerStatus?: 'ok' | 'failed' | 'legacy' | null;
    preflightAuthority?: string | null;
  },
): PhaseV2Progress {
  const batchState =
    progressState.phase1a_batch_state && typeof progressState.phase1a_batch_state === 'object'
      ? (progressState.phase1a_batch_state as Record<string, unknown>)
      : {};

  const preflightStatusRaw = batchState.preflight_status;
  const preflightStatus =
    typeof preflightStatusRaw === 'string' ? preflightStatusRaw.toUpperCase().trim() : 'NOT_STARTED';
  const preflightDegraded = batchState.preflight_degraded === true;

  const explicitStatus = coercePass3aStatus(progressState.pass3a_status);
  const legacyStatus: Pass3AStatus | undefined = (() => {
    if (preflightStatus === 'DONE' || preflightStatus === 'COMPLETE') {
      return preflightDegraded ? 'degraded' : 'done';
    }
    if (
      preflightStatus === 'IN_PROGRESS' ||
      preflightStatus === 'RUNNING' ||
      preflightStatus === 'SELF_CHAINED'
    ) {
      return 'running';
    }
    return undefined;
  })();

  const pass3ReducerFailed =
    pass3PreflightSignal.reducerStatus === 'failed' ||
    pass3PreflightSignal.preflightAuthority === 'unavailable';

  const pass3aStatus = pass3ReducerFailed
    ? 'failed'
    : (
      explicitStatus ??
      legacyStatus ??
      (pass3PreflightSignal.hasPass3PreflightArtifact ? 'done' : 'not_started')
    );

  const pass3aCompletedAt =
    isNonEmptyTrimmedString(progressState.pass3a_completed_at)
      ? progressState.pass3a_completed_at
      : undefined;

  const pass3aArtifactId =
    isNonEmptyTrimmedString(progressState.pass3a_artifact_id)
      ? progressState.pass3a_artifact_id
      : undefined;

  const degradedReason =
    isNonEmptyTrimmedString(progressState.degraded_reason)
      ? progressState.degraded_reason
      : undefined;
  const degradedReasonCodes = Array.isArray(progressState.degraded_reason_codes)
    ? progressState.degraded_reason_codes
        .filter((code): code is string => isNonEmptyTrimmedString(code))
    : undefined;
  const degradedAt =
    isNonEmptyTrimmedString(progressState.degraded_at)
      ? progressState.degraded_at
      : undefined;

  const failedReason =
    isNonEmptyTrimmedString(progressState.failed_reason)
      ? progressState.failed_reason
      : pass3ReducerFailed
        ? 'PASS3A_REDUCER_FAILED'
        : undefined;
  const failedAt =
    isNonEmptyTrimmedString(progressState.failed_at)
      ? progressState.failed_at
      : undefined;

  return {
    pass3a_status: pass3aStatus,
    pass3a_completed_at: pass3aCompletedAt,
    pass3a_artifact_id: pass3aArtifactId,
    degraded_reason: degradedReason,
    degraded_reason_codes:
      degradedReasonCodes && degradedReasonCodes.length > 0 ? degradedReasonCodes : undefined,
    degraded_at: degradedAt,
    failed_reason: failedReason,
    failed_at: failedAt,
  };
}

export function shouldRequeueReviewGateBlock(blockCode: string, gateValidity: unknown): boolean {
  // Only requeue for Pass 3A "not ready" states (still in progress).
  // REVIEW_GATE_QUALITY_TECHNICAL_BLOCK no longer requeues — it kicks forward.
  // Requeuing on technical blocks caused infinite loops with no user benefit.
  return (
    gateValidity === 'not_ready' &&
    (blockCode === 'PASS3A_NOT_READY' || blockCode === 'PASS3A_HALF_WRITTEN')
  );
}

interface EvaluationJob {
  id: string;
  manuscript_id: number;
  job_type: string;
  status: string;
  created_at: string;
}

interface Manuscript {
  id: number;
  title: string;
  content?: string | null;
  file_url?: string | null;
  work_type: string | null;
  user_id: string;
}

type CriterionEntry = EvaluationResultV1['criteria'][number];

type NormalizationDiagnostics = {
  usedLegacyScoreCount: number;
  missingScoreCount: number;
  clampedScoreCount: number;
  overviewFallbackUsed: boolean;
  recommendationsFallbackUsed: boolean;
};

type CalibrationProfile = {
  policyFamily: string;
  guidance: string;
};

type QualitySignalAssessment = {
  evidenceCoverageRatio: number;
  scoreSpread: number;
  hasUniformScores: boolean;
  hasLowVarianceScores: boolean;
  defaultZeroCount: number;
  confidencePenalty: number;
  warnings: string[];
};

/**
 * Five-way source-of-truth failure bucket.
 *
 * Determines recovery action, retry policy, and operator routing:
 *   app_logic            → stop, preserve artifacts, require code/migration change
 *   vercel_platform      → bounded retry after platform recovery or redeploy
 *   openai_provider      → budgeted exponential backoff if non-terminal
 *   perplexity_adjudication → retry only if adjudicator contract/dep restored
 *   supabase_contract    → freeze unsafe mode, require migration parity proof
 */
export type FailureBucket =
  | 'app_logic'
  | 'vercel_platform'
  | 'openai_provider'
  | 'perplexity_adjudication'
  | 'supabase_contract';

/**
 * Classify a failure code into its source-of-truth bucket.
 * Used by failure envelope, watchdog triage, and operator dashboards.
 */
export function classifyFailureBucket(code: string | null | undefined): FailureBucket {
  if (!code) return 'app_logic';
  // Perplexity / Pass 4 adjudication
  if (code.startsWith('PASS4_') || code.startsWith('PERPLEXITY_') || code === 'EXTERNAL_ADJUDICATION_MISSING_KEY') return 'perplexity_adjudication';
  // Supabase / persistence contract
  if (code.startsWith('PERSISTENCE_') || code.startsWith('SCHEMA_') || code.startsWith('ARTIFACT_') ||
      code === 'SUPABASE_CONTRACT_VIOLATED' || code === 'ARTIFACT_PERSISTENCE_FAILED' ||
      code === 'CONTEXT_CONTAMINATION_DETECTED') return 'supabase_contract';
  // OpenAI / provider transient
  if (code.startsWith('OPENAI_') || code === 'QUOTA_EXCEEDED' ||
      code === 'PASS1_FAILED' || code === 'PASS2_FAILED' || code === 'PASS3_FAILED' ||
      code === 'PASS2_INDEPENDENCE_REWRITE_FAILED') return 'openai_provider';
  // Vercel / platform
  if (code.startsWith('VERCEL_') || code === 'WORKER_TIMEOUT' ||
      code === 'LEASE_EXPIRED' || code === 'PROCESSOR_UNCAUGHT_ERROR') return 'vercel_platform';
  // Default: application logic (governance, QG, auth, schema violations, input)
  return 'app_logic';
}

/** Short deployed git SHA from Vercel env — 'local' in dev/test. */
const DEPLOYED_SHA: string =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? '').substring(0, 7) || 'local';

type PipelineFailureContext = {
  pipelineStage?: string;
  reasonCodes?: string[];
  diagnostics?: unknown;
  /** Override bucket classification when caller has definitive knowledge of failure source */
  bucket?: FailureBucket;
  /** Attempt number at time of failure — stamped into envelope for replay detection */
  attempt?: number;
};

type PipelineFailureEnvelope = {
  failure_origin: string;
  /** Source-of-truth bucket for recovery routing and retry policy */
  bucket: FailureBucket;
  error_code: string;
  error_message: string;
  reason_codes: string[];
  failed_at: string;
  pipeline_stage: string;
  /** Short git SHA of the deployed revision — enables same-SHA retry detection */
  deployed_sha: string;
  /** Attempt number at time of failure */
  attempt?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeReasonCodes(candidates: unknown, fallbackCode: string): string[] {
  if (!Array.isArray(candidates)) {
    return [fallbackCode];
  }

  const unique = Array.from(
    new Set(
      candidates
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );

  return unique.length > 0 ? unique : [fallbackCode];
}

function normalizeFailureDiagnostics(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return null;
    }

    if (serialized.length <= 4_000) {
      const parsed = JSON.parse(serialized);
      return isRecord(parsed) ? parsed : { value: parsed };
    }

    return {
      truncated: true,
      serialized_head: serialized.slice(0, 4_000),
      serialized_length: serialized.length,
    };
  } catch {
    return {
      diagnostics_unserializable: true,
    };
  }
}

function buildPipelineFailureEnvelope(args: {
  errorCode: string;
  errorMessage: string;
  context?: PipelineFailureContext;
}): PipelineFailureEnvelope {
  const pipelineStage =
    typeof args.context?.pipelineStage === 'string' && args.context.pipelineStage.trim().length > 0
      ? args.context.pipelineStage
      : 'processor';

  // Caller-supplied bucket takes precedence; otherwise classify by error code.
  const bucket: FailureBucket = args.context?.bucket ?? classifyFailureBucket(args.errorCode);

  return {
    failure_origin: 'processor',
    bucket,
    error_code: args.errorCode,
    error_message: args.errorMessage,
    reason_codes: normalizeReasonCodes(args.context?.reasonCodes, args.errorCode),
    failed_at: pipelineStage,
    pipeline_stage: pipelineStage,
    deployed_sha: DEPLOYED_SHA,
    ...(typeof args.context?.attempt === 'number' ? { attempt: args.context.attempt } : {}),
  };
}

type ProviderCallPersistenceSummary = {
  attempted: number;
  persisted: number;
  failed: number;
  skipped: number;
  pass4_deferred_reason?: string;
};

function mapPassToPhase(pass: ProviderTelemetryEntry['pass']): 'phase_1a' | 'phase_2' | 'phase_3' {
  if (pass === 1) return 'phase_1a';
  if (pass === 2) return 'phase_2';
  return 'phase_3';
}

async function persistPipelineProviderCalls(args: {
  supabase: any;
  jobId: string;
  telemetry?: ProviderTelemetryEntry[];
  hasPass4CrossCheck: boolean;
}): Promise<ProviderCallPersistenceSummary> {
  const summary: ProviderCallPersistenceSummary = {
    attempted: 0,
    persisted: 0,
    failed: 0,
    skipped: 0,
  };

  const telemetry = Array.isArray(args.telemetry) ? args.telemetry : [];

  for (const entry of telemetry) {
    summary.attempted += 1;

    // Current DB constraint allows provider IN ('openai','anthropic','simulated').
    // Persist OpenAI pass telemetry now; Pass 4 Perplexity persistence requires
    // explicit schema + contract follow-up.
    if (entry.provider !== 'openai') {
      summary.skipped += 1;
      console.warn('[ProviderTelemetryPersistence] unsupported_provider_for_current_schema', {
        job_id: args.jobId,
        provider: entry.provider,
        pass: entry.pass,
      });
      continue;
    }

    const row = {
      job_id: args.jobId,
      phase: mapPassToPhase(entry.pass),
      provider: 'openai',
      provider_meta_version: '2c1.v1',
      request_meta: {
        model: entry.model,
        request_id: entry.request_id ?? null,
        pass: entry.pass,
      },
      response_meta: {
        latency_ms: entry.duration_ms,
        retries: 0,
        status_code: entry.success ? 200 : null,
        finish_reason: entry.finish_reason ?? null,
        tokens_input: entry.usage?.prompt_tokens ?? null,
        tokens_output: entry.usage?.completion_tokens ?? null,
        tokens_total: entry.usage?.total_tokens ?? null,
        started_at: entry.started_at,
        ended_at: entry.completed_at,
        duration_ms: entry.duration_ms,
      },
      error_meta: null,
      result_envelope: {
        telemetry_version: 'provider_telemetry_v1',
        pass: entry.pass,
        provider: entry.provider,
        success: entry.success,
      },
    };

    const { error } = await args.supabase
      .from('evaluation_provider_calls')
      .upsert(row, {
        onConflict: 'job_id,provider,phase',
        ignoreDuplicates: false,
      });

    if (error) {
      summary.failed += 1;
      console.error('[ProviderTelemetryPersistence] upsert_failed', {
        job_id: args.jobId,
        provider: row.provider,
        phase: row.phase,
        code: error.code ?? null,
        message: error.message ?? String(error),
      });
      continue;
    }

    summary.persisted += 1;
  }

  if (args.hasPass4CrossCheck) {
    summary.pass4_deferred_reason =
      'pass4_perplexity_not_persisted_in_processor_path_follow_up_required';
    console.warn('[ProviderTelemetryPersistence] pass4_perplexity_deferred', {
      job_id: args.jobId,
      reason: summary.pass4_deferred_reason,
    });
  }

  return summary;
}

function evalDebugLog(message: string, ...args: unknown[]): void {
  if (!getEvaluationRuntimeConfig().evalDebugEnabled) {
    return;
  }
  console.log(message, ...args);
}

function evalDebugWarn(message: string, ...args: unknown[]): void {
  if (!getEvaluationRuntimeConfig().evalDebugEnabled) {
    return;
  }
  console.warn(message, ...args);
}

type ProcessorStageBoundary =
  | "phase1"
  | "phase2"
  | "pass3"
  | "finalized";

type ProcessorBoundaryState = "start" | "complete" | "failed";

function logProcessorStageBoundary(args: {
  jobId: string;
  stage: ProcessorStageBoundary;
  state: ProcessorBoundaryState;
  at: string;
  metadata?: Record<string, unknown>;
}): void {
  console.log("ProcessorStageBoundary", {
    job_id: args.jobId,
    stage: args.stage,
    state: args.state,
    at: args.at,
    ...(args.metadata ? { metadata: args.metadata } : {}),
  });
}

function hasLiveLeaseExpiration(value: unknown, nowMs = Date.now()): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  const leaseExpiryMs = Date.parse(value);
  if (!Number.isFinite(leaseExpiryMs)) {
    return false;
  }

  return leaseExpiryMs > nowMs;
}

class PipelineSlaExceededError extends Error {
  constructor(message = 'Evaluation exceeded hard SLA; worker aborted before stale sweeper') {
    super(message);
    this.name = 'PipelineSlaExceededError';
  }
}

export function resolveJobHardDeadlineMs(args: {
  startedAt: string | null | undefined;
  maxExecutionMs: number;
  fallbackNowMs?: number;
}): number {
  const fallbackNowMs = args.fallbackNowMs ?? Date.now();
  const startedAtMs = typeof args.startedAt === 'string' ? Date.parse(args.startedAt) : Number.NaN;

  if (Number.isFinite(startedAtMs)) {
    return startedAtMs + args.maxExecutionMs;
  }

  return fallbackNowMs + args.maxExecutionMs;
}

async function assertJobWithinSla(args: {
  supabase: any;
  jobId: string;
  hardDeadlineMs: number;
  stage: string;
  expectedLeaseToken?: string | null;
  expectedClaimedBy?: string | null;
}): Promise<void> {
  if (Date.now() < args.hardDeadlineMs) {
    return;
  }

  const { data: current, error: readError } = await args.supabase
    .from('evaluation_jobs')
    .select('status')
    .eq('id', args.jobId)
    .maybeSingle();

  if (readError) {
    console.warn('[Processor] SLA guard status read failed', {
      job_id: args.jobId,
      stage: args.stage,
      error: readError.message,
    });
  }

  const status = typeof current?.status === 'string' ? current.status : null;
  if (status === JOB_STATUS.COMPLETE || status === JOB_STATUS.FAILED) {
    throw new PipelineSlaExceededError(
      `Job already terminal at SLA guard stage=${args.stage}; aborting worker continuation`,
    );
  }

  if (args.expectedLeaseToken && args.expectedClaimedBy) {
    await finalizeProcessorFailureWithLeaseGuard({
      jobId: args.jobId,
      expectedLeaseToken: args.expectedLeaseToken,
      expectedClaimedBy: args.expectedClaimedBy,
      errorEnvelope: {
        code: 'PIPELINE_SLA_EXCEEDED',
        message: 'Evaluation exceeded hard SLA; worker aborted before stale sweeper',
        retryable: false,
      },
    });
  } else {
    await finalizeJobFailure({
      jobId: args.jobId,
      errorEnvelope: {
        code: 'PIPELINE_SLA_EXCEEDED',
        message: 'Evaluation exceeded hard SLA; worker aborted before stale sweeper',
        retryable: false,
      },
    });
  }

  throw new PipelineSlaExceededError();
}

export async function renewEvaluationJobLease(args: {
  supabase: any;
  jobId: string;
  leaseMs: number;
  stage: string;
  hardDeadlineMs: number;
}): Promise<void> {
  const now = Date.now();
  if (now >= args.hardDeadlineMs) {
    return;
  }

  const nowIso = new Date(now).toISOString();
  const leaseUntilIso = new Date(Math.min(now + args.leaseMs, args.hardDeadlineMs)).toISOString();

  // buildWritablePatch ensures lease_expires_at and other forbidden columns
  // can never slip into this payload even if this function is refactored later.
  const canonicalHeartbeatPayload = buildWritablePatch({
    // Canonical heartbeat fields used by stale sweeper and job forensics
    last_heartbeat_at: nowIso,
    last_heartbeat: nowIso,
    // Legacy heartbeat field retained for mixed-schema compatibility
    heartbeat_at: nowIso,
    // Canonical writable lease source column (lease_expires_at may be generated)
    lease_until: leaseUntilIso,
    // Liveness signal: every lease renewal (fired every 30s in all phase loops)
    // writes worker_pulse_at so the watchdog always has a fresh timestamp.
    worker_pulse_at: nowIso,
    updated_at: nowIso,
  });

  let { error } = await args.supabase
    .from('evaluation_jobs')
    .update(canonicalHeartbeatPayload)
    .eq('id', args.jobId)
    .eq('status', JOB_STATUS.RUNNING);

  if (error && isMissingColumnError(error, 'heartbeat_at')) {
    const { heartbeat_at: _omit, ...withoutLegacyHeartbeat } = canonicalHeartbeatPayload;
    ({ error } = await args.supabase
      .from('evaluation_jobs')
      .update(withoutLegacyHeartbeat)
      .eq('id', args.jobId)
      .eq('status', JOB_STATUS.RUNNING));
  }

  if (error && isMissingColumnError(error, 'lease_until')) {
    ({ error } = await args.supabase
      .from('evaluation_jobs')
      .update({
        last_heartbeat_at: nowIso,
        last_heartbeat: nowIso,
        heartbeat_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', args.jobId)
      .eq('status', JOB_STATUS.RUNNING));
  }

  if (error) {
    console.warn('[Processor] Failed to renew evaluation job lease', {
      job_id: args.jobId,
      stage: args.stage,
      error: error.message,
    });
  }
}

function resolveSafeStartedAt(args: {
  candidate: unknown;
  createdAt: unknown;
  fallbackIso: string;
}): string {
  const fallbackMs = Date.parse(args.fallbackIso);
  if (!Number.isFinite(fallbackMs)) {
    return new Date().toISOString();
  }

  if (typeof args.candidate !== 'string' || args.candidate.trim().length === 0) {
    return new Date(fallbackMs).toISOString();
  }

  const candidateMs = Date.parse(args.candidate);
  if (!Number.isFinite(candidateMs)) {
    return new Date(fallbackMs).toISOString();
  }

  const createdMs = typeof args.createdAt === 'string' ? Date.parse(args.createdAt) : Number.NaN;
  const minAllowedMs = Number.isFinite(createdMs) ? createdMs - 5 * 60_000 : Number.NEGATIVE_INFINITY;
  const maxAllowedMs = fallbackMs + 5 * 60_000;

  if (candidateMs < minAllowedMs || candidateMs > maxAllowedMs) {
    return new Date(fallbackMs).toISOString();
  }

  return new Date(candidateMs).toISOString();
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const match = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asStringArray(value: unknown, maxLen = 3): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, maxLen);
}

function normalizeVerdict(value: unknown): EvaluationResultV1['overview']['verdict'] {
  const candidate = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (candidate === 'pass' || candidate === 'revise' || candidate === 'fail') {
    return candidate;
  }
  return 'revise';
}

function normalizeEffortOrImpact(value: unknown): 'low' | 'medium' | 'high' {
  const candidate = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (candidate === 'low' || candidate === 'medium' || candidate === 'high') {
    return candidate;
  }
  return 'medium';
}

function firstNonEmpty(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

export function getCalibrationProfile(workType: string | null): CalibrationProfile {
  const normalized = (workType || '').toLowerCase();

  if (normalized.includes('memoir') || normalized.includes('nonfiction')) {
    return {
      policyFamily: 'memoir',
      guidance:
        'Calibration profile: memoir/nonfiction. Prioritize factual coherence, narrative authenticity, and thematic clarity over strict three-act fiction expectations.',
    };
  }

  if (normalized.includes('poetry') || normalized.includes('poem')) {
    return {
      policyFamily: 'poetry',
      guidance:
        'Calibration profile: poetry. Prioritize imagery precision, emotional resonance, voice consistency, and line-level craft; avoid forcing prose-narrative assumptions.',
    };
  }

  if (normalized.includes('screenplay') || normalized.includes('script')) {
    return {
      policyFamily: 'screenplay',
      guidance:
        'Calibration profile: screenplay/script. Prioritize scene economy, visual storytelling, dialogue subtext, pacing by sequence, and production-readability conventions.',
    };
  }

  return {
    policyFamily: 'standard',
    guidance:
      'Calibration profile: standard fiction. Prioritize concept strength, narrative drive, character arc coherence, and market-facing readability.',
  };
}

export function assessEvaluationQuality(
  criteria: EvaluationResultV1['criteria'],
): QualitySignalAssessment {
  if (!criteria || criteria.length === 0) {
    return {
      evidenceCoverageRatio: 0,
      scoreSpread: 0,
      hasUniformScores: false,
      hasLowVarianceScores: true,
      defaultZeroCount: 0,
      confidencePenalty: 0.2,
      warnings: ['Quality signal warning: criteria missing; confidence reduced.'],
    };
  }

  const scoreValues = criteria.map((criterion) => criterion.score_0_10);
  const minScore = Math.min(...scoreValues);
  const maxScore = Math.max(...scoreValues);
  const scoreSpread = maxScore - minScore;
  const hasUniformScores = scoreSpread === 0;
  const hasLowVarianceScores = scoreSpread <= 1.5;
  const defaultZeroCount = scoreValues.filter((score) => score === 0).length;

  const evidenceSupportedCount = criteria.filter((criterion) =>
    criterion.evidence.some((entry) => typeof entry.snippet === 'string' && entry.snippet.trim().length >= 20),
  ).length;
  const evidenceCoverageRatio = evidenceSupportedCount / criteria.length;

  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (evidenceCoverageRatio < 0.5) {
    warnings.push(
      `Quality signal warning: low evidence anchoring (${Math.round(evidenceCoverageRatio * 100)}% of criteria include substantive snippets).`,
    );
    confidencePenalty += 0.15;
  } else if (evidenceCoverageRatio < 0.8) {
    warnings.push(
      `Quality signal warning: partial evidence anchoring (${Math.round(evidenceCoverageRatio * 100)}% coverage).`,
    );
    confidencePenalty += 0.07;
  }

  if (hasUniformScores) {
    warnings.push('Quality signal warning: criterion scores are fully uniform; distribution may be under-calibrated.');
    confidencePenalty += 0.12;
  } else if (hasLowVarianceScores) {
    warnings.push(`Quality signal warning: narrow score spread (${scoreSpread.toFixed(2)}); review rubric differentiation.`);
    confidencePenalty += 0.06;
  }

  if (defaultZeroCount >= 5) {
    warnings.push(
      `Quality signal warning: ${defaultZeroCount} criteria resolved to 0/10; input completeness or response shape may be degraded.`,
    );
    confidencePenalty += 0.08;
  }

  return {
    evidenceCoverageRatio,
    scoreSpread,
    hasUniformScores,
    hasLowVarianceScores,
    defaultZeroCount,
    confidencePenalty: clamp(confidencePenalty, 0, 0.3),
    warnings,
  };
}

function normalizeCrossRecommendation(
  raw: unknown,
): EvaluationResultV1['recommendations']['quick_wins'][number] | null {
  if (!isRecord(raw)) {
    return null;
  }

  const actionRaw =
    typeof raw.action === 'string'
      ? raw.action
      : typeof raw.suggestion === 'string'
        ? raw.suggestion
        : '';
  const whyRaw =
    typeof raw.why === 'string'
      ? raw.why
      : typeof raw.reason === 'string'
        ? raw.reason
        : typeof raw.expected_impact === 'string'
          ? raw.expected_impact
          : '';

  const action = actionRaw.trim();
  if (action.length === 0) {
    return null;
  }

  return {
    action,
    why: whyRaw.trim(),
    effort: normalizeEffortOrImpact(raw.effort),
    impact: normalizeEffortOrImpact(raw.impact),
    ...(typeof raw.anchor_snippet === 'string' && raw.anchor_snippet.trim() ? { anchor_snippet: raw.anchor_snippet.trim() } : {}),
    ...(typeof raw.manuscript_coordinates === 'string' && raw.manuscript_coordinates.trim() ? { manuscript_coordinates: raw.manuscript_coordinates.trim() } : {}),
    ...(typeof raw.mechanism === 'string' && raw.mechanism.trim() ? { mechanism: raw.mechanism.trim() } : {}),
    ...(typeof raw.reader_effect === 'string' && raw.reader_effect.trim() ? { reader_effect: raw.reader_effect.trim() } : {}),
    ...(typeof raw.candidate_text_a === 'string' && raw.candidate_text_a.trim() ? { candidate_text_a: raw.candidate_text_a.trim() } : {}),
    ...(typeof raw.criterion_key === 'string' && raw.criterion_key.trim() ? { criterion_key: raw.criterion_key.trim() } : {}),
  };
}

export function normalizeOverviewFromAIResult(
  aiResult: Record<string, unknown>,
  diagnostics?: NormalizationDiagnostics,
): EvaluationResultV1['overview'] {
  const overviewRecord = isRecord(aiResult.overview) ? aiResult.overview : {};

  const verdict = normalizeVerdict(overviewRecord.verdict ?? aiResult.verdict);
  const overallScoreRaw =
    toFiniteNumber(overviewRecord.overall_score_0_100) ?? toFiniteNumber(aiResult.overall_score_0_100);
  const overall_score_0_100 = clamp(overallScoreRaw ?? 70, 0, 100);

  const one_paragraph_summary =
    (typeof overviewRecord.one_paragraph_summary === 'string'
      ? overviewRecord.one_paragraph_summary
      : typeof aiResult.overview === 'string'
        ? aiResult.overview
        : typeof aiResult.summary === 'string'
          ? aiResult.summary
          : typeof aiResult.overview_summary === 'string'
            ? aiResult.overview_summary
            : '') || 'No summary available.';

  if (diagnostics && one_paragraph_summary === 'No summary available.') {
    diagnostics.overviewFallbackUsed = true;
  }

  const top_3_strengths = asStringArray(
    overviewRecord.top_3_strengths ?? aiResult.top_3_strengths ?? aiResult.strengths,
    3,
  );
  const top_3_risks = asStringArray(
    overviewRecord.top_3_risks ?? aiResult.top_3_risks ?? aiResult.risks,
    3,
  );

  return {
    verdict,
    overall_score_0_100,
    one_paragraph_summary,
    top_3_strengths,
    top_3_risks,
  };
}

export function normalizeRecommendationsFromAIResult(
  aiResult: Record<string, unknown>,
  diagnostics?: NormalizationDiagnostics,
): EvaluationResultV1['recommendations'] {
  const recommendationsRecord = isRecord(aiResult.recommendations) ? aiResult.recommendations : {};

  const quickWinsSource = recommendationsRecord.quick_wins ?? aiResult.quick_wins;
  const strategicSource =
    recommendationsRecord.strategic_revisions ??
    aiResult.strategic_revisions ??
    aiResult.strategicRecommendations;

  const quick_wins = Array.isArray(quickWinsSource)
    ? quickWinsSource
        .map(normalizeCrossRecommendation)
        .filter(
          (item): item is EvaluationResultV1['recommendations']['quick_wins'][number] => item !== null,
        )
    : [];

  const strategic_revisions = Array.isArray(strategicSource)
    ? strategicSource
        .map(normalizeCrossRecommendation)
        .filter(
          (item): item is EvaluationResultV1['recommendations']['strategic_revisions'][number] =>
            item !== null,
        )
    : [];

  const normalized = {
    quick_wins,
    strategic_revisions,
  };

  if (diagnostics && quick_wins.length === 0 && strategic_revisions.length === 0) {
    diagnostics.recommendationsFallbackUsed = true;
  }

  return normalized;
}

async function resolveManuscriptText(
  supabase: any,
  manuscript: Manuscript,
): Promise<{ text: string; loadedChunks?: ManuscriptChunkEvidence[] }> {
  // Priority 1: Direct content column
  const directContent = typeof manuscript.content === 'string' ? manuscript.content.trim() : '';
  if (directContent.length > 0) {
    console.log(
      `[Processor] manuscript ${manuscript.id} resolveManuscriptText.content_column (${directContent.length} chars)`,
    );
    return { text: directContent };
  }

  // Priority 2: Decode data URI from file_url (paste submissions store the
  // canonical text here). This MUST run before any manuscript_chunks
  // reconstruction so re-evaluations cannot recursively inflate the resolved
  // text via the chunker's overlap budget. file_url is the canonical source
  // of truth for paste submissions; chunks are derived state.
  const fileUrl = typeof manuscript.file_url === 'string' ? manuscript.file_url : '';
  if (fileUrl.startsWith('data:text/plain')) {
    // Decode failures here must NOT silently fall through to the chunks
    // fallback — that is precisely the recursive-inflation bug PR #520
    // closes. A malformed data URI is a hard failure for this manuscript.
    const commaIndex = fileUrl.indexOf(',');
    if (commaIndex < 0) {
      throw new Error(
        `resolveManuscriptText.file_url_data_uri decode failed for manuscript ${manuscript.id}: missing comma separator`,
      );
    }
    let decoded: string;
    try {
      const encoded = fileUrl.substring(commaIndex + 1);
      decoded = decodeURIComponent(encoded);
    } catch (decodeError) {
      throw new Error(
        `resolveManuscriptText.file_url_data_uri decode failed for manuscript ${manuscript.id}: ${
          decodeError instanceof Error ? decodeError.message : String(decodeError)
        }`,
      );
    }
    if (decoded.trim().length > 0) {
      console.log(
        `[Processor] manuscript ${manuscript.id} resolveManuscriptText.file_url_data_uri (${decoded.length} chars)`,
      );
      // Canonical file_url path resolved successfully — do NOT query
      // manuscript_chunks. Returning here is what enforces the "valid
      // file_url path must not read chunks" invariant.
      return { text: decoded };
    }
    // data:text/plain prefix present but decoded payload was empty/whitespace —
    // surface as a hard failure rather than silently degrading to chunks.
    throw new Error(
      `resolveManuscriptText.file_url_data_uri decode failed for manuscript ${manuscript.id}: empty payload`,
    );
  }

  // Priority 3: Reconstruct from manuscript_chunks (last-resort fallback).
  // Only reached when manuscript.content is empty AND file_url is absent or
  // not a data:text/plain URI. This path is lossy because chunks include
  // overlap; treat it strictly as a fallback, not a canonical source.
  const { data: chunks, error: chunkError } = await supabase
    .from('manuscript_chunks')
    .select('chunk_index, content')
    .eq('manuscript_id', manuscript.id)
    .order('chunk_index', { ascending: true });

  if (chunkError) {
    throw new Error(
      `Failed to load manuscript chunks for manuscript ${manuscript.id}: ${chunkError.message}`,
    );
  }

  if (chunks && chunks.length > 0) {
    const validChunks = (chunks as Array<{ chunk_index?: unknown; content?: unknown }>)
      .filter(
        (c): c is ManuscriptChunkEvidence =>
          typeof c.chunk_index === 'number' && typeof c.content === 'string',
      );
    const reconstructed = validChunks
      .map((chunk) => chunk.content.trim())
      .filter((part) => part.length > 0)
      .join('\n');

    if (reconstructed.length > 0) {
      evalDebugWarn(
        `[Processor] manuscript ${manuscript.id} resolveManuscriptText.manuscript_chunks_fallback; reconstructed text from ${chunks.length} chunk(s)`,
      );
      return { text: reconstructed, loadedChunks: validChunks };
    }
  }

  return { text: '' };
}

async function maybeEnsureLongFormChunks(args: {
  manuscriptId: number;
  jobId: string;
  manuscriptText: string;
}): Promise<ChunkRoutingTelemetry> {
  const manuscriptWords = countWords(args.manuscriptText);
  const manuscriptChars = args.manuscriptText.trim().length;
  const promptBudgetChars = getEvaluationRuntimeConfig().pass.inputCharBudget;
  const exceedsPromptBudget = manuscriptChars > promptBudgetChars;

  // Defense in depth — the primary fail-closed check runs at job intake before
  // this function is called. This catches programmatic callers that bypass
  // processEvaluationJob's intake path.
  if (manuscriptWords > HARD_MANUSCRIPT_CEILING_WORDS) {
    throw new ManuscriptExceedsHardCeilingError(
      `Manuscript exceeds evaluation capacity (${manuscriptWords} words > ${HARD_MANUSCRIPT_CEILING_WORDS}). Please split into volumes.`,
      {
        code: 'MANUSCRIPT_EXCEEDS_HARD_CEILING',
        manuscript_words: manuscriptWords,
        hard_ceiling_words: HARD_MANUSCRIPT_CEILING_WORDS,
      },
    );
  }

  const shouldChunk = manuscriptWords >= STRUCTURAL_CHUNKING_THRESHOLD_WORDS || exceedsPromptBudget;
  const adaptiveCfg = selectChunkerConfig(manuscriptWords);

  if (!shouldChunk) {
    return {
      enabled: true,
      route: 'short_form',
      threshold_words: STRUCTURAL_CHUNKING_THRESHOLD_WORDS,
      prompt_budget_chars: promptBudgetChars,
      source_manuscript_words: manuscriptWords,
      source_manuscript_chars: manuscriptChars,
      manuscript_words: manuscriptWords,
      manuscript_chars: manuscriptChars,
      chunk_count: 0,
      bracket: 'sub_threshold',
      chunk_target_chars: adaptiveCfg.targetChars,
      chunk_max_chars_config: adaptiveCfg.maxChars,
    };
  }

  // Fix(#290): use processor-resolved text directly — never re-resolve through
  // getManuscriptText() which uses a divergent source path and can silently
  // return empty/placeholder text, causing chunk materialization to fail while
  // route telemetry still reports long_form.
  const chunkResult = await ensureChunksFromText(
    args.manuscriptId,
    args.jobId,
    args.manuscriptText,
  );

  return {
    enabled: true,
    route: 'long_form',
    trigger_reason:
      manuscriptWords >= STRUCTURAL_CHUNKING_THRESHOLD_WORDS
        ? 'word_threshold'
        : 'prompt_budget_exceeded',
    threshold_words: STRUCTURAL_CHUNKING_THRESHOLD_WORDS,
    prompt_budget_chars: promptBudgetChars,
    source_manuscript_words: chunkResult.source_manuscript_words ?? manuscriptWords,
    source_manuscript_chars: chunkResult.source_manuscript_chars ?? manuscriptChars,
    chunk_storage_words: chunkResult.chunk_storage_words,
    chunk_storage_chars: chunkResult.chunk_storage_chars,
    overlap_words: chunkResult.overlap_words,
    overlap_chars: chunkResult.overlap_chars,
    manuscript_words: manuscriptWords,
    manuscript_chars: manuscriptChars,
    chunk_count: chunkResult.ensured_count,
    bracket: selectChunkerBracket(manuscriptWords),
    chunk_target_chars: adaptiveCfg.targetChars,
    chunk_max_chars_config: adaptiveCfg.maxChars,
    ensure_chunks_returned_count: chunkResult.ensured_count,
    persisted_chunk_count: chunkResult.persisted_count,
    chunk_source: chunkResult.chunk_source,
    verified_at: chunkResult.verified_at,
    max_chunk_chars: chunkResult.max_chunk_chars,
    max_chunk_index: chunkResult.max_chunk_index,
  };
}

export function isManuscriptTextLongEnough(
  text: string,
  minWords?: number,
): boolean {
  const effectiveMinWords = minWords ?? getProcessorRuntimeDeps().evalMinManuscriptWords;
  const trimmed = text.trim();
  if (!trimmed) {
    return effectiveMinWords <= 0;
  }

  // Use word-boundary matching rather than split(/\s+/) to avoid overcounting
  // malformed whitespace-heavy text or undercounting punctuation-dense content.
  const wordCount = (trimmed.match(/\b\w+\b/g) || []).length;
  return wordCount >= effectiveMinWords;
}

function normalizeCriterionEntry(
  key: CriterionKey,
  raw: unknown,
  diagnostics?: NormalizationDiagnostics,
): CriterionEntry {
  const record = isRecord(raw) ? raw : {};

  const evidence = Array.isArray(record.evidence)
    ? record.evidence
        .filter(isRecord)
        .map((item) => {
          const location = isRecord(item.location)
            ? {
                segment_id:
                  typeof item.location.segment_id === 'string'
                    ? item.location.segment_id
                    : undefined,
                char_start:
                  typeof item.location.char_start === 'number'
                    ? item.location.char_start
                    : undefined,
                char_end:
                  typeof item.location.char_end === 'number'
                    ? item.location.char_end
                    : undefined,
              }
            : undefined;

          return {
            snippet: typeof item.snippet === 'string' ? item.snippet : '',
            ...(location &&
            (location.segment_id !== undefined ||
              location.char_start !== undefined ||
              location.char_end !== undefined)
              ? { location }
              : {}),
            ...(typeof item.note === 'string' ? { note: item.note } : {}),
          };
        })
    : [];

  const recommendations = Array.isArray(record.recommendations)
    ? record.recommendations
        .filter(isRecord)
        .map((item) => {
          const priority: 'high' | 'medium' | 'low' =
            item.priority === 'high' || item.priority === 'medium' || item.priority === 'low'
              ? item.priority
              : 'medium';

          return {
            priority,
            action: typeof item.action === 'string' ? item.action : '',
            expected_impact:
              typeof item.expected_impact === 'string' ? item.expected_impact : '',
          };
        })
    : [];

  evalDebugLog(
    `[Processor] normalizeCriterionEntry key=${key} recordKeys=${Object.keys(record).join(',')} score_0_10=${record.score_0_10} score=${(record as any).score}`,
  );

  const canonicalScore = toFiniteNumber(record.score_0_10);
  const legacyScore = toFiniteNumber((record as any).score);
  const scoreSource =
    canonicalScore !== undefined ? 'score_0_10' : legacyScore !== undefined ? 'score' : 'default_0';
  const rawScore = canonicalScore ?? legacyScore ?? 0;
  const normalizedScore = clamp(rawScore, 0, 10);

  if (scoreSource === 'score') {
    if (diagnostics) {
      diagnostics.usedLegacyScoreCount += 1;
    } else {
      evalDebugWarn(`[Processor] Criterion ${key} used legacy score field; normalizing score -> score_0_10`);
    }
  }
  if (scoreSource === 'default_0') {
    if (diagnostics) {
      diagnostics.missingScoreCount += 1;
    } else {
      evalDebugWarn(`[Processor] Criterion ${key} missing numeric score; defaulting score_0_10 to 0`);
    }
  }
  if (normalizedScore !== rawScore) {
    if (diagnostics) {
      diagnostics.clampedScoreCount += 1;
    } else {
      evalDebugWarn(
        `[Processor] Criterion ${key} score out of range (${rawScore}); clamped to ${normalizedScore}`,
      );
    }
  }

  return {
    key,
    score_0_10: normalizedScore,
    rationale: typeof record.rationale === 'string' ? record.rationale : '',
    evidence,
    recommendations,
  };
}

function describeCriteriaShape(aiCriteria: unknown): string {
  if (Array.isArray(aiCriteria)) {
    return `array(${aiCriteria.length})`;
  }
  if (aiCriteria === undefined) {
    return 'undefined';
  }
  if (isRecord(aiCriteria)) {
    return 'object';
  }
  return typeof aiCriteria;
}

export function normalizeCriteria(
  aiCriteria: unknown,
  diagnostics?: NormalizationDiagnostics,
): EvaluationResultV1['criteria'] {
  const expectedKeys = new Set<CriterionKey>(CRITERIA_KEYS);
  const inputShape = describeCriteriaShape(aiCriteria);

  const byKey: Partial<Record<CriterionKey, unknown>> = {};
  const observedKeys: string[] = [];

  if (Array.isArray(aiCriteria)) {
    for (const item of aiCriteria) {
      if (!isRecord(item) || typeof item.key !== 'string') {
        continue;
      }

      observedKeys.push(item.key);
      if (expectedKeys.has(item.key as CriterionKey)) {
        byKey[item.key as CriterionKey] = item;
      }
    }
  } else if (isRecord(aiCriteria)) {
    for (const [key, value] of Object.entries(aiCriteria)) {
      observedKeys.push(key);
      if (expectedKeys.has(key as CriterionKey)) {
        byKey[key as CriterionKey] = value;
      }
    }
  } else {
    console.warn('[Processor] Criteria normalization failed', {
      inputShape,
      missingKeys: [...CRITERIA_KEYS],
    });
    return [];
  }

  const observedSet = new Set(observedKeys);
  const missingKeys = CRITERIA_KEYS.filter((key) => !(key in byKey));
  const invalidKeys = [...observedSet].filter((key) => !expectedKeys.has(key as CriterionKey));

  if (missingKeys.length > 0 || invalidKeys.length > 0 || observedSet.size !== CRITERIA_KEYS.length) {
    console.warn('[Processor] Criteria normalization failed', {
      inputShape,
      observedCount: observedSet.size,
      missingKeys,
      invalidKeys,
    });
    return [];
  }

  const normalized = CRITERIA_KEYS.map((key) => normalizeCriterionEntry(key, byKey[key], diagnostics));
  evalDebugLog(`[Processor] Criteria normalization success (${normalized.length} canonical keys)`);
  return normalized;
}


/**
 * Extract criteria data from AI response, handling multiple response formats.
 * The AI may return criteria as:
 * 1. aiResult.criteria (object or array)
 * 2. Top-level keys matching CRITERIA_KEYS
 * 3. Nested under aiResult.evaluation.criteria
 */
function extractCriteriaFromAIResult(aiResult: Record<string, unknown>): unknown {
  // Case 1: criteria field exists
  if (aiResult.criteria !== undefined && aiResult.criteria !== null) {
    return aiResult.criteria;
  }

  // Case 2: criteria keys are at the top level of the response
  const topLevelCriteria: Record<string, unknown> = {};
  let foundCount = 0;
  for (const key of CRITERIA_KEYS) {
    if (key in aiResult && typeof aiResult[key] === 'object' && aiResult[key] !== null) {
      topLevelCriteria[key] = aiResult[key];
      foundCount++;
    }
  }
  if (foundCount >= 5) { // At least 5 criteria found at top level
    evalDebugLog(`[Processor] Extracted ${foundCount} criteria from top-level keys`);
    return topLevelCriteria;
  }

  // Case 3: nested under evaluation or results
  const nested = aiResult.evaluation || aiResult.results || aiResult.result;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const nestedObj = nested as Record<string, unknown>;
    if (nestedObj.criteria !== undefined) {
      evalDebugLog('[Processor] Extracted criteria from nested evaluation object');
      return nestedObj.criteria;
    }
  }

  console.warn('[Processor] Could not find criteria in AI response. Keys:', Object.keys(aiResult));
  return undefined;
}

/**
 * Canonical failure-code classification for the watchdog and resume route.
 *
 * INFRASTRUCTURE failures: caused by Vercel, OpenAI, Perplexity, Supabase transient
 * conditions. Safe to rescue / retry because re-running will produce a different result.
 *
 * GOVERNANCE / QUALITY failures: caused by the manuscript content itself or a
 * deterministic gate. Re-running will produce the SAME failure.  Rescuing these
 * would mask real product problems and waste compute.
 *
 * Rules:
 *  - Any code that STARTS WITH a prefix in TERMINAL_FAILURE_PREFIXES is terminal.
 *  - Any code in TERMINAL_FAILURE_EXACT is terminal.
 *  - Everything else is treated as infrastructure (rescuable) — conservative default.
 *
 * Pass4 / Perplexity notes:
 *  - PASS4_REFUSAL_EXHAUSTED: Perplexity safety-filter refusal after one retry.
 *    This is a content-driven failure (the manuscript triggered a refusal), NOT an
 *    infrastructure failure.  Do NOT rescue — it will refusal-loop forever.
 *  - PASS4_CANON_INVALID / PASS4_WEAK_AGREEMENT: governance errors, terminal.
 *  - PASS4_DISPUTED_CRITERIA: warning severity, ships ok:true in optional mode,
 *    never reaches here as a failure code in that mode.
 *  - PASS4_EXTERNAL_ADJUDICATION_FAILED: Perplexity API error (network/timeout).
 *    Retryable at the infra level — Perplexity was unreachable, not refusing.
 */
const TERMINAL_FAILURE_PREFIXES = [
  'POLICY_VIOLATION',      // Contract/provenance/governance policy violations (deterministic)
  'QG_',                    // All quality gate failures (content-driven)
  'PASS4_CANON_INVALID',    // Governance: cross-check structural failure
  'PASS4_WEAK_AGREEMENT',   // Governance: overall agreement too low
  'PASS4_GOVERNANCE_FAILED',// Governance: generic block
  'PASS4_REFUSAL_EXHAUSTED',// Perplexity safety filter — content-driven, not infra
  'PASS4_SCHEMA_INVALID',   // Perplexity returned unparseable schema
  'PASS4_EXTERNAL_ADJUDICATION_MISSING_KEY', // Config error — not infra
  'LLR_',                   // Lessons-learned registry block
  'SCOPE_CLASSIFICATION_FAILED', // Deterministic scope error
  'GOVERNANCE_INJECTION_MAP_INVALID', // Config-level governance error
  'CHUNK_BUDGET_OVERFLOW',  // Manuscript permanently too large for chunk budget
  'MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE', // Structural manuscript problem
  'PIPELINE_INPUT_INVALID', // Bad input — won't improve on retry
  'SCHEMA_INVALID',         // DB schema error — not transient
  'SCHEMA_VIOLATION',       // DB schema error — not transient
  'MANUSCRIPT_NOT_FOUND',   // Data missing — won't appear on retry
  'AUTH_FAILED',            // Credential error — not transient
  'AUTHORIZATION_ERROR',    // Same
  'QUOTA_EXCEEDED',         // Monthly quota — admin must resolve
  'INVALID_INPUT',          // Client-provided invalid data
  'PASS3_FAILED',           // LEGACY: old code path, treat as terminal
  'PASS2_INDEPENDENCE_REWRITE_FAILED', // Deterministic editorial failure
  'EVALUATION_GATE_REJECTED', // Gate rejected — content-driven
  'TEMPLATE_COMPLETENESS_GATE_FAILED', // Template/mapper contract failure — code fix required before retry
];

const TERMINAL_FAILURE_EXACT = new Set<string>([
  'USER_CANCELLED',
  'REVIEW_GATE_REJECTED_BY_AUTHOR',
  'TECHNICAL_FAILURE_REQUIRES_REVIEW',
]);

/**
 * Returns true if a failure code is terminal (must NOT be rescued or retried).
 * A terminal failure means re-running will produce the same failure.
 */
export function isTerminalFailureCode(code: string | null | undefined): boolean {
  if (!code) return false; // Unknown code: assume rescuable (conservative)
  if (code === 'LLR_PRE_ARTIFACT_GENERATION_BLOCK') {
    return false;
  }
  if (TERMINAL_FAILURE_EXACT.has(code)) return true;
  return TERMINAL_FAILURE_PREFIXES.some((prefix) => code.startsWith(prefix));
}

export function maxSelfRecoveryAttemptsForFailureCode(code: string | null | undefined): number {
  if (isTerminalFailureCode(code)) return 0;
  if (!code) return 2;

  // S06b Self-Correction Policy: handoff gate failures get exactly 1 retry.
  // LLM may produce clean output on a second attempt; if retry also fails,
  // the failure becomes terminal (quarantine + fail closed).
  if (code.startsWith('HANDOFF_')) return 1;

  if (code === 'PROCESSOR_UNCAUGHT_ERROR') return 2;

  if (
    code === 'PIPELINE_GLOBAL_SLA_EXCEEDED' ||
    code === 'LEASE_EXPIRED' ||
    code === 'PROCESSOR_LEASE_LOST' ||
    code === 'MARK_RUNNING_LEASE_LOST' ||
    code.startsWith('WORKER_TIMEOUT') ||
    code.startsWith('VERCEL_')
  ) {
    return 3;
  }

  if (
    code.startsWith('OPENAI_') ||
    code.startsWith('PERPLEXITY_') ||
    code === 'PASS4_EXTERNAL_ADJUDICATION_FAILED'
  ) {
    return 3;
  }

  return 2;
}

/**
 * Policy gate: pass12_handoff_v1 artifacts may ONLY be written for jobs whose
 * review_gate has been explicitly approved (review_gate_passed_at IS NOT NULL).
 *
 * Throws POLICY_VIOLATION if the gate has not been passed. This is defense-in-depth
 * against any future code path that might bypass the claim allowlist / GUARD E and
 * try to advance an awaiting_approval job past the review gate.
 */
export async function assertReviewGatePassedBeforeHandoff(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
): Promise<void> {
  const { data: jobCheck, error: jobCheckErr } = await supabase
    .from('evaluation_jobs')
    .select('review_gate_passed_at')
    .eq('id', jobId)
    .single();
  if (jobCheckErr) {
    console.error(
      `[POLICY VIOLATION] Failed to verify review_gate_passed_at for job ${jobId} before pass12_handoff_v1 write: ${jobCheckErr.message}`,
    );
    throw new Error(`POLICY_VIOLATION: pass12_handoff_v1 gate check failed (${jobCheckErr.message})`);
  }
  if (!jobCheck || !(jobCheck as { review_gate_passed_at?: string | null }).review_gate_passed_at) {
    console.error(
      `[POLICY VIOLATION] Attempted to write pass12_handoff_v1 for job ${jobId} without review_gate_passed_at. Aborting.`,
    );
    throw new Error('POLICY_VIOLATION: pass12_handoff_v1 requires review_gate_passed_at');
  }
}

/**
 * Policy gate: phase_2 may queue phase_3 only if pass12_handoff_v1 exists.
 * This prevents phase_3 from starting in a split state and hard-fails earlier
 * with an explicit policy violation.
 */
export async function assertPass12HandoffExistsBeforePhase3Queue(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
): Promise<void> {
  const { data: handoffCheck, error: handoffErr } = await supabase
    .from('evaluation_artifacts')
    .select('id')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass12_handoff_v1')
    .maybeSingle();

  if (handoffErr) {
    throw new Error(`POLICY_VIOLATION: phase_3 queue handoff check failed (${handoffErr.message})`);
  }

  if (!handoffCheck?.id) {
    throw new Error('POLICY_VIOLATION: phase_3 queue requires pass12_handoff_v1');
  }
}

/**
 * SIPOC content-level mistake-proofing: recover missing recommendations in a
 * handoff's pass2Output by reading the upstream pass2_chunk_cache_v1 artifact.
 *
 * When the chunk aggregator (or any upstream bug) produces a pass2Output with
 * empty recommendations arrays, this function reads the chunk cache and merges
 * the per-chunk recommendations back into the criteria, preserving candidate
 * prose fields (candidate_text_a/b/c).
 *
 * Returns true if any recommendations were recovered.
 */
async function recoverHandoffRecommendationsFromChunkCache(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  pass2Output: SinglePassOutput,
): Promise<boolean> {
  const totalRecs = pass2Output.criteria.reduce(
    (sum, c) => sum + (c.recommendations?.length ?? 0), 0,
  );
  if (totalRecs > 0) return false; // Nothing to recover

  const { data: cacheRow } = await supabase
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass2_chunk_cache_v1')
    .maybeSingle();

  if (!cacheRow?.content) {
    console.warn(`[SIPOC recovery] ${jobId}: pass2_chunk_cache_v1 not found — cannot recover recommendations`);
    return false;
  }

  const chunks = (cacheRow.content as Record<string, unknown>).chunks as
    Record<string, { result?: { criteria?: Array<{ key?: string; recommendations?: unknown[] }> } }> | undefined;
  if (!chunks) return false;

  // Build a map of criterion key → merged recommendations from all chunks
  const recoveredRecs = new Map<string, unknown[]>();
  for (const chunkData of Object.values(chunks)) {
    const criteria = chunkData?.result?.criteria;
    if (!Array.isArray(criteria)) continue;
    for (const crit of criteria) {
      if (!crit.key || !Array.isArray(crit.recommendations)) continue;
      const existing = recoveredRecs.get(crit.key) ?? [];
      existing.push(...crit.recommendations);
      recoveredRecs.set(crit.key, existing);
    }
  }

  if (recoveredRecs.size === 0) return false;

  // Merge recovered recommendations into pass2Output criteria (deduplicate by anchor_snippet)
  let totalRecovered = 0;
  for (const criterion of pass2Output.criteria) {
    const chunkRecs = recoveredRecs.get(criterion.key);
    if (!chunkRecs || chunkRecs.length === 0) continue;

    const seenAnchors = new Set(
      criterion.recommendations.map(r => (r.anchor_snippet ?? '').trim().toLowerCase()),
    );
    for (const rec of chunkRecs) {
      const r = rec as typeof criterion.recommendations[number];
      const anchor = (r.anchor_snippet ?? '').trim().toLowerCase();
      if (anchor && !seenAnchors.has(anchor)) {
        criterion.recommendations.push(r);
        seenAnchors.add(anchor);
        totalRecovered++;
      }
    }
  }

  if (totalRecovered > 0) {
    console.log(`[SIPOC recovery] ${jobId}: recovered ${totalRecovered} recommendations from pass2_chunk_cache_v1 into pass2Output`);
  }

  return totalRecovered > 0;
}

type UpstreamArtifactRow = {
  id?: string | null;
  job_id?: string | null;
  manuscript_id?: number | null;
  artifact_type?: string | null;
  content?: unknown;
  source_hash?: string | null;
};

function assertArtifactOwnedByCurrentJobAndManuscript(
  row: UpstreamArtifactRow,
  artifactType: string,
  jobId: string,
  manuscriptId: number,
): void {
  if (row.job_id !== jobId) {
    throw new Error(`POLICY_VIOLATION: ${artifactType} job_id mismatch (expected=${jobId}, actual=${row.job_id ?? 'null'})`);
  }
  if (typeof row.manuscript_id === 'number' && row.manuscript_id !== manuscriptId) {
    throw new Error(`POLICY_VIOLATION: ${artifactType} manuscript_id mismatch (expected=${manuscriptId}, actual=${row.manuscript_id})`);
  }

  const contentRecord = isRecord(row.content) ? row.content : null;
  if (contentRecord && typeof contentRecord.job_id === 'string' && contentRecord.job_id !== jobId) {
    throw new Error(`POLICY_VIOLATION: ${artifactType}.content.job_id mismatch (expected=${jobId}, actual=${contentRecord.job_id})`);
  }
  if (
    contentRecord &&
    typeof contentRecord.manuscript_id === 'number' &&
    contentRecord.manuscript_id !== manuscriptId
  ) {
    throw new Error(
      `POLICY_VIOLATION: ${artifactType}.content.manuscript_id mismatch (expected=${manuscriptId}, actual=${contentRecord.manuscript_id})`,
    );
  }
}

export async function assertPhase2UpstreamInputsCanonical(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  manuscriptId: number,
): Promise<void> {
  const { data: acceptedLedgerRow, error: acceptedLedgerErr } = await supabase
    .from('evaluation_artifacts')
    .select('id, job_id, manuscript_id, artifact_type, content, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'accepted_story_ledger_v1')
    .maybeSingle();

  if (acceptedLedgerErr) {
    throw new Error(`POLICY_VIOLATION: phase_2 accepted ledger check failed (${acceptedLedgerErr.message})`);
  }

  // ── KICK FORWARD: Auto-accept story ledger if missing ──
  // If no accepted_story_ledger_v1 exists (e.g., review gate was bypassed due to
  // non-fatal failures), auto-create one from pass1a_story_layer_v1 with a
  // corruption assessment. Phase 2 proceeds with degraded authority.
  if (!acceptedLedgerRow?.id) {
    console.log(`[phase_2] ${jobId}: No accepted_story_ledger_v1 found — initiating kick-forward auto-acceptance`);
    await autoAcceptStoryLedgerKickForward(supabase, jobId, manuscriptId);
    return;
  }

  const row = acceptedLedgerRow as UpstreamArtifactRow;
  assertArtifactOwnedByCurrentJobAndManuscript(row, 'accepted_story_ledger_v1', jobId, manuscriptId);

  const contentRecord = isRecord(row.content) ? row.content : null;
  const governanceRail = contentRecord && isRecord(contentRecord.governance_rail)
    ? (contentRecord.governance_rail as Record<string, unknown>)
    : null;
  const layerDecisions = governanceRail && isRecord(governanceRail.layer_decisions)
    ? (governanceRail.layer_decisions as Record<string, unknown>)
    : null;

  if (!governanceRail || !layerDecisions || Object.keys(layerDecisions).length < 9) {
    // Instead of hard-failing, auto-accept with what we have (kick forward)
    console.log(`[phase_2] ${jobId}: accepted_story_ledger_v1 has incomplete governance_rail — kick-forward re-acceptance`);
    await autoAcceptStoryLedgerKickForward(supabase, jobId, manuscriptId);
  }
}

/**
 * Auto-accept the story ledger when the review gate was bypassed (kick-forward).
 * Creates accepted_story_ledger_v1 from pass1a_story_layer_v1 with:
 * - A corruption assessment (0.0–1.0 score)
 * - Auto-accepted governance rail (no author verification)
 * - Degraded layer decisions (all layers accepted without review)
 *
 * Downstream processes see the corruption_score and adjust confidence accordingly.
 */
async function autoAcceptStoryLedgerKickForward(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  manuscriptId: number,
): Promise<void> {
  const { assessLedgerCorruption } = await import('@/lib/evaluation/review-gate/ledgerCorruptionAssessor');

  // Load the raw story layer
  const { data: storyLayerRow, error: storyLayerErr } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_story_layer_v1')
    .maybeSingle();

  if (storyLayerErr || !storyLayerRow) {
    throw new Error(
      `KICK_FORWARD_FAILED: Cannot auto-accept — pass1a_story_layer_v1 not found for job ${jobId}. ` +
      `This means Phase 1A never completed. Cannot proceed.`
    );
  }

  const storyLayerContent = isRecord(storyLayerRow.content) ? storyLayerRow.content : {};
  const layerExtraction = extractStoryLayers(storyLayerContent);
  if (layerExtraction.ok === false) {
    throw new Error(
      `KICK_FORWARD_FAILED: Cannot extract story layers — ${layerExtraction.reason}. ` +
      `This means the story layer artifact is structurally invalid.`
    );
  }
  const layers = layerExtraction.layers;
  const storyLayerSourceHash = (storyLayerRow as { source_hash?: string }).source_hash ?? '';

  // Assess corruption
  const corruptionAssessment = assessLedgerCorruption(layers);

  if (!corruptionAssessment.usable) {
    throw new Error(
      `KICK_FORWARD_FAILED: Story ledger is critically corrupt (score=${corruptionAssessment.corruption_score}, ` +
      `${corruptionAssessment.missing_layers.length} missing layers). Cannot produce meaningful evaluation.`
    );
  }

  console.log(
    `[phase_2] ${jobId}: Auto-accepting story ledger with corruption_score=${corruptionAssessment.corruption_score} ` +
    `(${corruptionAssessment.layers_healthy}/9 healthy, ${corruptionAssessment.degraded_layers.length} degraded, ` +
    `${corruptionAssessment.missing_layers.length} missing)`
  );

  // Build auto-accepted layer decisions (all layers accepted without author review)
  const layerNames = Object.keys(layers);
  const autoLayerDecisions: Record<string, { status: string; auto_accepted: boolean; corruption: number }> = {};
  for (const layerName of layerNames) {
    const detail = corruptionAssessment.layer_details.find(d => d.layer_name === layerName);
    autoLayerDecisions[layerName] = {
      status: 'accepted',
      auto_accepted: true,
      corruption: detail?.corruption ?? 0,
    };
  }

  const now = new Date().toISOString();
  const acceptedLedgerPayload = {
    job_id: jobId,
    manuscript_id: manuscriptId,
    manuscript_version_hash: `manuscript_${manuscriptId}_${jobId}`,
    artifact_id: `accepted_story_ledger_v1:kick_forward_${jobId.slice(0, 8)}`,
    artifact_type: 'accepted_story_ledger_v1',
    artifact_version: 'v1',
    source_hash: `kick_forward:${storyLayerSourceHash}`,
    generated_at: now,
    layers,
    governance_rail: {
      approval_state: 'auto_accepted_kick_forward',
      approved_by: 'system:kick_forward',
      approved_at: now,
      disposition: 'accept',
      author_notes: null,
      edit_requests: [],
      pass1a_story_layer_source_hash: storyLayerSourceHash,
      unresolved_warnings_preserved: true,
      dependency_warnings: [],
      contested_layer_count: 0,
      layer_decisions: autoLayerDecisions,
      // Corruption assessment — downstream processes use this to calibrate confidence
      corruption_assessment: corruptionAssessment,
      kick_forward_reason: 'Review gate bypassed due to non-fatal pipeline failure. Ledger auto-accepted with corruption measure.',
    },
  };

  const { error: writeErr } = await supabase
    .from('evaluation_artifacts')
    .upsert(
      {
        job_id: jobId,
        manuscript_id: manuscriptId,
        artifact_type: 'accepted_story_ledger_v1',
        artifact_version: 'v1',
        source_hash: acceptedLedgerPayload.source_hash,
        content: acceptedLedgerPayload,
        created_at: now,
      },
      { onConflict: 'job_id,artifact_type', ignoreDuplicates: false },
    );

  if (writeErr) {
    throw new Error(`KICK_FORWARD_FAILED: Could not write accepted_story_ledger_v1: ${writeErr.message}`);
  }

  // Also set review_gate_passed_at on the job row — downstream policy gates
  // (pass12_handoff_v1) require this timestamp to prove the gate was passed.
  // For kick-forward, we set it to now (auto-approved, no author interaction).
  await supabase
    .from('evaluation_jobs')
    .update({ review_gate_passed_at: now })
    .eq('id', jobId);

  // ── Gate B: Surface corruption score in phase log for admin diagnostics ──
  const { data: jobForLog } = await supabase
    .from('evaluation_jobs')
    .select('progress')
    .eq('id', jobId)
    .maybeSingle();

  if (jobForLog) {
    const currentProgress = (jobForLog as { progress?: Record<string, unknown> }).progress ?? {};
    const existingPhaseLog = Array.isArray(currentProgress.phase_log) ? currentProgress.phase_log : [];
    const corruptionLogEntry = {
      at: now,
      event: 'kick_forward_auto_accepted',
      stage: 'phase_2',
      corruption_score: corruptionAssessment.corruption_score,
      layers_healthy: corruptionAssessment.layers_healthy,
      degraded_layers: corruptionAssessment.degraded_layers,
      missing_layers: corruptionAssessment.missing_layers,
    };
    await supabase
      .from('evaluation_jobs')
      .update({
        progress: {
          ...currentProgress,
          phase_log: [...existingPhaseLog, corruptionLogEntry],
          corruption_score: corruptionAssessment.corruption_score,
        },
      })
      .eq('id', jobId);
  }

  console.log(`[phase_2] ${jobId}: Kick-forward auto-acceptance complete. Corruption score: ${corruptionAssessment.corruption_score}`);
}

export async function assertPhase3UpstreamInputsCanonical(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  manuscriptId: number,
): Promise<void> {
  await assertPhase2UpstreamInputsCanonical(supabase, jobId, manuscriptId);

  const { data: pass12Row, error: pass12Err } = await supabase
    .from('evaluation_artifacts')
    .select('id, job_id, manuscript_id, artifact_type, content, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass12_handoff_v1')
    .maybeSingle();

  if (pass12Err) {
    throw new Error(`POLICY_VIOLATION: phase_3 pass12 handoff check failed (${pass12Err.message})`);
  }
  if (!pass12Row?.id) {
    throw new Error('POLICY_VIOLATION: phase_3 requires pass12_handoff_v1');
  }

  const row = pass12Row as UpstreamArtifactRow;
  assertArtifactOwnedByCurrentJobAndManuscript(row, 'pass12_handoff_v1', jobId, manuscriptId);

  const contentRecord = isRecord(row.content) ? row.content : null;
  const schemaVersion = typeof contentRecord?.schema_version === 'string' ? contentRecord.schema_version : null;
  const hasPass1Output = Boolean(contentRecord && isRecord(contentRecord.pass1Output));

  if (schemaVersion !== 'pass12_handoff_v1' || !hasPass1Output) {
    throw new Error('POLICY_VIOLATION: pass12_handoff_v1 must be canonical and complete before phase_3');
  }
}

/**
 * Watchdog triage for stale running jobs.  Replaces the old flat "kill everything"
 * sweeper with a state-aware corrective-action loop.
 *
 * Two independent detection signals, each with its own corrective action:
 *
 * 1. FROZEN WATCHDOG (60 s no heartbeat, configurable via EVAL_FROZEN_HEARTBEAT_SECS)
 *    - The leaseRenewalLoop setInterval stops firing when Vercel fluid-compute freezes
 *      the function (not kills it — freezes it under memory pressure).  Two missed 30s
 *      beats = 60 s silence = function is frozen.
 *    - Corrective action is STATE-AWARE with the following guards (E runs FIRST):
 *        e) phase=review_gate AND phase_status=awaiting_approval → SKIP entirely
 *           (policy-conservative: the Review Gate is a hard author-input stop and
 *           may NEVER be advanced by the watchdog).
 *        a) Terminal failure code (QG_*, PASS4_REFUSAL_*, governance) → kill, never rescue.
 *        b) attempt_count >= max_attempts → kill terminally, no more rescues.
 *        c) Same stage + same error_code repeated twice → kill, not an infra problem.
 *        d) pass12_handoff_v1 artifact exists → rescue to phase_3/queued.
 *        f) Otherwise → true freeze mid-pipeline, mark failed (resume button appears).
 *
 * 2. AGE-BASED KILL (13 min stale, EVAL_STALE_RUNNING_MINUTES)
 *    - Existing behavior: belt-and-suspenders for jobs the frozen watchdog missed.
 *    - Belt-and-suspenders guard: NEVER touch phase_status='complete' rows.
 *      Those are handed-off jobs waiting for cron pickup — killing them would
 *      destroy work that already succeeded.
 *
 * Both passes skip phase_status='complete' rows — the only safe way to transition
 * a complete row is through the rescue path above.
 *
 * RECOVERY AUDIT: every rescue writes a watchdog_rescue_v1 artifact so the
 * recovery is forensically provable even after log rotation.
 */
export async function failStaleRunningJobs(): Promise<{
  staleFound: number;
  failed: number;
  rescued: number;
  ids: string[];
}> {
  // Watchdog must read fresh env — not the module-level cache — to pick up
  // runtime changes to EVAL_STALE_RUNNING_MINUTES / EVAL_FROZEN_HEARTBEAT_SECS.
  const { staleRunningMinutes, frozenHeartbeatSecs } = (() => {
    const fresh = resolveEvaluationRuntimeConfig(process.env);
    return { staleRunningMinutes: fresh.staleRunningMinutes, frozenHeartbeatSecs: fresh.frozenHeartbeatSecs };
  })();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const runningStatus = normalizeEvaluationJobStatus(JOB_STATUS.RUNNING) as JobStatus;
  const failedStatus  = normalizeEvaluationJobStatus(JOB_STATUS.FAILED)  as JobStatus;

  // ─── PASS 1: Frozen watchdog (60 s no heartbeat) ────────────────────────────
  // Fetch full rows with all columns needed for triage decisions.
  const frozenCutoff = new Date(nowMs - frozenHeartbeatSecs * 1_000).toISOString();
  const { data: frozenCandidates, error: frozenErr } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, phase, phase_status, progress, failure_code, attempt_count, max_attempts')
    .eq('status', runningStatus)
    .not('last_heartbeat_at', 'is', null)
    .lt('last_heartbeat_at', frozenCutoff)
    .order('last_heartbeat_at', { ascending: true })
    .limit(25);

  if (frozenErr) {
    console.warn('[Watchdog] frozen-heartbeat scan failed:', frozenErr.message);
  }

  let rescued = 0;
  const frozenFailIds: string[] = [];

  if (frozenCandidates && frozenCandidates.length > 0) {
    // Batch-fetch handoff artifacts for all frozen candidates in one query.
    const frozenIds = frozenCandidates.map((r) => r.id);
    const { data: handoffArtifacts } = await supabase
      .from('evaluation_artifacts')
      .select('job_id')
      .in('job_id', frozenIds)
      .eq('artifact_type', 'pass12_handoff_v1');

    const handoffJobIds = new Set((handoffArtifacts ?? []).map((a) => a.job_id));

    // Two-artifact gate: batch-fetch ledger + preflight artifacts for phase_1a frozen jobs
    const { data: ledgerArtifacts } = await supabase
      .from('evaluation_artifacts')
      .select('job_id')
      .in('job_id', frozenIds)
      .eq('artifact_type', 'pass1a_character_ledger_v1');
    const ledgerJobIds = new Set((ledgerArtifacts ?? []).map((a) => a.job_id));

    const { data: preflightArtifacts } = await supabase
      .from('evaluation_artifacts')
      .select('job_id')
      .in('job_id', frozenIds)
      .eq('artifact_type', 'pass3_preflight_draft_v1');
    const preflightJobIds = new Set((preflightArtifacts ?? []).map((a) => a.job_id));

    // Chunk cache artifacts for frozen phase_1a jobs — chunk_cache present but
    // ledger missing means ledger can be rebuilt from cache without OpenAI calls.
    const { data: frozenChunkCacheArtifacts } = await supabase
      .from('evaluation_artifacts')
      .select('job_id')
      .in('job_id', frozenIds)
      .eq('artifact_type', 'pass1a_chunk_cache_v1');
    const chunkCacheJobIds = new Set((frozenChunkCacheArtifacts ?? []).map((a) => a.job_id));

    // Batch-fetch evaluation_result_v2 (Pass 3B synthesis) artifacts for GUARD D
    // logging only. Under the new contract, any handoff-present rescue targets
    // phase_3 (which owns both Pass 3B synthesis and WAVE).
    const { data: evalResultArtifacts } = await supabase
      .from('evaluation_artifacts')
      .select('job_id')
      .in('job_id', frozenIds)
      .eq('artifact_type', 'evaluation_result_v2');
    const evalResultJobIds = new Set((evalResultArtifacts ?? []).map((a) => a.job_id));

    const rescueNow = new Date().toISOString();
    type RescueEntry = {
      id: string;
      manuscriptId: number;
      reason: string;
      checkpoint: string;
      // Explicit rescue target — overrides the default phase-based mapping below.
      // Used by split-brain rescue: pass12_handoff exists while job is stuck in
      // phase_1a — target is phase_3 if evaluation_result_v2 is present,
      // phase_2 (Pass 3B synthesis) otherwise.
      targetPhase?: string;
    };
    const rescueEntries: RescueEntry[] = [];
    const terminalFailEntries: Array<{ id: string; reason: string }> = [];

    for (const row of frozenCandidates) {
      const progress = row.progress && typeof row.progress === 'object'
        ? (row.progress as Record<string, unknown>)
        : {};
      const phaseStatusTopLevel = row.phase_status as string | null;
      const phaseStatusProgress  = progress.phase_status as string | undefined;
      const lastErrorCode         = (row.failure_code as string | null)
                                     ?? (progress.error_code as string | undefined)
                                     ?? null;
      const attemptCount  = (row.attempt_count  as number | null) ?? 0;
      const maxAttempts   = (row.max_attempts   as number | null) ?? 11;

      // ─ GUARD E (phase-conservative): never advance a job sitting at the
      //   review_gate / awaiting_approval hard stop. The gate is waiting on an
      //   explicit author approval artifact; advancing it from the watchdog is a
      //   policy violation. This is the FIRST check — overrides every other path.
      if ((row as { phase?: string }).phase === 'review_gate' && phaseStatusTopLevel === 'awaiting_approval') {
        console.warn(
          `[WATCHDOG GUARD E] Job ${row.id} is at review_gate/awaiting_approval — policy violation to advance. Skipping.`,
        );
        continue;
      }

      // ─ GUARD A: Terminal failure code — content/governance-driven, never rescue ──
      if (isTerminalFailureCode(lastErrorCode)) {
        terminalFailEntries.push({
          id: row.id,
          reason: `terminal_failure_code:${lastErrorCode}`,
        });
        continue;
      }

      // ─ GUARD B: Attempt limit exhausted — stop rescue loop ──────────────────
      if (attemptCount >= maxAttempts) {
        terminalFailEntries.push({
          id: row.id,
          reason: `max_attempts_exhausted:${attemptCount}/${maxAttempts}`,
        });
        continue;
      }

      // ─ GUARD C: Same-stage same-code repeated failure — not an infra problem ──
      // Detected by checking if progress.watchdog_last_rescue_code === lastErrorCode
      // AND progress.watchdog_last_rescue_phase === current phase.  If they match,
      // the previous rescue didn't fix anything — this is deterministic.
      const lastRescueCode  = progress.watchdog_last_rescue_code  as string | undefined;
      const lastRescuePhase = progress.watchdog_last_rescue_phase as string | undefined;
      const currentPhase    = (progress.phase as string | undefined)
                               ?? phaseStatusTopLevel
                               ?? 'unknown';
      if (
        lastErrorCode &&
        lastRescueCode  === lastErrorCode &&
        lastRescuePhase === currentPhase
      ) {
        terminalFailEntries.push({
          id: row.id,
          reason: `repeated_same_failure:${currentPhase}:${lastErrorCode}`,
        });
        continue;
      }

      // ─ GUARD D: Artifact checkpoint gate ─────────────────────────────────────
      // If pass12_handoff_v1 exists (or phase_status=complete), Pass 1+2 finished.
      // Under the new contract phase_3 owns Pass 3B synthesis AND WAVE, so any
      // job stuck with a handoff (eval_result present or not) rescues to phase_3.
      const alreadyHandedOff =
        phaseStatusTopLevel === 'complete' ||
        phaseStatusProgress  === 'complete' ||
        handoffJobIds.has(row.id);

      if (alreadyHandedOff) {
        const hasEvalResult = evalResultJobIds.has(row.id);
        const handoffTargetPhase = 'phase_3';

        if (currentPhase === 'phase_1a' || currentPhase === 'phase_2') {
          if (hasEvalResult) {
            console.log(`[watchdog] split-brain: handoff + eval_result present — advancing to phase_3 (WAVE) (job=${row.id})`);
          } else {
            console.log(`[watchdog] split-brain: handoff present, eval_result missing — advancing to phase_3 (Pass 3B synthesis) (job=${row.id})`);
          }
        }
        rescueEntries.push({
          id: row.id,
          manuscriptId: (row.manuscript_id as number | null) ?? 0,
          reason: hasEvalResult
            ? 'handoff_artifact_found_eval_result_present'
            : 'handoff_artifact_found_eval_result_missing',
          checkpoint: hasEvalResult
            ? 'pass12_handoff_v1+evaluation_result_v2'
            : 'pass12_handoff_v1',
          targetPhase: handoffTargetPhase,
        });
        continue;
      }

      // Frozen-job rescue gate for phase_1a.
      // NOTE: split-brain (pass12_handoff_v1 present while phase=phase_1/_1a) is
      // handled higher up by GUARD D, which intercepts the handoff case before
      // we get here and rescues straight to phase_3.
      //   Condition 1: ledger + preflight both present → rescue to phase_2
      //   Condition 2: ledger present, preflight missing + >400s elapsed → rescue
      //                to phase_2 (preflight degraded)
      //   Condition 2b: chunk cache present, ledger missing → rescue to phase_1a
      //                 (runner will rebuild ledger from cache, zero OpenAI calls)
      //   Condition 3: neither artifact present AND no handoff. If >600s, terminal
      //                UNLESS chunk cache exists — then rescue to phase_1a.
      if (currentPhase === 'phase_1a') {
        const hasLedger      = ledgerJobIds.has(row.id);
        const hasPreflight   = preflightJobIds.has(row.id);
        const hasChunkCache  = chunkCacheJobIds.has(row.id);
        const phase1aStartedAt = progress.phase1a_started_at as string | undefined;
        const elapsedSincePhase1aStartMs = phase1aStartedAt
          ? nowMs - new Date(phase1aStartedAt).getTime()
          : 0;
        const PREFLIGHT_TIMEOUT_THRESHOLD_MS = 400_000; // 400s
        const PHASE1A_HARD_TIMEOUT_MS        = 600_000; // 600s

        // ── Condition 1: both Pass 1A artifacts ready → rescue to phase_2 ──
        if (hasLedger && hasPreflight) {
          rescueEntries.push({
            id: row.id,
            manuscriptId: (row.manuscript_id as number | null) ?? 0,
            reason: 'phase_1a_both_artifacts_ready',
            checkpoint: 'pass1a_character_ledger_v1+pass3_preflight_draft_v1',
            targetPhase: 'review_gate',
          });
          continue;
        }

        // ── Condition 2: ledger ready, preflight timed out → degraded rescue ──
        if (hasLedger && !hasPreflight && elapsedSincePhase1aStartMs > PREFLIGHT_TIMEOUT_THRESHOLD_MS) {
          rescueEntries.push({
            id: row.id,
            manuscriptId: (row.manuscript_id as number | null) ?? 0,
            reason: 'phase_1a_ledger_ready_preflight_timeout',
            checkpoint: 'pass1a_character_ledger_v1',
            targetPhase: 'review_gate',
          });
          continue;
        }

        // ── Condition 2b: chunk cache present, ledger missing → rebuild ledger ──
        // Rescue back to phase_1a so the runner reads the cache, calls
        // reduceCharacterEvidence + buildCharacterLedgerV2, writes the ledger,
        // then queues phase_2 — zero OpenAI calls needed.
        if (hasChunkCache && !hasLedger) {
          rescueEntries.push({
            id: row.id,
            manuscriptId: (row.manuscript_id as number | null) ?? 0,
            reason: 'phase_1a_chunk_cache_ready_ledger_missing',
            checkpoint: 'pass1a_chunk_cache_v1',
            targetPhase: 'phase_1a',
          });
          continue;
        }

        // ── Condition 3: neither artifact + no handoff. If >600s, terminal. ──
        if (elapsedSincePhase1aStartMs > PHASE1A_HARD_TIMEOUT_MS) {
          console.warn(`[watchdog] phase_1a hard timeout: no artifacts after ${Math.round(elapsedSincePhase1aStartMs / 1000)}s — failing job ${row.id}`);
          terminalFailEntries.push({
            id: row.id,
            reason: 'phase_1a timeout: no artifacts written after 600s',
          });
          continue;
        }

        // Not enough artifacts yet — let the job keep running
        console.log(`[Watchdog] ${row.id}: phase_1a frozen but artifacts not ready — no rescue (hasLedger=${hasLedger} hasPreflight=${hasPreflight} hasChunkCache=${hasChunkCache} elapsed=${Math.round(elapsedSincePhase1aStartMs / 1000)}s)`);
        continue;
      }

      // ─ GUARD F: True freeze mid-pipeline — no checkpoint, mark failed ─────────
      terminalFailEntries.push({
        id: row.id,
        reason: 'frozen_no_checkpoint',
      });
    }

    // ─── Rescue: transition to queued/phase_2 so next cron tick claims Phase 2 ────
    if (rescueEntries.length > 0) {
      // Build progress patch: stamp watchdog_last_rescue_* so Guard C fires if
      // the same job comes back frozen with the same error code after rescue.
      // We can't do per-row JSONB patches in a bulk UPDATE, so we add the
      // rescue stamp individually (still batched — one write per rescued job).
      const rescueUpdateResults = await Promise.allSettled(
        rescueEntries.map(async (entry) => {
          // Fetch current progress to merge stamp without losing existing keys.
          const { data: currentRow } = await supabase
            .from('evaluation_jobs')
            .select('progress, attempt_count, review_gate_entered_at')
            .eq('id', entry.id)
            .single();

          const currentProgress = (currentRow?.progress && typeof currentRow.progress === 'object')
            ? (currentRow.progress as Record<string, unknown>)
            : {};
          const currentAttempts = (currentRow?.attempt_count as number | null) ?? 0;

          // Determine rescue target phase:
          //   - entry.targetPhase set explicitly (split-brain → phase_2 or phase_3
          //     based on evaluation_result_v2 presence) → honor it
              //   - phase_1a frozen → rescue to phase_2 (Pass 3 will re-run Pass 1A if ledger missing)
          //   - phase_2+ frozen → rescue to phase_2 (safe retry)
          const currentPhaseForRescue = (currentProgress.phase as string | undefined) ?? 'phase_1a';
          // Default rescue target:
          //   chunk_cache checkpoint → back to phase_1a (ledger rebuild, no OpenAI)
          //   anything else in phase_1a, or phase_2+ → phase_2
          const rescueTargetPhase = entry.targetPhase
            ?? (entry.checkpoint === 'pass1a_chunk_cache_v1' ? 'phase_1a' : 'phase_2');
          const rescueTargetPhaseStatus = rescueTargetPhase === 'review_gate' ? 'awaiting_approval' : JOB_STATUS.QUEUED;
          const rescueAttemptCount = rescueTargetPhase === 'review_gate' ? currentAttempts : currentAttempts + 1;

          const rescuedProgress = {
            ...currentProgress,
            phase:                      rescueTargetPhase,
            phase_status:               rescueTargetPhaseStatus,
            watchdog_last_rescue_at:    rescueNow,
            watchdog_last_rescue_code:  currentProgress.error_code ?? null,
            watchdog_last_rescue_phase: currentProgress.phase ?? null,
            watchdog_rescue_count:      ((currentProgress.watchdog_rescue_count as number | null) ?? 0) + 1,
          };

          const { data: updateResult, error: updateErr } = await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.QUEUED,
              phase: rescueTargetPhase,
              phase_status: rescueTargetPhaseStatus,
              claimed_by: null,
              claimed_at: null,
              lease_token: null,
              lease_until: null,
              attempt_count: rescueAttemptCount,
              updated_at: rescueNow,
              progress: rescuedProgress,
              ...(rescueTargetPhase === 'review_gate' && !currentRow?.review_gate_entered_at ? { review_gate_entered_at: rescueNow } : {}),
            })
            .eq('id', entry.id)
            .eq('status', runningStatus)
            .select('id')
            .single();

          if (updateErr) {
            console.warn('[Watchdog] rescue update failed for job', entry.id, updateErr.message);
            return null;
          }

          // Write durable recovery audit artifact — survives log rotation.
          // This is best-effort: if it fails, the rescue still happened.
          try {
            const { upsertEvaluationArtifact: _upsert } = await import('./artifactPersistence');
            await _upsert({
              supabase,
              jobId: entry.id,
              manuscriptId: entry.manuscriptId,
              artifactType: 'watchdog_rescue_v1',
              content: {
                event: 'watchdog_rescue',
                from_status: 'running',
                to_status: 'queued',
                from_phase: currentProgress.phase ?? 'phase_1a',
                to_phase: rescueTargetPhase,
                rescue_reason: entry.reason,
                checkpoint_used: entry.checkpoint,
                rescue_count: rescuedProgress.watchdog_rescue_count,
                attempt_count_after: rescueAttemptCount,
                rescuedAt: rescueNow,
              },
              sourceHash: `watchdog_rescue_${entry.id}_${rescueNow}`,
              artifactVersion: 'watchdog_rescue_v1',
            });
          } catch (artifactErr) {
            // Non-fatal — rescue already committed to DB
            console.warn('[Watchdog] recovery audit artifact write failed (non-fatal):', entry.id,
              artifactErr instanceof Error ? artifactErr.message : String(artifactErr));
          }

          return updateResult?.id ?? null;
        }),
      );

      const successfulRescues = rescueUpdateResults
        .filter((r) => r.status === 'fulfilled' && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<string | null>).value as string);

      rescued = successfulRescues.length;
      if (rescued > 0) {
        console.log(`[Watchdog] Rescued ${rescued} frozen job(s) to next-phase/queued`, {
          rescued_ids: successfulRescues,
        });
      }
    }

    // ─── Terminal fail: governance errors, exhausted attempts, repeat failures ────
    if (terminalFailEntries.length > 0) {
      const failIds = terminalFailEntries.map((e) => e.id);
      const { error: freezeFailErr } = await supabase
        .from('evaluation_jobs')
        .update({
          status: failedStatus,
          phase_status: 'failed',
          last_error: 'Auto-failed by watchdog: frozen function with no recoverable checkpoint',
          failure_code: 'WORKER_TIMEOUT_PHASE_1A' as string,
          claimed_by: null,
          claimed_at: null,
          lease_token: null,
          lease_until: null,
          updated_at: rescueNow,
        })
        .in('id', failIds)
        .eq('status', runningStatus);

      if (freezeFailErr) {
        console.warn('[Watchdog] terminal-fail update failed:', freezeFailErr.message);
      } else {
        for (const entry of terminalFailEntries) {
          console.log(`[Watchdog] Terminal-failed job ${entry.id}: ${entry.reason}`);
          frozenFailIds.push(entry.id);
        }
      }
    }
  }

  // ─── PASS 2: Age-based kill (13 min) ────────────────────────────────────────
  // Belt-and-suspenders for anything the frozen watchdog missed.
  // NEVER touch phase_status='complete' rows.
  const ageCutoff = new Date(nowMs - staleRunningMinutes * 60_000).toISOString();

  const { data: staleByAge, error: ageError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', runningStatus)
    .neq('phase_status', 'complete')   // ← guard: never kill handed-off jobs
    .not('last_heartbeat_at', 'is', null)
    .lt('last_heartbeat_at', ageCutoff)
    .order('last_heartbeat_at', { ascending: true })
    .limit(25);

  if (ageError) {
    console.warn('[Processor] Failed to check stale running jobs (age):', ageError.message);
    return { staleFound: 0, failed: frozenFailIds.length, rescued, ids: frozenFailIds };
  }

  // Also collect jobs with expired claim leases (skip phase_status='complete').
  // Primary scan uses lease_until (the column claim RPCs write to).
  // Fallback to lease_expires_at if lease_until is missing (legacy schema).
  let staleByLease: Array<{ id: string }> | null = null;
  let leaseScanUsedLegacyColumn = false;
  let { data: leaseData, error: leaseError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', runningStatus)
    .neq('phase_status', 'complete')   // ← guard
    .not('lease_until', 'is', null)
    .lt('lease_until', now)
    .order('lease_until', { ascending: true })
    .limit(25);

  if (leaseError && isMissingColumnError(leaseError, 'lease_until')) {
    console.warn('[Processor] lease_until unavailable; retrying with lease_expires_at');
    leaseScanUsedLegacyColumn = true;
    ({ data: leaseData, error: leaseError } = await supabase
      .from('evaluation_jobs')
      .select('id')
      .eq('status', runningStatus)
      .neq('phase_status', 'complete') // ← guard
      .not('lease_expires_at', 'is', null)
      .lt('lease_expires_at', now)
      .order('lease_expires_at', { ascending: true })
      .limit(25));
  }

  staleByLease = (leaseData as Array<{ id: string }> | null) ?? [];

  if (leaseError) {
    console.warn('[Processor] Failed to check stale running jobs (lease):', leaseError.message);
  }

  const ageIds   = (staleByAge   ?? []).map((r) => r.id);
  const leaseIds = (staleByLease ?? []).map((r) => r.id);
  // Exclude IDs already handled by the frozen watchdog in this tick
  const alreadyHandled = new Set([...frozenFailIds, ...Array.from({ length: rescued }, (_, i) => i)]);
  const staleIds = Array.from(new Set([...ageIds, ...leaseIds]))
    .filter((id) => !frozenFailIds.includes(id));

  void alreadyHandled; // suppress lint — kept for documentation clarity

  if (staleIds.length === 0) {
    return { staleFound: frozenFailIds.length, failed: frozenFailIds.length, rescued, ids: frozenFailIds };
  }

  // ── CHECKPOINT CHECK for lease/age stale jobs ────────────────────────────────
  // Before bulk-failing, check if any of these jobs already wrote a
  // pass12_handoff_v1 artifact (Pass 1+2 succeeded but phase transition
  // was interrupted). Those must be rescued to phase_1a, not failed.
  const { data: staleHandoffRows } = await supabase
    .from('evaluation_artifacts')
    .select('job_id')
    .in('job_id', staleIds)
    .eq('artifact_type', 'pass12_handoff_v1');
  const staleHandoffJobIds = new Set((staleHandoffRows ?? []).map((r) => r.job_id as string));

  // Also check for phase_1a two-artifact gate (ledger + preflight)
  const { data: staleLedgerRows } = await supabase
    .from('evaluation_artifacts')
    .select('job_id')
    .in('job_id', staleIds)
    .eq('artifact_type', 'pass1a_character_ledger_v1');
  const staleLedgerJobIds = new Set((staleLedgerRows ?? []).map((r) => r.job_id as string));

  const { data: stalePreflightRows } = await supabase
    .from('evaluation_artifacts')
    .select('job_id')
    .in('job_id', staleIds)
    .eq('artifact_type', 'pass3_preflight_draft_v1');
  const stalePreflightJobIds = new Set((stalePreflightRows ?? []).map((r) => r.job_id as string));

  // Check for pass1a_chunk_cache_v1 — partial checkpoint for full-novel phase_1a timeouts.
  // When chunk cache exists but ledger is missing, phase_1a can rebuild the ledger from cache
  // without re-running OpenAI. Treat as rescuable rather than failed.
  const { data: staleChunkCacheRows } = await supabase
    .from('evaluation_artifacts')
    .select('job_id')
    .in('job_id', staleIds)
    .eq('artifact_type', 'pass1a_chunk_cache_v1');
  const staleChunkCacheJobIds = new Set((staleChunkCacheRows ?? []).map((r) => r.job_id as string));

  // Rescue if: handoff OR (ledger + preflight) OR (ledger alone) OR chunk_cache (ledger missing but rebuildable)
  const staleToRescue = staleIds.filter((id) => {
    if (staleHandoffJobIds.has(id)) return true;
    const hasLedger     = staleLedgerJobIds.has(id);
    const hasPreflight  = stalePreflightJobIds.has(id);
    const hasChunkCache = staleChunkCacheJobIds.has(id);
    if (hasLedger && hasPreflight) return true;
    if (hasLedger) return true; // stale-by-lease already implies timeout elapsed
    if (hasChunkCache) return true; // chunk cache is a recoverable checkpoint — ledger can be rebuilt
    return false;
  });
  const staleToFail = staleIds.filter((id) => !staleToRescue.includes(id));

  if (staleToRescue.length > 0) {
    const staleRescueNow = new Date().toISOString();
    const staleRescueResults = await Promise.allSettled(
      staleToRescue.map(async (id) => {
        const { data: currentRow } = await supabase
          .from('evaluation_jobs')
          .select('progress, attempt_count')
          .eq('id', id)
          .single();

        const currentProgress = (currentRow?.progress && typeof currentRow.progress === 'object')
          ? (currentRow.progress as Record<string, unknown>)
          : {};
        const currentAttempts = (currentRow?.attempt_count as number | null) ?? 0;
        const currentPhaseForRescue = (currentProgress.phase as string | undefined) ?? 'phase_1a';
        // Phase-aware rescue targeting:
        //   - phase_1a + chunk cache, no ledger → phase_1a (rebuild ledger from cache, zero OpenAI)
        //   - phase_3 + handoff artifact → phase_3 (don't regress to phase_2)
        //   - handoff present + phase_2 or later → phase_3 (skip re-running Phase 2)
        //   - everything else → phase_2
        const hasLedgerForStaleJob  = staleLedgerJobIds.has(id);
        const hasCacheForStaleJob   = staleChunkCacheJobIds.has(id);
        const hasHandoffForStaleJob = staleHandoffJobIds.has(id);
        const rescueTargetPhase =
          (currentPhaseForRescue === 'phase_1a' && hasCacheForStaleJob && !hasLedgerForStaleJob)
            ? 'phase_1a'
            : (currentPhaseForRescue === 'phase_3' && hasHandoffForStaleJob)
              ? 'phase_3'
              : (hasHandoffForStaleJob && currentPhaseForRescue !== 'phase_1a')
                ? 'phase_3'
                : 'phase_2';

        const { error: rescueErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED,
            phase: rescueTargetPhase,
            phase_status: JOB_STATUS.QUEUED,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            attempt_count: currentAttempts + 1,
            updated_at: staleRescueNow,
            progress: {
              ...currentProgress,
              phase: rescueTargetPhase,
              phase_status: JOB_STATUS.QUEUED,
              watchdog_last_rescue_at: staleRescueNow,
              watchdog_last_rescue_phase: currentPhaseForRescue,
              watchdog_rescue_count: ((currentProgress.watchdog_rescue_count as number | null) ?? 0) + 1,
              message: `Watchdog rescued (lease expired with handoff artifact) — queued as ${rescueTargetPhase}`,
            },
          })
          .eq('id', id)
          .eq('status', runningStatus);

        if (rescueErr) {
          console.warn('[Watchdog] stale-lease rescue failed for job', id, rescueErr.message);
          return null;
        }
        console.log(`[Watchdog] Rescued stale-lease job ${id} — ${currentPhaseForRescue} → ${rescueTargetPhase}`);
        rescued++;
        return id;
      }),
    );
    void staleRescueResults; // results logged per-job above
  }

  // Only fail jobs that had no recoverable checkpoint
  const staleIds_final = staleToFail;
  if (staleIds_final.length === 0) {
    return { staleFound: staleIds.length + frozenFailIds.length, failed: frozenFailIds.length, rescued, ids: frozenFailIds };
  }

  const failureResetPayloadBase = {
    status: failedStatus,
    phase_status: 'failed',
    last_error:
      'Auto-failed stale running job: worker timed out or crashed before completion update',
    failure_code: 'STALE_RUNNING_NO_RECOVERABLE_CHECKPOINT' as string,
    claimed_by: null,
    claimed_at: null,
    lease_token: null,
    updated_at: now,
  };

  // Production (lease_until exists): clear lease_until.
  // Legacy (lease_until missing, fell back to lease_expires_at): clear lease_expires_at.
  const failureResetPayload = leaseScanUsedLegacyColumn
    ? { ...failureResetPayloadBase, lease_expires_at: null }
    : { ...failureResetPayloadBase, lease_until: null };

  let { data: failedRows, error: failError } = await supabase
    .from('evaluation_jobs')
    .update(failureResetPayload)
    .in('id', staleIds_final)
    .eq('status', runningStatus)
    .neq('phase_status', 'complete')   // ← final guard on the UPDATE itself
    .select('id');

  if (failError && !leaseScanUsedLegacyColumn && isMissingColumnError(failError, 'lease_until')) {
    // lease_until scan succeeded but update failed — retry without lease_until
    console.warn('[Processor] lease_until update failed unexpectedly; retrying without it');
    ({ data: failedRows, error: failError } = await supabase
      .from('evaluation_jobs')
      .update(failureResetPayloadBase)
      .in('id', staleIds_final)
      .eq('status', runningStatus)
      .neq('phase_status', 'complete') // ← guard
      .select('id'));
  } else if (failError && leaseScanUsedLegacyColumn && isMissingColumnError(failError, 'lease_expires_at')) {
    // Legacy fallback: lease_expires_at column disappeared between scan and update
    console.warn('[Processor] lease_expires_at update failed unexpectedly; retrying without it');
    ({ data: failedRows, error: failError } = await supabase
      .from('evaluation_jobs')
      .update(failureResetPayloadBase)
      .in('id', staleIds_final)
      .eq('status', runningStatus)
      .neq('phase_status', 'complete') // ← guard
      .select('id'));
  }

  if (failError) {
    console.warn('[Processor] Failed to auto-fail stale jobs:', failError.message);
    return { staleFound: staleIds.length + frozenFailIds.length, failed: frozenFailIds.length, rescued, ids: staleIds };
  }

  const ageFailed = failedRows?.length ?? 0;
  const totalFailed = ageFailed + frozenFailIds.length;
  if (totalFailed > 0) {
    console.log(`[Processor] Auto-failed ${totalFailed} stale running job(s) (age=${ageFailed}, frozen=${frozenFailIds.length})`);
  }

  return {
    staleFound: staleIds.length + frozenFailIds.length,
    failed: totalFailed,
    rescued,
    ids: [...staleIds, ...frozenFailIds],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFLIGHT CHECKS
// Runs before any DB fetch or LLM call. Fails closed on missing infrastructure.
// ─────────────────────────────────────────────────────────────────────────────

export type PreflightResult =
  | { ok: true }
  | { ok: false; reason: string; bucket: FailureBucket };

/**
 * Verify that required environment variables, provider credentials, and
 * pipeline configuration are present before accepting a job.
 *
 * Failure here means the deployment is misconfigured — NOT a job-specific
 * error. The job is NOT failed on preflight violation; the cron is blocked
 * and the operator must fix the environment or feature flag state.
 *
 * Checks (fail-closed):
 *   1. OPENAI_API_KEY — required for all Pass1/Pass2/Pass3 LLM calls
 *   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — required for all DB writes
 *   3. Pass 4 adjudication: if EVAL_PASS4_ENABLED=true, PERPLEXITY_API_KEY must be set
 *   4. EVAL_PIPELINE_ENABLED must be 'true' (redundant with kill-switch, but belt+suspenders)
 */
export function runPreflightChecks(): PreflightResult {
  // 1. Core LLM provider
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || openaiKey.trim() === '' || openaiKey === 'test-key') {
    // Allow test-key in non-production environments (stress harness)
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        reason: 'OPENAI_API_KEY is missing or placeholder in production',
        bucket: 'vercel_platform',
      };
    }
  }

  // 2. Supabase persistence contract
  const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrlEnv || !supabaseKey) {
    return {
      ok: false,
      reason: 'Supabase URL or service role key is missing — persistence contract violated',
      bucket: 'supabase_contract',
    };
  }

  // 3. Pass 4 adjudication — if enabled, Perplexity key must be present
  const pass4Enabled =
    process.env.EVAL_PASS4_ENABLED === 'true' ||
    process.env.EVAL_PASS4_ADJUDICATION_ENABLED === 'true';
  if (pass4Enabled) {
    const perplexityKey = process.env.PERPLEXITY_API_KEY ?? '';
    if (!perplexityKey || perplexityKey.trim() === '') {
      return {
        ok: false,
        reason: 'EVAL_PASS4_ENABLED=true but PERPLEXITY_API_KEY is missing — adjudication contract violated',
        bucket: 'perplexity_adjudication',
      };
    }
  }

  // 4. Pipeline enabled (belt+suspenders — kill switch is checked first in processEvaluationJob)
  if (process.env.EVAL_PIPELINE_ENABLED === 'false') {
    return {
      ok: false,
      reason: 'EVAL_PIPELINE_ENABLED=false',
      bucket: 'vercel_platform',
    };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 0 — Gold Standard Warm-Up
//
// Loads the WAVE evaluation gold standard into the LLM's context window as a
// calibration primer. The evaluator studies what 10/10 looks like — across all
// 13 criteria, confidence bands, and annotation protocol — BEFORE the manuscript
// is ever touched. No chunking. No manuscript read. Pure standard internalization.
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_0_GOLD_STANDARD = `
# REVISIONGRADE EVALUATION GOLD STANDARD — CALIBRATION PRIMER
# Authority: RevisionGrade Quality Standard v1.0 (Binding)
# Purpose: Internalize scoring thresholds before evaluating any manuscript.
# This is a READ-ONLY calibration pass. Do not generate output. Acknowledge only.

## THE 13 CANONICAL CRITERIA (Immutable)

Scoring scale: 0–10
  10   = Mastery — industry-publication standard, no meaningful weaknesses
  7–9  = Professional — publishable, specific improvements may strengthen
  5–6  = Competent — functional but with craft gaps requiring attention
  3–4  = Weak — core problems undermine the work; revision required
  1–2  = Critical failure — structural or craft breakdown; significant rework needed
  0    = Absent / non-functional

Criteria:
1.  concept          — Core premise strength, originality, inherent tension
2.  narrativeDrive   — Forward movement through escalation and consequence
3.  character        — Psychological coherence, motivation, capacity for change
4.  voice            — POV stability, intentionality, appropriateness to material
5.  sceneConstruction — Each scene performs narrative function (reveal/escalate/complicate/resolve)
6.  dialogue         — Authenticity, subtext, no unnecessary exposition
7.  theme            — Embedded through action/consequence, not stated directly
8.  worldbuilding    — Environmental logic, system consistency, credibility
9.  pacing           — Rhythm of tension/release across the work
10. proseControl     — Precision, intentionality, no unmotivated repetition
11. tone             — Tonal integrity, no unintended register drift
12. narrativeClosure — Narrative promises kept, intentionally subverted, or explicitly left open
13. marketability    — Professional readiness, control, cohesion

## GOLD-STANDARD CALIBRATION THRESHOLDS

Confidence Bands:
  HIGH   (≥95%) — Claim correctness target ≥95%. Assert only when evidence is unambiguous.
  MEDIUM (80–94%) — Acceptable range. Flag when reasonable experts may disagree.
  LOW    (<80%)  — No correctness requirement. Label uncertainty explicitly.

Release gates (blocking):
  - Confidence drift >5 percentage points on critical claim types → BLOCK
  - Increased false certainty (high-confidence claims that are wrong) → BLOCK
  - Broken determinism (same input → different outputs) → BLOCK
  - Ambiguity present but not flagged → BLOCK

## ANNOTATION PROTOCOL — WHAT GOLD LOOKS LIKE

For a score of 9–10 on any criterion:
  - Evidence is specific and unambiguous (cite passage, pattern, or structural beat)
  - The craft element performs its function consistently across the work
  - No unmotivated violations — any deviation is intentional and controlled
  - Professional comparison: the work equals or surpasses published standards in this dimension

For a score of 5–6:
  - The element functions at a basic level but lacks control or consistency
  - Weaknesses are identifiable and pattern-based, not isolated incidents
  - Revision path is clear: the author can fix this without restructuring the work

For a score of 1–4:
  - The element has broken down or is absent
  - Root cause is structural, not surface-level
  - Revision requires significant rewriting, not line editing

## EVIDENCE-BASED ASSESSMENT CONTRACT

  - Every score requires manuscript evidence (specific passage, pattern, or scene)
  - Generic feedback is a calibration failure — cite the text
  - Flag weaknesses by WAVE tier: Early (structural), Mid (momentum), Late (polish)
  - Disagreement zones: do NOT force false certainty — label as ambiguous
  - Missing criteria = evaluation invalid. All 13 must be scored.

## PUBLICATION READINESS GATE

  All 13 criteria must score 7+ for publication readiness.
  Any criterion below 7 is a gate closure requiring revision before submission.
  The evaluator does not soften scores to spare feelings — honest assessment protects the author.

## EVALUATION MODES

RevisionGrade supports three evaluation-output modes. They share the same 13-criteria standard but differ in analysis depth:

  1. short_form_evaluation — submissions under 25,000 words. 13 criteria only. No full-manuscript continuity proof. No Golden Spine. No governed ledgers. No Story Ledger extraction.
  2. long_form_evaluation — 25,000+ words. Manuscript-scale analysis, plain-editorial continuity findings, promise/payoff tracking. No separate layer architecture rendering required.
  3. long_form_multi_layer_evaluation — 25,000+ words with multi-layer complexity. Full DREAM depth: Story Ledger, governed ledgers, layer-aware architecture, cross-layer synthesis.

Do not promise analysis depth that exceeds the selected mode.

Authority: docs/governance/evaluation-output-mode-contract.md
Templates: docs/templates/evaluation/{short,long,long-form-multi-layer}-form-evaluation-template.md

## SIX-PART CRITERION OPPORTUNITY CONTRACT

Each criterion may surface zero to three opportunities. Do NOT force opportunities when a criterion is already performing well — excellent writing may warrant zero opportunities.

Each surfaced opportunity uses this six-part diagnostic structure:
  1. Evidence — where in the manuscript the issue appears (passage, location, chapter)
  2. Symptom — the observable reader-facing problem (confusion, lost tension, broken immersion, unclear stakes)
  3. Cause — why the issue exists structurally (the mechanism producing the symptom)
  4. Fix direction — the bounded repair direction (what type of change, not the full rewrite)
  5. Reader effect — what changes for the reader if repaired
  6. Mistake-proofing — what must NOT be damaged during repair (preserve voice, preserve mystery, do not resolve tension too early)

Top Recommendations are executive summaries — not verbatim copies of criterion opportunities.
A/B/C rewrite proposals belong in the Revise Queue, not in evaluation output.

## ACKNOWLEDGMENT CONTRACT

You have now internalized the RevisionGrade evaluation gold standard.
When you evaluate the manuscript in the next phase, you will:
  1. Apply these 13 criteria exactly as defined above
  2. Score according to the calibrated thresholds (not relative to the submission)
  3. Ground every score in specific manuscript evidence
  4. Flag confidence honestly — never assert HIGH when evidence is ambiguous
  5. Complete all 13 criteria without exception
  6. Surface criterion opportunities using the six-part diagnostic structure (Evidence, Symptom, Cause, Fix direction, Reader effect, Mistake-proofing)
  7. Allow zero opportunities when a criterion is near-flawless

## INTERNALIZATION PROOF — REQUIRED OUTPUT

Do NOT respond with a single word. You must demonstrate internalization by writing
a structured calibration lock. Use this exact format:

CALIBRATED

SCORING LOCK:
- Scale: [0-2 critical failure | 3-4 weak | 5-6 competent | 7-9 professional | 10 mastery]
- Gate: all 13 criteria must score 7+ for publication readiness
- Evidence rule: every score requires specific manuscript citation — generic feedback = calibration failure

CRITERIA LOCKED (13):
[For each of the 13 criteria you MUST write a minimum of 40 words. Include: (1) the criterion name, (2) its definition exactly as you internalized it, (3) what specific manuscript evidence is required to score it, (4) what a score of 7 or above looks like, (5) what a score below 7 looks like. Do not abbreviate. Do not combine criteria. Write all 13 in full.]

CONFIDENCE BANDS LOCKED:
- HIGH (≥95%) — only when evidence is unambiguous
- MEDIUM (80–94%) — when reasonable experts may disagree
- LOW (<80%) — label uncertainty explicitly, no correctness requirement

DIAGNOSTIC CONTRACT LOCKED:
- Six-part structure: Evidence, Symptom, Cause, Fix direction, Reader effect, Mistake-proofing
- Zero opportunities allowed when criterion is near-flawless
- Top Recommendations are summaries, not verbatim opportunity copies
- A/B/C proposals belong in Revise Queue only

READY TO EVALUATE.

## EVALUATION GOVERNANCE RULES (canon_correction_playbook_v1 v1.3.1)

Phase 0: load rules only. Do not read the manuscript.
Phase 1A: read the manuscript and build pass1a_story_layer_v1 — the Story Layer / Story Ledger artifact with 9 required layers.
Phase 2: score only after pass1a_story_layer_v1 is complete.

Failure modes Phase 1A must avoid:
1. Loudest-lane bias: map ALL lane types (plot / emotional / doctrinal / medicine-object / relationship / environmental).
2. Relationship spine omission: merge cross-world/cross-species arcs into single spine entries.
3. Object/medicine blindness: named healing agents and relics are structural — not texture.
4. Unsupported vocabulary: extract labels from source text; do not impose genre defaults (e.g. "poaching").
5. Closure deflation: do not score Narrative Closure until Relationship Spine Layer is complete.
6. Already-present error: do not recommend adding what is already present; use ALREADY_PRESENT.

Phase 2 scoring prohibitions:
- Narrative Closure MUST NOT be scored if Relationship Spine Layer is empty.
- Criterion scores MUST NOT finalize before pass1a_story_layer_v1 exists and all 9 required layers pass completeness checks.
- Recommendations MUST carry validity: VALID / PARTIALLY_VALID / ALREADY_PRESENT / CANON_FALSE / SOURCE_UNSUPPORTED / VOICE_RISK.

## REVISIONGRADE PLATFORM FIT — WHAT THIS PLATFORM OPTIMIZES FOR

RevisionGrade evaluates manuscripts for submission readiness against professional publishing standards.
This platform is NOT a general writing assistant. It is a governed revision operating system for serious authors.

Key platform calibration points:
- The evaluation must serve the author's revision journey — not a publisher's acquisition filter
- Scores reflect craft quality against professional standards, not marketability alone
- The 9 canonical story layers (identity, cast, identity/pronouns, POV, relationships, objects/symbols, location/timeline, threat/ending, source integrity) are the structural backbone — they must inform scoring on all 13 criteria
- WAVE tier tagging (Early / Mid / Late) is mandatory on all recommendations — it tells the author WHEN to fix something
- Loudest-lane bias is a calibration failure: all lane types must be mapped (plot / emotional / doctrinal / medicine-object / relationship / environmental)
- The author is the ultimate authority on their manuscript — conflicting AI extractions must be flagged, not silently resolved
- Generic feedback ("the pacing is slow") without manuscript evidence is a calibration failure
- The platform produces ONE evaluation per manuscript section — there is no back-and-forth revision cycle in evaluation mode
- Scores below 7.0 on any criterion block submission readiness — be honest, be specific, cite the text

## REVISIONGRADE PLATFORM CALIBRATION — EVALUATION GOVERNANCE RULES

These rules apply to every evaluation. They are derived from platform lessons, not manuscript-specific facts.

1. Low-frequency characters can be high-structure. Page volume is not a proxy for structural weight. A character with fewer pages may carry a load-bearing relationship spine, doctrinal role, or thematic arc. Never downgrade structural importance based on word count alone.

2. Counter-systems must be surfaced. Every world with a primary doctrine, culture, or power system may contain a secondary counter-system — an alternative worldview, medicine tradition, or belief structure running in parallel or opposition. Counter-systems are structural, not decorative. Surface them explicitly.

3. Relationship spines must be preserved across synthesis. Named relationship spines (A–B pairings with defined dynamics, stakes, and arcs) must survive synthesis intact. Do not reduce a relationship spine to a solo character label.

4. Do not assign motivation without source support. Motivations, beliefs, and emotional states attributed to a character must trace to explicit manuscript evidence. If source support is absent, do not assign. Use SOURCE_UNSUPPORTED validity tag.

5. Medicine and object systems are plot engines, not texture. Named healing agents with ingredients, procedure, risk, and knowledge-transfer are structural elements — include in Story Layer, score in criterion analysis. Do not omit.

6. Distinguish excerpt closure from full-novel closure. When evaluating a partial manuscript, score local-arc payoffs — do not penalize for the absence of full-novel closure. Full-novel closure is unavailable by definition in an excerpt submission.

7. Classify every recommendation before issuing it. Use: ADD (genuinely absent) / CLARIFY (present but ambiguous) / SHARPEN (present but underweighted) / ALREADY_PRESENT (exists, no change needed) / VOICE_RISK (improvement risks author's voice) / CANON_ERROR (evaluation made a factual error). Do not issue ADD when the element exists.

8. Author corrections are governing context. If the author flagged a layer as incorrect or provided a correction, that correction takes precedence over AI extraction. Do not silently resolve conflicts in favor of AI output.

9. Aggressive recommendations are a calibration failure. Recommendation volume is not quality. Do not issue ADD recommendations for elements that are present but underweighted — use SHARPEN or ALREADY_PRESENT instead. Generic feedback without manuscript evidence is a calibration failure.
`;

type Phase0Result =
  | {
      success: true;
      durationMs: number;
      measuredDurationMs: number;
      llmDurationMs: number;
      dwellDurationMs: number;
      acknowledgment: string;
      wordCount: number;
      proofNormalized: boolean;
    }
  | { success: false; error: string; durationMs: number };

// Phase 0 must dwell a minimum of 12 seconds regardless of LLM response speed.
// This guarantees the model has actually processed the full gold standard before
// the job transitions to phase_1a. "CALIBRATED" in 1s means nothing was internalized.
const PHASE_0_MIN_DWELL_MS = 12_000;

// Timer granularity and event-loop scheduling can produce ±1..few ms skew at
// exact threshold boundaries. Keep a narrow tolerance for legacy/raw telemetry
// while persisting normalized proof to avoid false negatives.
const PHASE_0_PROOF_TOLERANCE_MS = 100;

export function normalizePhase0ProofDuration(args: {
  measuredDurationMs: number;
  llmDurationMs: number;
  dwellDurationMs: number;
  minDwellMs?: number;
}): { normalizedDurationMs: number; proofNormalized: boolean } {
  const minDwellMs = args.minDwellMs ?? PHASE_0_MIN_DWELL_MS;
  const normalizedDurationMs = Math.max(
    args.measuredDurationMs,
    minDwellMs,
    args.llmDurationMs + args.dwellDurationMs,
  );
  return {
    normalizedDurationMs,
    proofNormalized: normalizedDurationMs !== args.measuredDurationMs,
  };
}

export function isPhase0ProofSatisfied(args: {
  totalDurationMs: number | null;
  measuredDurationMs: number | null;
  minProvenMs?: number;
  toleranceMs?: number;
}): boolean {
  const minProvenMs = args.minProvenMs ?? PHASE_0_MIN_DWELL_MS;
  const toleranceMs = args.toleranceMs ?? PHASE_0_PROOF_TOLERANCE_MS;
  const proofFloorMs = minProvenMs - toleranceMs;
  const bestProofMs = Math.max(
    args.totalDurationMs ?? Number.NEGATIVE_INFINITY,
    args.measuredDurationMs ?? Number.NEGATIVE_INFINITY,
  );

  return Number.isFinite(bestProofMs) && bestProofMs >= proofFloorMs;
}

// Minimum word count for a valid Phase 0 calibration lock.
// The required proforma has 4 sections:
//   CALIBRATED header
//   SCORING LOCK (scale + gate + evidence rule)
//   CRITERIA LOCKED — 13 criteria × 40 words minimum each = ~520 words
//   CONFIDENCE BANDS (3 bands defined)
//   READY TO EVALUATE
// A fully completed response must be at least 500 words.
// Below this floor the LLM did not write out the criteria properly
// and Phase 0 is treated as a calibration failure — job fails and retries.
const PHASE_0_MIN_CALIBRATION_WORDS = 500;

async function runPhase0GoldPrimer(args: {
  jobId: string;
  openaiApiKey: string;
  openAiModel: string;
  evalOpenAiTimeoutMs: number;
}): Promise<Phase0Result> {
  const { jobId, openaiApiKey, openAiModel, evalOpenAiTimeoutMs } = args;
  const startMs = Date.now();

  // Clamp timeout: Phase 0 should complete in 12-30s; cap at 60s.
  const phase0TimeoutMs = Math.min(evalOpenAiTimeoutMs, 60_000);

  console.log(`[Phase0] ${jobId}: sending gold-standard primer to ${openAiModel} (min dwell ${PHASE_0_MIN_DWELL_MS}ms)`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      signal: AbortSignal.timeout(phase0TimeoutMs),
      body: JSON.stringify({
        model: openAiModel,
        max_completion_tokens: 1000, // 500-word proforma minimum: 13 criteria × 40 words min + sections
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a literary evaluation engine. You are about to receive your evaluation gold standard. ' +
              'Read it in full. Internalize every criterion, threshold, and evidence contract. ' +
              'Then write your structured calibration lock exactly as specified at the end of the document. ' +
              'Do NOT respond with just one word — the calibration lock is required output.',
          },
          {
            role: 'user',
            content: PHASE_0_GOLD_STANDARD,
          },
        ],
      }),
    });

    const llmDurationMs = Date.now() - startMs;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Still enforce min dwell even on failure — do not transition faster on error.
      const elapsed = Date.now() - startMs;
      if (elapsed < PHASE_0_MIN_DWELL_MS) {
        await new Promise(r => setTimeout(r, PHASE_0_MIN_DWELL_MS - elapsed));
      }
      return {
        success: false,
        error: `OpenAI HTTP ${response.status}: ${body.slice(0, 300)}`,
        durationMs: Date.now() - startMs,
      };
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const acknowledgment = json.choices?.[0]?.message?.content?.trim() ?? '';
    const wordCount = acknowledgment.split(/\s+/).filter(Boolean).length;
    console.log(`[Phase0] ${jobId}: LLM calibration lock received in ${llmDurationMs}ms (${wordCount} words / ${acknowledgment.length} chars)`);

    // ── Proforma word-count gate ────────────────────────────────────────
    // The required calibration lock proforma must be fully completed:
    //   CALIBRATED + SCORING LOCK + CRITERIA LOCKED (13) + CONFIDENCE BANDS + READY TO EVALUATE
    // A response below PHASE_0_MIN_CALIBRATION_WORDS means the LLM skipped sections
    // and must be treated as a calibration failure — Phase 0 fails and will retry.
    if (wordCount < PHASE_0_MIN_CALIBRATION_WORDS) {
      // Still enforce min dwell before failing — don't exit Phase 0 faster on failure.
      const elapsed = Date.now() - startMs;
      if (elapsed < PHASE_0_MIN_DWELL_MS) {
        await new Promise(r => setTimeout(r, PHASE_0_MIN_DWELL_MS - elapsed));
      }
      console.error(
        `[Phase0] ${jobId}: calibration lock too short — ${wordCount} words < ${PHASE_0_MIN_CALIBRATION_WORDS} minimum. ` +
        `Response: "${acknowledgment.slice(0, 200)}${acknowledgment.length > 200 ? '...' : ''}"`
      );
      return {
        success: false,
        error: `CALIBRATION_INSUFFICIENT: ${wordCount}/${PHASE_0_MIN_CALIBRATION_WORDS} words — LLM did not complete the proforma`,
        durationMs: Date.now() - startMs,
      };
    }
    // ── End proforma word-count gate ───────────────────────────────────

    // ── Hard minimum dwell ──────────────────────────────────────────────────
    // Even if OpenAI responds fast, the evaluator brain must sit with the gold
    // standard for a minimum time before it's trusted to process the manuscript.
    const elapsed = Date.now() - startMs;
    if (elapsed < PHASE_0_MIN_DWELL_MS) {
      const remaining = PHASE_0_MIN_DWELL_MS - elapsed;
      console.log(`[Phase0] ${jobId}: enforcing minimum dwell — holding ${remaining}ms`);
      await new Promise(r => setTimeout(r, remaining));
    }
    // ── End hard minimum dwell ───────────────────────────────────────────────

    const measuredDurationMs = Date.now() - startMs;
    const dwellDurationMs = Math.max(0, PHASE_0_MIN_DWELL_MS - llmDurationMs);
    const { normalizedDurationMs, proofNormalized } = normalizePhase0ProofDuration({
      measuredDurationMs,
      llmDurationMs,
      dwellDurationMs,
      minDwellMs: PHASE_0_MIN_DWELL_MS,
    });
    console.log(
      `[Phase0] ${jobId}: warm-up PASS — ${wordCount} words, ${normalizedDurationMs}ms total ` +
      `(measured=${measuredDurationMs}ms, llm=${llmDurationMs}ms, dwell=${dwellDurationMs}ms)`
    );

    return {
      success: true,
      durationMs: normalizedDurationMs,
      measuredDurationMs,
      llmDurationMs,
      dwellDurationMs,
      acknowledgment,
      wordCount,
      proofNormalized,
    };
  } catch (err) {
    const elapsed = Date.now() - startMs;
    if (elapsed < PHASE_0_MIN_DWELL_MS) {
      await new Promise(r => setTimeout(r, PHASE_0_MIN_DWELL_MS - elapsed));
    }
    const durationMs = Date.now() - startMs;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Phase0] ${jobId}: primer call failed after ${durationMs}ms:`, message);
    return { success: false, error: message, durationMs };
  }
}

/**
 * Fire-and-forget HTTP kick to /api/workers/process-evaluations.
 *
 * WHY HTTP (not direct processQueuedJobs() call):
 * Each Phase 1A batch must run inside its own fresh Vercel invocation with a
 * clean maxDuration clock. A direct in-process call re-enters the same
 * invocation and would recreate the exact timeout risk that self-chaining
 * was designed to prevent.
 *
 * WHY getConfiguredAppBaseUrl() (not VERCEL_URL):
 * VERCEL_URL resolves to the deployment-specific preview URL, not the
 * canonical production hostname. WORKER_KICKOFF_BASE_URL → NEXT_PUBLIC_APP_URL
 * → VERCEL_URL is the correct priority chain already implemented in
 * triggerWorker.ts. Using the same helper keeps URL resolution consistent.
 *
 * WHY THE 150ms DELAY:
 * The DB write committing phase_1a/queued must flush before the new worker
 * invocation claims the row. 150ms is enough for the Postgres commit to be
 * visible to a fresh connection from a new Vercel function invocation.
 */
async function kickPhase1aWorker(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[kickPhase1aWorker] CRON_SECRET not set — skipping kick, cron is fallback');
    return;
  }

  const base = getConfiguredAppBaseUrl() ?? 'https://www.revisiongrade.com';
  const url = new URL('/api/workers/process-evaluations', base).toString();

  // Stabilization pause: let the DB write commit and propagate before the new worker claims.
  await stabilize(STABILIZE_SELF_CHAIN_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'phase1a_self_chain_kick' }),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`[kickPhase1aWorker] kick sent → HTTP ${res.status} (url=${url})`);
  } catch (err) {
    // Best-effort — cron is the rescue fallback
    console.warn('[kickPhase1aWorker] kick failed (cron is fallback):', err instanceof Error ? err.message : String(err));
  }
}

type Phase0RequeueProgressPatch = {
  phase: 'phase_1a';
  phase_status: 'queued';
  total_units: number;
  completed_units: number;
  phase0_total_duration_ms: number;
  phase0_measured_duration_ms: number;
  phase0_llm_duration_ms: number;
  phase0_dwell_duration_ms: number;
  phase0_calibration_word_count: number;
  phase0_proof_normalized: boolean;
  phase0_model: string;
  phase0_deploy_sha: string;
  phase0_completed_at: string;
};

export function buildPhase0RequeueProgressPatch(args: {
  successResult: {
    durationMs: number;
    measuredDurationMs: number;
    llmDurationMs: number;
    dwellDurationMs: number;
    wordCount: number;
    proofNormalized: boolean;
  };
  openAiModel: string;
  deployedSha: string;
  phase0CompletedAt: string;
}): Phase0RequeueProgressPatch {
  return {
    phase: 'phase_1a',
    phase_status: 'queued',
    total_units: 100,
    completed_units: 8,
    phase0_total_duration_ms: args.successResult.durationMs,
    phase0_measured_duration_ms: args.successResult.measuredDurationMs,
    phase0_llm_duration_ms: args.successResult.llmDurationMs,
    phase0_dwell_duration_ms: args.successResult.dwellDurationMs,
    phase0_calibration_word_count: args.successResult.wordCount,
    phase0_proof_normalized: args.successResult.proofNormalized,
    phase0_model: args.openAiModel,
    phase0_deploy_sha: args.deployedSha,
    phase0_completed_at: args.phase0CompletedAt,
  };
}

const POST_PHASE0_HANDOFF_GRACE_MS = 90_000;
const SHORT_FORM_GLOBAL_SLA_MS = 15 * 60_000;
const LONG_FORM_GLOBAL_SLA_MS = 60 * 60_000;
const QUEUED_HARD_STOP_HALT_THRESHOLD = 3;
const SLA_AUTO_REQUEUE_MAX = 3;
const FAILED_SELF_RECOVERY_MAX = 3;

async function terminalizeQueuedHardStops(): Promise<{
  hardStopped: number;
  ids: string[];
  shouldHaltProcessing: boolean;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: queuedRows, error } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, status, phase, phase_status, created_at, updated_at, phase0_completed_at, manuscript_word_count, progress')
    .eq('status', JOB_STATUS.QUEUED)
    .limit(50);

  if (error) {
    console.warn('[Watchdog] queued-hard-stop scan failed:', error.message);
    return { hardStopped: 0, ids: [], shouldHaltProcessing: false };
  }

  const rows = (queuedRows ?? []) as QueueHardStopCandidate[];
  if (rows.length === 0) {
    return { hardStopped: 0, ids: [], shouldHaltProcessing: false };
  }

  const manuscriptUserIdCache = new Map<number, string | null>();

  const resolveUserIdForManuscript = async (manuscriptId: number | null): Promise<string | null> => {
    if (typeof manuscriptId !== 'number' || !Number.isFinite(manuscriptId)) {
      return null;
    }

    if (manuscriptUserIdCache.has(manuscriptId)) {
      return manuscriptUserIdCache.get(manuscriptId) ?? null;
    }

    const { data, error: manuscriptErr } = await supabase
      .from('manuscripts')
      .select('user_id')
      .eq('id', manuscriptId)
      .maybeSingle();

    if (manuscriptErr) {
      console.warn('[Watchdog] failed to resolve manuscript user for recovery alert', {
        manuscript_id: manuscriptId,
        error: manuscriptErr.message,
      });
      manuscriptUserIdCache.set(manuscriptId, null);
      return null;
    }

    const userId = typeof data?.user_id === 'string' ? data.user_id : null;
    manuscriptUserIdCache.set(manuscriptId, userId);
    return userId;
  };

  const sendRecoveryAlert = async (args: {
    row: QueueHardStopCandidate & { manuscript_id?: number | null };
    recoveryAction: Parameters<typeof shouldAlertSupportForRecoveryAction>[0];
    recoveryKey: string | null | undefined;
    internalDiagnosis: string | null | undefined;
    userSafeMessage: string | null | undefined;
  }) => {
    if (!shouldAlertSupportForRecoveryAction(args.recoveryAction)) {
      return;
    }

    const progress =
      args.row.progress && typeof args.row.progress === 'object'
        ? (args.row.progress as Record<string, unknown>)
        : {};
    const manuscriptId =
      typeof args.row.manuscript_id === 'number' && Number.isFinite(args.row.manuscript_id)
        ? args.row.manuscript_id
        : null;
    const userId = await resolveUserIdForManuscript(manuscriptId);

    const alertResult = await sendRecoverySupportAlert({
      job_id: args.row.id,
      manuscript_id: manuscriptId,
      user_id: userId,
      phase: args.row.phase,
      phase_status: args.row.phase_status,
      progress_phase: typeof progress.phase === 'string' ? progress.phase : null,
      progress_phase_status: typeof progress.phase_status === 'string' ? progress.phase_status : null,
      recovery_key: args.recoveryKey ?? `SPLIT_BRAIN:UNKNOWN:${args.row.id}`,
      recovery_action: args.recoveryAction,
      internal_diagnosis: args.internalDiagnosis ?? 'Split-brain recovery triggered without internal diagnosis',
      user_safe_message: toUserSafeRecoveryMessage(args.userSafeMessage),
      created_at: args.row.created_at ?? null,
      updated_at: args.row.updated_at ?? null,
    });

    if (!alertResult.sent) {
      console.warn('[Watchdog] recovery support alert not sent', {
        job_id: args.row.id,
        recovery_action: args.recoveryAction,
        recovery_key: args.recoveryKey ?? null,
        error: alertResult.error ?? null,
      });
    }
  };

  const { data: seedArtifacts } = await supabase
    .from('evaluation_artifacts')
    .select('job_id, artifact_type')
    .in('job_id', rows.map((row) => row.id))
    .in('artifact_type', [
      'story_map_seed_v1',
      'evaluation_seed_v1',
      'seed_fit_gap_report_v1',
    ]);

  const hasSeedArtifacts = new Set((seedArtifacts ?? []).map((row) => row.job_id as string));

  let hardStopped = 0;
  const hardStoppedIds: string[] = [];

  for (const row of rows) {
    const recovery = decideSplitBrainRecovery(row);

    // ── SPLIT-BRAIN AUTO-HEAL ─────────────────────────────────────────────────
    // Before classifying hard-stops, attempt to auto-heal trivial split-brain
    // states where only progress.phase_status diverges from the column (the
    // column is authoritative). This prevents user-visible failures caused by
    // stale progress JSONB left behind after a rescue/retry reset.
    const splitBrainClass = classifySplitBrain(row);
    if (splitBrainClass === 'healable') {
      const healedProgress = {
        ...(row.progress && typeof row.progress === 'object' ? row.progress : {}),
        phase: row.phase,
        phase_status: row.phase_status,
        split_brain_healed_at: nowIso,
      };
      const { error: healErr } = await supabase
        .from('evaluation_jobs')
        .update({ progress: healedProgress, updated_at: nowIso })
        .eq('id', row.id)
        .eq('status', JOB_STATUS.QUEUED);

      if (!healErr) {
        await sendRecoveryAlert({
          row,
          recoveryAction: recovery.action,
          recoveryKey: recovery.recoveryKey,
          internalDiagnosis: recovery.internalReason,
          userSafeMessage: recovery.publicReason,
        });
        console.log(`[Watchdog] Auto-healed split-brain for job ${row.id}: synced progress.phase_status=${row.phase_status}`);
        // Healed — skip hard-stop classification for this row
        continue;
      }
      console.warn(`[Watchdog] Split-brain auto-heal failed for job ${row.id}:`, healErr.message);
      // Fall through to hard-stop classification if heal fails
    }

    const decision = classifyQueuedHardStop(row, {
      nowMs,
      graceMs: POST_PHASE0_HANDOFF_GRACE_MS,
      shortFormSlaMs: SHORT_FORM_GLOBAL_SLA_MS,
      longFormSlaMs: LONG_FORM_GLOBAL_SLA_MS,
      hasSeedArtifacts: hasSeedArtifacts.has(row.id),
    });

    if (!decision) {
      continue;
    }

    // ── SLA AUTO-REQUEUE ────────────────────────────────────────────────────
    // On first SLA timeout, auto-requeue the job silently instead of failing.
    // This gives the worker one more chance without bothering the user.
    // Only fail on the second consecutive SLA timeout.
    if (decision.code === 'PIPELINE_GLOBAL_SLA_EXCEEDED') {
      const existingProgress = row.progress && typeof row.progress === 'object' ? row.progress : {};
      const slaRequeueCount = typeof existingProgress.sla_auto_requeue_count === 'number'
        ? existingProgress.sla_auto_requeue_count
        : 0;

      if (slaRequeueCount < SLA_AUTO_REQUEUE_MAX) {
        const requeueProgress = {
          ...existingProgress,
          sla_auto_requeue_count: slaRequeueCount + 1,
          sla_auto_requeued_at: nowIso,
          dashboard_status: 'recovery_in_progress',
          recovery_message: 'Evaluation delayed — recovery is in progress.',
          hard_stop_code: decision.code,
          hard_stop_internal_reason: decision.internalReason ?? null,
          phase: row.phase,
          phase_status: 'queued',
        };
        const { error: requeueErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED,
            phase_status: 'queued',
            updated_at: nowIso,
            progress: requeueProgress,
          })
          .eq('id', row.id)
          .eq('status', JOB_STATUS.QUEUED);

        if (!requeueErr) {
          console.log(`[Watchdog] SLA auto-requeue for job ${row.id} (attempt ${slaRequeueCount + 1}/${SLA_AUTO_REQUEUE_MAX})`);
          continue;
        }
        console.warn(`[Watchdog] SLA auto-requeue failed for job ${row.id}:`, requeueErr.message);
        // Fall through to hard-stop if requeue fails
      }
    }

    const hardStopProgress = {
      ...(row.progress && typeof row.progress === 'object' ? row.progress : {}),
      hard_stop_code: decision.code,
      hard_stop_reason: decision.reason,
      hard_stop_internal_reason: decision.internalReason ?? null,
      hard_stop_at: nowIso,
      hard_stop_halted: true,
    };

    const claimedBy = 'watchdog:hard-stop';
    const leaseToken = randomUUID();
    const leaseUntil = new Date(nowMs + 30_000).toISOString();
    const staleHeartbeatAt = new Date(nowMs - 120_000).toISOString();

    const { error: promoteErr } = await supabase
      .from('evaluation_jobs')
      .update({
        status: JOB_STATUS.RUNNING,
        phase_status: JOB_STATUS.RUNNING,
        claimed_by: claimedBy,
        claimed_at: nowIso,
        lease_token: leaseToken,
        lease_until: leaseUntil,
        last_heartbeat_at: staleHeartbeatAt,
        updated_at: nowIso,
        progress: hardStopProgress,
      })
      .eq('id', row.id)
      .eq('status', JOB_STATUS.QUEUED);

    if (promoteErr) {
      console.warn('[Watchdog] queued-hard-stop promote failed:', row.id, promoteErr.message);
      continue;
    }

    const { error: failErr } = await supabase
      .from('evaluation_jobs')
      .update({
        status: JOB_STATUS.FAILED,
        phase_status: JOB_STATUS.FAILED,
        claimed_by: null,
        claimed_at: null,
        lease_token: null,
        lease_until: null,
        last_heartbeat_at: null,
        last_heartbeat: null,
        worker_pulse_at: null,
        last_error: decision.reason,
        failure_code: decision.code,
        updated_at: nowIso,
        progress: hardStopProgress,
      })
      .eq('id', row.id)
      .eq('status', JOB_STATUS.RUNNING);

    if (failErr) {
      console.warn('[Watchdog] queued-hard-stop fail failed:', row.id, failErr.message);
      continue;
    }

    await sendRecoveryAlert({
      row,
      recoveryAction: decision.recoveryAction,
      recoveryKey: decision.recoveryKey,
      internalDiagnosis: decision.internalReason,
      userSafeMessage: decision.reason,
    });

    hardStopped += 1;
    hardStoppedIds.push(row.id);
    console.warn('[Watchdog] hard-stopped queued limbo job', {
      job_id: row.id,
      failure_code: decision.code,
      reason: decision.reason,
    });
  }

  return {
    hardStopped,
    ids: hardStoppedIds,
    shouldHaltProcessing: hardStopped >= QUEUED_HARD_STOP_HALT_THRESHOLD,
  };
}

export async function selfRecoverRetryableFailedJobs(options?: { targetJobId?: string }): Promise<{
  recovered: number;
  skippedTerminal: number;
  exhausted: number;
  ids: string[];
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const nowIso = new Date().toISOString();

  const resolveLoginEmailForManuscript = async (manuscriptId: number | null | undefined): Promise<string | null> => {
    if (typeof manuscriptId !== 'number' || !Number.isFinite(manuscriptId)) return null;

    const { data: manuscript, error: manuscriptError } = await supabase
      .from('manuscripts')
      .select('user_id')
      .eq('id', manuscriptId)
      .maybeSingle();

    if (manuscriptError) {
      console.warn('[Worker] failed to resolve manuscript owner for major issue user email', {
        manuscript_id: manuscriptId,
        error: manuscriptError.message,
      });
      return null;
    }

    const userId = typeof manuscript?.user_id === 'string' ? manuscript.user_id : null;
    if (!userId) return null;

    try {
      const authAdmin = (supabase as unknown as {
        auth?: {
          admin?: {
            getUserById?: (id: string) => Promise<{ data?: { user?: { email?: string | null } | null }; error?: { message?: string } | null }>;
            listUsers?: (options?: { perPage?: number }) => Promise<{ data?: { users?: Array<{ id: string; email?: string | null }> }; error?: { message?: string } | null }>;
          };
        };
      }).auth?.admin;

      if (typeof authAdmin?.getUserById === 'function') {
        const { data, error: userError } = await authAdmin.getUserById(userId);
        if (userError) {
          console.warn('[Worker] failed to resolve auth user email for major issue user email', {
            user_id: userId,
            error: userError.message,
          });
          return null;
        }
        return typeof data?.user?.email === 'string' ? data.user.email : null;
      }

      if (typeof authAdmin?.listUsers === 'function') {
        const { data, error: listError } = await authAdmin.listUsers({ perPage: 1000 });
        if (listError) {
          console.warn('[Worker] failed to list auth users for major issue user email', {
            user_id: userId,
            error: listError.message,
          });
          return null;
        }
        const user = (data?.users ?? []).find((candidate) => candidate.id === userId);
        return typeof user?.email === 'string' ? user.email : null;
      }
    } catch (error) {
      console.warn('[Worker] failed to resolve login email for major issue user email', {
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  };

  let query = supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, status, phase, phase_status, failure_code, last_error, failure_envelope, failed_at, claimed_by, worker_pulse_at, progress, attempt_count, max_attempts, created_at, updated_at')
    .eq('status', JOB_STATUS.FAILED);

  if (options?.targetJobId) {
    query = query.eq('id', options.targetJobId);
  }

  const { data: failedRows, error } = await query.limit(options?.targetJobId ? 1 : 20);

  if (error) {
    console.warn('[Worker] failed self-recovery scan failed:', error.message);
    return { recovered: 0, skippedTerminal: 0, exhausted: 0, ids: [] };
  }

  let recovered = 0;
  let skippedTerminal = 0;
  let exhausted = 0;
  const ids: string[] = [];

  for (const row of (failedRows ?? []) as Array<{
    id: string;
    status: string;
    phase: string | null;
    phase_status: string | null;
    failure_code: string | null;
    last_error: string | null;
    failure_envelope: Record<string, unknown> | null;
    failed_at: string | null;
    claimed_by: string | null;
    worker_pulse_at: string | null;
    progress: Record<string, unknown> | null;
    manuscript_id?: number | null;
    attempt_count?: number | null;
    max_attempts?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>) {
    const failureCode = row.failure_code ?? null;
    if (isTerminalFailureCode(failureCode)) {
      skippedTerminal += 1;
      continue;
    }

    const existingProgress = row.progress && typeof row.progress === 'object' ? row.progress : {};
    const selfRecoveryCount = typeof existingProgress.self_recovery_count === 'number'
      ? existingProgress.self_recovery_count
      : 0;

    const maxSelfRecoveryAttempts = maxSelfRecoveryAttemptsForFailureCode(failureCode);
    if (selfRecoveryCount >= Math.min(FAILED_SELF_RECOVERY_MAX, maxSelfRecoveryAttempts)) {
      const exhaustedProgress = {
        ...existingProgress,
        self_recovery_exhausted_at: nowIso,
        self_recovery_exhausted_reason: failureCode ?? 'unknown_failure_code',
        dashboard_status: 'technical_review_required',
        recovery_message: MAJOR_TECHNICAL_ISSUE_PUBLIC_MESSAGE,
      };
      const { data: exhaustedUpdateRow, error: exhaustedUpdateError } = await supabase
        .from('evaluation_jobs')
        .update({
          failure_code: 'TECHNICAL_FAILURE_REQUIRES_REVIEW',
          last_error: `Self-recovery exhausted for ${failureCode ?? 'unknown_failure_code'}`,
          progress: exhaustedProgress,
          updated_at: nowIso,
        })
        .eq('id', row.id)
        .eq('status', JOB_STATUS.FAILED)
        .select('id')
        .maybeSingle();
      if (exhaustedUpdateError) {
        console.warn('[Worker] failed self-recovery exhaustion update failed:', {
          job_id: row.id,
          failure_code: failureCode,
          error: exhaustedUpdateError.message,
        });
        continue;
      }
      if (!exhaustedUpdateRow) {
        console.warn('[Worker] failed self-recovery exhaustion skipped; guarded row was already claimed or changed:', {
          job_id: row.id,
          failure_code: failureCode,
        });
        continue;
      }
      exhausted += 1;
      const alertResult = await sendEvaluationFailureSupportAlert({
        job_id: row.id,
        manuscript_id: typeof row.manuscript_id === 'number' ? row.manuscript_id : null,
        phase: row.phase,
        phase_status: row.phase_status,
        progress_phase: typeof existingProgress.phase === 'string' ? existingProgress.phase : null,
        progress_phase_status: typeof existingProgress.phase_status === 'string' ? existingProgress.phase_status : null,
        failure_code: 'TECHNICAL_FAILURE_REQUIRES_REVIEW',
        failure_message: `Self-recovery exhausted for ${failureCode ?? 'unknown_failure_code'}`,
        source: 'worker_auto_recovery_exhausted',
        pipeline_stage: typeof existingProgress.phase === 'string' ? existingProgress.phase : null,
        retry_eligible: false,
        diagnostics: {
          exhausted_failure_code: failureCode ?? 'unknown_failure_code',
          self_recovery_count: selfRecoveryCount,
          max_self_recovery_attempts: maxSelfRecoveryAttempts,
        },
        created_at: row.created_at ?? null,
        updated_at: nowIso,
      });
      if (!alertResult.sent) {
        console.warn('[Worker] exhausted self-recovery support alert not sent', {
          job_id: row.id,
          failure_code: failureCode,
          attempted: alertResult.attempted,
          error: alertResult.error ?? null,
        });
      }
      const userEmail = await resolveLoginEmailForManuscript(row.manuscript_id);
      if (userEmail) {
        const userAlertResult = await sendEvaluationMajorIssueUserAlert({
          job_id: row.id,
          manuscript_id: typeof row.manuscript_id === 'number' ? row.manuscript_id : null,
          user_email: userEmail,
        });
        if (!userAlertResult.sent) {
          console.warn('[Worker] exhausted self-recovery user alert not sent', {
            job_id: row.id,
            attempted: userAlertResult.attempted,
            error: userAlertResult.error ?? null,
          });
        }
      } else {
        console.warn('[Worker] exhausted self-recovery user alert skipped; no login email resolved', {
          job_id: row.id,
          manuscript_id: row.manuscript_id ?? null,
        });
      }
      continue;
    }

    const { data: artifactRows, error: artifactError } = await supabase
      .from('evaluation_artifacts')
      .select('id, artifact_type, content, source_hash, created_at')
      .eq('job_id', row.id)
      .order('created_at', { ascending: true });

    if (artifactError) {
      console.warn('[Worker] failed self-recovery artifact scan failed:', {
        job_id: row.id,
        error: artifactError.message,
      });
    }

    const resumeRows = (artifactRows ?? []) as RuntimeArtifactRow[];
    const hasLegacyPhase2Handoff = resumeRows.some((artifact) => artifact.artifact_type === 'pass12_handoff_v1');
    const hasLegacyChunkCheckpoint = resumeRows.some((artifact) =>
      artifact.artifact_type === 'pass1_chunk_cache_v1' ||
      artifact.artifact_type === 'pass2_chunk_cache_v1',
    );
    const checkpointDecision = selectResumeCheckpoint({
      rows: resumeRows,
      hasLegacyPhase2Handoff,
      hasLegacyChunkCheckpoint,
    });
    const targetPhase = checkpointDecision.target_phase;

    // ── Durable failure diagnostic snapshot ──────────────────────────────
    // Capture the CURRENT failure state before self-recovery clears it.
    // Without this, retry sets last_error/failure_code to null, making
    // the system blind to what actually crashed.
    const lastSuccessfulArtifact = resumeRows.length > 0
      ? resumeRows[resumeRows.length - 1]
      : null;
    const failureDiagnostic = {
      snapshot_at: nowIso,
      job_id: row.id,
      phase: row.phase,
      phase_status: row.phase_status,
      attempt_count: row.attempt_count ?? null,
      completed_units: typeof existingProgress.completed_units === 'number'
        ? existingProgress.completed_units : null,
      failure_code: failureCode,
      last_error: row.last_error ?? null,
      failure_envelope: row.failure_envelope ?? null,
      failed_at: row.failed_at ?? null,
      worker_id: row.claimed_by ?? null,
      worker_pulse_at: row.worker_pulse_at ?? null,
      last_successful_artifact_type: lastSuccessfulArtifact?.artifact_type ?? null,
      last_successful_artifact_created_at: lastSuccessfulArtifact?.created_at ?? null,
      resume_target_phase: targetPhase,
      resume_mode: checkpointDecision.resume_mode,
      phase3_error: existingProgress.phase3_error ?? null,
      phase3_substage: existingProgress.phase3_substage ?? existingProgress.message ?? null,
    };

    // Append to durable failure_history array in progress JSONB.
    const existingHistory = Array.isArray(existingProgress.failure_history)
      ? existingProgress.failure_history as unknown[]
      : [];
    const failureHistory = [...existingHistory, failureDiagnostic].slice(-10);

    console.log('[Worker] self-recovery: persisting failure diagnostic before clearing', {
      job_id: row.id,
      failure_code: failureCode,
      phase: row.phase,
      target_phase: targetPhase,
      snapshot_index: failureHistory.length,
    });

    const nextProgress = {
      ...existingProgress,
      phase: targetPhase,
      phase_status: 'queued',
      retry_requested_at: nowIso,
      resume_requested_at: nowIso,
      self_recovery_count: selfRecoveryCount + 1,
      self_recovered_at: nowIso,
      self_recovery_source: 'worker_auto_recovery',
      self_recovery_failure_code: failureCode,
      self_recovery_max_attempts: maxSelfRecoveryAttempts,
      self_recovery_resume_mode: checkpointDecision.resume_mode,
      self_recovery_checkpoint_artifact_type: checkpointDecision.checkpoint_artifact_type ?? null,
      self_recovery_checkpoint_artifact_id: checkpointDecision.checkpoint_artifact_id ?? null,
      dashboard_status: 'recovery_in_progress',
      recovery_message: 'Evaluation delayed — recovery is in progress.',
      failure_history: failureHistory,
    };

    const { data: updateRow, error: updateError } = await supabase
      .from('evaluation_jobs')
      .update({
        status: JOB_STATUS.QUEUED,
        phase: targetPhase,
        phase_status: JOB_STATUS.QUEUED,
        last_error: null,
        failure_code: null,
        failure_envelope: null,
        failed_at: null,
        claimed_by: null,
        claimed_at: null,
        lease_token: null,
        lease_until: null,
        last_heartbeat_at: null,
        last_heartbeat: null,
        worker_pulse_at: null,
        updated_at: nowIso,
        progress: nextProgress,
      })
      .eq('id', row.id)
      .eq('status', JOB_STATUS.FAILED)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.warn('[Worker] failed self-recovery update failed:', {
        job_id: row.id,
        failure_code: failureCode,
        error: updateError.message,
      });
      continue;
    }

    if (!updateRow) {
      console.warn('[Worker] failed self-recovery skipped; guarded row was already claimed or changed:', {
        job_id: row.id,
        failure_code: failureCode,
      });
      continue;
    }

    recovered += 1;
    ids.push(row.id);
  }

  if (recovered > 0 || skippedTerminal > 0 || exhausted > 0) {
    console.log('[Worker] failed self-recovery scan complete', {
      recovered,
      skippedTerminal,
      exhausted,
      ids,
    });
  }

  return { recovered, skippedTerminal, exhausted, ids };
}

type SeedClaimStatus =
  | 'proposed_unverified'
  | 'partially_confirmed'
  | 'confirmed_by_evidence'
  | 'drift_detected'
  | 'superseded_by_evidence'
  | 'invalidated';

type SeedClaim = {
  claim_id: string;
  claim_status: SeedClaimStatus;
  hypothesis: string;
  temp_seed_entity_id?: string;
  criterion_key?: string;
  evidence_coordinates?: string[];
};

type SeedArtifact = {
  artifact_type: 'story_map_seed_v1' | 'evaluation_seed_v1';
  authority: 'seed_only';
  artifact_status: 'created' | 'superseded' | 'archived' | 'failed';
  generated_at: string;
  claims: SeedClaim[];
};

function tokenizeSeedCandidates(manuscriptText: string): string[] {
  const matches = manuscriptText.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  const stopWords = new Set([
    'The', 'And', 'But', 'For', 'With', 'That', 'This', 'Then', 'When', 'Where', 'From', 'Into',
    'Chapter', 'Part', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ]);
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const token of matches) {
    if (stopWords.has(token)) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(token);
    if (candidates.length >= 8) break;
  }

  return candidates;
}

function buildStorySeedArtifact(args: { manuscriptText: string; generatedAt: string }): SeedArtifact {
  const entitySeeds = tokenizeSeedCandidates(args.manuscriptText).slice(0, 4);
  const claims: SeedClaim[] = entitySeeds.map((entity, idx) => ({
    claim_id: `story_seed:${idx + 1}`,
    claim_status: 'proposed_unverified',
    hypothesis: `${entity} may carry recurring narrative pressure or relationship weight.`,
    temp_seed_entity_id: `temp_seed_entity_${entity.toLowerCase()}`,
    evidence_coordinates: [`seed:hypothesis:${idx + 1}`],
  }));

  if (claims.length === 0) {
    claims.push({
      claim_id: 'story_seed:0',
      claim_status: 'proposed_unverified',
      hypothesis: 'No stable proper-name candidates were detected; derive structural entities from manuscript evidence during Pass 1A.',
      evidence_coordinates: ['seed:hypothesis:fallback'],
    });
  }

  return {
    artifact_type: 'story_map_seed_v1',
    authority: 'seed_only',
    artifact_status: 'created',
    generated_at: args.generatedAt,
    claims,
  };
}

function buildEvaluationSeedArtifact(args: { generatedAt: string }): SeedArtifact {
  const criterionSeeds = CRITERIA_KEYS.slice(0, 6);
  const claims: SeedClaim[] = criterionSeeds.map((criterionKey, idx) => ({
    claim_id: `evaluation_seed:${idx + 1}`,
    claim_status: 'proposed_unverified',
    criterion_key: criterionKey,
    hypothesis: `Prioritize evidence extraction for ${criterionKey} and validate only with chunk-grounded anchors.`,
    evidence_coordinates: [`seed:criterion:${criterionKey}`],
  }));

  return {
    artifact_type: 'evaluation_seed_v1',
    authority: 'seed_only',
    artifact_status: 'created',
    generated_at: args.generatedAt,
    claims,
  };
}

/**
 * Extracts seed entity names from story seed claims for use in the two-pass protocol.
 */
function extractSeedEntityNames(storySeed: SeedArtifact): string[] {
  const seedEntityNames: string[] = [];
  for (const claim of storySeed.claims) {
    if (claim.temp_seed_entity_id) {
      const name = claim.temp_seed_entity_id
        .replace(/^temp_seed_entity_/, '')
        .replace(/_/g, ' ')
        .trim();
      if (name.length > 0 && name !== 'fallback primary work') {
        seedEntityNames.push(name);
      }
    }
  }
  return seedEntityNames;
}

/**
 * Builds the Phase 1A seed context block using the two-pass seed-anchored extraction protocol.
 *
 * Two-pass architecture:
 *   Pass A (Seed Confirmation): LLM validates each seed entity against the manuscript chunk,
 *     producing a seed_validation array with confirmed/absent/corrected status per entity.
 *   Pass B (Novel Extraction): LLM extracts additional entities not in seed, requiring
 *     explicit manuscript evidence for each addition.
 *
 * This replaces the old single-pass approach where seeds were injected as mere context.
 * Seeds are 95%+ quality from DREAM benchmarks/gold standards and are treated as
 * baseline authority, not suggestions.
 */
function buildPass1aSeedContextBlock(seeds: {
  storySeed: SeedArtifact;
  evaluationSeed: SeedArtifact;
}): string {
  const seedEntityNames = extractSeedEntityNames(seeds.storySeed);

  const storyClaims = seeds.storySeed.claims.slice(0, 6).map(c => ({
    claim_id: c.claim_id,
    hypothesis: c.hypothesis,
  }));
  const evalClaims = seeds.evaluationSeed.claims.slice(0, 6).map(c => ({
    claim_id: c.claim_id,
    hypothesis: c.hypothesis,
  }));

  return buildTwoPassSeedBlock({
    seedEntityNames,
    seedClaims: storyClaims,
    evalClaims,
  });
}

async function ensureSeedArtifactsForPhase1a(args: {
  supabase: SupabaseClient<any, any, any>;
  jobId: string;
  manuscriptId: number;
  manuscriptText: string;
  userId: string;
  title: string;
  workType: string;
  openAiModel: string;
  openaiApiKey: string | undefined;
  evalOpenAiTimeoutMs: number;
}): Promise<{ storySeed: SeedArtifact; evaluationSeed: SeedArtifact; createdTypes: string[] }> {
  const seedTypes = [
    'story_map_seed_v1',
    'evaluation_seed_v1',
  ];
  const { data: existingRows, error: existingErr } = await args.supabase
    .from('evaluation_artifacts')
    .select('artifact_type, content')
    .eq('job_id', args.jobId)
    .in('artifact_type', seedTypes);

  if (existingErr) {
    throw new Error(`Failed to read seed artifacts: ${existingErr.message}`);
  }

  const existingByType = new Map<string, SeedArtifact>();
  for (const row of existingRows ?? []) {
    if (
      row &&
      typeof row === 'object' &&
      typeof (row as { artifact_type?: unknown }).artifact_type === 'string' &&
      (row as { content?: unknown }).content &&
      typeof (row as { content?: unknown }).content === 'object'
    ) {
      existingByType.set(
        (row as { artifact_type: string }).artifact_type,
        (row as { content: SeedArtifact }).content,
      );
    }
  }

  const createdTypes: string[] = [];
  const generatedAt = new Date().toISOString();

  let storySeed = existingByType.get('story_map_seed_v1');
  let evaluationSeed = existingByType.get('evaluation_seed_v1');

  if (!storySeed || !evaluationSeed) {
    const generated = await generateSemanticSeedArtifacts({
      jobId: args.jobId,
      manuscriptId: args.manuscriptId,
      manuscriptText: args.manuscriptText,
      title: args.title,
      workType: args.workType,
      generatedAt,
      model: args.openAiModel,
      timeoutMs: args.evalOpenAiTimeoutMs,
      openaiApiKey: args.openaiApiKey,
    });

    storySeed = storySeed ?? generated.storySeed;
    evaluationSeed = evaluationSeed ?? generated.evaluationSeed;

    if (!storySeed || !evaluationSeed) {
      throw new Error('PHASE05_SEMANTIC_SEED_GENERATION_INCOMPLETE');
    }

    if (!existingByType.has('story_map_seed_v1')) {
      await upsertEvaluationArtifact({
        supabase: args.supabase,
        jobId: args.jobId,
        manuscriptId: args.manuscriptId,
        artifactType: 'story_map_seed_v1',
        artifactVersion: 'story_map_seed_v1',
        sourceHash: buildSemanticSeedSourceHash({
          jobId: args.jobId,
          manuscriptId: args.manuscriptId,
          userId: args.userId,
          manuscriptText: args.manuscriptText,
          promptVersion: generated.promptVersion,
          model: generated.model,
        }),
        content: storySeed,
      });
      createdTypes.push('story_map_seed_v1');
    }

    if (!existingByType.has('evaluation_seed_v1')) {
      await upsertEvaluationArtifact({
        supabase: args.supabase,
        jobId: args.jobId,
        manuscriptId: args.manuscriptId,
        artifactType: 'evaluation_seed_v1',
        artifactVersion: 'evaluation_seed_v1',
        sourceHash: buildSemanticSeedSourceHash({
          jobId: args.jobId,
          manuscriptId: args.manuscriptId,
          userId: args.userId,
          manuscriptText: args.manuscriptText,
          promptVersion: generated.promptVersion,
          model: generated.model,
        }),
        content: evaluationSeed,
      });
      createdTypes.push('evaluation_seed_v1');
    }
  }

  if (!storySeed) {
    storySeed = buildStorySeedArtifact({ manuscriptText: args.manuscriptText, generatedAt });
    await upsertEvaluationArtifact({
      supabase: args.supabase,
      jobId: args.jobId,
      manuscriptId: args.manuscriptId,
      artifactType: 'story_map_seed_v1',
      artifactVersion: 'story_map_seed_v1',
      sourceHash: stableSourceHash({
        manuscriptId: args.manuscriptId,
        jobId: args.jobId,
        userId: args.userId,
        manuscriptText: args.manuscriptText,
        promptVersion: 'story_map_seed_v1:deterministic',
        model: 'seed_deterministic',
      }),
      content: storySeed,
    });
    if (!createdTypes.includes('story_map_seed_v1')) createdTypes.push('story_map_seed_v1');
  }

  if (!evaluationSeed) {
    evaluationSeed = buildEvaluationSeedArtifact({ generatedAt });
    await upsertEvaluationArtifact({
      supabase: args.supabase,
      jobId: args.jobId,
      manuscriptId: args.manuscriptId,
      artifactType: 'evaluation_seed_v1',
      artifactVersion: 'evaluation_seed_v1',
      sourceHash: stableSourceHash({
        manuscriptId: args.manuscriptId,
        jobId: args.jobId,
        userId: args.userId,
        manuscriptText: args.manuscriptText,
        promptVersion: 'evaluation_seed_v1:deterministic',
        model: 'seed_deterministic',
      }),
      content: evaluationSeed,
    });
    if (!createdTypes.includes('evaluation_seed_v1')) createdTypes.push('evaluation_seed_v1');
  }

  if (!storySeed || !evaluationSeed) {
    throw new Error('SEED_ARTIFACTS_MISSING_AFTER_ENSURE');
  }

  return { storySeed, evaluationSeed, createdTypes };
}

/**
 * Process a single evaluation job
 */
export async function processEvaluationJob(
  jobId: string,
): Promise<{ success: boolean; error?: string; skipped?: true; reason?: PipelineSkipResult['reason'] }> {
  // Kill switch — MUST be the first thing executed. No DB reads, no AI calls,
  // no config loading, no logging beyond a single one-liner. See OPERATIONS.md.
  if (!isPipelineEnabled()) {
    console.warn('[PipelineGuard] EVAL_PIPELINE_ENABLED=false — refusing to process job', {
      job_id: jobId ?? null,
    });
    const skip = pipelineDisabledResponse(jobId);
    return {
      success: false,
      skipped: true,
      reason: skip.reason,
      error: skip.reason,
    };
  }

  // Preflight: fail closed on missing env/credentials before any DB or LLM work.
  const preflight = runPreflightChecks();
  if (preflight.ok === false) {
    console.error('[Processor] Preflight check failed — job blocked, deployment needs attention', {
      job_id: jobId,
      reason: preflight.reason,
      bucket: preflight.bucket,
      deployed_sha: DEPLOYED_SHA,
    });
    return { success: false, error: `PREFLIGHT_FAILED: ${preflight.reason}` };
  }

  const {
    runtimeConfig,
    openaiApiKey,
    perplexityApiKey,
    evalDebugEnabled,
    evalMinManuscriptWords,
    openAiModel,
    evalPassTimeoutMs,
    evalOpenAiTimeoutMs,
    evalContextContaminationGuardEnabled,
  } = getProcessorRuntimeDeps();

  const processorStartMs = Date.now();

  const getVercelBudgetRemainingMs = () => VERCEL_HARD_LIMIT_MS - (Date.now() - processorStartMs);

  void pipelineLog({
    jobId,
    level: 'info',
    stage: 'processor_preflight',
    message: 'Processor preflight passed',
    metadata: {
      openaiKeyPresent: !!openaiApiKey,
      perplexityKeyPresent: !!perplexityApiKey,
      adjudicationMode: runtimeConfig.adjudicationMode,
    },
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let lifecycleStatus: JobStatus | null = null;
  // Hoisted so outer-catch can persist partial progress metadata (#223)
  let progressState: Record<string, unknown> = {};
  let expectedLeaseToken: string | null = null;
  let expectedClaimedBy: string | null = null;

  emitLatencyTrace({
    job_id: jobId,
    stage: 'claim',
    state: 'processor_entered',
    started_at: new Date().toISOString(),
  });

  const nextLifecycleStatus = (target: JobStatus): JobStatus => {
    const normalizedTarget = normalizeEvaluationJobStatus(target) as JobStatus;

    if (lifecycleStatus === null) {
      lifecycleStatus = normalizedTarget;
      return normalizedTarget;
    }

    if (lifecycleStatus !== normalizedTarget) {
      assertValidJobStatusTransition(lifecycleStatus, normalizedTarget);
      lifecycleStatus = normalizedTarget;
    }

    return normalizedTarget;
  };

  try {
    console.log(`[Processor] Processing job ${jobId}`);

    // 1. Fetch the job
    const { data: job, error: jobError } = await supabase
      .from('evaluation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return { success: false, error: `Job not found: ${jobError?.message}` };
    }

    lifecycleStatus = normalizeEvaluationJobStatus(job.status) as JobStatus;

    const progress =
      job.progress && typeof job.progress === 'object'
        ? (job.progress as Record<string, unknown>)
        : {};

    // Pre-claimed running jobs: atomically claimed by the processor (claimed_by is set,
    // phase_status=running, lease not yet expired). These were transitioned queued->running
    // by claim_evaluation_jobs RPC before being handed to this function.
    const hasCanonicalPreClaimOwnership =
      typeof job.claimed_by === 'string' &&
      job.claimed_by.trim().length > 0 &&
      typeof job.lease_token === 'string' &&
      job.lease_token.trim().length > 0;
    // Defensive: check both lease_expires_at (generated column in production)
    // and lease_until (the column claim RPCs actually write to). If
    // lease_expires_at is not generated, only lease_until will be populated.
    const hasLivePreClaimLease =
      hasLiveLeaseExpiration(job.lease_expires_at) ||
      hasLiveLeaseExpiration((job as Record<string, unknown>).lease_until);

    // NOTE: isPhase1CompleteHandoff and isPhase1PreClaimed removed — phase_1 is dead.
    // All new jobs start at phase_1a. No job will arrive here with phase='phase_1'.

    // job.phase (the DB column) is the AUTHORITATIVE source of truth for which
    // phase to execute. progress.phase is a JSONB shadow that can lag the column
    // — e.g. after an admin reset that clears job.phase=phase_1a but leaves
    // progress.phase='phase_3' from the prior run. Routing on progress.phase
    // caused reset jobs to skip ahead to phase_3 and fail with PHASE3_MISSING_HANDOFF.
    const isPhase1aPreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      job.phase === 'phase_1a' &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const isPhase2PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      job.phase === 'phase_2' &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const isPhase3PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      job.phase === 'phase_3' &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    // Phase 0 warm-up: same ownership + lease contract as all other phases.
    const isPhase0PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      job.phase === 'phase_0' &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    // Dispatch on job.phase, not on the precedence of pre-claim flags. With the
    // flags now keyed strictly on job.phase, at most one is true, so the chain
    // below is equivalent — but the explicit job.phase switch documents intent
    // and makes the single-source-of-truth contract impossible to miss.
    const executionPhase: 'phase_0' | 'phase_1a' | 'phase_2' | 'phase_3' =
      job.phase === 'phase_3' ? 'phase_3' :
      job.phase === 'phase_2' ? 'phase_2' :
      job.phase === 'phase_0' ? 'phase_0' :
      'phase_1a'; // job.phase === 'phase_1a' (or legacy 'phase_1' which is dead)

    // Hard guard: queued jobs must be atomically claimed before direct processing.
    // This function is execution-only for already-claimed running rows.
    if (job.status === 'queued') {
      return {
        success: false,
        error:
          `Queued jobs must be claimed before processing. status=${job.status}, phase=${job.phase}, phase_status=${job.phase_status}`,
      };
    }

    if (
      !isPhase0PreClaimed &&
      !isPhase1aPreClaimed &&
      !isPhase2PreClaimed &&
      !isPhase3PreClaimed
    ) {
      console.warn('[Processor] Job eligibility rejection', {
        job_id: jobId,
        status: job.status,
        phase: job.phase,
        phase_status: job.phase_status,
        progress_phase: progress.phase,
        progress_phase_status: progress.phase_status,
        claimed_by_present: Boolean(job.claimed_by),
        lease_token_present: Boolean(job.lease_token),
        lease_expires_at: job.lease_expires_at ?? null,
        lease_until: (job as Record<string, unknown>).lease_until ?? null,
        lease_is_live: hasLivePreClaimLease,
      });

      return {
        success: false,
        error:
          `Job not eligible for processing. status=${job.status}, phase=${job.phase}, phase_status=${job.phase_status}, ` +
          `claimed_by=${Boolean(job.claimed_by)}, lease_token=${Boolean(job.lease_token)}, ` +
          `lease_expires_at=${job.lease_expires_at ?? 'null'}, lease_until=${(job as Record<string, unknown>).lease_until ?? 'null'}`,
      };
    }

    progressState =
      job.progress && typeof job.progress === 'object' ? { ...job.progress } : {};

    const selectedEnglishVariant = normalizeEnglishVariant((job as Record<string, unknown>).english_variant);

    expectedLeaseToken = typeof job.lease_token === 'string' ? job.lease_token : null;
    expectedClaimedBy = typeof job.claimed_by === 'string' ? job.claimed_by : null;
    let failureAlertManuscriptId =
      typeof job.manuscript_id === 'number' && Number.isFinite(job.manuscript_id)
        ? job.manuscript_id
        : null;
    let failureAlertUserId =
      typeof (job as Record<string, unknown>).user_id === 'string'
        ? ((job as Record<string, unknown>).user_id as string)
        : null;

    const canonicalStartedAt = resolveSafeStartedAt({
      candidate: (job as Record<string, unknown>).started_at,
      createdAt: (job as Record<string, unknown>).created_at,
      fallbackIso: new Date().toISOString(),
    });
    // Hard deadline anchors to THIS INVOCATION's start, not the original job
    // creation time. Each phase (phase_1a, phase_2, phase_3) runs in
    // its own fresh Vercel invocation with its own 720s wall clock. Inheriting
    // job.started_at meant later phases had a budget already consumed by prior
    // phases — a 165k-word phase_1 that takes 30 min would leave phase_2 with
    // a negative budget before it even starts.
    //
    // invocationStartedAt is stamped here and then overwritten below with the
    // phase-specific timestamp once markRunning() fires (e.g. phase1a_started_at).
    // resolvePhaseDeadlineMs() reads the canonical per-phase timestamp from
    // progressState after markRunning so every phase gets a truly fresh 60-min window.
    const invocationStartedAt = new Date().toISOString();
    let hardDeadlineMs = resolveJobHardDeadlineMs({
      startedAt: invocationStartedAt,
      maxExecutionMs: runtimeConfig.worker.maxExecutionMs,
    });

    // Helper: refresh hardDeadlineMs from the phase-specific start timestamp
    // stamped by markRunning(). Call immediately after markRunning() in each
    // phase block so the budget is anchored to when THIS PHASE actually began.
    const refreshPhaseDeadline = (phaseStartedAt: string | undefined) => {
      const anchor = phaseStartedAt ?? invocationStartedAt;
      hardDeadlineMs = resolveJobHardDeadlineMs({
        startedAt: anchor,
        maxExecutionMs: runtimeConfig.worker.maxExecutionMs,
      });
      console.log(`[Processor] ${jobId}: phase deadline refreshed — anchor=${anchor} deadline=${new Date(hardDeadlineMs).toISOString()}`);
    };

    // ── Centralized worker heartbeat ────────────────────────────────────────
    // Stamp worker_pulse_at at every phase boundary and before/after any
    // long-running operation (DB reads, artifact loads, LLM calls). The
    // watchdog has a 20s idle-pulse threshold — any silent gap longer than
    // that will cause a legitimate worker to be killed. This single function
    // replaces all ad-hoc and no-op heartbeat callbacks.
    const pulseWorker = (label: string) => {
      const pulseNow = new Date().toISOString();
      void supabase
        .from('evaluation_jobs')
        .update({ worker_pulse_at: pulseNow })
        .eq('id', jobId)
        .eq('status', JOB_STATUS.RUNNING)
        .then(({ error }: { error: unknown }) => {
          if (error) {
            console.warn(`[${label}] worker_pulse_at stamp failed (non-fatal)`, error);
          }
        });
    };

    // ── Persistence lock ─────────────────────────────────────────────────────
    // Before entering the artifact persistence critical section, the worker
    // declares a "persistence lock" by setting worker_pulse_at to a FUTURE
    // timestamp (NOW + PERSISTENCE_CEILING). The watchdog's query
    // (worker_pulse_at < NOW - 20s) naturally skips jobs with future
    // timestamps, structurally preventing the split-brain race where the
    // watchdog kills a job mid-persistence.
    //
    // If the worker crashes, the future timestamp will eventually become stale
    // (after PERSISTENCE_CEILING + 20s ≈ 5min 20s), and the watchdog will
    // intervene normally. This is a positive-declaration model: the worker
    // TELLS the watchdog "I'm in a critical section" rather than relying on
    // absence-of-signal inference.
    const PERSISTENCE_CEILING_MS = 5 * 60 * 1000; // 5 minutes

    const declarePersistenceLock = (label: string) => {
      const lockUntil = new Date(Date.now() + PERSISTENCE_CEILING_MS).toISOString();
      void supabase
        .from('evaluation_jobs')
        .update({ worker_pulse_at: lockUntil })
        .eq('id', jobId)
        .eq('status', JOB_STATUS.RUNNING)
        .then(({ error }: { error: unknown }) => {
          if (error) {
            console.warn(`[${label}] persistence lock stamp failed (non-fatal)`, error);
          }
        });
    };

    const markRunning = async (
      message: string,
      completedUnits: number,
      phase: 'phase_1a' | 'phase_2' | 'phase_3' = 'phase_1a',
    ) => {
      if (!hasCanonicalPreClaimOwnership || !hasLivePreClaimLease) {
        throw new Error('markRunning requires claimed job');
      }

      const now = new Date().toISOString();

      // Phase_3 start is JSONB-only (no DB column exists)
      if (phase === 'phase_3') progressState.phase3_started_at = now;

      // Monotonic ratchet: progress percentage never goes backward. Kicks and
      // retries are invisible plumbing — the user only sees forward movement.
      const prevHighWater = (progressState as Record<string, unknown>).progress_high_water as number ?? 0;
      const safeCompletedUnits = Math.max(completedUnits, prevHighWater);

      // DB column patch — only columns that physically exist on evaluation_jobs.
      // Never build this inline: use getPhaseStartTimestamps so column drift
      // is caught by the schema-guard test in CI.
      const stageTimestampPatch = getPhaseStartTimestamps(phase as PhaseName, now);

      const nextProgress = {
        ...progressState,
        ...stageTimestampPatch,
        ...buildPhaseLogPatch(progressState, phase, 'entered', now),
        phase,
        phase_status: 'running',
        total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
        completed_units: safeCompletedUnits,
        progress_high_water: safeCompletedUnits,
        message,
        last_heartbeat_at: now,
      };

      Object.assign(progressState, nextProgress);

      const stageLabel = phase === 'phase_1a' ? 'phase1' : phase === 'phase_2' ? 'phase2' : phase as ProcessorStageBoundary;
      logProcessorStageBoundary({
        jobId,
        stage: (stageLabel === 'phase1' || stageLabel === 'phase2' || stageLabel === 'finalized' || stageLabel === 'pass3') ? stageLabel as ProcessorStageBoundary : 'phase1',
        state: 'start',
        at: now,
        metadata: {
          completed_units: completedUnits,
          message,
        },
      });

      // buildWritablePatch strips any forbidden columns (lease_expires_at,
      // phase1a_started_at, phase3_started_at, etc.) before hitting Supabase.
      // This is belt-and-suspenders on top of getPhaseStartTimestamps.
      const runningPayload = buildWritablePatch({
        status: nextLifecycleStatus(JOB_STATUS.RUNNING),
        phase,
        phase_status: 'running',
        total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
        completed_units: completedUnits,
        progress: nextProgress,
        started_at: canonicalStartedAt,
        last_heartbeat: now,
        last_heartbeat_at: now,
        heartbeat_at: now,
        worker_pulse_at: now,
        updated_at: now,
        // Per-stage timestamps — only real DB columns via getPhaseStartTimestamps
        ...stageTimestampPatch,
      });

      const { error: markRunningWriteError } = await supabase
        .from('evaluation_jobs')
        .update(runningPayload)
        .eq('id', jobId)
        .eq('status', JOB_STATUS.RUNNING)
        .eq('claimed_by', expectedClaimedBy)
        .eq('lease_token', expectedLeaseToken);

      if (markRunningWriteError) {
        const message = `Running state update failed for job ${jobId}: ${markRunningWriteError.message}`;
        console.error(`[Processor] ${message}`);
        if (/terminal phase_status|lease|claim|not running|failed can only be reset/i.test(markRunningWriteError.message)) {
          throw new ProcessorLeaseLostError({ jobId, failureCode: 'MARK_RUNNING_LEASE_LOST' });
        }
        throw new Error(message);
      }

      console.log('[Worker] markRunning persisted', {
        job_id: jobId,
        phase,
        phase_status: 'running',
        completed_units: completedUnits,
        started_at: runningPayload.started_at,
        heartbeat_at: runningPayload.heartbeat_at,
      });
    };

    const markFailed = async (
      errorMessage: string,
      errorCode: string = 'EVALUATION_FAILED',
      failureContext?: PipelineFailureContext,
    ) => {
      /**
       * CRITICAL: This function now routes through the centralized failure finalizer.
       * DO NOT add direct DB writes here — all failures flow through finalizeJobFailure().
       * This ensures atomic updates, consistent retry logic, and auditable error codes.
       */
      const now = new Date().toISOString();
      void pipelineLog({
        jobId,
        level: 'error',
        stage: 'processor_failed',
        message: 'Job failed',
        metadata: {
          status: 'failed',
          score: null,
          totalMs: Date.now() - processorStartMs,
          failureCode: errorCode,
        },
      });
      const pipelineFailureEnvelope = buildPipelineFailureEnvelope({
        errorCode,
        errorMessage,
        context: failureContext,
      });
      const pipelineFailureDiagnostics = normalizeFailureDiagnostics(failureContext?.diagnostics);
      const failedPhase =
        progressState.phase === 'phase_3' || executionPhase === 'phase_3' ? 'phase_3' :
        progressState.phase === 'phase_2' || executionPhase === 'phase_2' ? 'phase_2' :
        'phase_1a';

      const nextProgress = {
        ...progressState,
        phase: failedPhase,
        phase_status: 'failed',
        dashboard_status: 'technical_review_required',
        recovery_message: 'We\'ve detected a quality issue with your evaluation and our team is investigating. You\'ll receive an email when your report is ready. Your writing and all completed analysis have been preserved — no action is needed on your part.',
        total_units:
          typeof progressState.total_units === 'number'
            ? progressState.total_units
            : EVALUATION_PROGRESS_TOTAL_UNITS,
        completed_units:
          typeof progressState.completed_units === 'number'
            ? progressState.completed_units
            : 0,
        message: 'Evaluation failed',
        failed_at: now,
        error_code: errorCode,
        pipeline_failure_envelope: pipelineFailureEnvelope,
        ...(pipelineFailureDiagnostics
          ? { pipeline_failure_diagnostics: pipelineFailureDiagnostics }
          : {}),
      };

      const nextProgressRecord = nextProgress as Record<string, unknown>;
      if (!nextProgressRecord.pass3_completed_at && nextProgressRecord.pass3_started_at) {
        nextProgressRecord.pass3_completed_at = now;
      }

      Object.assign(progressState, nextProgress);

      const sendFailureSupportAlert = async (source: string) => {
        const alertResult = await sendEvaluationFailureSupportAlert({
          job_id: jobId,
          manuscript_id: failureAlertManuscriptId,
          user_id: failureAlertUserId,
          phase: failedPhase,
          phase_status: 'failed',
          progress_phase: typeof nextProgress.phase === 'string' ? nextProgress.phase : null,
          progress_phase_status: typeof nextProgress.phase_status === 'string' ? nextProgress.phase_status : null,
          failure_code: errorCode,
          failure_message: errorMessage,
          source,
          pipeline_stage: failureContext?.pipelineStage ?? null,
          retry_eligible: false,
          diagnostics: pipelineFailureDiagnostics ?? failureContext?.diagnostics ?? null,
          created_at: typeof (job as Record<string, unknown>).created_at === 'string'
            ? ((job as Record<string, unknown>).created_at as string)
            : null,
          updated_at: now,
        });

        if (!alertResult.sent) {
          console.warn('[Processor] evaluation failure support alert not sent', {
            job_id: jobId,
            failure_code: errorCode,
            attempted: alertResult.attempted,
            error: alertResult.error ?? null,
          });
        }
      };

      const phaseLabel = failedPhase === 'phase_2' ? 'phase2' : 'phase1';
      logProcessorStageBoundary({
        jobId,
        stage: phaseLabel,
        state: 'failed',
        at: now,
        metadata: {
          error: errorMessage,
          errorCode,
        },
      });

      const failedStatus = nextLifecycleStatus(JOB_STATUS.FAILED);
      let finalizeSucceeded = false;

      const fallbackPayload = {
        status: failedStatus,
        phase: failedPhase,
        phase_status: 'failed',
        total_units: nextProgress.total_units,
        completed_units: nextProgress.completed_units,
        progress: nextProgress,
        last_error: errorMessage,
        failure_code: errorCode,
        failure_envelope: {
          code: errorCode,
          message: errorMessage,
          retryable: false,
          bucket: pipelineFailureEnvelope.bucket,
          phase: failedPhase,
          pipeline_stage: pipelineFailureEnvelope.pipeline_stage,
          operator_action_needed: 'Review finalization/template diagnostics before retrying this job.',
        },
        failed_at: now,
        claimed_by: null,
        claimed_at: null,
        lease_token: null,
        lease_until: null,
        last_heartbeat_at: null,
        last_heartbeat: null,
        worker_pulse_at: null,
        next_attempt_at: null,
        updated_at: now,
      };

      try {
        if (!expectedLeaseToken || !expectedClaimedBy) {
          throw new Error(
            `[Processor] Missing verified claimed-owner metadata before failure finalization for job ${jobId}`,
          );
        }

        // Route through centralized, lease-guarded failure finalizer.
        const finalizeResult = await finalizeProcessorFailureWithLeaseGuard({
          jobId,
          expectedLeaseToken,
          expectedClaimedBy,
          errorEnvelope: {
            code: errorCode,
            message: errorMessage,
            retryable: false, // Processor failures are typically deterministic
          },
        });

        // Log retry eligibility for observability
        console.log(`[Processor] Job ${jobId} failed with code ${errorCode}; retryEligible=${finalizeResult.retryEligible}; attempt=${finalizeResult.attemptCount}/${finalizeResult.maxAttempts}`);
        finalizeSucceeded = true;
      } catch (finalizeError) {
        if (isProcessorLeaseLostError(finalizeError)) {
          console.error('[Processor][PROCESSOR_LEASE_LOST] terminal write skipped; no fallback mutation attempted', {
            job_id: jobId,
            failure_code: errorCode,
            message:
              finalizeError instanceof Error
                ? finalizeError.message
                : String(finalizeError),
          });
          throw finalizeError;
        }

        console.error(
          `[Processor] finalizeJobFailure failed for ${jobId}; using fallback failure write:`,
          finalizeError instanceof Error ? finalizeError.message : String(finalizeError)
        );
      }

      if (finalizeSucceeded) {
        // Preserve centralized failure ownership: patch envelope diagnostics into progress only.
        const { error: progressPatchError } = await supabase
          .from('evaluation_jobs')
          .update({
            phase: failedPhase,
            phase_status: 'failed',
            progress: nextProgress,
            failure_envelope: {
              code: errorCode,
              message: errorMessage,
              retryable: false,
              bucket: pipelineFailureEnvelope.bucket,
              phase: failedPhase,
              pipeline_stage: pipelineFailureEnvelope.pipeline_stage,
              operator_action_needed: 'Review finalization/template diagnostics before retrying this job.',
            },
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            last_heartbeat_at: null,
            last_heartbeat: null,
            worker_pulse_at: null,
            next_attempt_at: null,
            updated_at: now,
          })
          .eq('id', jobId);

        if (progressPatchError) {
          console.warn(
            `[Processor] Envelope progress patch failed for ${jobId}: ${progressPatchError.message}`,
          );
        }

        await sendFailureSupportAlert('processor:lease_guarded_failure_finalizer');

        return;
      }

      // Fail-closed fallback: centralized finalization failed, so we must persist terminal state here.
      const { error: fallbackError } = await supabase
        .from('evaluation_jobs')
        .update(fallbackPayload)
        .eq('id', jobId);

      if (fallbackError) {
        throw new Error(
          `[Processor] Failed to persist terminal failure state for ${jobId}: ${fallbackError.message}`,
        );
      }

      await sendFailureSupportAlert('processor:fallback_failure_write');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 0 — Gold Standard Warm-Up
    //
    // The evaluator STUDIES what success looks like BEFORE touching the
    // manuscript. No chunking, no manuscript read — just calibration of the
    // judging standard. The LLM ingests the WAVE gold standard + all 13
    // criteria definitions + calibration thresholds as a system primer.
    // Once internalized, the job is re-queued at phase_1a and this worker
    // returns immediately. A fresh worker claims the phase_1a job.
    // ─────────────────────────────────────────────────────────────────────────
    if (executionPhase === 'phase_0') {
      const phase0StartNow = new Date().toISOString();
      console.log(`[Processor/Phase0] ${jobId}: starting gold-standard warm-up`);

      // Stamp phase0_started_at + initial pulse
      await supabase
        .from('evaluation_jobs')
        .update({
          phase0_started_at: phase0StartNow,
          worker_pulse_at: phase0StartNow,
          updated_at: phase0StartNow,
        })
        .eq('id', jobId)
        .eq('status', JOB_STATUS.RUNNING);

      // Run the gold-standard primer — LLM internalizes evaluation criteria
      const phase0Result = await runPhase0GoldPrimer({
        jobId,
        openaiApiKey,
        openAiModel,
        evalOpenAiTimeoutMs,
      });

      if (!phase0Result.success) {
        const failedResult = phase0Result as { success: false; error: string; durationMs: number };
        const msg = `Phase 0 warm-up failed: ${failedResult.error}`;
        console.error(`[Processor/Phase0] ${jobId}: ${msg}`);
        await markFailed(msg);
        return { success: false, error: msg };
      }

      console.log(`[Processor/Phase0] ${jobId}: warm-up complete in ${phase0Result.durationMs}ms — transitioning to phase_1a`);

      // Stamp phase0_completed_at + pulse + explicit telemetry
      const phase0EndNow = new Date().toISOString();

      // Build Phase 0 telemetry patch for progress JSONB.
      // These fields are the authoritative proof of Phase 0 dwell behavior.
      // Do NOT derive dwell from timestamp deltas — store the actual measured values.
      const successResult = phase0Result as {
        success: true;
        durationMs: number;
        measuredDurationMs: number;
        llmDurationMs: number;
        dwellDurationMs: number;
        acknowledgment: string;
        wordCount: number;
        proofNormalized: boolean;
      };
      const phase0TelemetryPatch = buildPhase0RequeueProgressPatch({
        successResult,
        openAiModel,
        deployedSha: DEPLOYED_SHA,
        phase0CompletedAt: phase0EndNow,
      });

      // Re-queue at phase_1a: release lease, transition phase.
      // A fresh worker will claim and begin manuscript processing.
      const { error: reQueueErr } = await supabase
        .from('evaluation_jobs')
        .update({
          status: JOB_STATUS.QUEUED,
          phase: PHASES.PHASE_1A,
          phase_status: JOB_STATUS.QUEUED,
          claimed_by: null,
          lease_token: null,
          lease_until: null,
          last_heartbeat_at: null,
          last_heartbeat: null,
          worker_pulse_at: null,
          phase0_completed_at: phase0EndNow,
          updated_at: phase0EndNow,
          progress: { ...progressState, ...phase0TelemetryPatch },
        })
        .eq('id', jobId)
        .eq('status', JOB_STATUS.RUNNING);

      if (reQueueErr) {
        const msg = `Phase 0 → phase_1a re-queue failed: ${reQueueErr.message}`;
        console.error(`[Processor/Phase0] ${jobId}: ${msg}`);
        await markFailed(msg);
        return { success: false, error: msg };
      }

      console.log(`[Processor/Phase0] ${jobId}: re-queued at phase_1a — stabilizing before kick`);

      // Stabilization pause after Phase 0 — let the re-queue write fully commit
      // before kicking the Phase 1A worker so it reads fresh state.
      await stabilize();

      // Kick the worker so phase_1a is claimed immediately (no 5-min cron wait).
      // MUST be awaited: if this is void/detached, Vercel may kill the function
      // before the HTTP request goes out.
      await kickPhase1aWorker();

      return { success: true };
    }

    // 2. Update status to running
    await markRunning('Fetching writing', 2, executionPhase);

    // NOTE: phase0_started_at / phase0_completed_at are written ONLY by runPhase0GoldPrimer().
    // Do NOT stamp them here for direct phase_1a entries — that produces false Phase 0 timings.
    // Legacy/admin phase_1a entries that bypass Phase 0 are identified by absence of
    // progress.phase0_total_duration_ms in JSONB telemetry.

    console.log(`[Processor] Job ${jobId} status updated to running`);

    // 3. Fetch the manuscript
    const fetchManuscriptStartedAt = startLatencyStage({
      jobId,
      stage: 'fetch_manuscript',
      metadata: {
        manuscript_id: job.manuscript_id,
      },
    });

    const { data: manuscript, error: manuscriptError } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('id', job.manuscript_id)
      .single();

    if (manuscriptError || !manuscript) {
      finishLatencyStage({
        jobId,
        stage: 'fetch_manuscript',
        startedAt: fetchManuscriptStartedAt,
        state: 'failed',
        metadata: {
          finish_reason: 'manuscript_not_found',
        },
      });

      const message = `Manuscript not found: ${manuscriptError?.message}`;
      await markFailed(message);
      return { success: false, error: message };
    }

    finishLatencyStage({
      jobId,
      stage: 'fetch_manuscript',
      startedAt: fetchManuscriptStartedAt,
      state: 'completed',
      metadata: {
        manuscript_id: manuscript.id,
      },
    });

    console.log(`[Processor] Manuscript ${manuscript.id} fetched: "${manuscript.title}"`);
    failureAlertManuscriptId =
      typeof manuscript.id === 'number' && Number.isFinite(manuscript.id)
        ? manuscript.id
        : failureAlertManuscriptId;
    failureAlertUserId = typeof manuscript.user_id === 'string' ? manuscript.user_id : failureAlertUserId;

    const { text: resolvedManuscriptText } = await resolveManuscriptText(supabase, manuscript as Manuscript);
    const stripResult = stripNonEvaluativeSections(resolvedManuscriptText || '');
    const nonEvaluativeWarning = buildNonEvaluativeWarning(stripResult.excludedSections);

    if (!stripResult.sanitizedText || stripResult.sanitizedText.trim().length === 0) {
      const contentError = 'Manuscript text unavailable: neither manuscripts.content nor manuscript_chunks.content found';
      await markFailed(contentError);

      return { success: false, error: contentError };
    }

    if (!isManuscriptTextLongEnough(stripResult.sanitizedText, evalMinManuscriptWords)) {
      const shortContentError =
        `Manuscript text too short for reliable evaluation: ${stripResult.sanitizedText.trim().split(/\s+/).length} words ` +
        `(minimum ${evalMinManuscriptWords} words)`;
      await markFailed(shortContentError);

      return { success: false, error: shortContentError };
    }

    // Hard manuscript ceiling — fail-closed at intake, before any AI call.
    // Above this, no amount of chunk-routing can keep the evaluation honest at
    // our 12-min wall budget. Surface a clear "split into volumes" message.
    const intakeWordCount = countWords(stripResult.sanitizedText);
    if (intakeWordCount > HARD_MANUSCRIPT_CEILING_WORDS) {
      const ceilingError =
        `Manuscript exceeds evaluation capacity (${intakeWordCount} words > ${HARD_MANUSCRIPT_CEILING_WORDS}). ` +
        `Please split into volumes.`;
      await markFailed(ceilingError, 'MANUSCRIPT_EXCEEDS_HARD_CEILING', {
        pipelineStage: 'intake',
        reasonCodes: ['MANUSCRIPT_EXCEEDS_HARD_CEILING'],
        diagnostics: {
          manuscript_words: intakeWordCount,
          hard_ceiling_words: HARD_MANUSCRIPT_CEILING_WORDS,
        },
      });
      return { success: false, error: ceilingError };
    }

    // Context binding assertion: prove the fetched manuscript belongs to this job
    // before any pipeline invocation (fail-closed isolation guarantee).
    // Both IDs must be finite positive integers and must match.
    const fetchedManuscriptId = (manuscript as Manuscript).id;
    const jobManuscriptId = job.manuscript_id;
    if (
      !Number.isFinite(jobManuscriptId) ||
      jobManuscriptId <= 0 ||
      !Number.isFinite(fetchedManuscriptId) ||
      fetchedManuscriptId <= 0 ||
      fetchedManuscriptId !== jobManuscriptId
    ) {
      const bindingError =
        `Context binding failure: job.manuscript_id=${jobManuscriptId} does not match fetched manuscript.id=${fetchedManuscriptId}`;
      await markFailed(bindingError);
      return { success: false, error: bindingError };
    }

    const manuscriptWithContent: Manuscript = {
      ...(manuscript as Manuscript),
      content: stripResult.sanitizedText,
    };

    if (stripResult.excludedSections.length > 0) {
      progressState.excluded_non_evaluative_sections = stripResult.excludedSections.map((section) => ({
        kind: section.kind,
        label: section.label,
        start_line: section.startLine,
        end_line: section.endLine,
      }));
    }

    const preChunkSanitizedText = manuscriptWithContent.content || '';

    const chunkRouting = await maybeEnsureLongFormChunks({
      manuscriptId: manuscriptWithContent.id,
      jobId: String(job.id),
      manuscriptText: preChunkSanitizedText,
    });
    progressState.chunk_routing = chunkRouting;

    // Fail-closed guard: long_form must prove chunk materialization before pipeline.
    // If persisted_chunk_count is 0 OR does not match ensured chunk count, the pipeline
    // cannot produce trustworthy comparison-packet evidence. Fail explicitly here.
    if (
      chunkRouting.route === 'long_form' &&
      (
        chunkRouting.persisted_chunk_count === undefined ||
        chunkRouting.ensure_chunks_returned_count === undefined ||
        chunkRouting.persisted_chunk_count === 0 ||
        chunkRouting.ensure_chunks_returned_count === 0 ||
        chunkRouting.persisted_chunk_count !== chunkRouting.ensure_chunks_returned_count
      )
    ) {
      const chunkMaterializationError =
        `Long-form job requires verified chunk materialization before pipeline, but ` +
        `ensure_chunks_returned_count=${chunkRouting.ensure_chunks_returned_count ?? 0}, ` +
        `persisted_chunk_count=${chunkRouting.persisted_chunk_count ?? 0} ` +
        `for manuscript ${manuscriptWithContent.id}. ` +
        `Chunk materialization failed. Do not proceed.`;
      await markFailed(chunkMaterializationError, 'LONG_FORM_CHUNK_MATERIALIZATION_FAILED', {
        pipelineStage: 'phase_1a',
        reasonCodes: ['LONG_FORM_CHUNK_MATERIALIZATION_FAILED'],
        diagnostics: { chunk_routing: chunkRouting },
      });
      return { success: false, error: chunkMaterializationError };
    }

    // Post-condition: every materialized chunk MUST fit the Pass 1 prompt window
    // AND respect the adaptive chunker's per-bracket maxChars target. The first
    // check guards against prompt-window overflow (Pass 1 timeout); the second
    // ensures the adaptive sizer is producing chunks within its declared bound.
    if (
      chunkRouting.route === 'long_form' &&
      typeof chunkRouting.max_chunk_chars === 'number' &&
      chunkRouting.max_chunk_chars > 0
    ) {
      const charBudget = chunkRouting.prompt_budget_chars;
      const budgetCeiling = Math.floor(charBudget * 0.95);
      const adaptiveMaxChars = chunkRouting.chunk_max_chars_config;
      if (chunkRouting.max_chunk_chars > budgetCeiling) {
        const violatingIndex = chunkRouting.max_chunk_index ?? 0;
        const ratio = charBudget > 0 ? chunkRouting.max_chunk_chars / charBudget : 0;
        const chunkBudgetError =
          `Chunker post-condition violated: chunk ${violatingIndex} has ` +
          `char_count=${chunkRouting.max_chunk_chars} which exceeds 95% of ` +
          `inputCharBudget (${charBudget}). Pass 1 cannot complete within the prompt ` +
          `window — failing closed before dispatch.`;
        await markFailed(chunkBudgetError, 'CHUNK_BUDGET_OVERFLOW', {
          pipelineStage: 'chunking',
          reasonCodes: ['CHUNK_BUDGET_OVERFLOW'],
          diagnostics: {
            chunk_routing: chunkRouting,
            violating_chunk_index: violatingIndex,
            chunk_char_count: chunkRouting.max_chunk_chars,
            char_budget: charBudget,
            ratio,
          },
        });
        return { success: false, error: chunkBudgetError };
      }
      // PR #520 chunk-materialization invariants — run BEFORE the
      // CHUNK_BUDGET_OVERFLOW adaptive bracket gate so recursive overlap
      // inflation (the bug that closed Issue #519) is caught at its source
      // rather than masked by a downstream budget check.
      {
        const chunkCount = chunkRouting.chunk_count ?? 0;
        const maxIndex = chunkRouting.max_chunk_index ?? -1;
        // Only fail closed when max_chunk_index is OUT OF RANGE (greater than
        // chunk_count - 1). A lower max_chunk_index can occur legitimately in
        // mocked/fixture data and is not an inflation signal — only an
        // overflow index proves recursive chunk accumulation.
        if (chunkCount > 0 && maxIndex >= 0 && maxIndex > chunkCount - 1) {
          const rangeError =
            `Chunk index range mismatch: chunk_count=${chunkCount} but max_chunk_index=${maxIndex} exceeds expected upper bound ${chunkCount - 1}. ` +
            `Failing closed before persistence.`;
          await markFailed(rangeError, 'CHUNK_INDEX_RANGE_MISMATCH', {
            pipelineStage: 'chunking',
            reasonCodes: ['CHUNK_INDEX_RANGE_MISMATCH'],
            diagnostics: {
              chunk_routing: chunkRouting,
              chunk_count: chunkCount,
              max_chunk_index: maxIndex,
            },
          });
          return { success: false, error: rangeError };
        }
        // Inflation check: aggregate emitted chunk size vs the canonical base
        // span. baseIndexedChars is the resolved-text length (canonical
        // source); totalOverlapChars is the total overlap budget the chunker
        // is allowed to add. The sum of emitted chunk content must not exceed
        // baseIndexedChars + totalOverlapChars by more than a small safety
        // margin, otherwise the resolver picked up an already-overlap-inflated
        // source (the Issue #519 failure mode).
        const routingRecord = chunkRouting as unknown as Record<string, unknown>;
        const baseIndexedChars =
          typeof routingRecord.base_chars === 'number'
            ? (routingRecord.base_chars as number)
            : typeof routingRecord.resolved_text_chars === 'number'
            ? (routingRecord.resolved_text_chars as number)
            : 0;
        const perChunkOverlap = chunkRouting.overlap_chars ?? 0;
        const totalOverlapChars = chunkCount > 1 ? perChunkOverlap * (chunkCount - 1) : 0;
        const totalEmittedChars =
          typeof routingRecord.total_chunk_chars === 'number'
            ? (routingRecord.total_chunk_chars as number)
            : 0;
        if (
          baseIndexedChars > 0 &&
          totalEmittedChars > 0 &&
          totalEmittedChars > baseIndexedChars + totalOverlapChars + 1024
        ) {
          const inflationError =
            `Chunk content inflation detected: total_emitted_chars=${totalEmittedChars} exceeds ` +
            `baseIndexedChars=${baseIndexedChars} + totalOverlapChars=${totalOverlapChars} ` +
            `(margin=1024). Resolver may have read overlap-inflated source. ` +
            `Failing closed before persistence.`;
          await markFailed(inflationError, 'CHUNK_CONTENT_INFLATION', {
            pipelineStage: 'chunking',
            reasonCodes: ['CHUNK_CONTENT_INFLATION'],
            diagnostics: {
              chunk_routing: chunkRouting,
              base_indexed_chars: baseIndexedChars,
              total_overlap_chars: totalOverlapChars,
              total_emitted_chars: totalEmittedChars,
            },
          });
          return { success: false, error: inflationError };
        }
      }

      if (chunkRouting.max_chunk_chars > adaptiveMaxChars) {
        const violatingIndex = chunkRouting.max_chunk_index ?? 0;
        // The emitted chunk content includes any prepended overlap on non-first
        // chunks (content = text.slice(baseStart - overlap, baseEnd)). For
        // diagnostic clarity, surface BOTH the emitted size (which is what the
        // contract enforces) and the implied base-span size, so a future
        // overlap-vs-emitted accounting drift is immediately obvious.
        const emittedChars = chunkRouting.max_chunk_chars;
        const overlapBudget = chunkRouting.overlap_chars ?? 0;
        const impliedBaseChars = Math.max(0, emittedChars - overlapBudget);
        const chunkBudgetError =
          `Chunker post-condition violated: chunk ${violatingIndex} has ` +
          `char_count=${emittedChars} which exceeds adaptive ` +
          `bracket maxChars=${adaptiveMaxChars} (bracket=${chunkRouting.bracket}). ` +
          `Failing closed before dispatch.`;
        await markFailed(chunkBudgetError, 'CHUNK_BUDGET_OVERFLOW', {
          pipelineStage: 'chunking',
          reasonCodes: ['CHUNK_BUDGET_OVERFLOW'],
          diagnostics: {
            chunk_routing: chunkRouting,
            violating_chunk_index: violatingIndex,
            chunk_char_count: emittedChars,
            chunk_emitted_chars: emittedChars,
            chunk_implied_base_chars: impliedBaseChars,
            chunk_overlap_budget_chars: overlapBudget,
            adaptive_max_chars: adaptiveMaxChars,
            bracket: chunkRouting.bracket,
          },
        });
        return { success: false, error: chunkBudgetError };
      }
    }

    let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
    let finalTextProvenance: FinalTextProvenance = {
      final_text_source: 'short_form_initial_text',
      post_chunk_reresolved: false,
      canonical_path_used: 'resolveManuscriptText.initial',
    };
    if (chunkRouting.route === 'long_form') {
      const { text: canonicalPostChunkText, loadedChunks } = await resolveManuscriptText(supabase, {
        ...(manuscript as Manuscript),
        content: null,
      });

      if (canonicalPostChunkText.trim().length > 0) {
        manuscriptWithContent.content = canonicalPostChunkText;
      }

      if (loadedChunks && loadedChunks.length > 0) {
        // Reuse chunks already loaded by resolveManuscriptText — no second DB read needed.
        manuscriptChunksForPipeline = loadedChunks.filter(
          (row) => row.content.trim().length > 0,
        );
      } else {
        // Fallback: explicit query when resolveManuscriptText did not take chunk-reconstruction path.
        const { data: chunkRows, error: chunkRowsError } = await supabase
          .from('manuscript_chunks')
          .select('chunk_index, content')
          .eq('manuscript_id', manuscriptWithContent.id)
          .order('chunk_index', { ascending: true });

        if (chunkRowsError) {
          const chunkLoadError =
            `Failed to load chunk evidence for manuscript ${manuscriptWithContent.id}: ${chunkRowsError.message}`;
          await markFailed(chunkLoadError, 'CHUNK_EVIDENCE_LOAD_FAILED', {
            pipelineStage: 'phase_1a',
            reasonCodes: ['CHUNK_EVIDENCE_LOAD_FAILED'],
          });
          return { success: false, error: chunkLoadError };
        }

        manuscriptChunksForPipeline = (chunkRows ?? [])
          .filter(
            (row: { chunk_index?: unknown; content?: unknown }): row is ManuscriptChunkEvidence =>
              typeof row.chunk_index === 'number' &&
              typeof row.content === 'string' &&
              row.content.trim().length > 0,
          )
          .map((row) => ({
            chunk_index: row.chunk_index,
            content: row.content,
          }));
      }

      progressState.chunk_evidence = {
        source: 'manuscript_chunks',
        chunk_count: manuscriptChunksForPipeline.length,
      };

      finalTextProvenance = {
        final_text_source: 'long_form_post_chunk_canonical',
        post_chunk_reresolved: true,
        canonical_path_used: 'resolveManuscriptText.post_chunk_reconstruct',
      };
    } else {
      // Short-form / sub-threshold: no chunking occurred, so synthesize a
      // single chunk from the full manuscript text.  Without this, Pass 3A
      // receives an empty array and instantly fails with "all_chunks_failed".
      const fullText = (manuscriptWithContent.content || '').trim();
      if (fullText.length > 0) {
        manuscriptChunksForPipeline = [{ chunk_index: 0, content: fullText }];
        progressState.chunk_evidence = {
          source: 'short_form_synthetic_single_chunk',
          chunk_count: 1,
        };
      }
    }

    progressState.final_text_source = finalTextProvenance.final_text_source;
    progressState.post_chunk_reresolved = finalTextProvenance.post_chunk_reresolved;
    progressState.canonical_path_used = finalTextProvenance.canonical_path_used;

    console.log('[Processor] chunk routing decision', {
      job_id: jobId,
      manuscript_id: manuscriptWithContent.id,
      ...chunkRouting,
    });

    const timeoutSourceText = preChunkSanitizedText;
    const timeoutPayloadText = manuscriptWithContent.content || '';
    const sourceWordCount = countWords(timeoutSourceText);
    const payloadWordCount = countWords(timeoutPayloadText);

    // Word-count-aware work type: never blindly default to 'novel' for a 5K-word manuscript.
    const effectiveWorkType = manuscriptWithContent.work_type
      || inferWorkTypeFromWordCount(Math.max(sourceWordCount, payloadWordCount));
    const timeoutInputText =
      payloadWordCount >= sourceWordCount ? timeoutPayloadText : timeoutSourceText;
    const timeoutScopeProfile = classifySubmissionScope(timeoutInputText, chunkRouting.chunk_count);
    const timeoutWordBasis = countWords(timeoutInputText);

    // Pass expected chunk count so the timeout scales with actual workload.
    // For a 52-chunk long-form job this yields ~924s instead of the flat 720s
    // floor, giving the chunk concurrency pool realistic headroom.
    const expectedChunksForTimeout =
      chunkRouting.route === 'long_form' &&
      typeof chunkRouting.persisted_chunk_count === 'number' &&
      chunkRouting.persisted_chunk_count > 1
        ? chunkRouting.persisted_chunk_count
        : undefined;

    const timeoutResolution = resolveScopedEvaluationTimeouts({
      inputScale: timeoutScopeProfile.inputScale as TimeoutScopeInputScale,
      passTimeoutMs: evalPassTimeoutMs,
      openAiTimeoutMs: evalOpenAiTimeoutMs,
      floorMs: LONG_FORM_TIMEOUT_FLOOR_MS,
      expectedChunks: expectedChunksForTimeout,
    });

    progressState.timeout_resolution = {
      input_scale: timeoutResolution.inputScale,
      floor_applied: timeoutResolution.floorApplied,
      floor_ms: timeoutResolution.floorMs,
      base_pass_timeout_ms: timeoutResolution.basePassTimeoutMs,
      base_openai_timeout_ms: timeoutResolution.baseOpenAiTimeoutMs,
      resolved_pass_timeout_ms: timeoutResolution.passTimeoutMs,
      resolved_openai_timeout_ms: timeoutResolution.openAiTimeoutMs,
      timeout_word_basis: timeoutWordBasis,
      timeout_source_word_count: sourceWordCount,
      timeout_chunk_storage_word_count: payloadWordCount,
      ...(timeoutResolution.chunkScaledFrom !== undefined
        ? { chunk_scaled_from: timeoutResolution.chunkScaledFrom }
        : {}),
    };

    console.log('[Processor][TimeoutResolution]', {
      job_id: jobId,
      manuscript_id: manuscriptWithContent.id,
      input_scale: timeoutResolution.inputScale,
      manuscript_words: timeoutScopeProfile.wordCount,
      timeout_word_basis: timeoutWordBasis,
      timeout_source_word_count: sourceWordCount,
      timeout_chunk_storage_word_count: payloadWordCount,
      floor_applied: timeoutResolution.floorApplied,
      floor_ms: timeoutResolution.floorMs,
      base_pass_timeout_ms: timeoutResolution.basePassTimeoutMs,
      base_openai_timeout_ms: timeoutResolution.baseOpenAiTimeoutMs,
      resolved_pass_timeout_ms: timeoutResolution.passTimeoutMs,
      resolved_openai_timeout_ms: timeoutResolution.openAiTimeoutMs,
      ...(timeoutResolution.chunkScaledFrom !== undefined
        ? { chunk_scaled_from: timeoutResolution.chunkScaledFrom }
        : {}),
    });

    // 4. Canonical evaluation via governed multi-pass pipeline (fail-closed)
    //
    // RELAY RACE ARCHITECTURE (3 Vercel invocations):
    //   phase_1a → phase_2 → phase_3
    //   phase_1a: Pass 1A (character ledger) + Pass 3A (preflight) — parallel
    //             writes: pass1a_character_ledger_v1 + pass3_preflight_draft_v1
    //             self-chains → phase_2
    //   phase_2:  Pass 1 + Pass 2 — ledger-informed
    //             writes: pass12_handoff_v1
    //             self-chains → phase_3
    //   phase_3:  Pass 3B synthesis → evaluation_result_v2 + longform_document_v1
    //             then: WAVE gate (non-fatal, 60s cap) → wave_revision_plan_v1
    //             then: job → COMPLETE

    let pipelineResult: Awaited<ReturnType<typeof runPipeline>> | undefined;

    const externalMode = getExternalAdjudicationMode();

    // ── PHASE 3 EXECUTION PATH (Pass 3B Synthesis + WAVE Readiness Layer) ───────
    // Own 720s Vercel invocation. Owns Pass 3B synthesis AND WAVE Readiness Layer (diagnoses/plans; not repair).
    //   - If pass12_handoff_v1 missing → terminal failure (PHASE3_MISSING_HANDOFF)
    //   - If evaluation_result_v2 already exists → skip synthesis, run WAVE inline
    //   - If evaluation_result_v2 missing + handoff present → run Pass 3B synthesis
    //     via runPipeline (with cached P1+P2 injected), persist result, then fall
    //     through to the canonical persistence path. The WAVE-queue block at the
    //     bottom of the persistence path detects executionPhase==='phase_3' and
    //     runs WAVE inline instead of re-queueing phase_3.
    if (executionPhase === 'phase_3') {
      pulseWorker('phase3/entry');
      try {
        await assertPhase3UpstreamInputsCanonical(supabase, String(job.id), Number(job.manuscript_id));
      } catch (phase3InputErr) {
        const message = phase3InputErr instanceof Error ? phase3InputErr.message : String(phase3InputErr);
        console.error(`[phase_3] ${jobId}: canonical upstream input guard failed`, message);
        await markFailed(
          `Phase 3 upstream input policy violation: ${message}`,
          'POLICY_VIOLATION_PHASE3_UPSTREAM_INPUT',
          { pipelineStage: 'phase_3' },
        );
        return { success: false, error: 'POLICY_VIOLATION_PHASE3_UPSTREAM_INPUT' };
      }

      // ── GOVERNANCE GATE: Phase 3 also requires accepted_story_ledger_v1 ──
      pulseWorker('phase3/before-governance-gate');
      const { buildAuthorCorrectionsBlock: buildCorrectionsBlockP3 } = await import('@/lib/evaluation/pipeline/prompts/pass2-editorial');

      const { data: p3LedgerRow, error: p3LedgerErr } = await supabase
        .from('evaluation_artifacts')
        .select('content')
        .eq('job_id', job.id)
        .eq('artifact_type', 'accepted_story_ledger_v1')
        .maybeSingle();

      if (p3LedgerErr || !p3LedgerRow?.content) {
        console.error(`[phase_3] ${jobId}: accepted_story_ledger_v1 missing — cannot synthesize`);
        await markFailed(
          'Phase 3 cannot synthesize without accepted_story_ledger_v1.',
          'MISSING_ACCEPTED_STORY_LEDGER',
          { pipelineStage: 'phase_3' }
        );
        return { success: false, error: 'MISSING_ACCEPTED_STORY_LEDGER' };
      }

      const p3GovRail = (p3LedgerRow.content as Record<string, unknown>).governance_rail as Record<string, unknown> | undefined;
      if (!p3GovRail) {
        console.error(`[phase_3] ${jobId}: governance_rail missing from accepted_story_ledger_v1`);
        await markFailed(
          'Phase 3 cannot synthesize without author governance rail.',
          'MISSING_AUTHOR_GOVERNANCE_RAIL',
          { pipelineStage: 'phase_3' }
        );
        return { success: false, error: 'MISSING_AUTHOR_GOVERNANCE_RAIL' };
      }

      const p3LayerDecisions = p3GovRail.layer_decisions as Record<string, unknown> | undefined;
      if (!p3LayerDecisions || Object.keys(p3LayerDecisions).length < 9) {
        console.error(`[phase_3] ${jobId}: incomplete layer_decisions — found ${Object.keys(p3LayerDecisions ?? {}).length}/9`);
        await markFailed(
          'Phase 3 cannot synthesize until all Story Layer layers have author decisions.',
          'INCOMPLETE_AUTHOR_LAYER_DECISIONS',
          { pipelineStage: 'phase_3', diagnostics: { found: Object.keys(p3LayerDecisions ?? {}).length, required: 9 } }
        );
        return { success: false, error: 'INCOMPLETE_AUTHOR_LAYER_DECISIONS' };
      }

      const authorCorrectionsBlockP3 = buildCorrectionsBlockP3(p3GovRail);
      if (authorCorrectionsBlockP3) {
        console.log(`[phase_3] ${jobId}: AUTHOR CORRECTIONS BLOCK injected (${authorCorrectionsBlockP3.length} chars) — governing context active`);
      } else {
        console.log(`[phase_3] ${jobId}: clean approval — no author corrections to inject`);
      }
      // ── END GOVERNANCE GATE ──
      pulseWorker('phase3/after-governance-gate');

      const { data: handoffPresenceRow } = await supabase
        .from('evaluation_artifacts')
        .select('job_id')
        .eq('job_id', job.id)
        .eq('artifact_type', 'pass12_handoff_v1')
        .maybeSingle();
      const evalResultArtifactType = 'evaluation_result' + '_v2';
      const { data: evalResultPresenceRow } = await supabase
        .from('evaluation_artifacts')
        .select('job_id')
        .eq('job_id', job.id)
        .eq('artifact_type', evalResultArtifactType)
        .maybeSingle();

      const hasHandoff    = !!handoffPresenceRow;
      const hasEvalResult = !!evalResultPresenceRow;

      if (!hasHandoff) {
        console.error(`[phase_3] ${jobId}: pass12_handoff_v1 missing — terminal failure`);
        await markFailed(
          'phase_3 entered without pass12_handoff_v1 — cannot synthesize',
          'PHASE3_MISSING_HANDOFF',
          { pipelineStage: 'phase_3' },
        );
        return { success: false };
      }

      // ── Pass 3B synthesis path: handoff exists, eval_result missing ──────────
      // Read handoff + ledger + preflight, build runners, run runPipeline,
      // assign outer pipelineResult, fall through to persistence path.
      if (!hasEvalResult) {
        pulseWorker('phase3/before-pass3b-synthesis');
        await markRunning('Running Pass 3B synthesis', 80, 'phase_3');
        refreshPhaseDeadline(progressState.phase3_started_at as string | undefined);

        pulseWorker('phase3/before-handoff-read');
        const { data: handoffRow, error: handoffReadError } = await supabase
          .from('evaluation_artifacts')
          .select('content')
          .eq('job_id', job.id)
          .eq('artifact_type', 'pass12_handoff_v1')
          .maybeSingle();
        pulseWorker('phase3/after-handoff-read');

        if (handoffReadError || !handoffRow?.content) {
          console.error(`[phase_3] ${jobId}: handoff artifact read failed`,
            handoffReadError?.message ?? 'no_content');
          await markFailed(
            'phase_3 handoff read failed',
            'PHASE3_MISSING_HANDOFF',
            { pipelineStage: 'phase_3' },
          );
          return { success: false };
        }

        const handoff = handoffRow.content as {
          pass1Output: SinglePassOutput;
          pass2Output: SinglePassOutput | null;
          chunk_count: number;
          partial_capture?: boolean;
        };

        const cachedPass1 = handoff.pass1Output;
        const cachedPass2 = handoff.pass2Output;

        // SIPOC mistake-proofing: if handoff pass2Output has empty recommendations
        // (upstream aggregator bug or data corruption), recover from chunk cache.
        if (cachedPass2) {
          await recoverHandoffRecommendationsFromChunkCache(supabase, String(job.id), cachedPass2);
        }

        const phase3Runners = cachedPass2 !== null
          ? {
              runPass1: async () => cachedPass1,
              runPass2: async () => cachedPass2,
            }
          : {
              runPass1: async () => cachedPass1,
            };

        // Read prebuilt character ledger (built by phase_1a)
        pulseWorker('phase3/before-ledger-read');
        let prebuiltCharacterLedgerP3: { ledger: Pass1aCharacterLedger; ledgerV2: CharacterLedgerV2 } | undefined;
        try {
          const { data: ledgerArtifactP3 } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', job.id)
            .eq('artifact_type', 'pass1a_character_ledger_v1')
            .maybeSingle();
          if (ledgerArtifactP3?.content?.ledger_v1 && ledgerArtifactP3?.content?.ledger_v2) {
            prebuiltCharacterLedgerP3 = {
              ledger: ledgerArtifactP3.content.ledger_v1 as Pass1aCharacterLedger,
              ledgerV2: ledgerArtifactP3.content.ledger_v2 as CharacterLedgerV2,
            };
          } else {
            console.warn(`[phase_3] ${jobId}: pass1a_character_ledger_v1 missing — Pass 1A will re-run inline`);
          }
        } catch (ledgerReadErr) {
          console.warn(`[phase_3] ${jobId}: ledger artifact read failed (non-fatal)`,
            ledgerReadErr instanceof Error ? ledgerReadErr.message : String(ledgerReadErr));
        }

        // Read prebuilt Pass 3A preflight (soft — absence triggers PREFLIGHT UNAVAILABLE in Pass 3B)
        pulseWorker('phase3/before-preflight-read');
        let prebuiltPreflightDraftP3: Pass3PreflightDraft | undefined;
        try {
          const { data: preflightArtifactP3 } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', job.id)
            .eq('artifact_type', 'pass3_preflight_draft_v1')
            .maybeSingle();
          if (preflightArtifactP3?.content?.schema_version === 'pass3_preflight_draft_v1') {
            const candidate = preflightArtifactP3.content as Pass3PreflightDraft;
            // Guard: only inject preflight if the reducer actually produced usable output.
            // A preflight with authority="unavailable" or reducer_status!="ok" is a
            // failed/placeholder artifact — Pass 3B should use PREFLIGHT UNAVAILABLE
            // rather than silently consuming null-score criterion drafts as real evidence.
            const reducerOk =
              candidate.reducer_status === 'ok' ||
              // Backward compat: older artifacts without reducer_status are accepted
              // only when authority is not "unavailable" AND criterionDrafts has real scores.
              (
                !candidate.reducer_status &&
                candidate.preflight_authority !== 'unavailable' &&
                Array.isArray(candidate.criterionDrafts) &&
                candidate.criterionDrafts.some(d => d.provisionalScore !== null)
              );
            if (reducerOk) {
              prebuiltPreflightDraftP3 = candidate;
            } else {
              console.warn(
                `[phase_3] ${jobId}: pass3_preflight_draft_v1 found but reducer failed or produced empty output ` +
                `(authority=${candidate.preflight_authority}, reducer_status=${candidate.reducer_status ?? 'legacy'}) — ` +
                `Pass 3B will use PREFLIGHT UNAVAILABLE fallback`
              );
            }
          } else {
            console.warn(`[phase_3] ${jobId}: pass3_preflight_draft_v1 missing — Pass 3B will use PREFLIGHT UNAVAILABLE fallback`);
          }
        } catch (preflightReadErr) {
          console.warn(`[phase_3] ${jobId}: preflight artifact read failed (non-fatal)`,
            preflightReadErr instanceof Error ? preflightReadErr.message : String(preflightReadErr));
        }

        const pass3StartedAt = new Date().toISOString();
        progressState.pass3_started_at = pass3StartedAt;
        logProcessorStageBoundary({
          jobId,
          stage: 'pass3',
          state: 'start',
          at: pass3StartedAt,
          metadata: { model: getCanonicalPipelineModel(openAiModel), phase: 'phase_3_synthesis' },
        });

        const leaseRenewalIntervalMsP3synth = 30_000;
        const leaseRenewalLoopP3synth = setInterval(() => {
          void renewEvaluationJobLease({
            supabase,
            jobId,
            leaseMs: runtimeConfig.worker.leaseMs,
            stage: 'phase_3_pass3b_renewal',
            hardDeadlineMs,
          }).catch((err: unknown) => {
            console.warn('[phase_3] lease renewal failed (non-fatal)',
              err instanceof Error ? err.message : String(err));
          });
        }, leaseRenewalIntervalMsP3synth);

        // ── Vercel budget gate: self-chain if insufficient time for Pass 3 synthesis ──
        const budgetBeforeP3Ms = getVercelBudgetRemainingMs();
        if (budgetBeforeP3Ms < BUDGET_SAFETY_MARGIN_MS) {
          console.warn(`[phase_3] ${jobId}: budget exhausted before synthesis (remaining=${budgetBeforeP3Ms}ms < margin=${BUDGET_SAFETY_MARGIN_MS}ms) — self-chaining`);
          clearInterval(leaseRenewalLoopP3synth);
          const selfChainNow = new Date().toISOString();
          const { error: budgetChainErr } = await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.QUEUED,
              phase: PHASES.PHASE_3,
              phase_status: JOB_STATUS.QUEUED,
              claimed_by: null,
              lease_token: null,
              lease_until: null,
              worker_pulse_at: null,
              updated_at: selfChainNow,
              progress: {
                ...progressState,
                phase: 'phase_3',
                phase_status: 'queued',
                message: 'Re-queued: insufficient Vercel budget for Pass 3 synthesis',
                phase_log: [
                  ...((progressState.phase_log as unknown[]) ?? []),
                  { at: selfChainNow, event: 'phase3_budget_self_chain', budget_remaining_ms: budgetBeforeP3Ms },
                ],
              },
            })
            .eq('id', jobId)
            .eq('status', JOB_STATUS.RUNNING);
          if (budgetChainErr) {
            throw new Error(`Phase 3 budget self-chain failed: ${budgetChainErr.message}`);
          }
          // Stabilization pause before Phase 3 self-chain return.
          await stabilize(STABILIZE_SELF_CHAIN_MS);
          return { success: true };
        }

        pulseWorker('phase3/before-pipeline-run');
        const runPipelineStartedAtP3 = startLatencyStage({
          jobId,
          stage: 'pipeline_run',
          metadata: { model: getCanonicalPipelineModel(openAiModel), phase: 'phase_3_synthesis' },
        });

        const providerBudget = resolveProviderBudget({
          chunkCount: manuscriptChunksForPipeline?.length ?? 1,
          manuscriptWordCount: countWords(manuscriptWithContent.content || ''),
        });

        const { data: providerCallRows, error: providerCallErr } = await supabase
          .from('evaluation_provider_calls')
          .select('response_meta')
          .eq('job_id', String(job.id))
          .eq('provider', 'openai');

        if (providerCallErr) {
          const providerBudgetReadError = `Provider budget preflight failed: ${providerCallErr.message}`;
          await markFailed(providerBudgetReadError, 'PROVIDER_BUDGET_EXCEEDED', { pipelineStage: 'phase_3' });
          return { success: false, error: providerBudgetReadError };
        }

        const providerCallCount = Array.isArray(providerCallRows) ? providerCallRows.length : 0;
        const providerEstimatedTokens = Array.isArray(providerCallRows)
          ? providerCallRows.reduce((sum, row) => {
              const tokens = (row as { response_meta?: { tokens_total?: unknown } | null })?.response_meta?.tokens_total;
              return sum + (Number.isFinite(Number(tokens)) ? Number(tokens) : 0);
            }, 0)
          : 0;

        if (
          providerCallCount >= providerBudget.maxCalls ||
          providerEstimatedTokens >= providerBudget.maxEstimatedTokens
        ) {
          const providerBudgetExceeded =
            `Provider budget exceeded before phase_3 pipeline run: calls=${providerCallCount}/${providerBudget.maxCalls}, ` +
            `estimated_tokens=${providerEstimatedTokens}/${providerBudget.maxEstimatedTokens}`;
          await markFailed(providerBudgetExceeded, 'PROVIDER_BUDGET_EXCEEDED', { pipelineStage: 'phase_3' });
          return { success: false, error: providerBudgetExceeded };
        }

        const llrRecoveryMode =
          progressState.llr_retry_mode === 'safe_rewrite' ? 'safe_rewrite' : 'none';

        // Load full-context story ledger for Phase 2/3 grounding (if generated in Phase 0.5a)
        let phase23LedgerContextBlock: string | undefined;
        if (process.env.EVAL_FULL_CONTEXT_LEDGER === 'true') {
          try {
            const { data: ledgerRows } = await supabase
              .from('evaluation_artifacts')
              .select('content')
              .eq('job_id', String(job.id))
              .eq('artifact_type', 'full_context_story_ledger_v1')
              .limit(1);
            if (ledgerRows && ledgerRows.length > 0) {
              const ledger = (ledgerRows[0] as { content: FullContextStoryLedger }).content;
              phase23LedgerContextBlock = buildLedgerSeedContextBlock(ledger);
            }
          } catch (ledgerLoadErr) {
            console.warn(`[phase_2/3] ${jobId}: failed to load full-context ledger (non-fatal)`, {
              error: ledgerLoadErr instanceof Error ? ledgerLoadErr.message : String(ledgerLoadErr),
            });
          }
        }

        let pipelineResultP3;
        try {
          pipelineResultP3 = await runPipeline({
            manuscriptText: manuscriptWithContent.content || '',
            manuscriptChunks: manuscriptChunksForPipeline,
            workType: effectiveWorkType,
            title: manuscriptWithContent.title,
            jobId: String(job.id),
            model: getCanonicalPipelineModel(openAiModel),
            openaiApiKey,
            perplexityApiKey: perplexityApiKey || undefined,
            manuscriptId: String(manuscriptWithContent.id),
            englishVariant: selectedEnglishVariant,
            executionMode: 'TRUSTED_PATH',
            _passTimeoutMs: timeoutResolution.passTimeoutMs,
            _openAiTimeoutMs: timeoutResolution.openAiTimeoutMs,
            _runners: phase3Runners,
            ...(prebuiltCharacterLedgerP3 ? { _prebuiltCharacterLedger: prebuiltCharacterLedgerP3 } : {}),
            ...(prebuiltPreflightDraftP3 ? { _prebuiltPreflightDraft: prebuiltPreflightDraftP3 } : {}),
            ...(authorCorrectionsBlockP3 ? { _authorCorrectionsBlock: authorCorrectionsBlockP3 } : {}),
            _llrRecoveryMode: llrRecoveryMode,
            _storyLedgerContextBlock: phase23LedgerContextBlock,
            onHeartbeat: async (stage) => {
              await assertJobWithinSla({
                supabase,
                jobId,
                hardDeadlineMs,
                stage,
                expectedLeaseToken,
                expectedClaimedBy,
              });
              await renewEvaluationJobLease({
                supabase, jobId, leaseMs: runtimeConfig.worker.leaseMs, stage, hardDeadlineMs,
              });
            },
          });
        } finally {
          clearInterval(leaseRenewalLoopP3synth);
        }

        finishLatencyStage({
          jobId,
          stage: 'pipeline_run',
          startedAt: runPipelineStartedAtP3,
          state: pipelineResultP3.ok ? 'completed' : 'failed',
          metadata: {
            finish_reason: pipelineResultP3.ok
              ? 'ok'
              : ('error_code' in pipelineResultP3 ? pipelineResultP3.error_code : 'pipeline_failed'),
          },
        });

        pipelineResult = pipelineResultP3;

        // Fall through to the canonical persistence path. The WAVE-queue block
        // (search for "phase_2 → phase_3 queued") detects executionPhase==='phase_3'
        // and runs WAVE inline instead of re-queueing.
      } else {
        // ── WAVE-only path: eval_result already exists, skip synthesis ─────────
        // This is the rerun/retry case. Run WAVE inline + complete.
        await markRunning('Running WAVE readiness analysis', 95, 'phase_3');
      refreshPhaseDeadline(progressState.phase3_started_at as string | undefined);

      // Heartbeat renewal loop — WAVE can run for several minutes on large manuscripts.
      const leaseRenewalIntervalMsP3 = 30_000;
      const leaseRenewalLoopP3 = setInterval(() => {
        void renewEvaluationJobLease({
          supabase,
          jobId,
          leaseMs: runtimeConfig.worker.leaseMs,
          stage: 'phase_3_wave_renewal',
          hardDeadlineMs,
        }).catch((err: unknown) => {
          console.warn('[Processor] phase_3 lease renewal failed (non-fatal)',
            err instanceof Error ? err.message : String(err));
        });
        // IDLE GUARD: phase_3 has no per-chunk callbacks so we pulse on the
        // lease interval itself — but ONLY write worker_pulse_at here, not
        // last_heartbeat_at (renewEvaluationJobLease already owns that).
        // This proves the JS event loop is still spinning inside the invocation.
        const p3PulseNow = new Date().toISOString();
        void supabase
          .from('evaluation_jobs')
          .update({ worker_pulse_at: p3PulseNow })
          .eq('id', jobId)
          .eq('status', JOB_STATUS.RUNNING)
          .then(({ error }: { error: unknown }) => {
            if (error) console.warn('[phase_3] worker_pulse_at stamp failed (non-fatal)', error);
          });
      }, leaseRenewalIntervalMsP3);

      try {
        // Read the persisted evaluation result (synthesis) from artifacts.
        const { data: evalArtifactRow } = await supabase
          .from('evaluation_artifacts')
          .select('content')
          .eq('job_id', job.id)
          .eq('artifact_type', 'evaluation_result_v2')
          .maybeSingle();

        // Read the character ledger artifact written by phase_1a.
        const { data: ledgerArtifactRow } = await supabase
          .from('evaluation_artifacts')
          .select('content')
          .eq('job_id', job.id)
          .eq('artifact_type', 'pass1a_character_ledger_v1')
          .maybeSingle();

        const synthesis = evalArtifactRow?.content?.synthesis ?? null;
        const wordCount = (evalArtifactRow?.content?.word_count as number | null)
          ?? (evalArtifactRow?.content?.coverage?.sourceWords as number | null)
          ?? 0;
        const characterLedgerV2Phase3 = ledgerArtifactRow?.content?.ledger_v2 as CharacterLedgerV2 | undefined;

        if (!synthesis) {
          // WAVE never fails the evaluation — the base evaluation is the paid product.
          // If the synthesis artifact is missing, persist a failed WAVE artifact and
          // mark the job COMPLETE. The user still gets their evaluation report.
          console.error(`[Processor] ${jobId}: phase_3 — evaluation result artifact missing; persisting failed WAVE artifact and completing job`);

          try {
            const missingHash = `wave_missing_synthesis_${String(job.id)}`;
            await upsertEvaluationArtifact({
              supabase,
              jobId: String(job.id),
              manuscriptId: Number(job.manuscript_id),
              artifactType: 'wave_revision_plan_v1',
              artifactVersion: 'wave_revision_plan_v1',
              sourceHash: missingHash,
              content: {
                status: 'failed',
                reason_code: 'PHASE3_SYNTHESIS_MISSING',
                reason: 'Evaluation result artifact missing or has no synthesis',
                retryable: true,
                generated_at: new Date().toISOString(),
              },
            });
          } catch (missingArtifactErr) {
            console.error(`[Processor] ${jobId}: phase_3 — failed to persist missing-synthesis artifact (non-fatal)`,
              missingArtifactErr instanceof Error ? missingArtifactErr.message : String(missingArtifactErr));
          }

          // Mark job complete — WAVE is optional, evaluation already persisted
          nextLifecycleStatus(JOB_STATUS.COMPLETE);
          const missingNow = new Date().toISOString();
          await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.COMPLETE,
              phase: 'phase_3',
              phase_status: 'complete',
              completed_at: missingNow,
              updated_at: missingNow,
              phase3_completed_at: missingNow,
              progress: {
                ...progressState,
                ...buildPhaseLogPatch(progressState, 'phase_3', 'passed', missingNow),
                completed_units: 100,
                phase: 'phase_3',
                phase_status: 'complete',
                message: 'WAVE skipped (synthesis artifact missing) — evaluation complete',
                phase3_wave_status: 'failed',
                phase3_wave_reason: 'PHASE3_SYNTHESIS_MISSING',
                phase3_completed_at: missingNow,
              },
            })
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING);

          return { success: true };
        }

        const waveHandoff = {
          manuscriptText: manuscriptWithContent.content || '',
          synthesis,
          characterLedgerV2: characterLedgerV2Phase3,
          wordCount,
          jobId,
          manuscriptVersionId: (job.manuscript_version_id as string | null) ?? null,
        };

        const waveStartMs = Date.now();
        let waveResult: import('@/lib/evaluation/waveRevision').WaveRevisionResult | null = null;
        try {
          waveResult = await Promise.race([
            (await import('@/lib/evaluation/waveRevision')).executeWaveRevision(waveHandoff),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('WAVE_TIMEOUT')), 60_000)
            ),
          ]);
        } catch (waveErr) {
          const errMsg = waveErr instanceof Error ? waveErr.message : String(waveErr);
          const isTimeout = errMsg === 'WAVE_TIMEOUT';
          const reasonCode = isTimeout
            ? 'WAVE_TIMEOUT'
            : errMsg.includes('WAVE_SOURCE_VERSION_RESOLUTION_FAILED')
              ? 'WAVE_SOURCE_VERSION_RESOLUTION_FAILED'
              : errMsg.includes('createRevisionSession failed')
                ? 'WAVE_SESSION_CREATE_FAILED'
                : 'WAVE_ERROR';
          console.warn(`[WAVE/Phase3] ${isTimeout ? 'Timeout' : 'Error'} for job ${jobId} (${Date.now() - waveStartMs}ms):`, errMsg);

          // Normalize: status is always "failed"; use reason_code to distinguish
          // timeout vs other errors. Keeps the status enum clean:
          //   complete | skipped | failed
          const failedPlan = {
            status: 'failed' as const,
            reason_code: reasonCode,
            reason: errMsg,
            retryable: isTimeout,
            generated_at: new Date().toISOString(),
          };

          try {
            const waveFailHash = stableSourceHash({
              manuscriptId: manuscript.id,
              jobId: job.id,
              userId: manuscriptWithContent.user_id,
              manuscriptText: manuscriptWithContent.content || '',
              promptVersion: `wave_revision_plan_v1:${failedPlan.status}`,
              model: 'wave_deterministic',
            });
            await upsertEvaluationArtifact({
              supabase,
              jobId: job.id,
              manuscriptId: job.manuscript_id,
              artifactType: 'wave_revision_plan_v1',
              artifactVersion: 'wave_revision_plan_v1',
              sourceHash: waveFailHash,
              content: failedPlan,
            });
          } catch (artifactErr) {
            console.error(`[WAVE/Phase3] Failed to persist failure artifact for job ${jobId} (non-fatal):`,
              artifactErr instanceof Error ? artifactErr.message : String(artifactErr));
          }
        }

        if (waveResult) {
          try {
            const wavePlanHash = stableSourceHash({
              manuscriptId: manuscript.id,
              jobId: job.id,
              userId: manuscriptWithContent.user_id,
              manuscriptText: manuscriptWithContent.content || '',
              promptVersion: `wave_revision_plan_v1:${waveResult.plan.status}`,
              model: 'wave_deterministic',
            });
            await upsertEvaluationArtifact({
              supabase,
              jobId: job.id,
              manuscriptId: job.manuscript_id,
              artifactType: 'wave_revision_plan_v1',
              artifactVersion: 'wave_revision_plan_v1',
              sourceHash: wavePlanHash,
              content: waveResult.plan,
            });
            console.log(`[WAVE/Phase3] Artifacts persisted for job ${jobId} — status=${waveResult.plan.status}`);
          } catch (artifactErr) {
            console.error(`[WAVE/Phase3] Failed to persist success artifacts for job ${jobId} (non-fatal):`,
              artifactErr instanceof Error ? artifactErr.message : String(artifactErr));
          }
        }

        // ── Canon Governance Runner (non-blocking, fire-and-forget) ──────
        // Runs Gate 15, Golden Spine, Dialogue Canon audit, and Revision Canon Metadata after WAVE.
        try {
          const { runCanonGovernance } = await import('@/lib/evaluation/canonGovernanceRunner');
          const evalCriteria = Array.isArray(evalArtifactRow?.content?.criteria)
            ? (evalArtifactRow.content.criteria as Array<{ key?: string }>).map(c => c.key).filter((k): k is string => typeof k === 'string')
            : [];
          const canonResult = await Promise.race([
            runCanonGovernance({
              manuscriptText: manuscriptWithContent.content || '',
              jobId,
              manuscriptId: job.manuscript_id,
              userId: manuscriptWithContent.user_id,
              criteriaKeys: evalCriteria,
              wordCount,
            }, supabase),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
          ]);
          if (canonResult) {
            const layers = [
              canonResult.gate15 ? `Gate15=${canonResult.gate15.overallStatus}` : null,
              canonResult.goldenSpine ? `GoldenSpine=${canonResult.goldenSpine.overallStatus}` : null,
              canonResult.dialogueCanon ? `Dialogue=${canonResult.dialogueCanon.overallStatus}` : null,
              canonResult.revisionCanonMetadata ? `RevMeta=${canonResult.revisionCanonMetadata.overallStatus}` : null,
            ].filter(Boolean).join(', ');
            console.log(`[CanonGovernance/Phase3] ${jobId}: ${layers}`);
          }
        } catch (canonErr) {
          console.error(`[CanonGovernance/Phase3] ${jobId}: non-fatal error`,
            canonErr instanceof Error ? canonErr.message : String(canonErr));
        }

        // ── Finalization Quality Guard ──────────────────────────────────
        // Before marking complete, verify the evaluation deliverable is usable.
        // Any quality violation → status = quality_issue_detected, not complete.
        clearInterval(leaseRenewalLoopP3);
        const phase3Now = new Date().toISOString();
        const qualityViolations: Array<{ code: string; detail: string }> = [];

        // Load eval result for quality inspection
        const { data: finalEvalRow } = await supabase
          .from('evaluation_artifacts')
          .select('content')
          .eq('job_id', String(job.id))
          .eq('artifact_type', 'evaluation_result_v2')
          .maybeSingle();

        const finalCriteria = Array.isArray(finalEvalRow?.content?.criteria)
          ? (finalEvalRow.content.criteria as Array<{
              key?: string;
              score?: number;
              recommendations?: Array<{ action?: string; quarantined?: boolean }>;
            }>)
          : [];

        // QUALITY_ACCEPTED_LEDGER_EMPTY: check accepted ledger layers
        const { data: finalAcceptedLedger } = await supabase
          .from('evaluation_artifacts')
          .select('content')
          .eq('job_id', String(job.id))
          .eq('artifact_type', 'accepted_story_ledger_v1')
          .maybeSingle();

        if (finalAcceptedLedger?.content) {
          const acceptedContent = finalAcceptedLedger.content as Record<string, unknown>;
          const acceptedLayers = acceptedContent.layers;
          if (!acceptedLayers || (typeof acceptedLayers === 'object' && Object.keys(acceptedLayers as Record<string, unknown>).length === 0)) {
            qualityViolations.push({
              code: 'QUALITY_ACCEPTED_LEDGER_EMPTY',
              detail: 'accepted_story_ledger_v1.layers is empty — downstream synthesis was starved of story-layer context',
            });
          }
        }

        // Count author-facing (non-quarantined) recommendations
        const allRecs = finalCriteria.flatMap((c) => c.recommendations ?? []);
        const authorFacingRecs = allRecs.filter((r) => !r.quarantined);
        const quarantinedRecs = allRecs.filter((r) => r.quarantined);

        // QUALITY_ZERO_AUTHOR_RECOMMENDATIONS
        if (allRecs.length === 0 || authorFacingRecs.length === 0) {
          qualityViolations.push({
            code: 'QUALITY_ZERO_AUTHOR_RECOMMENDATIONS',
            detail: `total_recs=${allRecs.length}, author_facing=${authorFacingRecs.length} — no usable recommendations in deliverable`,
          });
        }

        // QUALITY_ALL_RECS_QUARANTINED
        if (allRecs.length > 0 && quarantinedRecs.length === allRecs.length) {
          qualityViolations.push({
            code: 'QUALITY_ALL_RECS_QUARANTINED',
            detail: `all ${allRecs.length} recommendations quarantined by integrity gate`,
          });
        }

        // QUALITY_DENSITY_UNMET: enforce actual density floor per criterion
        //   score ≤ 8 → at least 1 non-quarantined rec
        //   score ≤ 5 → at least 2 non-quarantined recs
        const densityFailures: Array<{ key: string; score: number; required: number; actual: number }> = [];
        for (const c of finalCriteria) {
          const score = typeof c.score === 'number' ? c.score : 10;
          if (score > 8) continue; // no density requirement for high-scoring criteria
          const nonQuarantinedRecs = (c.recommendations ?? []).filter((r) => !r.quarantined).length;
          const required = score <= 5 ? 2 : 1;
          if (nonQuarantinedRecs < required) {
            densityFailures.push({ key: c.key ?? 'unknown', score, required, actual: nonQuarantinedRecs });
          }
        }
        if (densityFailures.length > 0) {
          const failSummary = densityFailures
            .map((f) => `${f.key}(score=${f.score}, need=${f.required}, have=${f.actual})`)
            .join(', ');
          qualityViolations.push({
            code: 'QUALITY_DENSITY_UNMET',
            detail: `${densityFailures.length} criteria below density floor: ${failSummary}`,
          });
        }

        if (qualityViolations.length > 0) {
          const violationCodes = qualityViolations.map((v) => v.code).join(', ');
          const violationDetails = qualityViolations.map((v) => `${v.code}: ${v.detail}`).join('; ');
          console.error(`[Processor] ${jobId}: FINALIZATION GUARD TRIGGERED — ${violationCodes}`);
          console.error(`[Processor] ${jobId}: quality violation details: ${violationDetails}`);

          const { error: qualityFailErr } = await supabase
            .from('evaluation_jobs')
            .update({
              status: 'quality_issue_detected',
              phase: 'phase_3',
              phase_status: 'quality_issue_detected',
              completed_at: phase3Now,
              updated_at: phase3Now,
              phase3_completed_at: phase3Now,
              progress: {
                ...progressState,
                ...buildPhaseLogPatch(progressState, 'phase_3', 'quality_issue_detected', phase3Now),
                completed_units: 100,
                phase: 'phase_3',
                phase_status: 'quality_issue_detected',
                message: `Finalization blocked: ${violationCodes}`,
                quality_violations: qualityViolations,
                phase3_completed_at: phase3Now,
              },
            })
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING);

          if (qualityFailErr) {
            console.error(`[Processor] ${jobId}: quality_issue_detected update failed`, qualityFailErr.message);
          }

          return { success: false, error: `FINALIZATION_GUARD: ${violationCodes}` };
        }

        // All quality checks passed — mark complete.
        console.log(`[Processor] ${jobId}: phase_3 WAVE complete — marking job complete`);
        nextLifecycleStatus(JOB_STATUS.COMPLETE);
        const { error: phase3CompleteErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.COMPLETE,
            phase: 'phase_3',
            phase_status: 'complete',
            completed_at: phase3Now,
            updated_at: phase3Now,
            phase3_completed_at: phase3Now,
            progress: {
              ...progressState,
              ...buildPhaseLogPatch(progressState, 'phase_3', 'passed', phase3Now),
              completed_units: 100,
              phase: 'phase_3',
              phase_status: 'complete',
              message: 'WAVE readiness layer complete',
              phase3_completed_at: phase3Now,
            },
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING);

        if (phase3CompleteErr) {
          console.error(`[Processor] ${jobId}: phase_3 completion update failed`, phase3CompleteErr.message);
        }

        return { success: true };
      } catch (phase3Err) {
        clearInterval(leaseRenewalLoopP3);
        const errMsg = phase3Err instanceof Error ? phase3Err.message : String(phase3Err);
        console.error(`[Processor] ${jobId}: phase_3 fatal error — evaluation already complete, marking job complete anyway`, errMsg);
        // Phase_3 fatal error: evaluation already persisted from phase_2. Complete anyway.
        nextLifecycleStatus(JOB_STATUS.COMPLETE);
        const errNow = new Date().toISOString();
        await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.COMPLETE,
            phase: 'phase_3',
            phase_status: 'complete',
            completed_at: errNow,
            phase3_completed_at: errNow,
            updated_at: errNow,
            progress: {
              ...progressState,
              ...buildPhaseLogPatch(progressState, 'phase_3', 'passed', errNow),
              completed_units: 100,
              phase: 'phase_3',
              phase_status: 'complete',
              message: 'WAVE phase error (non-fatal) — evaluation complete',
              phase3_error: errMsg,
            },
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING);
        return { success: true };
      }
      } // end WAVE-only else
    } // end phase_3 execution

    // ── PHASE 1A EXECUTION PATH (Pass 1A Character Sweep) ─────────────────────
    // Own 720s Vercel invocation. Reads manuscript, runs Pass 1A character sweep,
    // builds ledger V1+V2, persists artifact, then queues phase_2.
    // MANDATORY — if it fails, the job fails (ledger required for Pass 3).
    if (executionPhase === 'phase_1a') {
      // phase0_completed_at is written only by runPhase0GoldPrimer() when real Phase 0 runs.
      // Do NOT stamp it here — this is the phase_1a execution path, not Phase 0 completion.
      await markRunning('Running Pass 1A character sweep', 10, 'phase_1a');
      refreshPhaseDeadline(progressState.phase1a_started_at as string | undefined);

      // ── PHASE_0_NOT_PROVEN guard ────────────────────────────────────────────
      // Fail-closed: Phase 1A must not proceed unless Phase 0 ran for ≥12,000ms.
      // progress.phase0_total_duration_ms is written only by runPhase0GoldPrimer()
      // and is authoritative. The phase0_started_at / phase0_completed_at columns
      // are NOT reliable (they have legacy cosmetic stamp paths). Use JSONB only.
      // Exception: jobs with progress.phase0_bypass_reason set (admin/legacy resets).
      {
        const p0DurationMs = typeof progressState.phase0_total_duration_ms === 'number'
          ? progressState.phase0_total_duration_ms
          : typeof progressState.phase0_total_duration_ms === 'string'
            ? Number(progressState.phase0_total_duration_ms)
            : null;
        const p0MeasuredDurationMs = typeof progressState.phase0_measured_duration_ms === 'number'
          ? progressState.phase0_measured_duration_ms
          : typeof progressState.phase0_measured_duration_ms === 'string'
            ? Number(progressState.phase0_measured_duration_ms)
            : null;
        const p0BypassReason = progressState.phase0_bypass_reason as string | undefined;
        const PHASE_0_MIN_PROVEN_MS = 12_000;
        const p0ProofFloorMs = PHASE_0_MIN_PROVEN_MS - PHASE_0_PROOF_TOLERANCE_MS;
        const phase0ProofSatisfied = isPhase0ProofSatisfied({
          totalDurationMs: p0DurationMs,
          measuredDurationMs: p0MeasuredDurationMs,
          minProvenMs: PHASE_0_MIN_PROVEN_MS,
          toleranceMs: PHASE_0_PROOF_TOLERANCE_MS,
        });

        if (!p0BypassReason && !phase0ProofSatisfied) {
          const actual = p0DurationMs !== null ? `${p0DurationMs}ms` : 'absent';
          const measured = p0MeasuredDurationMs !== null ? `${p0MeasuredDurationMs}ms` : 'absent';
          console.error(
            `[phase_1a] ${jobId}: PHASE_0_NOT_PROVEN — ` +
            `phase0_total_duration_ms=${actual}, phase0_measured_duration_ms=${measured}, ` +
            `proof_floor=${p0ProofFloorMs}ms (${PHASE_0_MIN_PROVEN_MS}ms - tolerance ${PHASE_0_PROOF_TOLERANCE_MS}ms). ` +
            `Phase 0 calibration did not complete. Failing job to prevent uncalibrated evaluation.`
          );
          await markFailed(
            `Phase 0 calibration not proven (phase0_total_duration_ms=${actual}, phase0_measured_duration_ms=${measured}). ` +
            `The evaluator did not complete the 12-second gold standard warm-up.`,
            'PHASE_0_NOT_PROVEN',
            {
              pipelineStage: 'phase_1a_entry',
              diagnostics: {
                phase0_total_duration_ms: p0DurationMs,
                phase0_measured_duration_ms: p0MeasuredDurationMs,
                phase0_min_proven_ms: PHASE_0_MIN_PROVEN_MS,
                phase0_proof_tolerance_ms: PHASE_0_PROOF_TOLERANCE_MS,
              },
            }
          );
          return { success: false, error: 'PHASE_0_NOT_PROVEN' };
        }

        if (p0BypassReason) {
          console.warn(`[phase_1a] ${jobId}: Phase 0 bypassed — reason=${p0BypassReason} (admin/legacy)`);
        } else {
          console.log(
            `[phase_1a] ${jobId}: Phase 0 proven — total=${p0DurationMs ?? 'absent'}ms ` +
            `measured=${p0MeasuredDurationMs ?? 'absent'}ms ` +
            `words=${progressState.phase0_calibration_word_count ?? 'unknown'}`
          );
        }
      }
      // ── End PHASE_0_NOT_PROVEN guard ────────────────────────────────────────

      // ── SEED guard + generation before any Phase 1A chunk work ─────────────
      // Contract: Phase 1A must run with story_map_seed_v1 + evaluation_seed_v1
      // present. If missing, generate deterministically and persist before
      // dispatching Pass 1A. Any seed persistence failure is fail-closed.
      let phase1aSeedContextBlock = '';
      let phase1aLedgerContextBlock = '';
      let seedEntityNamesForConsistency: string[] = [];
      try {
        const seedStartedAt = new Date().toISOString();
        const seedStartMs = Date.now();

        const ensuredSeeds = await ensureSeedArtifactsForPhase1a({
          supabase,
          jobId: String(job.id),
          manuscriptId: Number(job.manuscript_id),
          manuscriptText: manuscriptWithContent.content || '',
          userId: manuscriptWithContent.user_id,
          title: manuscriptWithContent.title,
          workType: effectiveWorkType,
          openAiModel,
          openaiApiKey,
          evalOpenAiTimeoutMs,
        });

        const seedDurationMs = Date.now() - seedStartMs;
        const seedCompletedAt = new Date().toISOString();

        phase1aSeedContextBlock = buildPass1aSeedContextBlock({
          storySeed: ensuredSeeds.storySeed,
          evaluationSeed: ensuredSeeds.evaluationSeed,
        });

        // Extract seed entity names for post-extraction consistency check.
        for (const claim of ensuredSeeds.storySeed.claims) {
          if (claim.temp_seed_entity_id) {
            const name = claim.temp_seed_entity_id
              .replace(/^temp_seed_entity_/, '')
              .replace(/_/g, ' ')
              .trim();
            if (name.length > 0 && name !== 'fallback primary work') {
              seedEntityNamesForConsistency.push(name);
            }
          }
        }

        // ── Phase 0.5A/0.5B logging for mistake-proofing ─────────────────
        // Every phase transition must be visible in the progress timeline.
        const seedLogEntries: Record<string, unknown>[] = [];
        if (ensuredSeeds.createdTypes.includes('story_map_seed_v1')) {
          seedLogEntries.push(
            { at: seedStartedAt, event: 'phase_0_5a_started', stage: 'phase_0_5a', label: 'Generating story map seed' },
            { at: seedCompletedAt, event: 'phase_0_5a_completed', stage: 'phase_0_5a', duration_ms: seedDurationMs, artifact: 'story_map_seed_v1' },
          );
        }
        if (ensuredSeeds.createdTypes.includes('evaluation_seed_v1')) {
          seedLogEntries.push(
            { at: seedStartedAt, event: 'phase_0_5b_started', stage: 'phase_0_5b', label: 'Generating evaluation seed' },
            { at: seedCompletedAt, event: 'phase_0_5b_completed', stage: 'phase_0_5b', duration_ms: seedDurationMs, artifact: 'evaluation_seed_v1' },
          );
        }
        if (seedLogEntries.length > 0) {
          // Persist seed phase_log entries immediately so they're visible even if
          // a later step fails. This is the mistake-proofing contract: no silent work.
          const existingLog = (progressState.phase_log as unknown[]) ?? [];
          progressState = {
            ...progressState,
            phase_log: [...existingLog, ...seedLogEntries],
          };
          await supabase
            .from('evaluation_jobs')
            .update({
              progress: progressState,
              worker_pulse_at: seedCompletedAt,
            })
            .eq('id', jobId)
            .eq('status', JOB_STATUS.RUNNING);
        }

        if (ensuredSeeds.createdTypes.length > 0) {
          console.log(`[phase_0.5] ${jobId}: generated seed artifacts (${seedDurationMs}ms)`, {
            created: ensuredSeeds.createdTypes,
          });
        } else {
          console.log(`[phase_0.5] ${jobId}: seed artifacts already present (skip)`);
        }

        // ── Phase 0.5A Enhanced: Full-Context Story Ledger (behind feature flag) ──
        // When EVAL_FULL_CONTEXT_LEDGER=true, generate a comprehensive 9-layer
        // story ledger from the full manuscript text in a single LLM call.
        // This provides hard fact constraints that prevent downstream comprehension errors.
        if (process.env.EVAL_FULL_CONTEXT_LEDGER === 'true') {
          const manuscriptText = manuscriptWithContent.content || '';
          const wordCount = manuscriptText.split(/\s+/).length;

          // Check if we already have a full_context_story_ledger_v1 artifact
          const { data: existingLedgerRows } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', String(job.id))
            .eq('artifact_type', 'full_context_story_ledger_v1')
            .limit(1);

          if (!existingLedgerRows || existingLedgerRows.length === 0) {
            console.log(`[phase_0.5a_enhanced] ${jobId}: generating full-context story ledger (${wordCount} words)`);
            const ledgerStartMs = Date.now();

            try {
              const ledgerResult = await generateFullContextStoryLedger({
                jobId: String(job.id),
                manuscriptId: Number(job.manuscript_id),
                manuscriptText,
                title: manuscriptWithContent.title,
                workType: effectiveWorkType,
                wordCount,
                openaiApiKey,
                model: openAiModel,
                timeoutMs: Math.max(evalOpenAiTimeoutMs, 180_000), // 3 min for full-context
              });

              // Persist the ledger artifact
              await supabase
                .from('evaluation_artifacts')
                .insert({
                  job_id: String(job.id),
                  manuscript_id: Number(job.manuscript_id),
                  artifact_type: 'full_context_story_ledger_v1',
                  content: ledgerResult.ledger,
                  created_at: new Date().toISOString(),
                });

              // Build the ledger context block for Phase 1A
              phase1aLedgerContextBlock = buildLedgerSeedContextBlock(ledgerResult.ledger);

              const ledgerDurationMs = Date.now() - ledgerStartMs;

              // ── Gate A: Ledger Quality Minimum ──
              const ledgerQuality = assessLedgerQuality(ledgerResult.ledger);
              const qualitySummary = ledgerQuality.dimensions
                .map(d => `${d.name}=${d.actual}/${d.minimum}${d.passed ? '' : ' ⚠'}`)
                .join(', ');

              console.log(
                `[phase_0.5a_enhanced] ${jobId}: full-context ledger generated ` +
                `(${ledgerDurationMs}ms, quality=${ledgerQuality.status}, completeness=${(ledgerQuality.overall_completeness * 100).toFixed(0)}%, ` +
                `${ledgerResult.ledger.canonical_hard_facts.length} hard facts, ${ledgerResult.ledger.failure_conditions.length} failure conditions)`
              );
              if (ledgerQuality.status === 'degraded') {
                console.warn(
                  `[phase_0.5a_enhanced] ${jobId}: degraded ledger quality — below minimum on: ` +
                  `${ledgerQuality.degraded_dimensions.join(', ')}. Details: ${qualitySummary}`
                );
              }

              // Structural validation against benchmark template
              const structValidation = ledgerResult.structuralValidation;
              if (structValidation && structValidation.status !== 'passed') {
                console.warn(
                  `[phase_0.5a_enhanced] ${jobId}: structural validation ${structValidation.status} — ` +
                  `missing: [${structValidation.missing_layers.join(', ')}], ` +
                  `empty: [${structValidation.empty_layers.join(', ')}], ` +
                  `warnings: ${structValidation.warnings.length}`
                );
              }

              // Log to phase timeline with quality assessment + structural validation
              const ledgerLogEntries: Record<string, unknown>[] = [
                { at: new Date(ledgerStartMs).toISOString(), event: 'phase_0_5a_enhanced_started', stage: 'phase_0_5a_enhanced', label: 'Generating full-context story ledger' },
                {
                  at: new Date().toISOString(),
                  event: 'phase_0_5a_enhanced_completed',
                  stage: 'phase_0_5a_enhanced',
                  duration_ms: ledgerDurationMs,
                  artifact: 'full_context_story_ledger_v1',
                  ledger_quality: ledgerQuality.status,
                  ledger_completeness: ledgerQuality.overall_completeness,
                  degraded_dimensions: ledgerQuality.degraded_dimensions,
                  structural_validation: structValidation?.status ?? 'unknown',
                  structural_missing_layers: structValidation?.missing_layers ?? [],
                  structural_warnings: structValidation?.warnings?.slice(0, 10) ?? [],
                },
              ];
              const existingLogForLedger = (progressState.phase_log as unknown[]) ?? [];
              progressState = {
                ...progressState,
                phase_log: [...existingLogForLedger, ...ledgerLogEntries],
              };
              await supabase
                .from('evaluation_jobs')
                .update({ progress: progressState, worker_pulse_at: new Date().toISOString() })
                .eq('id', jobId)
                .eq('status', JOB_STATUS.RUNNING);
            } catch (ledgerErr) {
              // ── Gate C: Log failure event in phase timeline ──
              const ledgerFailedMs = Date.now() - ledgerStartMs;
              const errorMsg = ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr);
              console.warn(`[phase_0.5a_enhanced] ${jobId}: full-context ledger generation failed (non-fatal, continuing with claim-based seeds)`, {
                error: errorMsg,
                duration_ms: ledgerFailedMs,
              });

              const failLogEntries: Record<string, unknown>[] = [
                { at: new Date(ledgerStartMs).toISOString(), event: 'phase_0_5a_enhanced_started', stage: 'phase_0_5a_enhanced', label: 'Generating full-context story ledger' },
                {
                  at: new Date().toISOString(),
                  event: 'phase_0_5a_enhanced_failed',
                  stage: 'phase_0_5a_enhanced',
                  duration_ms: ledgerFailedMs,
                  error: errorMsg.slice(0, 500),
                  fallback: 'claim_based_seeds_only',
                },
              ];
              const existingLogForFail = (progressState.phase_log as unknown[]) ?? [];
              progressState = {
                ...progressState,
                phase_log: [...existingLogForFail, ...failLogEntries],
              };
              await supabase
                .from('evaluation_jobs')
                .update({ progress: progressState, worker_pulse_at: new Date().toISOString() })
                .eq('id', jobId)
                .eq('status', JOB_STATUS.RUNNING);
            }
          } else {
            // Ledger already exists — load it and build the context block
            const existingLedger = (existingLedgerRows[0] as { content: FullContextStoryLedger }).content;
            phase1aLedgerContextBlock = buildLedgerSeedContextBlock(existingLedger);
            console.log(`[phase_0.5a_enhanced] ${jobId}: loaded existing full-context ledger`);
          }

          // ── Phase 0.5B: Full-Context DREAM Seed (editorial calibration) ──
          // Generates an editorial diagnostic that serves as scoring calibration
          // reference for Phase 3B longform output.
          const manuscriptTextForDream = manuscriptWithContent.content || '';
          const wordCountForDream = manuscriptTextForDream.split(/\s+/).length;

          const { data: existingDreamRows } = await supabase
            .from('evaluation_artifacts')
            .select('id')
            .eq('job_id', String(job.id))
            .eq('artifact_type', 'editorial_dream_seed_v1')
            .limit(1);

          if (!existingDreamRows || existingDreamRows.length === 0) {
            console.log(`[phase_0.5b] ${jobId}: generating editorial DREAM seed (${wordCountForDream} words)`);
            const dreamStartMs = Date.now();

            try {
              const dreamResult = await generateEditorialDreamSeed({
                jobId: String(job.id),
                manuscriptId: Number(job.manuscript_id),
                manuscriptText: manuscriptTextForDream,
                title: manuscriptWithContent.title,
                workType: effectiveWorkType,
                wordCount: wordCountForDream,
                isMultiLayer: wordCountForDream >= 75_000,
                openaiApiKey,
                model: openAiModel,
                timeoutMs: Math.max(evalOpenAiTimeoutMs, 180_000),
              });

              await supabase
                .from('evaluation_artifacts')
                .insert({
                  job_id: String(job.id),
                  manuscript_id: Number(job.manuscript_id),
                  artifact_type: 'editorial_dream_seed_v1',
                  content: dreamResult.dreamSeed,
                  created_at: new Date().toISOString(),
                });

              const dreamDurationMs = Date.now() - dreamStartMs;
              console.log(`[phase_0.5b] ${jobId}: editorial DREAM seed generated (${dreamDurationMs}ms, score=${dreamResult.dreamSeed.overall_score}, grade=${dreamResult.dreamSeed.overall_grade})`);
            } catch (dreamErr) {
              // Non-fatal: DREAM seed is calibration only, pipeline continues without it
              console.warn(`[phase_0.5b] ${jobId}: editorial DREAM seed generation failed (non-fatal)`, {
                error: dreamErr instanceof Error ? dreamErr.message : String(dreamErr),
              });
            }
          } else {
            console.log(`[phase_0.5b] ${jobId}: editorial DREAM seed already present (skip)`);
          }
        }
      } catch (seedErr) {
        const seedErrMsg = seedErr instanceof Error ? seedErr.message : String(seedErr);
        await markFailed(
          `Phase 1A requires story_map_seed_v1 + evaluation_seed_v1 before chunk processing: ${seedErrMsg}`,
          'SEED_ARTIFACTS_MISSING',
          {
            pipelineStage: 'phase_1a_seed_guard',
            reasonCodes: ['SEED_ARTIFACTS_MISSING'],
            diagnostics: { error: seedErrMsg },
            bucket: 'supabase_contract',
          },
        );
        return { success: false, error: 'SEED_ARTIFACTS_MISSING' };
      }


      // ── Phase 1A: Self-Chaining Batch Mode ─────────────────────────────────
      //
      // WHY SELF-CHAINING:
      // Production evidence shows Phase 1A claims, runs briefly (60–75s), then
      // re-queues without completing. Root cause: the previous design attempted
      // all chunks plus preflight in a single invocation, which exceeds the
      // observed effective runtime ceiling regardless of maxDuration config.
      //
      // This implementation processes a bounded chunk batch per invocation,
      // persists progress, then intentionally re-queues phase_1a and kicks the
      // next worker. Intentional self-chain is NOT a failure — attempt_count
      // must not increment. Each invocation loads cached results and resumes
      // from the last cursor position.
      //
      // SUBSTEP ORDER (per complete Phase 1A lifecycle):
      //   1. Build or load chunk_routing_manifest (setup-tax elimination)
      //   2. Load pass1a_chunk_cache_v1 (skip completed chunks)
      //   3. LOOP: process bounded batches, self-chain until all chunks done
      //   4. Run runPass3Preflight ONCE after all chunks are cached
      //   5. Assemble ledger + build Story Layer
      //   6. Persist Story Layer artifact
      //   7. Open Review Gate (phase_1a → awaiting_approval)

      const phase1aInvocationEntryMs = Date.now();
      // Budget timer is reset after seed/ledger setup completes so that
      // the 240s invocation budget is reserved for chunk batch processing,
      // not consumed by LLM-heavy seed generation (which can take 4+ min).
      let phase1aInvocationStartMs = phase1aInvocationEntryMs;
      const phase1aConfig = runtimeConfig.phase1a;

      // Heartbeat renewal loop — keeps lease alive during chunk LLM calls.
      const leaseRenewalIntervalMsP1a = 30_000;
      const leaseRenewalLoopP1a = setInterval(() => {
        void renewEvaluationJobLease({
          supabase,
          jobId,
          leaseMs: runtimeConfig.worker.leaseMs,
          stage: 'phase_1a_batch_renewal',
          hardDeadlineMs,
        }).catch((err: unknown) => {
          console.warn('[Processor] phase_1a lease renewal failed (non-fatal)',
            err instanceof Error ? err.message : String(err));
        });
      }, leaseRenewalIntervalMsP1a);

      try {
        const allChunks = manuscriptChunksForPipeline;
        const totalChunks = Array.isArray(allChunks) ? allChunks.length : 1;

        // ── 1. Chunk routing manifest (setup-tax elimination) ─────────────
        // On first invocation: build routing manifest and persist as artifact
        // so resumed invocations skip expensive manuscript fetch + routing.
        const routingManifestType = 'phase1a_chunk_routing_manifest_v1';
        const routingManifestHash = createHash('sha256')
          .update(`${String(job.id)}:${String(job.manuscript_id)}:routing:${totalChunks}`)
          .digest('hex');

        // Persist routing manifest on first invocation (idempotent upsert).
        const routingManifestContent = {
          job_id: String(job.id),
          manuscript_id: Number(job.manuscript_id),
          total_chunks: totalChunks,
          source_hash: routingManifestHash,
          created_at: new Date().toISOString(),
          deploy_sha: DEPLOYED_SHA,
        };
        await upsertEvaluationArtifact({
          supabase,
          jobId: String(job.id),
          manuscriptId: Number(job.manuscript_id),
          artifactType: routingManifestType,
          content: routingManifestContent,
          sourceHash: routingManifestHash,
          artifactVersion: routingManifestType,
        });
        console.log(`[phase_1a] ${jobId}: routing manifest persisted (${totalChunks} chunks)`);

        // ── 2. Load pass1a chunk cache ────────────────────────────────────
        const pass1aSourceHash = createHash('sha256')
          .update(`${String(job.id)}:${String(job.manuscript_id)}:${totalChunks}`)
          .digest('hex');

        const pass1aCacheMap = new Map<number, Pass1aChunkOutput>();
        let pass1aCacheHashMismatchDetected = false;

        try {
          const { data: pass1aCacheRow } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', String(job.id))
            .eq('artifact_type', 'pass1a_chunk_cache_v1')
            .maybeSingle();

          const existingCache = pass1aCacheRow?.content as Pass1aChunkCacheArtifact | null | undefined;
          if (existingCache && existingCache.source_hash === pass1aSourceHash) {
            for (const [k, v] of Object.entries(existingCache.chunks ?? {})) {
              pass1aCacheMap.set(Number(k), v.result);
            }
            console.log(`[phase_1a] ${jobId}: cache loaded — ${pass1aCacheMap.size}/${totalChunks} chunks already done`);
          } else if (existingCache) {
            pass1aCacheHashMismatchDetected = true;
            console.log(`[phase_1a] ${jobId}: stale cache (hash mismatch) — starting fresh`);
          }
        } catch (cacheReadErr) {
          console.warn(`[phase_1a] ${jobId}: cache read failed (non-fatal, will run fresh)`,
            cacheReadErr instanceof Error ? cacheReadErr.message : String(cacheReadErr));
        }

        // Guardrail: if cache is empty but progress carries terminal/review fields
        // (or cache hash mismatched), scrub stale state before continuing so
        // a fresh evaluation cannot inherit stale diagnostics/blocks.
        const preSanitizeBatchState =
          progressState.phase1a_batch_state && typeof progressState.phase1a_batch_state === 'object'
            ? (progressState.phase1a_batch_state as Record<string, unknown>)
            : {};
        const staleProgressCarryoverDetected =
          pass1aCacheHashMismatchDetected || (
            pass1aCacheMap.size === 0 && (
              (typeof preSanitizeBatchState.chunks_completed === 'number' && preSanitizeBatchState.chunks_completed > 0)
              || (Array.isArray(preSanitizeBatchState.completed_chunk_indexes) && preSanitizeBatchState.completed_chunk_indexes.length > 0)
              || (typeof preSanitizeBatchState.preflight_status === 'string' && preSanitizeBatchState.preflight_status !== 'NOT_STARTED')
              || typeof progressState.pass3a_status === 'string'
              || typeof progressState.block_code === 'string'
              || typeof progressState.gate_ready_status === 'string'
              || progressState.review_gate_ready === false
              || progressState.review_gate_block_terminal === true
            )
          );

        if (staleProgressCarryoverDetected) {
          const {
            phase1a_batch_state: _dropPhase1aBatchState,
            track_c_status: _dropTrackCStatus,
            pass3a_status: _dropPass3aStatus,
            pass3a_gate_validity: _dropPass3aGateValidity,
            pass3a_artifact_id: _dropPass3aArtifactId,
            pass3a_completed_at: _dropPass3aCompletedAt,
            pass3a_degraded_reason: _dropPass3aDegradedReason,
            degraded_reason: _dropDegradedReason,
            degraded_reason_codes: _dropDegradedReasonCodes,
            degraded_at: _dropDegradedAt,
            failed_reason: _dropFailedReason,
            failed_reason_detail: _dropFailedReasonDetail,
            failed_at: _dropFailedAt,
            gate_ready_status: _dropGateReadyStatus,
            review_gate_ready: _dropReviewGateReady,
            block_code: _dropBlockCode,
            block_reason: _dropBlockReason,
            story_layer_artifact_id: _dropStoryLayerArtifactId,
            quality_report_artifact_id: _dropQualityReportArtifactId,
            review_gate_block_terminal: _dropReviewGateBlockTerminal,
            ...progressWithoutStalePhase1aFields
          } = progressState;

          const staleResetAt = new Date().toISOString();
          const staleResetProgress = {
            ...progressWithoutStalePhase1aFields,
            phase: 'phase_1a',
            phase_status: 'running',
            message: 'Analyzing writing',
            phase_log: [
              ...((Array.isArray(progressWithoutStalePhase1aFields.phase_log)
                ? progressWithoutStalePhase1aFields.phase_log
                : []) as unknown[]),
              {
                at: staleResetAt,
                event: 'phase1a_stale_state_reset',
                stage: 'phase_1a',
                reason: pass1aCacheHashMismatchDetected
                  ? 'cache_hash_mismatch'
                  : 'empty_cache_with_stale_terminal_metadata',
              },
            ],
          };

          progressState = staleResetProgress;

          await supabase
            .from('evaluation_jobs')
            .update({
              worker_pulse_at: staleResetAt,
              updated_at: staleResetAt,
              progress: staleResetProgress,
            })
            .eq('id', jobId)
            .eq('status', JOB_STATUS.RUNNING);

          console.warn(
            `[phase_1a] ${jobId}: stale phase state scrubbed before processing (cache_size=${pass1aCacheMap.size}, hash_mismatch=${pass1aCacheHashMismatchDetected})`,
          );
        }

        // ── 3. Build batch state from progress JSONB ──────────────────────
        const existingBatchState = progressState.phase1a_batch_state as Record<string, unknown> | undefined;

        // Cursor = next chunk index to process. Derived from cache (source of
        // truth) rather than stored cursor to handle cache-ahead-of-cursor edge cases.
        const completedIndexes = new Set<number>(pass1aCacheMap.keys());
        const allChunkIndexes = Array.isArray(allChunks)
          ? allChunks.map(c => c.chunk_index ?? 0)
          : [0];
        const pendingIndexes = allChunkIndexes.filter(i => !completedIndexes.has(i));

        const batchIndex = (existingBatchState?.batch_index as number | undefined) ?? 0;
        const batchesTotal = Math.ceil(totalChunks / phase1aConfig.batchSize);

        console.log(`[phase_1a] ${jobId}: batch state — completed=${completedIndexes.size}/${totalChunks} pending=${pendingIndexes.length} batchIndex=${batchIndex}`);

        // Stabilization pause after cache load — let DB writes settle before starting batch work.
        await stabilize();

        // ── BUDGET TIMER RESET ─────────────────────────────────────────────
        // Seed generation, ledger creation, cache load, and stabilization
        // delays happen before any chunk work. Reset the budget timer here
        // so the full invocationBudgetMs (240s) is available for batch
        // processing. Without this reset, LLM-heavy setup (4+ min for
        // ledger generation) consumes the budget and causes the worker to
        // self-chain without processing a single chunk.
        const setupDurationMs = Date.now() - phase1aInvocationEntryMs;
        phase1aInvocationStartMs = Date.now();
        console.log(`[phase_1a] ${jobId}: budget timer reset after setup (setup took ${setupDurationMs}ms, budget=${phase1aConfig.invocationBudgetMs}ms now starts fresh)`);

        // ── 4. Determine what this invocation should do ───────────────────
        const allChunksDone = pendingIndexes.length === 0;
        const preflightStatus = (existingBatchState?.preflight_status as string | undefined) ?? 'NOT_STARTED';
        const ledgerAssemblyStatus = (existingBatchState?.ledger_assembly_status as string | undefined) ?? 'NOT_STARTED';

        // ── Durable Track B + Track C lanes ─────────────────────────────
        // Track B (Phase 1A): chunk batching → ledger → Story Layer
        // Track C (Pass 3A):  MAP chunks → REDUCE → pass3_preflight_draft_v1
        //
        // Both lanes advance independently within each Phase 1A invocation.
        // All progress is persisted through JSONB state and artifacts before
        // any self-chain or return. No correctness depends on an unawaited
        // background promise surviving a self-chain boundary.
        //
        // Invocation flow:
        //   1. Load Track B + Track C state from progress
        //   2. Do bounded Track B work if Track B is not done
        //   3. Do bounded Track C work if Track C is not terminal AND budget remains
        //   4. If either lane still has work → self-chain with both states persisted
        //   5. If both lanes are terminal → assemble Story Layer / Review Gate handoff

        // Normalize Track C (preflight) status for durable lane logic.
        let normalizedPreflightStatus =
          preflightStatus === 'RUNNING' ? 'IN_PROGRESS'
          : preflightStatus === 'COMPLETE' ? 'DONE'
          : preflightStatus;

        const trackBDone = allChunksDone;
        // DONE and DEGRADED are both terminal — degraded = gate-valid.
        const trackCTerminal =
          normalizedPreflightStatus === 'DONE' ||
          normalizedPreflightStatus === 'DEGRADED';

        if (!trackBDone) {
          // ── CHUNK BATCH EXECUTION PATH ──────────────────────────────────
          // Select next safe chunk slice — respect invocation budget.
          const budgetMs = phase1aConfig.invocationBudgetMs;
          const safetyMarginMs = phase1aConfig.safetyMarginMs;

          // Select next N pending chunks up to batchSize.
          const batchSliceIndexes = pendingIndexes.slice(0, phase1aConfig.batchSize);
          const batchChunks = Array.isArray(allChunks)
            ? allChunks.filter(c => batchSliceIndexes.includes(c.chunk_index ?? 0))
            : [{ chunk_index: 0, content: manuscriptWithContent.content || '' }];

          const batchStartedAt = new Date().toISOString();
          const batchStartMs = Date.now();

          // Append phase_log: batch started
          const batchStartedLogEntry = {
            at: batchStartedAt,
            event: 'phase1a_batch_started',
            stage: 'phase_1a',
            batch_index: batchIndex,
            chunks_in_batch: batchChunks.length,
            chunks_completed_so_far: completedIndexes.size,
            chunks_remaining: pendingIndexes.length,
            total_chunks: totalChunks,
            worker_id: job.claimed_by ?? 'unknown',
            deploy_sha: DEPLOYED_SHA,
          };
          // Derive progress from persisted chunk count (the "piggy bank") so
          // watchdog-reclaimed workers resume where the last worker left off
          // instead of resetting the progress bar backward.
          const resumeChunkFraction = totalChunks > 0 ? completedIndexes.size / totalChunks : 0;
          const resumeProgressUnits = Math.max(10, Math.round(10 + resumeChunkFraction * 30));
          await markRunning('Analyzing writing', resumeProgressUnits, 'phase_1a');

          console.log(`[phase_1a] ${jobId}: batch ${batchIndex + 1}/${batchesTotal} — processing chunks [${batchSliceIndexes.join(',')}] budget=${budgetMs}ms`);

          // onChunkComplete: persist cache entry + pulse after each chunk.
          const onPass1aChunkComplete = async (
            chunkIndex: number,
            result: Pass1aChunkOutput,
          ): Promise<void> => {
            pass1aCacheMap.set(chunkIndex, result);
            const cacheArtifact: Pass1aChunkCacheArtifact = {
              job_id: String(job.id),
              source_hash: pass1aSourceHash,
              chunks: Object.fromEntries(
                [...pass1aCacheMap.entries()].map(([i, r]) => [
                  i,
                  { chunk_index: i, result: r, completed_at: new Date().toISOString() },
                ]),
              ),
              total_expected: totalChunks,
              cached_at: new Date().toISOString(),
            };
            await upsertEvaluationArtifact({
              supabase,
              jobId: String(job.id),
              manuscriptId: Number(job.manuscript_id),
              artifactType: 'pass1a_chunk_cache_v1',
              content: cacheArtifact,
              sourceHash: pass1aSourceHash,
              artifactVersion: 'pass1a_chunk_cache_v1',
            });
            // Pulse after each chunk — confirms real work to watchdog.
            const pulseNow = new Date().toISOString();
            void supabase
              .from('evaluation_jobs')
              .update({ worker_pulse_at: pulseNow, updated_at: pulseNow })
              .eq('id', String(job.id))
              .eq('status', JOB_STATUS.RUNNING)
              .then(({ error }: { error: unknown }) => {
                if (error) console.warn(`[phase_1a] worker_pulse_at stamp failed chunk=${chunkIndex}`, error);
                else console.log(`[phase_1a] worker_pulse_at stamped chunk=${chunkIndex} at=${pulseNow}`);
              });
          };

          // Budget check before running: bail if insufficient time.
          const elapsedBeforeBatch = Date.now() - phase1aInvocationStartMs;
          const remainingBudgetMs = budgetMs - elapsedBeforeBatch;
          if (remainingBudgetMs < safetyMarginMs) {
            // Not enough time — self-chain immediately without processing.
            console.warn(`[phase_1a] ${jobId}: budget exhausted before batch start (remaining=${remainingBudgetMs}ms < margin=${safetyMarginMs}ms) — self-chaining`);
          } else {
            // ── PARALLEL EXECUTION: Track B (batch) + Track C (preflight) ──
            // On the first batch (batchIndex === 0) and when Track C hasn't
            // started yet, fire Pass 3A concurrently with the chunk batch.
            // This eliminates the sequential bottleneck where Track C could
            // only start after batch completion (which always exceeded budget).
            const shouldFireTrackCParallel =
              batchIndex === 0 &&
              normalizedPreflightStatus !== 'DONE' &&
              normalizedPreflightStatus !== 'DEGRADED' &&
              normalizedPreflightStatus !== 'IN_PROGRESS';

            const trackCParallelPromise = shouldFireTrackCParallel
              ? (async () => {
                  const tcStart = new Date().toISOString();
                  console.log(`[track_c] ${jobId}: starting Pass 3A in PARALLEL with batch 0`);
                  const existingLog = (progressState.phase_log as unknown[]) ?? [];
                  void supabase
                    .from('evaluation_jobs')
                    .update({
                      progress: {
                        ...progressState,
                        track_c_status: 'running',
                        phase_log: [
                          ...existingLog,
                          { at: tcStart, event: 'track_c_started', stage: 'pass_3a', parallel_with_batch: true },
                        ],
                      },
                    })
                    .eq('id', jobId)
                    .eq('status', JOB_STATUS.RUNNING);
                  return runPass3Preflight({
                    manuscriptChunks: Array.isArray(allChunks) ? allChunks : [],
                    title: manuscriptWithContent.title,
                    workType: effectiveWorkType,
                    jobId: String(job.id),
                    manuscriptId: Number(job.manuscript_id),
                    openaiApiKey,
                    supabase,
                    _chunkConcurrency: phase1aConfig.preflightConcurrency,
                    _onChunkHeartbeat: () => pulseWorker('phase1a/track-c-parallel'),
                  });
                })()
              : null;

            // Run the bounded chunk batch (Track B).
            const pass1aBatchResult = await runPass1a({
              manuscriptText: manuscriptWithContent.content || '',
              manuscriptChunks: batchChunks,
              workType: effectiveWorkType,
              title: manuscriptWithContent.title,
              seedContextBlock: phase1aSeedContextBlock,
              ledgerContextBlock: phase1aLedgerContextBlock || undefined,
              openaiApiKey,
              jobId: String(job.id),
              _chunkCache: pass1aCacheMap,
              _onChunkComplete: onPass1aChunkComplete,
            });

            const batchDurationMs = Date.now() - batchStartMs;

            console.log(`[phase_1a] ${jobId}: batch ${batchIndex + 1} complete in ${batchDurationMs}ms — success=${pass1aBatchResult.successful_chunks} failed=${pass1aBatchResult.failedChunkIndices.length}`);

            // Stabilization pause after batch — let cache + pulse writes settle.
            await stabilize();

            if (pass1aBatchResult.successful_chunks === 0 && pass1aBatchResult.total_chunks > 0) {
              // All chunks in this batch failed — this is a real failure, not self-chain.
              const firstErr = pass1aBatchResult.failedChunkErrors[0]?.error ?? 'unknown_error';
              throw new Error(`Phase 1A batch ${batchIndex + 1}: all ${batchChunks.length} chunks failed. First error: ${firstErr}`);
            }

            // If Track C was fired in parallel, settle it now (non-blocking on batch).
            if (trackCParallelPromise) {
              try {
                const trackCResult = await Promise.race([
                  trackCParallelPromise,
                  new Promise<{ __trackCTimedOut: true }>(r =>
                    setTimeout(() => r({ __trackCTimedOut: true }), 120_000),
                  ),
                ]);
                if (trackCResult && '__trackCTimedOut' in trackCResult) {
                  normalizedPreflightStatus = 'SELF_CHAINED';
                  console.log(`[track_c] ${jobId}: parallel Pass 3A timed out (120s) — will resume on next invocation`);
                } else {
                  const tcr = trackCResult as Awaited<ReturnType<typeof runPass3Preflight>>;
                  const reducerFailed = tcr.preflight.reducer_status === 'failed' || tcr.preflight.preflight_authority === 'unavailable';
                  normalizedPreflightStatus = reducerFailed ? 'DEGRADED' : 'DONE';
                  const tcCompletedAt = new Date().toISOString();
                  console.log(`[track_c] ${jobId}: parallel Pass 3A completed — authority=${tcr.preflight.preflight_authority}, duration=${tcr.durationMs}ms`);
                  await supabase
                    .from('evaluation_jobs')
                    .update({
                      worker_pulse_at: tcCompletedAt,
                      progress: {
                        ...progressState,
                        track_c_status: reducerFailed ? 'degraded' : 'done',
                        pass3a_status: reducerFailed ? 'failed' : 'done',
                        pass3a_completed_at: tcCompletedAt,
                        pass3a_artifact_id: tcr.artifactId,
                        phase1a_batch_state: {
                          ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                          preflight_status: reducerFailed ? 'FAILED' : 'DONE',
                        },
                        phase_log: [
                          ...((progressState.phase_log as unknown[]) ?? []),
                          {
                            at: tcCompletedAt,
                            event: reducerFailed ? 'track_c_reducer_failed' : 'track_c_completed',
                            stage: 'pass_3a',
                            duration_ms: tcr.durationMs,
                            parallel: true,
                          },
                        ],
                      },
                    })
                    .eq('id', jobId)
                    .eq('status', JOB_STATUS.RUNNING);
                }
              } catch (tcErr) {
                normalizedPreflightStatus = 'DEGRADED';
                console.warn(`[track_c] ${jobId}: parallel Pass 3A failed (non-fatal):`, tcErr instanceof Error ? tcErr.message : String(tcErr));
              }
            }
          }

          // Recompute pending after batch.
          const completedAfterBatch = new Set<number>(pass1aCacheMap.keys());
          const pendingAfterBatch = allChunkIndexes.filter(i => !completedAfterBatch.has(i));
          const batchCompletedAt = new Date().toISOString();

          // Update phase1a_batch_state in progress.
          const updatedBatchState = {
            batch_index: batchIndex + 1,
            batches_total: batchesTotal,
            batch_size: phase1aConfig.batchSize,
            concurrency: phase1aConfig.concurrency,
            invocation_budget_ms: phase1aConfig.invocationBudgetMs,
            safety_margin_ms: phase1aConfig.safetyMarginMs,
            total_chunks: totalChunks,
            completed_chunk_indexes: [...completedAfterBatch],
            pending_chunk_indexes: pendingAfterBatch,
            chunks_completed: completedAfterBatch.size,
            chunks_remaining: pendingAfterBatch.length,
            last_batch_started_at: batchStartedAt,
            last_batch_completed_at: batchCompletedAt,
            last_worker_id: job.claimed_by ?? 'unknown',
            last_deploy_sha: DEPLOYED_SHA,
            preflight_status: preflightStatus,
            ledger_assembly_status: ledgerAssemblyStatus,
          };

          const batchCompletedLogEntry = {
            at: batchCompletedAt,
            event: 'phase1a_batch_completed',
            stage: 'phase_1a',
            batch_index: batchIndex,
            chunks_completed: completedAfterBatch.size,
            chunks_remaining: pendingAfterBatch.length,
            total_chunks: totalChunks,
          };

          if (pendingAfterBatch.length > 0) {
            // ── Track B has remaining chunks. ────────────────────────────
            // Before self-chaining, attempt bounded Track C work if budget
            // allows and Track C is not already terminal. This way both
            // lanes advance within a single invocation without requiring
            // background promises.
            let trackCStatusAfterBatch = normalizedPreflightStatus;

            // Budget calculation: use the actual Vercel maxDuration (800s) as
            // the effective ceiling, not just the invocationBudgetMs (which is
            // a soft self-chain hint). Track C should run if there's real time
            // remaining under the hard ceiling — not just leftover batch budget.
            const elapsedAfterBatchMs = Date.now() - phase1aInvocationStartMs;
            const softRemainingMs = phase1aConfig.invocationBudgetMs - phase1aConfig.safetyMarginMs - elapsedAfterBatchMs;
            // Hard ceiling: 800s maxDuration minus safety margin. Track C can use
            // up to 120s (preflight map+reduce for large manuscripts).
            const HARD_CEILING_MS = 780_000; // 800s - 20s safety
            const hardRemainingMs = HARD_CEILING_MS - elapsedAfterBatchMs;
            // Use the more generous of: soft remaining budget OR hard remaining budget.
            // This ensures Track C fires even when the soft budget is exhausted,
            // as long as the Vercel function still has real time remaining.
            const remainingAfterBatchMs = Math.max(softRemainingMs, Math.min(hardRemainingMs, 120_000));

            if (trackCStatusAfterBatch !== 'DONE' && trackCStatusAfterBatch !== 'DEGRADED' && remainingAfterBatchMs > 15_000) {
              // Enough budget remains — run Track C (Pass 3A) as awaited call.
              console.log(`[track_c] ${jobId}: running bounded Track C within chunk-batch invocation (budget=${remainingAfterBatchMs}ms)`);
              const trackCStartAt = new Date().toISOString();
              await supabase
                .from('evaluation_jobs')
                .update({
                  worker_pulse_at: trackCStartAt,
                  progress: {
                    ...progressState,
                    track_c_status: 'running',
                    phase1a_batch_state: {
                      ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                      preflight_status: 'IN_PROGRESS',
                    },
                    phase_log: [
                      ...((progressState.phase_log as unknown[]) ?? []),
                      batchStartedLogEntry,
                      batchCompletedLogEntry,
                      { at: trackCStartAt, event: 'track_c_started', stage: 'pass_3a', budget_remaining_ms: remainingAfterBatchMs },
                    ],
                  },
                })
                .eq('id', jobId)
                .eq('status', JOB_STATUS.RUNNING);

              // Race Pass 3A against remaining budget.
              //
              // Promise.race note: if the timeout wins, the underlying
              // runPass3Preflight promise is NOT cancelled (JS has no native
              // cancellation). However this is safe because:
              //   1. runPass3Preflight writes to artifacts (pass3_preflight_draft_v1)
              //      which are keyed by jobId — idempotent overwrites.
              //   2. The next invocation re-runs preflight from scratch (inputs
              //      are durable manuscripts chunks), so a late write from the
              //      timed-out promise is harmlessly overwritten.
              //   3. The self-chain write below releases the lease and persists
              //      track_c_status='running', so the next invocation won't
              //      treat the job as Track C terminal.
              type TrackCTimeoutSentinel = { __trackCTimedOut: true };
              const trackCTimeout = new Promise<TrackCTimeoutSentinel>(r =>
                setTimeout(() => r({ __trackCTimedOut: true }), Math.max(1_000, remainingAfterBatchMs)),
              );
              try {
                const raceResult = await Promise.race([
                  runPass3Preflight({
                    manuscriptChunks: Array.isArray(allChunks) ? allChunks : [],
                    title: manuscriptWithContent.title,
                    workType: effectiveWorkType,
                    jobId: String(job.id),
                    manuscriptId: Number(job.manuscript_id),
                    openaiApiKey,
                    supabase,
                    _chunkConcurrency: phase1aConfig.preflightConcurrency,
                    _onChunkHeartbeat: () => pulseWorker('phase1a/track-c-race'),
                  }),
                  trackCTimeout,
                ]);

                const isTimeout = raceResult && typeof raceResult === 'object' && '__trackCTimedOut' in raceResult;
                if (isTimeout) {
                  trackCStatusAfterBatch = 'SELF_CHAINED';
                  console.log(`[track_c] ${jobId}: Pass 3A budget expired during chunk-batch invocation — will resume on next invocation`);
                } else {
                  const trackCResult = raceResult as Awaited<ReturnType<typeof runPass3Preflight>>;
                  const trackCReducerFailed =
                    trackCResult.preflight.reducer_status === 'failed' ||
                    trackCResult.preflight.preflight_authority === 'unavailable';
                  trackCStatusAfterBatch = trackCReducerFailed ? 'DEGRADED' : 'DONE';
                  const completedAt = new Date().toISOString();
                  console.log(`[track_c] ${jobId}: Pass 3A completed during chunk-batch invocation`, {
                    authority: trackCResult.preflight.preflight_authority,
                    reducer_status: trackCResult.preflight.reducer_status ?? 'legacy',
                    duration_ms: trackCResult.durationMs,
                  });
                  await supabase
                    .from('evaluation_jobs')
                    .update({
                      worker_pulse_at: completedAt,
                      progress: {
                        ...progressState,
                        track_c_status: trackCReducerFailed ? 'degraded' : 'done',
                        pass3a_status: trackCReducerFailed ? 'failed' : 'done',
                        pass3a_completed_at: completedAt,
                        pass3a_artifact_id: trackCResult.artifactId,
                        failed_reason: trackCReducerFailed ? 'PASS3A_REDUCER_FAILED' : undefined,
                        failed_reason_detail: trackCReducerFailed
                          ? (trackCResult.preflight.reducer_failure_reason ?? 'Reducer produced unavailable authority.')
                          : undefined,
                        failed_at: trackCReducerFailed ? completedAt : undefined,
                        phase1a_batch_state: {
                          ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                          preflight_status: trackCReducerFailed ? 'FAILED' : 'DONE',
                        },
                        phase_log: [
                          ...((progressState.phase_log as unknown[]) ?? []),
                          {
                            at: completedAt,
                            event: trackCReducerFailed ? 'track_c_reducer_failed' : 'track_c_completed',
                            stage: 'pass_3a',
                            duration_ms: trackCResult.durationMs,
                            reducer_failure_reason: trackCReducerFailed
                              ? (trackCResult.preflight.reducer_failure_reason ?? 'unknown')
                              : undefined,
                          },
                        ],
                      },
                    })
                    .eq('id', jobId)
                    .eq('status', JOB_STATUS.RUNNING);
                }
              } catch (err) {
                // Pass 3A error (non-fatal) — mark degraded so we don't retry forever.
                trackCStatusAfterBatch = 'DEGRADED';
                const degradedAt = new Date().toISOString();
                const degradedReason = err instanceof Error ? err.message : String(err);
                console.warn(`[track_c] ${jobId}: Pass 3A failed (non-fatal) — marking degraded:`, degradedReason);
                await supabase
                  .from('evaluation_jobs')
                  .update({
                    progress: {
                      ...progressState,
                      track_c_status: 'degraded',
                      pass3a_status: 'degraded',
                      degraded_reason: degradedReason,
                      degraded_reason_codes: ['TRACK_C_ERROR_DURING_BATCH'],
                      degraded_at: degradedAt,
                      phase1a_batch_state: {
                        ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                        preflight_status: 'DEGRADED',
                        preflight_degraded: true,
                        degraded_reason: degradedReason,
                        degraded_reason_codes: ['TRACK_C_ERROR_DURING_BATCH'],
                        degraded_at: degradedAt,
                      },
                    },
                  })
                  .eq('id', jobId)
                  .eq('status', JOB_STATUS.RUNNING);
              }
            }

            // ── SELF-CHAIN: more chunks remain ──────────────────────────
            // Intentional continuation — NOT a failure.
            // Re-queue phase_1a, release lease, kick next worker.
            // DO NOT increment attempt_count.
            const selfChainAt = new Date().toISOString();
            const selfChainLogEntry = {
              at: selfChainAt,
              event: 'phase1a_self_chain_queued',
              stage: 'phase_1a',
              next_batch_index: batchIndex + 1,
              chunks_remaining: pendingAfterBatch.length,
              chunks_completed: completedAfterBatch.size,
              total_chunks: totalChunks,
              track_c_status: trackCStatusAfterBatch,
            };

            // Build self-chain progress from the LATEST Track C state.
            // If Track C degraded or completed during this invocation, the
            // self-chain write must preserve that state — not rebuild from
            // stale progressState.
            const trackCStatusForSelfChain =
              trackCStatusAfterBatch === 'DONE' ? 'done'
              : trackCStatusAfterBatch === 'DEGRADED' ? 'degraded'
              : trackCStatusAfterBatch === 'SELF_CHAINED' ? 'running'
              : 'running';

            // Merge latest Track C batch state fields (degraded proof, etc.)
            // on top of updatedBatchState so self-chain doesn't lose them.
            const latestTrackCBatchFields: Record<string, unknown> = {
              preflight_status: trackCStatusAfterBatch,
            };
            if (trackCStatusAfterBatch === 'DEGRADED') {
              // Preserve structured degraded proof through self-chain.
              const batchState = (progressState.phase1a_batch_state as Record<string, unknown>) ?? {};
              latestTrackCBatchFields.preflight_degraded = true;
              latestTrackCBatchFields.degraded_reason = batchState.degraded_reason ?? 'Track C failed during chunk-batch invocation';
              latestTrackCBatchFields.degraded_reason_codes = batchState.degraded_reason_codes ?? ['TRACK_C_ERROR_DURING_BATCH'];
              latestTrackCBatchFields.degraded_at = batchState.degraded_at ?? new Date().toISOString();
            }

            // Preserve pass3a gate fields through self-chain when Track C
            // completed or degraded during this invocation.
            const pass3aSelfChainFields: Record<string, unknown> = {};
            if (trackCStatusAfterBatch === 'DONE') {
              pass3aSelfChainFields.pass3a_status = 'done';
              pass3aSelfChainFields.pass3a_completed_at = new Date().toISOString();
              pass3aSelfChainFields.pass3a_artifact_id = (progressState as Record<string, unknown>).pass3a_artifact_id ?? undefined;
            } else if (trackCStatusAfterBatch === 'DEGRADED') {
              pass3aSelfChainFields.pass3a_status = 'degraded';
              const batchStateForDegraded = (progressState.phase1a_batch_state as Record<string, unknown>) ?? {};
              pass3aSelfChainFields.degraded_reason = batchStateForDegraded.degraded_reason ?? 'Track C failed during chunk-batch invocation';
              pass3aSelfChainFields.degraded_reason_codes = batchStateForDegraded.degraded_reason_codes ?? ['TRACK_C_ERROR_DURING_BATCH'];
              pass3aSelfChainFields.degraded_at = batchStateForDegraded.degraded_at ?? new Date().toISOString();
            }

            // Progress bar: scale Phase 1A chunk progress to 10–40% band.
            // totalChunks adapts to manuscript length automatically.
            const chunkFraction = totalChunks > 0 ? completedAfterBatch.size / totalChunks : 0;
            const selfChainProgressPercent = Math.round(10 + chunkFraction * 30);

            const updatedProgress = {
              ...progressState,
              phase: 'phase_1a',
              phase_status: 'queued',
              message: `Analyzing writing (${completedAfterBatch.size}/${totalChunks} sections)`,
              total_units: 100,
              completed_units: selfChainProgressPercent,
              track_c_status: trackCStatusForSelfChain,
              ...pass3aSelfChainFields,
              phase1a_batch_state: { ...updatedBatchState, ...latestTrackCBatchFields },
              phase_log: [
                ...((progressState.phase_log as unknown[]) ?? []),
                batchStartedLogEntry,
                batchCompletedLogEntry,
                selfChainLogEntry,
              ],
            };

            const { error: selfChainErr } = await supabase
              .from('evaluation_jobs')
              .update({
                status: JOB_STATUS.QUEUED,
                phase: PHASES.PHASE_1A,
                phase_status: JOB_STATUS.QUEUED,
                claimed_by: null,
                lease_token: null,
                lease_until: null,
                worker_pulse_at: null,
                updated_at: selfChainAt,
                progress: updatedProgress,
              })
              .eq('id', jobId)
              .eq('status', JOB_STATUS.RUNNING);

            if (selfChainErr) {
              throw new Error(`Phase 1A self-chain re-queue failed: ${selfChainErr.message}`);
            }

            console.log(`[phase_1a] ${jobId}: self-chained — batch ${batchIndex + 1}/${batchesTotal} done, ${pendingAfterBatch.length} chunks remain, track_c=${trackCStatusAfterBatch}`);

            // Stabilization pause before kicking next worker.
            await stabilize(STABILIZE_SELF_CHAIN_MS);
            await kickPhase1aWorker();

            clearInterval(leaseRenewalLoopP1a);
            return { success: true };
          }

          // All chunks are done after this batch — Track B complete.
          console.log(`[phase_1a] ${jobId}: all ${totalChunks} chunks cached (Track B complete)`);

          // Persist final Track B batch state.
          const trackBCompletedAt = new Date().toISOString();
          await supabase
            .from('evaluation_jobs')
            .update({
              worker_pulse_at: trackBCompletedAt,
              progress: {
                ...progressState,
                track_b_status: 'done',
                phase1a_batch_state: { ...updatedBatchState },
                phase_log: [
                  ...((progressState.phase_log as unknown[]) ?? []),
                  batchStartedLogEntry,
                  batchCompletedLogEntry,
                  { at: trackBCompletedAt, event: 'track_b_complete', stage: 'phase_1a', total_chunks: totalChunks },
                ],
              },
            })
            .eq('id', jobId)
            .eq('status', JOB_STATUS.RUNNING);
        }

        // ── 5. Track C (Pass 3A) — durable lane ─────────────────────────
        // Track C state is derived from persisted progress.phase1a_batch_state.
        // Both inputs to runPass3Preflight are durable committed artifacts
        // (manuscript chunks + Phase 0 calibration), so re-running from
        // scratch is always safe.
        //
        // States: NOT_STARTED → IN_PROGRESS → DONE (happy path)
        //         IN_PROGRESS (stale/crashed) → re-run
        //         SELF_CHAINED (budget expired prior invocation) → re-run
        //         DONE → skip
        //         DEGRADED → skip (gate-valid, partial coverage)
        let pass3aResult: Awaited<ReturnType<typeof runPass3Preflight>> | null = null;

        if (trackCTerminal) {
          console.log(`[track_c] ${jobId}: Pass 3A already terminal (${normalizedPreflightStatus}) — skipping`);
        } else {
          // IN_PROGRESS (crashed) / SELF_CHAINED / NOT_STARTED → run preflight.
          const isCrashRecovery = normalizedPreflightStatus === 'IN_PROGRESS';
          const isSelfChainResume = normalizedPreflightStatus === 'SELF_CHAINED';
          console.log(
            `[track_c] ${jobId}: running Pass 3A` +
            (isCrashRecovery ? ' (crash recovery)' : isSelfChainResume ? ' (self-chain resume)' : ' (first attempt)'),
          );

          const preflightStartAt = new Date().toISOString();

          // Persist IN_PROGRESS before starting work.
          await supabase
            .from('evaluation_jobs')
            .update({
              worker_pulse_at: preflightStartAt,
              progress: {
                ...progressState,
                track_c_status: 'running',
                phase1a_batch_state: {
                  ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                  preflight_status: 'IN_PROGRESS',
                },
                phase_log: [
                  ...((progressState.phase_log as unknown[]) ?? []),
                  {
                    at: preflightStartAt,
                    event: 'track_c_started',
                    stage: 'pass_3a',
                    crash_recovery: isCrashRecovery,
                    self_chain_resume: isSelfChainResume,
                  },
                ],
              },
            })
            .eq('id', jobId)
            .eq('status', JOB_STATUS.RUNNING);

          // Reset budget timer so Track C gets a fresh invocation window.
          // Without this, chunk processing consumes most of the 240s budget
          // and Track C repeatedly self-chains with only seconds remaining.
          phase1aInvocationStartMs = Date.now();

          // Invocation budget guard — race preflight against remaining budget.
          // Use the Vercel hard ceiling (800s maxDuration) rather than the soft
          // invocationBudgetMs (240s). Track C runs alone in this path (chunks
          // are already done) so it can safely use the full function duration.
          // The soft budget caused 109K-word manuscripts to self-chain
          // repeatedly at exactly 225s — never completing synthesis.
          //
          // Promise.race note: if the timeout wins, runPass3Preflight is NOT
          // cancelled (JS has no native cancellation). This is safe because
          // runPass3Preflight writes are keyed by jobId (idempotent), the next
          // invocation re-runs from scratch overwriting any late writes, and
          // the self-chain write persists track_c_status='running' so the next
          // invocation won't treat the job as Track C terminal.
          const TRACK_C_HARD_CEILING_MS = 780_000; // 800s maxDuration - 20s safety
          const elapsedSinceResetMs = Date.now() - phase1aInvocationStartMs;
          const preflightBudgetMs = Math.max(
            1_000,
            TRACK_C_HARD_CEILING_MS - elapsedSinceResetMs,
          );

          type PreflightTimeoutSentinel = { __preflightTimedOut: true };
          const timeoutPromise = new Promise<PreflightTimeoutSentinel>(r =>
            setTimeout(() => r({ __preflightTimedOut: true }), preflightBudgetMs),
          );

          let raceResult:
            | Awaited<ReturnType<typeof runPass3Preflight>>
            | PreflightTimeoutSentinel
            | null = null;
          let preflightThrew: unknown = null;
          try {
            raceResult = await Promise.race([
              runPass3Preflight({
                manuscriptChunks: Array.isArray(allChunks) ? allChunks : [],
                title: manuscriptWithContent.title,
                workType: effectiveWorkType,
                jobId: String(job.id),
                manuscriptId: Number(job.manuscript_id),
                openaiApiKey,
                supabase,
                _chunkConcurrency: phase1aConfig.preflightConcurrency,
                _onChunkHeartbeat: () => pulseWorker('phase1a/track-c-standalone'),
              }),
              timeoutPromise,
            ]);
          } catch (err) {
            preflightThrew = err;
          }

          const isTimeout =
            raceResult !== null &&
            typeof raceResult === 'object' &&
            (raceResult as PreflightTimeoutSentinel).__preflightTimedOut === true;

          if (isTimeout) {
            // Budget expired — self-chain (NOT a failure). Persist state
            // before returning so next invocation can resume.
            const selfChainAt = new Date().toISOString();
            const elapsedMs = Date.now() - phase1aInvocationStartMs;
            console.warn(
              `[track_c] ${jobId}: Pass 3A budget expired after ${elapsedMs}ms — self-chaining`,
            );

            const selfChainProgress = {
              ...progressState,
              phase: 'phase_1a',
              phase_status: 'queued',
              message: 'Analyzing writing (finalizing review)',
              track_c_status: 'running',
              phase1a_batch_state: {
                ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                preflight_status: 'SELF_CHAINED',
              },
              phase_log: [
                ...((progressState.phase_log as unknown[]) ?? []),
                {
                  at: selfChainAt,
                  event: 'track_c_self_chain_queued',
                  stage: 'pass_3a',
                  elapsed_ms: elapsedMs,
                  budget_ms: preflightBudgetMs,
                },
              ],
            };

            const { error: chainErr } = await supabase
              .from('evaluation_jobs')
              .update({
                status: JOB_STATUS.QUEUED,
                phase: PHASES.PHASE_1A,
                phase_status: JOB_STATUS.QUEUED,
                claimed_by: null,
                lease_token: null,
                lease_until: null,
                worker_pulse_at: null,
                updated_at: selfChainAt,
                progress: selfChainProgress,
              })
              .eq('id', jobId)
              .eq('status', JOB_STATUS.RUNNING);
            if (chainErr) {
              throw new Error(`Track C self-chain re-queue failed: ${chainErr.message}`);
            }

            console.log(`[track_c] ${jobId}: self-chained — stabilizing before next worker kick`);
            await stabilize(STABILIZE_SELF_CHAIN_MS);
            await kickPhase1aWorker();
            clearInterval(leaseRenewalLoopP1a);
            return { success: true };
          }

          if (preflightThrew) {
            // Preflight error (non-fatal) — mark degraded so we don't retry forever.
            const degradedAt = new Date().toISOString();
            const degradedReason = preflightThrew instanceof Error ? preflightThrew.message : String(preflightThrew);
            console.warn(`[track_c] ${jobId}: Pass 3A failed (non-fatal):`, degradedReason);
            pass3aResult = null;
            const pass3aDegradedProgress = {
              ...progressState,
              completed_units: 43,
              message: 'Building story analysis',
              track_c_status: 'degraded',
              pass3a_status: 'degraded',
              degraded_reason: degradedReason,
              degraded_reason_codes: ['TRACK_C_PREFLIGHT_ERROR'],
              degraded_at: degradedAt,
              phase1a_batch_state: {
                ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                preflight_status: 'DEGRADED',
                preflight_degraded: true,
                degraded_reason: degradedReason,
                degraded_reason_codes: ['TRACK_C_PREFLIGHT_ERROR'],
                degraded_at: degradedAt,
              },
            };
            await supabase
              .from('evaluation_jobs')
              .update({
                progress: pass3aDegradedProgress,
              })
              .eq('id', jobId)
              .eq('status', JOB_STATUS.RUNNING);
            Object.assign(progressState, pass3aDegradedProgress);
          } else {
            // Happy path — preflight completed within budget.
            pass3aResult = raceResult as Awaited<ReturnType<typeof runPass3Preflight>>;
            const completedAt = new Date().toISOString();
            const pass3aReducerFailed =
              pass3aResult.preflight.reducer_status === 'failed' ||
              pass3aResult.preflight.preflight_authority === 'unavailable';
            const pass3aStatus = pass3aReducerFailed ? 'failed' : 'done';
            console.log(`[track_c] ${jobId}: Pass 3A completed`, {
              authority: pass3aResult.preflight.preflight_authority,
              reducer_status: pass3aResult.preflight.reducer_status ?? 'legacy',
              coverage: `${pass3aResult.preflight.manuscript_read_status.chunks_received}/${pass3aResult.preflight.manuscript_read_status.chunks_expected}`,
              duration_ms: pass3aResult.durationMs,
            });

            // Persist DONE state before proceeding.
            const pass3aDoneProgress = {
              ...progressState,
              completed_units: 43,
              message: 'Building story analysis',
              track_c_status: pass3aReducerFailed ? 'degraded' : 'done',
              pass3a_status: pass3aStatus,
              pass3a_completed_at: completedAt,
              pass3a_artifact_id: pass3aResult.artifactId,
              failed_reason: pass3aReducerFailed ? 'PASS3A_REDUCER_FAILED' : undefined,
              failed_reason_detail: pass3aReducerFailed
                ? (pass3aResult.preflight.reducer_failure_reason ?? 'Reducer produced unavailable authority.')
                : undefined,
              failed_at: pass3aReducerFailed ? completedAt : undefined,
              phase1a_batch_state: {
                ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
                preflight_status: pass3aReducerFailed ? 'FAILED' : 'DONE',
              },
              phase_log: [
                ...((progressState.phase_log as unknown[]) ?? []),
                {
                  at: completedAt,
                  event: pass3aReducerFailed ? 'track_c_reducer_failed' : 'track_c_completed',
                  stage: 'pass_3a',
                  duration_ms: pass3aResult.durationMs,
                  reducer_failure_reason: pass3aReducerFailed
                    ? (pass3aResult.preflight.reducer_failure_reason ?? 'unknown')
                    : undefined,
                },
              ],
            };
            await supabase
              .from('evaluation_jobs')
              .update({
                worker_pulse_at: completedAt,
                progress: pass3aDoneProgress,
              })
              .eq('id', jobId)
              .eq('status', JOB_STATUS.RUNNING);
            Object.assign(progressState, pass3aDoneProgress);
          }
        }

        // ── 6. Assemble ledger + build Story Layer ────────────────────────
        // Reconstruct full chunkOutputs from the completed cache map.
        if (pass1aCacheMap.size < totalChunks) {
          // Should not happen if we passed the allChunksDone gate, but guard anyway.
          throw new Error(`Phase 1A ledger: cache has ${pass1aCacheMap.size}/${totalChunks} chunks — cannot assemble ledger`);
        }

        const expectedChunkIndexes = (Array.isArray(allChunks) ? allChunks : [])
          .map((chunk) => Number((chunk as { chunk_index?: unknown }).chunk_index))
          .filter((index) => Number.isInteger(index));
        const missingChunkIndexes = expectedChunkIndexes.filter((index) => !pass1aCacheMap.has(index));
        if (missingChunkIndexes.length > 0) {
          throw new Error(
            `Phase 1A ledger: missing ${missingChunkIndexes.length} expected chunk(s) in cache (${missingChunkIndexes.slice(0, 10).join(', ')}) — cannot assemble ledger`,
          );
        }

        // Reconcile persisted batch-state with cache truth before continuing.
        // This prevents stale progress snapshots (e.g. 10/13) from surviving
        // into failed terminal states when cache is already complete.
        const canonicalCompletedChunkIndexes = [...pass1aCacheMap.keys()].sort((a, b) => a - b);
        const canonicalPendingChunkIndexes = expectedChunkIndexes.filter((index) => !pass1aCacheMap.has(index));
        const priorBatchState =
          progressState.phase1a_batch_state && typeof progressState.phase1a_batch_state === 'object'
            ? (progressState.phase1a_batch_state as Record<string, unknown>)
            : {};
        const priorCompletedCount = Number(priorBatchState.chunks_completed ?? 0);
        const priorRemainingCount = Number(priorBatchState.chunks_remaining ?? 0);
        const batchStateWasStale =
          priorCompletedCount !== canonicalCompletedChunkIndexes.length ||
          priorRemainingCount !== canonicalPendingChunkIndexes.length;

        const reconciledBatchState: Record<string, unknown> = {
          ...priorBatchState,
          total_chunks: totalChunks,
          chunks_completed: canonicalCompletedChunkIndexes.length,
          chunks_remaining: canonicalPendingChunkIndexes.length,
          completed_chunk_indexes: canonicalCompletedChunkIndexes,
          pending_chunk_indexes: canonicalPendingChunkIndexes,
          batch_index: Math.ceil(canonicalCompletedChunkIndexes.length / Math.max(1, phase1aConfig.batchSize)),
          batches_total: Math.ceil(totalChunks / Math.max(1, phase1aConfig.batchSize)),
        };

        // Sort chunks by index to ensure consistent ledger ordering.
        const sortedChunkOutputs: Pass1aChunkOutput[] = [...pass1aCacheMap.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, output]) => output);

        // ── Two-pass seed validation: parse per-chunk seed_validation arrays ──
        const allChunkSeedValidations: SeedValidationPassAResult[] = [];
        if (seedEntityNamesForConsistency.length > 0) {
          for (const chunkOutput of sortedChunkOutputs) {
            const validation = parseSeedValidationFromChunkOutput(
              chunkOutput as unknown as Record<string, unknown>,
              seedEntityNamesForConsistency,
            );
            allChunkSeedValidations.push(validation);
          }
        }

        // ── Entity contamination filter: remove pseudo-entities BEFORE ledger assembly ──
        let totalContaminatedEntities = 0;
        const cleanedChunkOutputs: Pass1aChunkOutput[] = sortedChunkOutputs.map(chunkOutput => {
          if (!Array.isArray(chunkOutput.characters) || chunkOutput.characters.length === 0) {
            return chunkOutput;
          }
          const { clean, rejected } = filterContaminatedEntities(chunkOutput.characters);
          if (rejected.length > 0) {
            totalContaminatedEntities += rejected.length;
            console.warn(`[Processor] ${jobId}: chunk ${chunkOutput.chunk_index} — filtered ${rejected.length} contaminated entities: ${rejected.map(r => r.name).join(', ')}`);
          }
          return { ...chunkOutput, characters: clean };
        });

        // ── Seed drift detection: aggregate validation results across chunks ──
        if (allChunkSeedValidations.length > 0) {
          const driftResult = computeSeedDriftScore({
            seedEntityNames: seedEntityNamesForConsistency,
            allChunkValidations: allChunkSeedValidations,
            contaminatedCount: totalContaminatedEntities,
          });
          console.log(`[Processor] ${jobId}: seed drift analysis`, {
            drift_score: driftResult.drift_score,
            never_confirmed: driftResult.never_confirmed,
            should_requeue: driftResult.should_requeue,
          });

          if (driftResult.should_requeue) {
            console.warn(`[Processor] ${jobId}: SEED DRIFT DETECTED — ${driftResult.summary}`);
          }
        }

        if (totalContaminatedEntities > 0) {
          console.log(`[Processor] ${jobId}: entity contamination filter removed ${totalContaminatedEntities} pseudo-entities across all chunks`);
        }

        const ledgerAssemblyStartedAt = new Date().toISOString();
        await supabase
          .from('evaluation_jobs')
          .update({
            worker_pulse_at: ledgerAssemblyStartedAt,
            progress: {
              ...progressState,
              phase1a_batch_state: {
                ...reconciledBatchState,
                ledger_assembly_status: 'RUNNING',
              },
              phase_log: [
                ...((progressState.phase_log as unknown[]) ?? []),
                ...(batchStateWasStale
                  ? [{
                      at: ledgerAssemblyStartedAt,
                      event: 'phase1a_batch_state_reconciled',
                      stage: 'phase_1a',
                      chunks_completed: canonicalCompletedChunkIndexes.length,
                      chunks_remaining: canonicalPendingChunkIndexes.length,
                      total_chunks: totalChunks,
                    }]
                  : []),
                { at: ledgerAssemblyStartedAt, event: 'phase1a_ledger_assembly_started', stage: 'phase_1a' },
              ],
            },
          })
          .eq('id', jobId)
          .eq('status', JOB_STATUS.RUNNING);

        // ── Load seed story ledger for 9-layer grounding gate ──────────────
        let seedLedgerForGrounding: FullContextStoryLedger | null = null;
        try {
          const { data: seedLedgerRows } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', String(job.id))
            .eq('artifact_type', 'full_context_story_ledger_v1')
            .limit(1);
          if (seedLedgerRows && seedLedgerRows.length > 0) {
            seedLedgerForGrounding = (seedLedgerRows[0] as { content: FullContextStoryLedger }).content;
          }
        } catch (seedLoadErr) {
          console.warn(`[Processor] ${jobId}: failed to load seed ledger for grounding gate (non-fatal)`, seedLoadErr);
        }

        // Use cleaned (contamination-filtered) chunk outputs for ledger assembly
        // Pass seed ledger + manuscript text for 9-layer grounding validation
        const characterLedger: Pass1aCharacterLedger = reduceCharacterEvidence({
          chunkOutputs: cleanedChunkOutputs,
          jobId: String(job.id),
          totalChunksInManuscript: totalChunks,
          manuscriptText: manuscriptWithContent.content || undefined,
          seedLedger: seedLedgerForGrounding,
          seedEntityNames: seedEntityNamesForConsistency.length > 0 ? seedEntityNamesForConsistency : undefined,
        });

        const characterLedgerV2Phase1a: CharacterLedgerV2 = buildCharacterLedgerV2({
          ledger: characterLedger,
          chunkOutputs: cleanedChunkOutputs,
          jobId: String(job.id),
          totalChunksInManuscript: totalChunks,
        });

        console.log(`[Processor] ${jobId}: phase_1a — character ledger ready`, {
          entries: characterLedger.entries.length,
          v2_active_blockers: characterLedgerV2Phase1a.activeBlockers.length,
        });

        // ── Seed consistency check: compare extraction against seed baseline ──
        if (seedEntityNamesForConsistency.length > 0) {
          const extractedEntityNames = characterLedger.entries.map((e) => e.canonical_name);
          const seedConsistencyReport = buildSeedConsistencyReport({
            seedEntityNames: seedEntityNamesForConsistency,
            extractedEntityNames,
          });

          console.log(`[Processor] ${jobId}: seed consistency check`, {
            verdict: seedConsistencyReport.verdict,
            confirmed: seedConsistencyReport.confirmed_count,
            missed: seedConsistencyReport.missed_count,
            contaminated: seedConsistencyReport.contaminated_count,
            drift_ratio: seedConsistencyReport.drift_ratio,
          });

          // Persist seed consistency report for audit trail.
          await upsertEvaluationArtifact({
            supabase,
            jobId: String(job.id),
            manuscriptId: Number(job.manuscript_id),
            artifactType: 'seed_contradiction_report_v1' as any,
            content: seedConsistencyReport,
            sourceHash: `seed_consistency_${String(job.id)}`,
            artifactVersion: 'seed_contradiction_report_v1',
          });

          if (seedConsistencyReport.contaminated_count > 0) {
            console.warn(
              `[Processor] ${jobId}: CONTAMINATION DETECTED — ${seedConsistencyReport.contaminated_count} pseudo-entities in extraction. ` +
              `Recommendations: ${seedConsistencyReport.recommendations.join('; ')}`,
            );
          }
        }

        // Persist character ledger artifact.
        await upsertEvaluationArtifact({
          supabase,
          jobId: String(job.id),
          manuscriptId: Number(job.manuscript_id),
          artifactType: 'pass1a_character_ledger_v1',
          content: {
            job_id: String(job.id),
            manuscript_id: Number(job.manuscript_id),
            ...characterLedger,
            ledger_v2: characterLedgerV2Phase1a,
            generated_at: new Date().toISOString(),
            pipeline_stats: {
              total_chunks: totalChunks,
              successful_chunks: sortedChunkOutputs.length,
              failed_chunks: 0,
              protagonists: characterLedger.coverage_summary.protagonists,
              co_protagonists: characterLedger.coverage_summary.co_protagonists,
              symbol_items: characterLedger.coverage_summary.symbol_payoff_items.length,
              hard_fail_triggers: characterLedger.coverage_summary.hard_fail_triggers.length,
              v2_active_blockers: characterLedgerV2Phase1a.activeBlockers.length,
              v2_relationship_pairs: characterLedgerV2Phase1a.relationshipLedger.length,
              v2_objects_tracked: characterLedgerV2Phase1a.objectLedger.length,
            },
          },
          sourceHash: `pass1a_ledger_${String(job.id)}`,
          artifactVersion: 'pass1a_character_ledger_v1',
        });

        console.log(`[Processor] ${jobId}: phase_1a — ledger artifact persisted, building story layer`);

        // ── PR12: Build canonical Story Layer payload from completed ledger ──
        const storyLayerPayload = buildStoryLayerFromLedger(
          characterLedger,
          characterLedgerV2Phase1a,
          sortedChunkOutputs,
        );

        const currentBatchStateForQuality =
          progressState.phase1a_batch_state && typeof progressState.phase1a_batch_state === 'object'
            ? (progressState.phase1a_batch_state as Record<string, unknown>)
            : {};
        const reducerFailedFromProgress = progressState.pass3a_status === 'failed';
        const authorityFromPass3aResult = pass3aResult?.preflight?.preflight_authority;
        const authorityUnavailableFromBatchState =
          typeof currentBatchStateForQuality.preflight_status === 'string'
          && currentBatchStateForQuality.preflight_status.toUpperCase().trim() === 'FAILED';

        const qualityReport = buildLedgerQualityReport(
          characterLedger,
          characterLedgerV2Phase1a,
          storyLayerPayload,
          {
            chunkCoverage: {
              chunks_expected: totalChunks,
              chunks_completed: sortedChunkOutputs.length,
            },
            preflightReducer: {
              reducer_status: reducerFailedFromProgress ? 'failed' : 'ok',
              preflight_authority:
                authorityUnavailableFromBatchState
                  ? 'unavailable'
                  : (authorityFromPass3aResult === 'unavailable' ||
                     authorityFromPass3aResult === 'full' ||
                     authorityFromPass3aResult === 'reduced' ||
                     authorityFromPass3aResult === 'advisory')
                    ? authorityFromPass3aResult
                    : null,
            },
          },
        );

        console.log(`[Processor] ${jobId}: phase_1a — quality report built`, {
          gate_ready_status: qualityReport.gate_ready_status,
          hard_fail_present: qualityReport.hard_fail_present,
          blocking_reasons_count: qualityReport.blocking_reasons.length,
        });

        // ── PR12: Persist pass1a_story_layer_v1 + ledger_quality_report_v1 ─
        const phase1aMeta = {
          job_id: String(job.id),
          evaluation_project_id: (job as Record<string, unknown>).evaluation_project_id as string | null ?? null,
          manuscript_id: Number(job.manuscript_id),
          manuscript_version_hash: `manuscript_${String(job.manuscript_id)}_${String(job.id)}`,
          generated_at: new Date().toISOString(),
        };

        const storyLayerRefs = await writePhase1aReviewGateArtifacts({
          metadata: phase1aMeta,
          storyLayer: storyLayerPayload,
          qualityReport,
          writeArtifact: async (artifact) => {
            const { error: artifactWriteErr } = await supabase
              .from('evaluation_artifacts')
              .upsert(
                {
                  job_id: String(job.id),
                  manuscript_id: Number(job.manuscript_id),
                  evaluation_project_id: phase1aMeta.evaluation_project_id ?? null,
                  artifact_type: artifact.artifact_type,
                  artifact_version: artifact.artifact_version,
                  source_hash: artifact.source_hash,
                  content: artifact.content,
                  created_at: new Date().toISOString(),
                },
                { onConflict: 'job_id,artifact_type', ignoreDuplicates: false },
              );
            if (artifactWriteErr) {
              throw new Error(
                `Failed to write ${artifact.artifact_type}: ${artifactWriteErr.message}`,
              );
            }
            return { artifact_id: artifact.content.artifact_id };
          },
        });

        const storyLayerPersistedAt = new Date().toISOString();
        console.log(`[Processor] ${jobId}: phase_1a — story layer artifacts written`, {
          pass1a_story_layer_v1: storyLayerRefs.pass1a_story_layer_v1.artifact_id,
          ledger_quality_report_v1: storyLayerRefs.ledger_quality_report_v1.artifact_id,
        });

        // Progress bump: story layer assembled → move bar past the 40% plateau.
        progressState.completed_units = 47;
        progressState.message = 'Assembling story layer';
        await supabase
          .from('evaluation_jobs')
          .update({
            worker_pulse_at: storyLayerPersistedAt,
            progress: progressState,
          })
          .eq('id', jobId)
          .eq('status', JOB_STATUS.RUNNING);

        // ── Story Ledger lane map coverage warning (canon_correction_playbook_v1) ─
        // Flag only — does NOT hard-block Phase 2 in v1. The lane map (Layer 1) is
        // optional in v1; absence is logged so we can iterate prompt fidelity over
        // time. When the ledger eventually carries the extensions, the flag goes
        // away on its own.
        const storyLedgerExtensionsForWarning =
          (storyLayerPayload as { extensions?: StoryLedgerExtensions } | null | undefined)
            ?.extensions ?? null;
        const storyLedgerLaneMapWarning = shouldFlagStoryLedgerLaneMapWarning(
          storyLedgerExtensionsForWarning,
        );
        if (storyLedgerLaneMapWarning) {
          const existingMetadata =
            ((job as { metadata?: Record<string, unknown> }).metadata && typeof (job as { metadata?: Record<string, unknown> }).metadata === 'object')
              ? (job as { metadata: Record<string, unknown> }).metadata
              : {};
          (job as { metadata?: Record<string, unknown> }).metadata = {
            ...existingMetadata,
            story_ledger_lane_map_warning: true,
          };
          console.warn(
            `[Processor] ${jobId}: phase_1a — story_ledger_lane_map empty; warning flag set (canon_correction_playbook_v1).`,
          );
        }

        // ── 7. Review Gate handoff (Phase Architecture v2 helper) ─────────
        const phase1aNow = new Date().toISOString();
        const manuscriptWordCountForGate =
          typeof chunkRouting.manuscript_words === 'number' && Number.isFinite(chunkRouting.manuscript_words)
            ? chunkRouting.manuscript_words
            : countWords(manuscriptWithContent.content || '');
        const requireUserFacingReviewGate = shouldRequireStoryLedgerReviewGate(manuscriptWordCountForGate);
        const reviewGateArtifactTypes = [
          'pass1a_story_layer_v1',
          'ledger_quality_report_v1',
          'pass3_preflight_draft_v1',
        ];

        const { data: reviewGateArtifacts, error: reviewGateArtifactsErr } = await supabase
          .from('evaluation_artifacts')
          .select('artifact_type, id, content, source_hash')
          .eq('job_id', job.id)
          .in('artifact_type', reviewGateArtifactTypes);

        if (reviewGateArtifactsErr) {
          throw new Error(
            `Failed to read Review Gate handoff artifacts: ${reviewGateArtifactsErr.message}`,
          );
        }

        const phaseV2Artifacts = toPhaseV2ArtifactSet(reviewGateArtifacts);
        const phaseV2Progress = derivePhaseV2ReviewGateProgress(
          progressState,
          {
            hasPass3PreflightArtifact: Boolean(phaseV2Artifacts.pass3_preflight_draft_v1?.artifact_id),
            reducerStatus: phaseV2Artifacts.pass3_preflight_reducer_status,
            preflightAuthority: phaseV2Artifacts.pass3_preflight_authority,
          },
        );

        const reviewGateHandoffResult = buildReviewGateHandoff(
          phaseV2Progress,
          phaseV2Artifacts,
        );

        const shortFormTechnicalBlockBypass =
          !requireUserFacingReviewGate
          && reviewGateHandoffResult.ok === false
          && reviewGateHandoffResult.blocked.progress.block_code === 'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK';

        // Short-form content hard-fail bypass: for manuscripts under the
        // Review Gate word threshold, content hard-fails (ending accountability,
        // entity-typing contamination, etc.) are craft findings — not pipeline
        // blockers.  The Review Gate is a long-form governance mechanism.
        const shortFormContentBlockBypass =
          !requireUserFacingReviewGate
          && reviewGateHandoffResult.ok === false
          && !shortFormTechnicalBlockBypass;

        // Short-form policy: internal Story Layer artifacts are still generated,
        // but user-facing Review Gate approval is long-form only.
        //
        // Per architecture doctrine: "For short-form: Phase 0.5A + Phase 0.5B +
        // manuscript text + deterministic evidence validator is sufficient
        // authority to produce a scoped short-form evaluation report."
        //
        // Short-form bypasses the Review Gate regardless of block reason
        // (technical, content hard-fail, or any other).
        if (!requireUserFacingReviewGate && (reviewGateHandoffResult.ok || shortFormTechnicalBlockBypass || shortFormContentBlockBypass)) {
          const autoApprovalAt = new Date().toISOString();
          // FIX (PR #890 regression): Use shared extractStoryLayers() helper
          // that handles both the flat shape (from buildStoryLayerFromLedger())
          // and the wrapped shape (from persisted artifacts).  Previous code
          // checked for `.layers` on the flat payload which never existed →
          // persisted `layers: {}` for every short-form eval since June 1.
          const layerExtraction = extractStoryLayers(storyLayerPayload);

          if (layerExtraction.ok === false) {
            const msg =
              `QUALITY_ACCEPTED_LEDGER_EMPTY: ${layerExtraction.reason}. ` +
              `Cannot produce meaningful evaluation without story-layer context.`;
            console.error(`[phase_1a] ${jobId}: ${msg}`);
            await markFailed(msg, 'QUALITY_ACCEPTED_LEDGER_EMPTY', { pipelineStage: 'phase_1a' });
            return { success: false, error: msg };
          }

          // All 9 canonical keys are required.  If any are missing the accepted
          // ledger would be incomplete and downstream synthesis would be degraded.
          if (layerExtraction.missing_keys.length > 0) {
            const msg =
              `QUALITY_ACCEPTED_LEDGER_INCOMPLETE: ${layerExtraction.missing_keys.length}/9 canonical layer keys missing ` +
              `(${layerExtraction.missing_keys.join(', ')}). Cannot accept an incomplete story ledger.`;
            console.error(`[phase_1a] ${jobId}: ${msg}`);
            await markFailed(msg, 'QUALITY_ACCEPTED_LEDGER_INCOMPLETE', { pipelineStage: 'phase_1a' });
            return { success: false, error: msg };
          }

          const sourceLayers = layerExtraction.layers;
          const sourceLayerKeyCount = Object.keys(sourceLayers).length;
          const canonicalLayerKeyCount = STORY_LAYER_KEYS.filter(
            (k) => k in sourceLayers && sourceLayers[k] && typeof sourceLayers[k] === 'object',
          ).length;

          console.log(
            `[phase_1a] ${jobId}: short-form auto-approval — ` +
            `source_layer_count=${sourceLayerKeyCount}, canonical_layer_count=${canonicalLayerKeyCount}/9, ` +
            `extraction_shape=${layerExtraction.shape}`,
          );

          // Extract blocked progress safely — inside this branch the result may
          // be ok=true (gate passed) OR ok=false (bypass path).  Use a local
          // narrowing variable so TypeScript can discriminate.
          const blockedProgress = reviewGateHandoffResult.ok === false
            ? reviewGateHandoffResult.blocked.progress
            : undefined;

          const pass3aStatusForShortFormBypass = reviewGateHandoffResult.ok
            ? reviewGateHandoffResult.handoff.progress.pass3a_status
            : (blockedProgress?.pass3a_status ?? phaseV2Progress.pass3a_status ?? 'failed');
          const pass3aGateValidityForShortFormBypass = reviewGateHandoffResult.ok
            ? reviewGateHandoffResult.handoff.progress.pass3a_gate_validity
            : blockedProgress?.pass3a_gate_validity;
          const technicalBypassReason = shortFormTechnicalBlockBypass
            ? blockedProgress?.block_reason
            : undefined;
          const contentBlockBypassReason = shortFormContentBlockBypass
            ? (blockedProgress?.block_reason ?? 'short_form_content_hard_fail_bypassed')
            : undefined;

          const preferredLayerKeys = Object.keys(sourceLayers).filter((k) => k.trim().length > 0);
          const canonicalFallbackLayerKeys = [
            'canon_identity_core',
            'relationship_network',
            'timeline_and_causality',
            'motivation_and_goal_pressure',
            'stakes_and_threat_model',
            'symbolic_systems',
            'theme_and_argument',
            'voice_register_and_pov',
            'ending_and_accountability',
          ];
          const layerKeys = (preferredLayerKeys.length > 0 ? preferredLayerKeys : canonicalFallbackLayerKeys).slice(0, 9);

          while (layerKeys.length < 9) {
            layerKeys.push(`layer_${layerKeys.length + 1}`);
          }

          const autoLayerDecisions = Object.fromEntries(
            layerKeys.map((key) => [
              key,
              {
                status: 'accepted_without_changes',
                comment: `Auto-approved by short-form policy (< ${STORY_LEDGER_USER_GATE_MIN_WORDS} words).`,
              },
            ]),
          );

          const acceptedLedgerPayload = {
            job_id: String(job.id),
            manuscript_id: Number(job.manuscript_id),
            artifact_id: `accepted_story_ledger_v1:${randomUUID().slice(0, 16)}`,
            artifact_type: 'accepted_story_ledger_v1',
            artifact_version: 'v1',
            source_hash: createHash('sha256')
              .update(`${String(job.id)}:short_form_auto_accept:${manuscriptWordCountForGate}:${autoApprovalAt}`)
              .digest('hex'),
            generated_at: autoApprovalAt,
            layers: sourceLayers,
            layer_audit: {
              source_layer_count: sourceLayerKeyCount,
              accepted_layer_count: canonicalLayerKeyCount,
              missing_layer_keys: layerExtraction.missing_keys,
              extraction_shape: layerExtraction.shape,
            },
            governance_rail: {
              approval_state: 'accepted',
              approved_by: 'system:auto_short_form_policy',
              approved_at: autoApprovalAt,
              disposition: 'accepted_without_changes',
              author_notes: null,
              edit_requests: [],
              unresolved_warnings_preserved: true,
              dependency_warnings:
                (qualityReport as { quality_report?: { layer_dependency_warnings?: unknown } })
                  ?.quality_report?.layer_dependency_warnings ?? [],
              contested_layer_count: 0,
              layer_decisions: autoLayerDecisions,
              auto_approved_short_form: true,
              auto_approval_reason: 'short_form_under_25000_words',
              manuscript_word_count: manuscriptWordCountForGate,
            },
          };

          await upsertEvaluationArtifact({
            supabase,
            jobId: String(job.id),
            manuscriptId: Number(job.manuscript_id),
            artifactType: 'accepted_story_ledger_v1',
            content: acceptedLedgerPayload,
            sourceHash: acceptedLedgerPayload.source_hash,
            artifactVersion: 'v1',
          });

          const phase2QueueAt = new Date().toISOString();
          const phase2BypassProgress = {
            ...progressState,
            ...buildPhaseLogPatch(progressState, 'phase_1a', 'passed', phase2QueueAt),
            total_units: 100,
            completed_units: 55,
            phase: 'phase_2',
            phase_status: 'queued',
            message: shortFormTechnicalBlockBypass
              ? 'Phase 1A complete — short-form policy bypassed retryable technical Review Gate block and queued diagnosis'
              : shortFormContentBlockBypass
                ? 'Phase 1A complete — short-form policy bypassed content hard-fail Review Gate block and queued diagnosis'
                : 'Phase 1A complete — short-form policy skipped Story Ledger approval and queued diagnosis',
            phase1a_completed_at: phase2QueueAt,
            gate_ready_status: 'auto_approved_short_form',
            review_gate_ready: false,
            hard_fail_present: qualityReport.hard_fail_present,
            story_layer_artifact_id: storyLayerRefs.pass1a_story_layer_v1.artifact_id,
            quality_report_artifact_id: storyLayerRefs.ledger_quality_report_v1.artifact_id,
            pass3a_status: pass3aStatusForShortFormBypass,
            pass3a_gate_validity: pass3aGateValidityForShortFormBypass,
            pass3a_artifact_id: phaseV2Progress.pass3a_artifact_id,
            pass3a_degraded_reason: phaseV2Progress.degraded_reason,
            short_form_review_gate_bypassed: true,
            short_form_review_gate_bypass_reason: shortFormTechnicalBlockBypass
              ? 'manuscript_under_25000_words_retryable_technical_block'
              : shortFormContentBlockBypass
                ? 'manuscript_under_25000_words_content_hard_fail_bypassed'
                : 'manuscript_under_25000_words',
            short_form_technical_block_bypassed: shortFormTechnicalBlockBypass,
            short_form_technical_block_reason: technicalBypassReason,
            short_form_content_block_bypassed: shortFormContentBlockBypass,
            short_form_content_block_reason: contentBlockBypassReason,
            story_ledger_user_gate_required: false,
            story_ledger_user_gate_min_words: STORY_LEDGER_USER_GATE_MIN_WORDS,
            manuscript_word_count: manuscriptWordCountForGate,
            phase1a_batch_state: {
              ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
              ledger_assembly_status: 'COMPLETE',
              preflight_status: (shortFormTechnicalBlockBypass || shortFormContentBlockBypass)
                ? (((progressState.phase1a_batch_state as Record<string, unknown> | undefined)?.preflight_status as string | undefined) ?? 'FAILED')
                : 'DONE',
            },
            phase_log: [
              ...((progressState.phase_log as unknown[]) ?? []),
              { at: storyLayerPersistedAt, event: 'phase1a_story_layer_persisted', stage: 'phase_1a' },
              {
                at: phase2QueueAt,
                event: shortFormTechnicalBlockBypass
                  ? 'review_gate_skipped_short_form_technical_block'
                  : shortFormContentBlockBypass
                    ? 'review_gate_skipped_short_form_content_block'
                    : 'review_gate_skipped_short_form',
                stage: 'phase_1a',
                manuscript_word_count: manuscriptWordCountForGate,
                threshold_words: STORY_LEDGER_USER_GATE_MIN_WORDS,
                technical_block_code: shortFormTechnicalBlockBypass
                  ? reviewGateHandoffResult.blocked.progress.block_code
                  : undefined,
                content_block_code: shortFormContentBlockBypass
                  ? reviewGateHandoffResult.blocked.progress.block_code
                  : undefined,
              },
            ],
          };

          const { data: shortFormQueueRow, error: shortFormQueueErr } = await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.QUEUED,
              phase: PHASES.PHASE_2,
              phase_status: JOB_STATUS.QUEUED,
              claimed_by: null,
              claimed_at: null,
              lease_token: null,
              lease_until: null,
              review_gate_passed_at: phase2QueueAt,
              updated_at: phase2QueueAt,
              progress: phase2BypassProgress,
            })
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING)
            .select('id, status, phase, phase_status')
            .single();

          if (shortFormQueueErr) {
            throw new Error(`Phase 1A short-form bypass transition failed: ${shortFormQueueErr.message}`);
          }

          console.log(
            `[Processor] ${jobId}: short-form review gate skipped — queued phase_2 directly`,
            {
              manuscript_word_count: manuscriptWordCountForGate,
              threshold_words: STORY_LEDGER_USER_GATE_MIN_WORDS,
              status: shortFormQueueRow?.status,
              phase: shortFormQueueRow?.phase,
            },
          );
          return { success: true };
        }

        if (reviewGateHandoffResult.ok === false) {
          const blocked = reviewGateHandoffResult.blocked;
          const blockedNow = new Date().toISOString();
          const existingBatchState =
            progressState.phase1a_batch_state && typeof progressState.phase1a_batch_state === 'object'
              ? (progressState.phase1a_batch_state as Record<string, unknown>)
              : {};
          const requeueBlockedJob = shouldRequeueReviewGateBlock(
            blocked.progress.block_code,
            blocked.progress.pass3a_gate_validity,
          );
          const blockedProgress = {
            ...progressState,
            phase: 'phase_1a',
            phase_status: requeueBlockedJob ? JOB_STATUS.QUEUED : JOB_STATUS.FAILED,
            message: blocked.progress.message,
            phase1a_completed_at: blockedNow,
            ledger_entries: characterLedger.entries.length,
            story_layer_artifact_id: storyLayerRefs.pass1a_story_layer_v1.artifact_id,
            quality_report_artifact_id: storyLayerRefs.ledger_quality_report_v1.artifact_id,
            gate_ready_status: blocked.progress.gate_ready_status,
            review_gate_ready: false,
            block_code: blocked.progress.block_code,
            block_reason: blocked.progress.block_reason,
            pass3a_status: blocked.progress.pass3a_status,
            pass3a_gate_validity: blocked.progress.pass3a_gate_validity,
            phase1a_batch_state: {
              ...existingBatchState,
              ledger_assembly_status: 'COMPLETE',
            },
            phase_log: [
              ...((progressState.phase_log as unknown[]) ?? []),
              { at: storyLayerPersistedAt, event: 'phase1a_story_layer_persisted', stage: 'phase_1a' },
              {
                at: blockedNow,
                event: 'review_gate_blocked',
                stage: 'phase_1a',
                block_code: blocked.progress.block_code,
                block_reason: blocked.progress.block_reason,
                requeue: requeueBlockedJob,
              },
            ],
          };

          const blockedJobPatch = requeueBlockedJob
            ? {
                status: JOB_STATUS.QUEUED,
                phase: PHASES.PHASE_1A,
                phase_status: JOB_STATUS.QUEUED,
                claimed_by: null,
                claimed_at: null,
                lease_token: null,
                lease_until: null,
                updated_at: blockedNow,
                progress: blockedProgress,
              }
            : {
                status: JOB_STATUS.FAILED,
                phase: PHASES.PHASE_1A,
                phase_status: JOB_STATUS.FAILED,
                claimed_by: null,
                claimed_at: null,
                lease_token: null,
                lease_until: null,
                updated_at: blockedNow,
                last_error: `Review Gate blocked: ${blocked.progress.block_reason}`,
                failure_code: blocked.progress.block_code,
                progress: {
                  ...blockedProgress,
                  review_gate_block_terminal: true,
                },
              };

          const { error: blockedPatchErr } = await supabase
            .from('evaluation_jobs')
            .update(blockedJobPatch)
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING);

          if (blockedPatchErr) {
            throw new Error(`Review Gate block progress patch failed: ${blockedPatchErr.message}`);
          }

          console.warn(
            `[Processor] ${jobId}: review_gate handoff blocked`,
            {
              block_code: blocked.progress.block_code,
              block_reason: blocked.progress.block_reason,
              pass3a_status: blocked.progress.pass3a_status ?? null,
              pass3a_gate_validity: blocked.progress.pass3a_gate_validity,
              requeue: requeueBlockedJob,
            },
          );
          return { success: true };
        }

        const phase1aHandoffProgress = {
          ...progressState,
          ...buildPhaseLogPatch(progressState, 'phase_1a', 'passed', phase1aNow),
          total_units: 100,
          completed_units: 50,
          phase: reviewGateHandoffResult.handoff.progress.phase,
          phase_status: reviewGateHandoffResult.handoff.progress.phase_status,
          message: reviewGateHandoffResult.handoff.progress.message,
          phase1a_completed_at: phase1aNow,
          ledger_entries: characterLedger.entries.length,
          story_layer_artifact_id: storyLayerRefs.pass1a_story_layer_v1.artifact_id,
          quality_report_artifact_id: storyLayerRefs.ledger_quality_report_v1.artifact_id,
          gate_ready_status: reviewGateHandoffResult.handoff.progress.gate_ready_status,
          review_gate_ready: reviewGateHandoffResult.handoff.progress.review_gate_ready,
          hard_fail_present: qualityReport.hard_fail_present,
          pass3a_status: reviewGateHandoffResult.handoff.progress.pass3a_status,
          pass3a_gate_validity: reviewGateHandoffResult.handoff.progress.pass3a_gate_validity,
          pass3a_artifact_id: reviewGateHandoffResult.handoff.progress.pass3a_artifact_id,
          pass3a_degraded_reason: reviewGateHandoffResult.handoff.progress.pass3a_degraded_reason,
          phase1a_batch_state: {
            ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
            ledger_assembly_status: 'COMPLETE',
            preflight_status: 'DONE',
          },
          phase_log: [
            ...((progressState.phase_log as unknown[]) ?? []),
            { at: storyLayerPersistedAt, event: 'phase1a_story_layer_persisted', stage: 'phase_1a' },
            { at: phase1aNow, event: 'review_gate_opened', stage: 'phase_1a' },
          ],
        };

        // Containment mode: skip review_gate and go straight to phase_2.
        // Phase 2 has autoAcceptStoryLedgerKickForward that creates the
        // accepted_story_ledger_v1 artifact from pass1a_story_layer_v1.
        const containmentBypass = !STORY_LEDGER_APPROVAL_ENABLED;
        const targetPhase = containmentBypass ? 'phase_2' : reviewGateHandoffResult.handoff.phase;
        const targetPhaseStatus = containmentBypass ? JOB_STATUS.QUEUED : reviewGateHandoffResult.handoff.phase_status;
        const targetStatus = containmentBypass ? JOB_STATUS.QUEUED : reviewGateHandoffResult.handoff.status;

        const { data: phase1aHandoffRow, error: phase1aHandoffErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: targetStatus,
            phase: targetPhase,
            phase_status: targetPhaseStatus,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            review_gate_entered_at: phase1aNow,
            ...(containmentBypass ? { review_gate_passed_at: phase1aNow } : {}),
            updated_at: phase1aNow,
            progress: {
              ...phase1aHandoffProgress,
              ...buildPhaseLogPatch(phase1aHandoffProgress, 'review_gate', containmentBypass ? 'containment_bypass' : 'entered', phase1aNow),
              ...(containmentBypass ? { phase: 'phase_2', phase_status: JOB_STATUS.QUEUED } : {}),
            },
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING)
          .select('id, status, phase, phase_status')
          .single();

        if (phase1aHandoffErr) {
          console.error(
            `[Processor] ${jobId}: phase_1a → ${targetPhase} transition FAILED`,
            phase1aHandoffErr.message,
          );
          throw new Error(
            `Phase 1A → ${targetPhase} transition failed: ${phase1aHandoffErr.message}`,
          );
        }

        if (!phase1aHandoffRow) {
          console.warn(
            `[Processor] ${jobId}: phase_1a → ${targetPhase} 0 rows — job already transitioned`,
            { returned: phase1aHandoffRow ?? null },
          );
          return { success: true };
        }

        if (containmentBypass) {
          console.log(
            `[Processor] ${jobId}: containment mode active — review_gate bypassed, transitioning directly to phase_2`,
            {
              gate_ready_status: reviewGateHandoffResult.handoff.progress.gate_ready_status,
              review_gate_ready: reviewGateHandoffResult.handoff.progress.review_gate_ready,
              pass3a_status: reviewGateHandoffResult.handoff.progress.pass3a_status,
            },
          );
        } else {
          console.log(
            `[Processor] ${jobId}: phase_1a handoff confirmed — status=queued phase=review_gate phase_status=awaiting_approval`,
            {
              gate_ready_status: reviewGateHandoffResult.handoff.progress.gate_ready_status,
              review_gate_ready: reviewGateHandoffResult.handoff.progress.review_gate_ready,
              pass3a_status: reviewGateHandoffResult.handoff.progress.pass3a_status,
              pass3a_gate_validity: reviewGateHandoffResult.handoff.progress.pass3a_gate_validity,
            },
          );
        }
        return { success: true };
      } catch (phase1aErr) {
        const errMsg = phase1aErr instanceof Error ? phase1aErr.message : String(phase1aErr);
        console.error(`[Processor] ${jobId}: phase_1a fatal error`, errMsg);
        clearInterval(leaseRenewalLoopP1a);

        // Classify the failure correctly — only use PASS1A_LEDGER_MISSING when
        // the actual condition is a missing accepted_story_ledger lookup.
        // Other Phase 1A failures get their own codes for diagnostic accuracy.
        const classification = classifyPhase1aFailure(phase1aErr);

        // Map phase1a-specific bucket to FailureBucket for envelope routing
        const envelopeBucket: FailureBucket =
          classification.bucket === 'ledger' ? 'app_logic' :
          classification.bucket === 'transition' ? 'app_logic' :
          classification.bucket === 'provider' ? 'openai_provider' :
          classification.bucket === 'timeout' ? 'openai_provider' :
          classification.bucket === 'policy' ? 'app_logic' :
          'openai_provider';

        // Persist structured error into progress for forensic audit
        const phase1aErrorRecord = {
          code: classification.code,
          message: classification.message,
          bucket: classification.bucket,
          at: new Date().toISOString(),
        };
        progressState.phase1a_error = phase1aErrorRecord;

        await markFailed(
          `Phase 1A character sweep failed: ${errMsg}`,
          classification.code,
          { pipelineStage: 'phase_1a', bucket: envelopeBucket, diagnostics: phase1aErrorRecord },
        );
        return { success: false, error: errMsg };
      } finally {
        clearInterval(leaseRenewalLoopP1a);
      }
    } // end phase_1a execution

    if (executionPhase === 'phase_2') {
      // GUARD: Phase 2 must never fire at the exact millisecond Phase 1 completes.
      // Previously job 3b7a549b-ea34-4b3d-ae85-30bc8b234576 had
      // phase1_completed_at === phase2_started_at to the millisecond, indicating
      // Phase 2 was triggered without any guard. Insert a deterministic settle
      // delay so any in-flight Phase 1 commit can land before Phase 2 reads.
      // Stabilization pause before Phase 2 — ensure Phase 1 artifacts are fully committed.
      pulseWorker('phase2/entry');
      console.log(`[phase_2] ${jobId}: stabilizing before Phase 2 start`);
      await stabilize();

      pulseWorker('phase2/after-stabilize');
      await markRunning('Resuming from phase 1 handoff', 55, 'phase_2');
      refreshPhaseDeadline(progressState.phase2_started_at as string | undefined);

      pulseWorker('phase2/before-upstream-canonical-assert');
      try {
        await assertPhase2UpstreamInputsCanonical(supabase, String(job.id), Number(job.manuscript_id));
      } catch (phase2InputErr) {
        const message = phase2InputErr instanceof Error ? phase2InputErr.message : String(phase2InputErr);
        console.error(`[phase_2] ${jobId}: canonical upstream input guard failed`, message);
        await markFailed(
          `Phase 2 upstream input policy violation: ${message}`,
          'POLICY_VIOLATION_PHASE2_UPSTREAM_INPUT',
          { pipelineStage: 'phase_2' },
        );
        return { success: false, error: 'POLICY_VIOLATION_PHASE2_UPSTREAM_INPUT' };
      }

      // ── GOVERNANCE GATE: accepted_story_ledger_v1 is required before Phase 2 ──
      // This is the author-approved contract. Phase 2 must not score from unverified extraction.
      pulseWorker('phase2/before-governance-gate');
      const { buildAuthorCorrectionsBlock: buildCorrectionsBlock } = await import('@/lib/evaluation/pipeline/prompts/pass2-editorial');

      const { data: acceptedLedgerRow, error: acceptedLedgerErr } = await supabase
        .from('evaluation_artifacts')
        .select('content')
        .eq('job_id', job.id)
        .eq('artifact_type', 'accepted_story_ledger_v1')
        .maybeSingle();

      if (acceptedLedgerErr) {
        console.error(`[phase_2] ${jobId}: accepted_story_ledger_v1 read error`, acceptedLedgerErr.message);
        await markFailed(
          'accepted_story_ledger_v1 read error — will retry',
          'MISSING_ACCEPTED_STORY_LEDGER',
          { pipelineStage: 'phase_2' }
        );
        return { success: false, error: 'MISSING_ACCEPTED_STORY_LEDGER' };
      }

      if (!acceptedLedgerRow?.content) {
        console.error(`[phase_2] ${jobId}: accepted_story_ledger_v1 missing — author approval required`);
        await markFailed(
          'Phase 2 cannot start before author Story Layer approval.',
          'MISSING_ACCEPTED_STORY_LEDGER',
          { pipelineStage: 'phase_2' }
        );
        return { success: false, error: 'MISSING_ACCEPTED_STORY_LEDGER' };
      }

      const ledgerContent = acceptedLedgerRow.content as Record<string, unknown>;
      const govRail = ledgerContent.governance_rail as Record<string, unknown> | undefined;

      if (!govRail) {
        console.error(`[phase_2] ${jobId}: governance_rail missing from accepted_story_ledger_v1`);
        await markFailed(
          'Phase 2 cannot start without author governance rail.',
          'MISSING_AUTHOR_GOVERNANCE_RAIL',
          { pipelineStage: 'phase_2' }
        );
        return { success: false, error: 'MISSING_AUTHOR_GOVERNANCE_RAIL' };
      }

      const layerDecisions = govRail.layer_decisions as Record<string, unknown> | undefined;
      if (!layerDecisions || Object.keys(layerDecisions).length < 9) {
        console.error(`[phase_2] ${jobId}: incomplete layer_decisions — found ${Object.keys(layerDecisions ?? {}).length}/9`);
        await markFailed(
          'Phase 2 cannot start until all Story Layer layers have author decisions.',
          'INCOMPLETE_AUTHOR_LAYER_DECISIONS',
          { pipelineStage: 'phase_2', diagnostics: { found: Object.keys(layerDecisions ?? {}).length, required: 9 } }
        );
        return { success: false, error: 'INCOMPLETE_AUTHOR_LAYER_DECISIONS' };
      }

      const authorCorrectionsBlock = buildCorrectionsBlock(govRail);
      if (authorCorrectionsBlock) {
        console.log(`[phase_2] ${jobId}: AUTHOR CORRECTIONS BLOCK injected (${authorCorrectionsBlock.length} chars) — governing context active`);
      } else {
        console.log(`[phase_2] ${jobId}: clean approval — no author corrections to inject`);
      }
      // ── END GOVERNANCE GATE ──
      pulseWorker('phase2/after-governance-gate');

      const runPass12ForHandoffRecovery = async (
        prebuiltLedger:
          | { ledger: Pass1aCharacterLedger; ledgerV2: CharacterLedgerV2 }
          | undefined,
      ): Promise<
        | { ok: true; pass1Output: SinglePassOutput; pass2Output: SinglePassOutput }
        | { ok: false; error: string; errorCode: string }
      > => {
        try {
          const [{ runPass1 }, { runPass2 }, { enforcePass2LexicalIndependence }, { loadCanonicalRegistry }, { buildLedgerBlockForPrompt }] = await Promise.all([
            import('@/lib/evaluation/pipeline/runPass1'),
            import('@/lib/evaluation/pipeline/runPass2'),
            import('@/lib/evaluation/pipeline/pass2IndependenceGuard'),
            import('@/lib/governance/canonRegistry'),
            import('@/lib/evaluation/pipeline/buildLedgerBlock'),
          ]);

          const registry = loadCanonicalRegistry();
          const ledgerBlock = prebuiltLedger
            ? buildLedgerBlockForPrompt(prebuiltLedger.ledger, prebuiltLedger.ledgerV2)
            : '';

          const chunkHeartbeat = () => pulseWorker('phase2/chunk-heartbeat');

          // ── Load Pass 1 + Pass 2 chunk caches for checkpoint resume ──
          const pass12SourceHash = createHash('sha256')
            .update(`${String(job.id)}:${String(job.manuscript_id)}:${manuscriptChunksForPipeline?.length ?? 0}`)
            .digest('hex');

          let pass1CacheMap: Map<number, SinglePassOutput> | undefined;
          let pass2CacheMap: Map<number, SinglePassOutput> | undefined;

          // Seed rolling checkpoint payloads from existing cache so upserts
          // never shrink the artifact. Every upsert writes the full merged set.
          const pass1ChunkResults: Record<number, { result: SinglePassOutput; completed_at: string }> = {};
          const pass2ChunkResults: Record<number, { result: SinglePassOutput; completed_at: string }> = {};

          pulseWorker('phase2/before-chunk-cache-load');
          try {
            const [pass1CacheRow, pass2CacheRow] = await Promise.all([
              supabase
                .from('evaluation_artifacts')
                .select('content')
                .eq('job_id', job.id)
                .eq('artifact_type', 'pass1_chunk_cache_v1')
                .maybeSingle(),
              supabase
                .from('evaluation_artifacts')
                .select('content')
                .eq('job_id', job.id)
                .eq('artifact_type', 'pass2_chunk_cache_v1')
                .maybeSingle(),
            ]);
            pulseWorker('phase2/after-chunk-cache-load');

            const pass1Content = pass1CacheRow.data?.content as { source_hash?: string; chunks?: Record<string, { result: SinglePassOutput; completed_at?: string }> } | null;
            if (pass1Content?.chunks && pass1Content.source_hash === pass12SourceHash) {
              pass1CacheMap = new Map<number, SinglePassOutput>();
              for (const [idx, entry] of Object.entries(pass1Content.chunks)) {
                pass1CacheMap.set(Number(idx), entry.result);
                pass1ChunkResults[Number(idx)] = { result: entry.result, completed_at: entry.completed_at ?? new Date().toISOString() };
              }
              console.log(`[phase_2] ${jobId}: loaded pass1_chunk_cache_v1 with ${pass1CacheMap.size} cached chunks (hash match)`);
            } else if (pass1Content?.chunks) {
              console.warn(`[phase_2] ${jobId}: pass1_chunk_cache_v1 source_hash mismatch — ignoring stale cache`);
            }

            const pass2Content = pass2CacheRow.data?.content as { source_hash?: string; chunks?: Record<string, { result: SinglePassOutput; completed_at?: string }> } | null;
            if (pass2Content?.chunks && pass2Content.source_hash === pass12SourceHash) {
              pass2CacheMap = new Map<number, SinglePassOutput>();
              for (const [idx, entry] of Object.entries(pass2Content.chunks)) {
                pass2CacheMap.set(Number(idx), entry.result);
                pass2ChunkResults[Number(idx)] = { result: entry.result, completed_at: entry.completed_at ?? new Date().toISOString() };
              }
              console.log(`[phase_2] ${jobId}: loaded pass2_chunk_cache_v1 with ${pass2CacheMap.size} cached chunks (hash match)`);
            } else if (pass2Content?.chunks) {
              console.warn(`[phase_2] ${jobId}: pass2_chunk_cache_v1 source_hash mismatch — ignoring stale cache`);
            }
          } catch (cacheLoadErr) {
            console.warn(`[phase_2] ${jobId}: chunk cache load failed (non-fatal)`,
              cacheLoadErr instanceof Error ? cacheLoadErr.message : String(cacheLoadErr));
          }

          // ── Rolling checkpoint upsert helpers ──
          let pass1UpsertPending = 0;
          let pass2UpsertPending = 0;
          const CHECKPOINT_INTERVAL = 5;

          const upsertChunkCache = async (
            artifactType: string,
            chunkResults: Record<number, { result: SinglePassOutput; completed_at: string }>,
          ) => {
            try {
              await supabase
                .from('evaluation_artifacts')
                .upsert({
                  job_id: job.id,
                  artifact_type: artifactType,
                  content: {
                    job_id: job.id,
                    source_hash: pass12SourceHash,
                    chunks: chunkResults,
                    total_expected: manuscriptChunksForPipeline?.length ?? 0,
                    cached_at: new Date().toISOString(),
                  },
                  created_at: new Date().toISOString(),
                }, { onConflict: 'job_id,artifact_type' });
            } catch (upsertErr) {
              console.warn(`[phase_2] ${jobId}: ${artifactType} upsert failed (non-fatal)`,
                upsertErr instanceof Error ? upsertErr.message : String(upsertErr));
            }
          };

          const onPass1ChunkComplete = async (chunkIndex: number, result: SinglePassOutput) => {
            pass1ChunkResults[chunkIndex] = { result, completed_at: new Date().toISOString() };
            pass1UpsertPending++;
            if (pass1UpsertPending >= CHECKPOINT_INTERVAL) {
              pass1UpsertPending = 0;
              await upsertChunkCache('pass1_chunk_cache_v1', pass1ChunkResults);
            }
          };

          const onPass2ChunkComplete = async (chunkIndex: number, result: SinglePassOutput) => {
            pass2ChunkResults[chunkIndex] = { result, completed_at: new Date().toISOString() };
            pass2UpsertPending++;
            if (pass2UpsertPending >= CHECKPOINT_INTERVAL) {
              pass2UpsertPending = 0;
              await upsertChunkCache('pass2_chunk_cache_v1', pass2ChunkResults);
            }
          };

          pulseWorker('phase2/before-chunk-processing');
          const [pass1Settled, pass2Settled] = await Promise.allSettled([
            runPass1({
              manuscriptText: manuscriptWithContent.content || '',
              manuscriptChunks: manuscriptChunksForPipeline,
              workType: effectiveWorkType,
              title: manuscriptWithContent.title,
              executionMode: 'TRUSTED_PATH',
              openaiApiKey,
              jobId: String(job.id),
              openAiTimeoutMs: timeoutResolution.openAiTimeoutMs,
              registry,
              _chunkConcurrency: prebuiltLedger ? 3 : undefined,
              characterLedgerBlock: ledgerBlock || undefined,
              _onChunkHeartbeat: chunkHeartbeat,
              _chunkCache: pass1CacheMap,
              _onChunkComplete: onPass1ChunkComplete,
            }),
            runPass2({
              manuscriptText: manuscriptWithContent.content || '',
              manuscriptChunks: manuscriptChunksForPipeline,
              workType: effectiveWorkType,
              title: manuscriptWithContent.title,
              executionMode: 'TRUSTED_PATH',
              model: getCanonicalPass2Model(openAiModel),
              openaiApiKey,
              manuscriptId: String(manuscriptWithContent.id),
              jobId: String(job.id),
              openAiTimeoutMs: timeoutResolution.openAiTimeoutMs,
              registry,
              _chunkConcurrency: prebuiltLedger ? 3 : undefined,
              characterLedgerBlock: ledgerBlock || undefined,
              authorCorrectionsBlock,
              _onChunkHeartbeat: chunkHeartbeat,
              _chunkCache: pass2CacheMap,
              _onChunkComplete: onPass2ChunkComplete,
            }),
          ]);

          // Final checkpoint: flush any remaining un-upserted chunk results.
          await Promise.allSettled([
            Object.keys(pass1ChunkResults).length > 0
              ? upsertChunkCache('pass1_chunk_cache_v1', pass1ChunkResults)
              : Promise.resolve(),
            Object.keys(pass2ChunkResults).length > 0
              ? upsertChunkCache('pass2_chunk_cache_v1', pass2ChunkResults)
              : Promise.resolve(),
          ]);

          if (pass1Settled.status === 'rejected') {
            const msg = pass1Settled.reason instanceof Error ? pass1Settled.reason.message : String(pass1Settled.reason);
            const code = msg.includes('CHUNK_ROUTING_NOT_ENGAGED') ? 'CHUNK_ROUTING_NOT_ENGAGED' : 'PASS1_FAILED';
            return { ok: false, error: msg, errorCode: code };
          }

          if (pass2Settled.status === 'rejected') {
            const msg = pass2Settled.reason instanceof Error ? pass2Settled.reason.message : String(pass2Settled.reason);
            const code = msg.includes('CHUNK_ROUTING_NOT_ENGAGED') ? 'CHUNK_ROUTING_NOT_ENGAGED' : 'PASS2_FAILED';
            return { ok: false, error: msg, errorCode: code };
          }

          const pass1Output = pass1Settled.value;
          const independenceResult = enforcePass2LexicalIndependence(pass1Output, pass2Settled.value);
          if (!independenceResult.ok) {
            return {
              ok: false,
              error: `Pass 2 lexical independence guard failed after rewrite (keys: ${independenceResult.failedKeys.join(', ')})`,
              errorCode: 'PASS2_INDEPENDENCE_REWRITE_FAILED',
            };
          }

          return {
            ok: true,
            pass1Output,
            pass2Output: independenceResult.output,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const code = msg.includes('CHUNK_ROUTING_NOT_ENGAGED') ? 'CHUNK_ROUTING_NOT_ENGAGED' : 'PHASE2_PASS12_FAILED';
          return { ok: false, error: msg, errorCode: code };
        }
      };

      pulseWorker('phase2/before-handoff-read');
      const { data: handoffRow, error: handoffReadError } = await supabase
        .from('evaluation_artifacts')
        .select('content')
        .eq('job_id', job.id)
        .eq('artifact_type', 'pass12_handoff_v1')
        .maybeSingle();

      if (handoffReadError || !handoffRow?.content) {
        // Handoff artifact missing or unreadable.
        // LONG-FORM CONTRACT: phase_2 must NOT run the full pipeline (P1+P2+P3 in
        // one Vercel invocation exceeds the 720s timeout on 100k+ word novels).
        // If phase_1a artifacts (ledger / preflight) are present, the old phase_2
        // resume path is the right re-runner — but the handoff being missing here
        // implies P1+P2 never completed, so requeue back to phase_1a so the 4-phase
        // sequence restarts cleanly. Short-form (non-chunk-routed) jobs may legitimately
        // bypass phase_1a and fall through to the full pipeline.
        const isLongForm = chunkRouting.route === 'long_form';
        if (isLongForm) {
          // RELAY CONTRACT: phase_2 owns Pass 1+2 and writes pass12_handoff_v1.
          // When the handoff is missing it means phase_2 was claimed but did not
          // complete. Do NOT requeue phase_1a — that creates a phase_1a ↔ phase_2
          // loop because after phase_1a the handoff will still be missing.
          // Instead: read the character ledger from phase_1a, run Pass 1+2 via
          // runPipeline (with cached ledger injected), write pass12_handoff_v1,
          // then queue phase_3.
          console.warn(
            `[phase_2] ${jobId}: long-form handoff missing — running Pass 1+2 to write it`,
            { handoffReadError: (handoffReadError as { message?: string } | null)?.message ?? 'no_data' },
          );

          // Read prebuilt character ledger from phase_1a (soft — absent = no grounding)
          pulseWorker('phase2/before-ledger-read-longform');
          let prebuiltLedgerP2: { ledger: Pass1aCharacterLedger; ledgerV2: CharacterLedgerV2 } | undefined;
          try {
            const { data: ledgerArtifactP2 } = await supabase
              .from('evaluation_artifacts')
              .select('content')
              .eq('job_id', job.id)
              .eq('artifact_type', 'pass1a_character_ledger_v1')
              .maybeSingle();
            if (ledgerArtifactP2?.content?.ledger_v1 && ledgerArtifactP2?.content?.ledger_v2) {
              prebuiltLedgerP2 = {
                ledger: ledgerArtifactP2.content.ledger_v1 as Pass1aCharacterLedger,
                ledgerV2: ledgerArtifactP2.content.ledger_v2 as CharacterLedgerV2,
              };
            } else {
              console.warn(`[phase_2] ${jobId}: pass1a_character_ledger_v1 missing or incomplete — running Pass 1+2 without ledger grounding`);
            }
          } catch (ledgerReadErrP2) {
            console.warn(`[phase_2] ${jobId}: ledger artifact read failed (non-fatal)`,
              ledgerReadErrP2 instanceof Error ? ledgerReadErrP2.message : String(ledgerReadErrP2));
          }

          // Run Pass 1+2 via runPipeline with captured runners — single call, no retry loop.
          // _runners intercepts the real runPass1/runPass2 outputs so we can write
          // pass12_handoff_v1. Pass 3B (synthesis) still runs inside this call but its
          // output is discarded — phase_3 owns synthesis and will re-run it via handoff.
          pulseWorker('phase2/before-pass12-recovery-longform');
          const leaseRenewalIntervalMsP2 = 30_000;
          const leaseRenewalLoopP2 = setInterval(() => {
            void renewEvaluationJobLease({
              supabase,
              jobId,
              leaseMs: runtimeConfig.worker.leaseMs,
              stage: 'phase_2_pass12_renewal',
              hardDeadlineMs,
            }).catch((err: unknown) => {
              console.warn('[phase_2] lease renewal failed (non-fatal)',
                err instanceof Error ? err.message : String(err));
            });
          }, leaseRenewalIntervalMsP2);

          // ── Vercel budget gate: self-chain if insufficient time for Pass 1+2 ──
          const budgetBeforeP2Ms = getVercelBudgetRemainingMs();
          if (budgetBeforeP2Ms < BUDGET_SAFETY_MARGIN_MS) {
            console.warn(`[phase_2] ${jobId}: budget exhausted before Pass 1+2 (remaining=${budgetBeforeP2Ms}ms < margin=${BUDGET_SAFETY_MARGIN_MS}ms) — self-chaining`);
            clearInterval(leaseRenewalLoopP2);
            const selfChainNow = new Date().toISOString();
            const { error: budgetChainErr } = await supabase
              .from('evaluation_jobs')
              .update({
                status: JOB_STATUS.QUEUED,
                phase: PHASES.PHASE_2,
                phase_status: JOB_STATUS.QUEUED,
                claimed_by: null,
                lease_token: null,
                lease_until: null,
                worker_pulse_at: null,
                updated_at: selfChainNow,
                progress: {
                  ...progressState,
                  phase: 'phase_2',
                  phase_status: 'queued',
                  message: 'Re-queued: insufficient Vercel budget for Pass 1+2',
                  phase_log: [
                    ...((progressState.phase_log as unknown[]) ?? []),
                    { at: selfChainNow, event: 'phase2_budget_self_chain', budget_remaining_ms: budgetBeforeP2Ms },
                  ],
                },
              })
              .eq('id', jobId)
              .eq('status', JOB_STATUS.RUNNING);
            if (budgetChainErr) {
              throw new Error(`Phase 2 budget self-chain failed: ${budgetChainErr.message}`);
            }
            return { success: true };
          }

          let capturedPass1: SinglePassOutput | undefined;
          let capturedPass2: SinglePassOutput | undefined;

          try {
            const pass12Recovery = await runPass12ForHandoffRecovery(prebuiltLedgerP2);
            if (pass12Recovery.ok === false) {
              console.error(`[phase_2] ${jobId}: Pass 1+2 handoff recovery failed`, {
                error_code: pass12Recovery.errorCode,
                error: pass12Recovery.error,
              });
              await markFailed(pass12Recovery.error, 'PHASE2_PASS12_FAILED', { pipelineStage: 'phase_2' });
              return { success: false, error: pass12Recovery.errorCode };
            }
            capturedPass1 = pass12Recovery.pass1Output;
            capturedPass2 = pass12Recovery.pass2Output;
          } finally {
            clearInterval(leaseRenewalLoopP2);
          }

          if (!capturedPass1) {
            const capErr = 'phase_2: Pass 1 output not captured after pipeline run';
            console.error(`[phase_2] ${jobId}: ${capErr}`);
            await markFailed(capErr, 'PHASE2_PASS1_MISSING', { pipelineStage: 'phase_2' });
            return { success: false, error: capErr };
          }

          const pass1ResultP2: SinglePassOutput = capturedPass1;
          const pass2ResultP2: SinglePassOutput = capturedPass2 ?? capturedPass1; // Pass 2 present when ok=true

          // SIPOC mistake-proofing: if aggregator produced empty recommendations,
          // recover from upstream chunk cache before writing handoff.
          await recoverHandoffRecommendationsFromChunkCache(supabase, String(job.id), pass2ResultP2);

          // Write pass12_handoff_v1
          const handoffContentP2 = {
            pass1Output: pass1ResultP2,
            pass2Output: pass2ResultP2,
            chunk_count: manuscriptChunksForPipeline?.length ?? 1,
            captured_at: new Date().toISOString(),
            schema_version: 'pass12_handoff_v1',
          };
          const handoffHashP2 = stableSourceHash({
            manuscriptId: Number(manuscriptWithContent.id),
            jobId: String(job.id),
            userId: String(manuscriptWithContent.user_id ?? ''),
            manuscriptText: manuscriptWithContent.content || '',
            promptVersion: 'pass12_handoff_v1',
            model: getCanonicalPipelineModel(openAiModel),
          });
          await assertReviewGatePassedBeforeHandoff(supabase, String(job.id));
          await upsertEvaluationArtifact({
            supabase,
            jobId: String(job.id),
            manuscriptId: Number(job.manuscript_id),
            artifactType: 'pass12_handoff_v1',
            content: handoffContentP2,
            sourceHash: handoffHashP2,
            artifactVersion: 'pass12_handoff_v1',
          });

          // Queue phase_3 — same pattern as the handoff-present branch
          const p2HandoffNow = new Date().toISOString();
          await assertPass12HandoffExistsBeforePhase3Queue(supabase, String(job.id));
          const { data: p2Phase3Row, error: p2Phase3Err } = await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.QUEUED,
              phase: 'phase_3',
              phase_status: JOB_STATUS.QUEUED,
              claimed_by: null,
              claimed_at: null,
              lease_token: null,
              lease_until: null,
              updated_at: p2HandoffNow,
              progress: {
                ...progressState,
                completed_units: 75,
                phase: 'phase_2',
                phase_status: 'complete',
                message: 'Scoring complete — preparing synthesis',
                phase2_completed_at: p2HandoffNow,
              },
            })
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING)
            .select('id, status, phase, phase_status')
            .single();

          if (p2Phase3Err) {
            console.error(`[phase_2] ${jobId}: phase_3 queue transition FAILED`, p2Phase3Err.message);
            return { success: false, error: p2Phase3Err.message };
          }
          console.log(`[phase_2] ${jobId}: Pass 1+2 → handoff written → phase_3 queued`,
            { status: p2Phase3Row?.status, phase: p2Phase3Row?.phase });
          return { success: true };
        }
        // Short-form: handoff missing — same relay contract as long-form.
        // Run P1+P2, write handoff, queue phase_3. The old fall-through to a full
        // runPipeline re-run below is dead code that never sets pipelineResult;
        // treat short-form exactly like long-form here.
        console.warn(
          `[Processor] ${jobId}: phase_2 short-form handoff missing — running Pass 1+2 to write it`,
          { handoffReadError: (handoffReadError as { message?: string } | null)?.message ?? 'no_data' },
        );

        // Read prebuilt character ledger (soft — absent = no grounding)
        pulseWorker('phase2/before-ledger-read-shortform');
        let prebuiltLedgerP2Short: { ledger: Pass1aCharacterLedger; ledgerV2: CharacterLedgerV2 } | undefined;
        try {
          const { data: ledgerArtifactP2Short } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', job.id)
            .eq('artifact_type', 'pass1a_character_ledger_v1')
            .maybeSingle();
          if (ledgerArtifactP2Short?.content?.ledger_v1 && ledgerArtifactP2Short?.content?.ledger_v2) {
            prebuiltLedgerP2Short = {
              ledger: ledgerArtifactP2Short.content.ledger_v1 as Pass1aCharacterLedger,
              ledgerV2: ledgerArtifactP2Short.content.ledger_v2 as CharacterLedgerV2,
            };
          }
        } catch (_ledgerErrShort) { /* non-fatal */ }

        pulseWorker('phase2/before-pass12-recovery-shortform');
        const leaseRenewalLoopP2Short = setInterval(() => {
          void renewEvaluationJobLease({ supabase, jobId, leaseMs: runtimeConfig.worker.leaseMs, stage: 'phase_2_short_renewal', hardDeadlineMs }).catch(() => {});
        }, 30_000);

        let capturedPass1Short: SinglePassOutput | undefined;
        let capturedPass2Short: SinglePassOutput | undefined;

        try {
          const pass12Recovery = await runPass12ForHandoffRecovery(prebuiltLedgerP2Short);
          if (pass12Recovery.ok === false) {
            await markFailed(pass12Recovery.error, 'PHASE2_PASS12_FAILED', { pipelineStage: 'phase_2' });
            return { success: false, error: pass12Recovery.errorCode };
          }
          capturedPass1Short = pass12Recovery.pass1Output;
          capturedPass2Short = pass12Recovery.pass2Output;
        } finally {
          clearInterval(leaseRenewalLoopP2Short);
        }

        if (!capturedPass1Short) {
          await markFailed('phase_2 short: Pass 1 output not captured', 'PHASE2_PASS1_MISSING', { pipelineStage: 'phase_2' });
          return { success: false, error: 'phase_2 short: Pass 1 output not captured' };
        }

        // SIPOC mistake-proofing: recover empty recommendations from chunk cache
        const pass2ResultP2Short: SinglePassOutput = capturedPass2Short ?? capturedPass1Short;
        await recoverHandoffRecommendationsFromChunkCache(supabase, String(job.id), pass2ResultP2Short);

        const handoffContentP2Short = {
          pass1Output: capturedPass1Short,
          pass2Output: pass2ResultP2Short,
          chunk_count: manuscriptChunksForPipeline?.length ?? 1,
          captured_at: new Date().toISOString(),
          schema_version: 'pass12_handoff_v1',
        };
        await assertReviewGatePassedBeforeHandoff(supabase, String(job.id));
        await upsertEvaluationArtifact({
          supabase,
          jobId: String(job.id),
          manuscriptId: Number(job.manuscript_id),
          artifactType: 'pass12_handoff_v1',
          content: handoffContentP2Short,
          sourceHash: stableSourceHash({
            manuscriptId: Number(manuscriptWithContent.id),
            jobId: String(job.id),
            userId: String(manuscriptWithContent.user_id ?? ''),
            manuscriptText: manuscriptWithContent.content || '',
            promptVersion: 'pass12_handoff_v1',
            model: getCanonicalPipelineModel(openAiModel),
          }),
          artifactVersion: 'pass12_handoff_v1',
        });

        const p2ShortNow = new Date().toISOString();
        await assertPass12HandoffExistsBeforePhase3Queue(supabase, String(job.id));
        const { error: p2ShortPhase3Err } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED, phase: 'phase_3', phase_status: JOB_STATUS.QUEUED,
            claimed_by: null, claimed_at: null, lease_token: null, lease_until: null,
            updated_at: p2ShortNow,
            progress: { ...progressState, completed_units: 75, phase: 'phase_2', phase_status: 'complete',
              message: 'Scoring complete — preparing synthesis',
              phase2_completed_at: p2ShortNow },
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING);
        if (p2ShortPhase3Err) {
          return { success: false, error: p2ShortPhase3Err.message };
        }
        console.log(`[phase_2] ${jobId}: short-form Pass 1+2 → handoff written → phase_3 queued`);
        return { success: true };
      } else {
        // Handoff artifact found — phase_2 has nothing to do. Pass 3B synthesis
        // is owned by phase_3 now. Queue phase_3 and return immediately.
        // DO NOT delete pass12_handoff_v1 — phase_3 reads it for synthesis.
        pulseWorker('phase2/handoff-present-queue-phase3');
        console.log(
          `[Processor] ${jobId}: phase_2 — handoff present, queueing phase_3 (Pass 3B synthesis owns synthesis)`,
        );

        const phase3QueueNow = new Date().toISOString();
        await assertPass12HandoffExistsBeforePhase3Queue(supabase, String(job.id));
        const { data: phase3QueueRow, error: phase3QueueErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED,
            phase: 'phase_3',
            phase_status: JOB_STATUS.QUEUED,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            updated_at: phase3QueueNow,
            progress: {
              ...progressState,
              completed_units: 75,
              phase: 'phase_2',
              phase_status: 'complete',
              message: 'Scoring complete — preparing synthesis',
              phase2_completed_at: phase3QueueNow,
            },
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING)
          .select('id, status, phase, phase_status')
          .single();

        if (phase3QueueErr) {
          console.error(
            `[Processor] ${jobId}: phase_2 → phase_3 queue transition FAILED`,
            phase3QueueErr.message,
          );
          return { success: false, error: phase3QueueErr.message };
        }
        console.log(
          `[Processor] ${jobId}: phase_2 → phase_3 queued`,
          { status: phase3QueueRow?.status, phase: phase3QueueRow?.phase },
        );
        return { success: true };
      }
    } // end phase_2

    // pipelineResult is guaranteed assigned here by phase_1a, phase_2, or phase_3 execution above.
    if (!pipelineResult) {
      throw new Error('pipelineResult unexpectedly undefined after phase execution');
    }

    console.log(
      `[Processor] ${jobId}: EXIT runPipeline ok=${pipelineResult.ok}` +
        (pipelineResult.ok === false
          ? ` failed_at=${pipelineResult.failed_at} code=${pipelineResult.error_code}`
          : ''),
    );

    if (pipelineResult.ok === false) {
      const pass3CompletedAt = new Date().toISOString();
      progressState.pass3_completed_at = pass3CompletedAt;
      logProcessorStageBoundary({
        jobId,
        stage: 'pass3',
        state: 'failed',
        at: pass3CompletedAt,
        metadata: {
          failed_at: pipelineResult.failed_at,
          error_code: pipelineResult.error_code,
        },
      });

      // ── Phase 3 Crash Recovery ──────────────────────────────────────────
      // If Phase 3 synthesis fails and we haven't exhausted retries, re-queue
      // at phase_3 instead of marking the job as permanently failed. The next
      // worker pickup will retry the synthesis with a fresh 800s budget.
      // Only re-queue if the failure actually occurred in Pass 3 (not an earlier pass).
      const PHASE_3_MAX_RETRIES = 2;
      const phase3RetryCount = (progressState as Record<string, unknown>).phase_3_retry_count as number ?? 0;
      const failedInPhase3 = pipelineResult.failed_at === 'pass3';
      if (executionPhase === 'phase_3' && failedInPhase3 && phase3RetryCount < PHASE_3_MAX_RETRIES) {
        const nextRetry = phase3RetryCount + 1;
        console.warn(`[Processor] ${jobId}: Phase 3 failed (attempt ${nextRetry}/${PHASE_3_MAX_RETRIES}), re-queuing for retry`, {
          error_code: pipelineResult.error_code,
          failed_at: pipelineResult.failed_at,
        });

        // Persist durable failure diagnostic before re-queue clears context.
        const phase3DiagnosticEntry = {
          snapshot_at: pass3CompletedAt,
          job_id: jobId,
          phase: 'phase_3',
          phase_status: 'failed',
          attempt_count: phase3RetryCount,
          completed_units: typeof progressState.completed_units === 'number'
            ? progressState.completed_units : null,
          failure_code: pipelineResult.error_code ?? null,
          last_error: `${pipelineResult.error_code}: ${pipelineResult.error}`,
          failed_at: pipelineResult.failed_at ?? null,
          substage: pipelineResult.failed_at ?? 'pass3_synthesis',
          resume_target_phase: 'phase_3',
          resume_mode: 'phase3_inline_retry',
        };
        const existingPhase3History = Array.isArray(
          (progressState as Record<string, unknown>).failure_history,
        )
          ? (progressState as Record<string, unknown>).failure_history as unknown[]
          : [];
        const phase3FailureHistory = [
          ...existingPhase3History,
          phase3DiagnosticEntry,
        ].slice(-10);

        (progressState as Record<string, unknown>).phase_3_retry_count = nextRetry;
        (progressState as Record<string, unknown>).phase_3_last_retry_at = pass3CompletedAt;
        (progressState as Record<string, unknown>).phase_3_last_error = pipelineResult.error_code;
        (progressState as Record<string, unknown>).failure_history = phase3FailureHistory;
        await supabase
          .from('evaluation_jobs')
          .update({
            status: 'queued',
            phase: 'phase_3',
            phase_status: 'queued',
            last_error: `Phase 3 retry ${nextRetry}/${PHASE_3_MAX_RETRIES}: ${pipelineResult.error_code}`,
            progress: progressState,
          })
          .eq('id', jobId);
        return { success: false, error: `Phase 3 re-queued for retry (${nextRetry}/${PHASE_3_MAX_RETRIES})` };
      }

      const serializedFailureDetails = pipelineResult.failure_details
        ? JSON.stringify(pipelineResult.failure_details).slice(0, 1500)
        : null;
      const pipelineError =
        `[Pipeline:${pipelineResult.failed_at}] ${pipelineResult.error_code} ${pipelineResult.error}` +
        (serializedFailureDetails ? ` | failure_details=${serializedFailureDetails}` : "");

      const llrDiagnosticSnapshot = pipelineResult.failure_details?.llr_diagnostic_snapshot;
      if (llrDiagnosticSnapshot) {
        try {
          const diagnosticSourceHash = stableSourceHash({
            manuscriptId: manuscript.id,
            jobId: job.id,
            userId: manuscriptWithContent.user_id,
            manuscriptText: manuscriptWithContent.content || '(No content provided)',
            promptVersion: `diagnostic_pass3_snapshot_v1:${llrDiagnosticSnapshot.stage}`,
            model: getCanonicalPipelineModel(openAiModel),
          });

          await upsertEvaluationArtifact({
            supabase,
            jobId: job.id,
            manuscriptId: job.manuscript_id,
            artifactType: 'diagnostic_pass3_snapshot_v1',
            artifactVersion: 'diagnostic_pass3_snapshot_v1',
            sourceHash: diagnosticSourceHash,
            content: {
              schema_version: 'diagnostic_pass3_snapshot_v1',
              created_at: new Date().toISOString(),
              job_id: job.id,
              manuscript_id: manuscript.id,
              failed_at: pipelineResult.failed_at,
              error_code: pipelineResult.error_code,
              stage: llrDiagnosticSnapshot.stage,
              blocked_rule_ids: llrDiagnosticSnapshot.blocked_rule_ids,
              checkpoint_id: llrDiagnosticSnapshot.checkpoint_id,
              recovery_options: llrDiagnosticSnapshot.recovery_options,
              diagnostics: llrDiagnosticSnapshot.diagnostics,
              safe_rewrite_applied: llrDiagnosticSnapshot.safe_rewrite_applied,
              safe_rewrite_attempted: llrDiagnosticSnapshot.safe_rewrite_attempted,
              convergence_result: llrDiagnosticSnapshot.convergence_result,
            },
          });

          console.log(`[Processor] ${jobId}: persisted diagnostic pass3 snapshot artifact`);
        } catch (diagnosticPersistError) {
          console.warn(
            `[Processor] ${jobId}: failed to persist diagnostic pass3 snapshot`,
            diagnosticPersistError instanceof Error
              ? diagnosticPersistError.message
              : String(diagnosticPersistError),
          );
        }
      }

      // ── Phase 2.7 gate diagnostic persistence (any gate failure) ──────────
      // Persists audit-only artifacts so failed jobs are reconstructable offline.
      // This is DISTINCT from the final user artifact (which is never persisted on failure).
      // Fail-soft: diagnostic persistence failure does not alter the job's error code.
      const gateDiagnostics = pipelineResult.gate_diagnostics;
      if (gateDiagnostics) {
        try {
          const gateHashBase = `gate_diagnostics_v1:${gateDiagnostics.error_code}:${gateDiagnostics.generated_at}`;
          const passOutputsHash = stableSourceHash({
            manuscriptId: manuscript.id,
            jobId: job.id,
            userId: manuscriptWithContent.user_id,
            manuscriptText: manuscriptWithContent.content || '(No content provided)',
            promptVersion: `pass_outputs_diagnostic_v1:${pipelineResult.error_code}`,
            model: getCanonicalPipelineModel(openAiModel),
          });

          // Artifact 1: Raw pass outputs (non-user-visible, audit-only)
          await upsertEvaluationArtifact({
            supabase,
            jobId: job.id,
            manuscriptId: job.manuscript_id,
            artifactType: 'pass_outputs_diagnostic_v1',
            artifactVersion: 'pass_outputs_diagnostic_v1',
            sourceHash: passOutputsHash,
            content: {
              schema_version: 'pass_outputs_diagnostic_v1',
              created_at: gateDiagnostics.generated_at,
              job_id: job.id,
              manuscript_id: manuscript.id,
              failed_at: gateDiagnostics.failed_at,
              error_code: gateDiagnostics.error_code,
              pass1_output: gateDiagnostics.pass1_output,
              pass2_output: gateDiagnostics.pass2_output,
              pass3_output: gateDiagnostics.pass3_output,
              provider_call_trace: gateDiagnostics.provider_call_trace,
            },
          });

          console.log(`[Processor] ${jobId}: persisted pass_outputs_diagnostic_v1 artifact`);

          const gateQualityHash = stableSourceHash({
            manuscriptId: manuscript.id,
            jobId: job.id,
            userId: manuscriptWithContent.user_id,
            manuscriptText: manuscriptWithContent.content || '(No content provided)',
            promptVersion: `quality_gate_diagnostics_v1:${gateHashBase}`,
            model: getCanonicalPipelineModel(openAiModel),
          });

          // Artifact 2: Per-criterion gate diagnostics (non-user-visible, audit-only)
          await upsertEvaluationArtifact({
            supabase,
            jobId: job.id,
            manuscriptId: job.manuscript_id,
            artifactType: 'quality_gate_diagnostics_v1',
            artifactVersion: 'quality_gate_diagnostics_v1',
            sourceHash: gateQualityHash,
            content: {
              schema_version: 'quality_gate_diagnostics_v1',
              created_at: gateDiagnostics.generated_at,
              job_id: job.id,
              manuscript_id: manuscript.id,
              failed_at: gateDiagnostics.failed_at,
              error_code: gateDiagnostics.error_code,
              per_criterion: gateDiagnostics.per_criterion,
            },
          });

          console.log(`[Processor] ${jobId}: persisted quality_gate_diagnostics_v1 artifact`);
        } catch (gateDiagnosticPersistError) {
          console.warn(
            `[Processor] ${jobId}: failed to persist gate diagnostic artifacts`,
            gateDiagnosticPersistError instanceof Error
              ? gateDiagnosticPersistError.message
              : String(gateDiagnosticPersistError),
          );
        }
      }

      console.error(`[Processor] Pipeline failed for job ${jobId}: ${pipelineError}`);

      // PR #506 / PR-B / PR-C — persist external_adjudication + full cross-check
      // observability onto the in-memory progressState BEFORE markFailed runs.
      //
      // Why progressState (not a direct DB write):
      //   markFailed builds nextProgress as { ...progressState, ... }. Any field
      //   we write directly to the DB column here gets stomped by that spread.
      //   Copying onto progressState first guarantees the failure-path write
      //   includes the audit fields, closing the observability gap that left
      //   cross_check_output NULL across all jobs and PASS4_CANON_INVALID
      //   incidents with no audit trail.
      if (pipelineResult.external_adjudication) {
        const ext = pipelineResult.external_adjudication;
        progressState.cross_check_status = ext.status;
        progressState.cross_check_reason = 'reason' in ext ? ext.reason : null;
        progressState.external_adjudication_mode = ext.mode;
        progressState.external_adjudication_status = ext.status;
      }

      // PR-B: surface the full cross-check output and governance audit context
      // so a future operator can reconstruct exactly what Pass 4 saw without
      // having to re-run the job. We persist cross_check_output to the dedicated
      // jsonb column (which has been unused) AND mirror invalidCriteria into
      // progress.audit_invalid_criteria so /admin/pipeline-health can render it
      // without an additional DB read.
      const crossCheckColumnPatch: Record<string, unknown> = {};
      if (pipelineResult.cross_check) {
        progressState.audit_invalid_criteria = pipelineResult.cross_check.invalidCriteria;
        progressState.audit_canon_valid = pipelineResult.cross_check.canonValid;
        progressState.audit_overall_agreement = pipelineResult.cross_check.overallAgreement;
        crossCheckColumnPatch.cross_check_output = pipelineResult.cross_check;
        crossCheckColumnPatch.cross_check_completed_at =
          pipelineResult.cross_check.crossCheckedAt ?? new Date().toISOString();
      }
      if (pipelineResult.pass4_governance && !pipelineResult.pass4_governance.ok) {
        progressState.pass4_block_code = pipelineResult.pass4_governance.blockCode ?? null;
        progressState.pass4_block_severity = pipelineResult.pass4_governance.severity ?? null;
        progressState.pass4_audit_context =
          pipelineResult.pass4_governance.auditContext ?? null;
      }

      if (Object.keys(crossCheckColumnPatch).length > 0) {
        try {
          await supabase
            .from('evaluation_jobs')
            .update(crossCheckColumnPatch)
            .eq('id', job.id);
        } catch (persistErr) {
          // Non-fatal: progress-mirror persistence below still captures the audit
          // trail. Logged so we can spot column-write regressions in obs.
          console.warn(
            `[Processor] ${jobId}: failed to persist cross_check_output column on failure path:`,
            persistErr instanceof Error ? persistErr.message : String(persistErr),
          );
        }
      }

      await markFailed(pipelineError, pipelineResult.error_code || 'PIPELINE_ERROR', {
        pipelineStage: pipelineResult.failed_at,
        reasonCodes: [pipelineResult.error_code || 'PIPELINE_ERROR'],
        diagnostics: pipelineResult.failure_details,
      });

      return { success: false, error: pipelineError };
    }

    await assertJobWithinSla({
      supabase,
      jobId,
      hardDeadlineMs,
      stage: 'after_runPipeline',
      expectedLeaseToken,
      expectedClaimedBy,
    });

    const pass3CompletedAt = new Date().toISOString();
    progressState.pass3_completed_at = pass3CompletedAt;
    logProcessorStageBoundary({
      jobId,
      stage: 'pass3',
      state: 'complete',
      at: pass3CompletedAt,
      metadata: {
        score: pipelineResult.synthesis.overall.overall_score_0_100,
      },
    });

    if ((externalMode === 'required' || externalMode === 'veto') && !pipelineResult.cross_check) {
      const missingCrossCheckResultError =
        `External adjudication mode '${externalMode}' requires cross-check output`;
      await markFailed(missingCrossCheckResultError);

      return { success: false, error: missingCrossCheckResultError };
    }

    const providerCallPersistence = await persistPipelineProviderCalls({
      supabase,
      jobId: String(job.id),
      telemetry: pipelineResult.provider_telemetry,
      hasPass4CrossCheck: Boolean(pipelineResult.cross_check),
    });
    progressState.provider_call_persistence = providerCallPersistence;

    const scopeProfileForV2Gate =
      process.env.EVAL_SCOPE_PROFILE_ENABLED === 'true'
        ? classifySubmissionScope(manuscriptWithContent.content || '', chunkRouting.chunk_count)
        : undefined;

    // v2 adapter: produces EvaluationResultV2 with observability-aware status per criterion
    const evaluationResult = synthesisToEvaluationResultV2({
      synthesis: pipelineResult.synthesis,
      ids: {
        evaluation_run_id: crypto.randomUUID(),
        job_id: job.id,
        manuscript_id: manuscript.id,
        user_id: manuscript.user_id,
      },
      crossCheckResult: pipelineResult.cross_check,
      pass4Governance: pipelineResult.pass4_governance,
      // PR #506 — thread the explicit Pass 4 status so the report's
      // governance.transparency.external_adjudication block can render
      // "External Adjudication: Completed · Required Mode · packet=29568 chars"
      // (or skipped / failed_soft with reason) without any inference.
      externalAdjudication: pipelineResult.external_adjudication,
      sourceText: manuscriptWithContent.content || "",
      manuscriptText: manuscriptWithContent.content || "",
      title: manuscript.title ?? undefined,
      englishVariant: selectedEnglishVariant,
      scopeProfile: scopeProfileForV2Gate,
      llmEnrichment: pipelineResult.synthesis.enrichment,
    });

    // PR #506 — persist Pass 4 status onto the canonical JobProgress so the jobs
    // surface (and Supabase) reflect Pass 4 truth instead of leaving cross_check_status
    // null. JobProgress is a typed-loose jsonb (`[k: string]: unknown`) so no
    // schema migration is needed.
    //
    // PR-B: also persist cross_check_output to the dedicated jsonb column and
    // mirror invalidCriteria / agreement / canonValid onto progressState so the
    // success path leaves the same observability surface as the failure path.
    if (pipelineResult.external_adjudication) {
      try {
        const successColumnPatch: Record<string, unknown> = {
          progress: {
            ...((job.progress as Record<string, unknown> | null) ?? {}),
            cross_check_status: pipelineResult.external_adjudication.status,
            cross_check_reason:
              'reason' in pipelineResult.external_adjudication
                ? pipelineResult.external_adjudication.reason
                : null,
            external_adjudication_mode: pipelineResult.external_adjudication.mode,
            external_adjudication_status: pipelineResult.external_adjudication.status,
            ...(pipelineResult.cross_check
              ? {
                  audit_invalid_criteria: pipelineResult.cross_check.invalidCriteria,
                  audit_canon_valid: pipelineResult.cross_check.canonValid,
                  audit_overall_agreement: pipelineResult.cross_check.overallAgreement,
                }
              : {}),
          },
        };
        if (pipelineResult.cross_check) {
          successColumnPatch.cross_check_output = pipelineResult.cross_check;
          successColumnPatch.cross_check_completed_at =
            pipelineResult.cross_check.crossCheckedAt ?? new Date().toISOString();
        }
        await supabase
          .from('evaluation_jobs')
          .update(successColumnPatch)
          .eq('id', job.id);
      } catch (persistErr) {
        // Non-fatal: report still carries authoritative status; this is for the jobs surface.
        console.warn(
          `[Processor] ${jobId}: failed to persist external_adjudication onto progress:`,
          persistErr instanceof Error ? persistErr.message : String(persistErr),
        );
      }
    }
    console.log(
      `[Processor] ${jobId}: evaluationResult synthesized overall=${evaluationResult.overview.overall_score_0_100}`,
    );

    const artifactCriteria = evaluationResult.criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.score_0_10,
      reasoning: criterion.rationale,
      evidence: criterion.evidence.map((item) => item.snippet).filter(Boolean).join(' | '),
      interpretation: '',
    }));
    const scoreLedger =
      artifactCriteria.length > 0
        ? buildScoreLedger({
            criteria: artifactCriteria.map((criterion) => ({
              key: criterion.key,
              final_score_0_10: criterion.final_score_0_10,
            })),
          })
        : {
            rawTotal: 0,
            maxTotal: 0,
            normalized: 0,
            weighting: 'weighted' as const,
            authorityComposite: computeAuthorityComposite([]),
          };
    const excellenceFilter = buildExcellenceFilter({
      criteria: artifactCriteria.map((criterion) => ({
        key: criterion.key,
        final_score_0_10: criterion.final_score_0_10,
      })),
    });

    let qualityGateV2 = runQualityGateV2(evaluationResult, {
      criteria: artifactCriteria,
      ledger: scoreLedger,
      efg: excellenceFilter,
    }, scopeProfileForV2Gate);

    // ── Deterministic QG summary weakness repair ─────────────────────────────
    // If the ONLY hard failure is v2_summary_weakness_presence, the evaluation
    // content is valid — only the overview summary text omitted bottom-score
    // weakness criteria names. Repair deterministically (no LLM retry) by
    // patching the summary with normalizeSummaryWithBottomWeaknesses, then
    // re-run QG. This avoids killing an otherwise complete evaluation over a
    // presentation/template defect.
    if (!qualityGateV2.pass) {
      const hardFailedChecks = qualityGateV2.checks.filter((check) => !check.passed);
      const isOnlySummaryWeakness =
        hardFailedChecks.length === 1 &&
        hardFailedChecks[0].check_id === 'v2_summary_weakness_presence';

      if (isOnlySummaryWeakness) {
        const propagation = summarizePropagationIntegrity(evaluationResult.criteria);
        const repairedSummary = normalizeSummaryWithBottomWeaknesses(
          evaluationResult.overview.one_paragraph_summary,
          propagation.bottomScoreCriteria,
        );

        console.log(
          `[Processor] ${jobId}: deterministic QG summary repair — patching overview summary to name bottom-score weaknesses: ${propagation.bottomScoreCriteria.join(', ')}`,
        );

        evaluationResult.overview.one_paragraph_summary = repairedSummary;

        qualityGateV2 = runQualityGateV2(evaluationResult, {
          criteria: artifactCriteria,
          ledger: scoreLedger,
          efg: excellenceFilter,
        }, scopeProfileForV2Gate);

        if (qualityGateV2.pass) {
          console.log(
            `[Processor] ${jobId}: QG summary repair succeeded — evaluation continues`,
          );
        }
      }
    }

    if (!qualityGateV2.pass) {
      const failedChecks = qualityGateV2.checks
        .filter((check) => !check.passed)
        .map((check) => `${check.check_id}: ${check.details ?? check.error_code ?? 'failed'}`);
      const gateError = `[QualityGateV2] ${failedChecks.join('; ')}`;

      // ── V2 gate diagnostic persistence (fail-soft) ──────────────────────────
      // Persist forensic artifacts BEFORE marking job failed so any V2 gate trip
      // is reconstructable from evaluation_artifacts without flying blind.
      // Mirrors the Phase 2.7 gate diagnostic pattern for pass4 failures.
      const v2GateFailedAt = new Date().toISOString();
      progressState.v2_gate_status = 'failed';
      progressState.v2_gate_failed_at = v2GateFailedAt;

      try {
        // Build per-criterion gate view for the diagnostics artifact.
        const v2PerCriterion = evaluationResult.criteria.map((c) => {
          const score = typeof c.score_0_10 === 'number' ? c.score_0_10 : null;
          const confidence = c.confidence_score_0_100 ?? null;
          const confidenceLabel = c.confidence_level ?? null;
          const scoreCapApplies = c.status === 'SCORABLE' && confidenceLabel === 'low';
          const violated =
            scoreCapApplies &&
            typeof score === 'number' &&
            score > QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE;
          const reasons: string[] = [];
          if (violated) {
            reasons.push(
              `score=${score} exceeds cap=${QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE} for low-confidence criterion`,
            );
          }
          return {
            criterion_key: c.key,
            score,
            confidence,
            confidence_label: confidenceLabel,
            score_cap_applies: scoreCapApplies,
            violated,
            reasons,
          };
        });

        const v2FailedCriteria = v2PerCriterion
          .filter((pc) => pc.violated)
          .map((pc) => ({
            criterion_key: pc.criterion_key,
            score: pc.score,
            confidence: pc.confidence,
            reasons: pc.reasons,
          }));

        const evidenceAnchorsByCriterion: Record<string, string[]> = {};
        for (const c of evaluationResult.criteria) {
          evidenceAnchorsByCriterion[c.key] = c.evidence
            .map((e) => e.snippet)
            .filter((s) => typeof s === 'string' && s.trim().length > 0);
        }

        // Artifact 1: Pass 2 outputs the V2 gate consumed (per-criterion).
        const v2PassOutputsHash = stableSourceHash({
          manuscriptId: manuscript.id,
          jobId: job.id,
          userId: manuscriptWithContent.user_id,
          manuscriptText: manuscriptWithContent.content || '(No content provided)',
          promptVersion: `pass_outputs_diagnostic_v1:QG_FAILED:v2_gate:${v2GateFailedAt}`,
          model: getCanonicalPipelineModel(openAiModel),
        });

        await upsertEvaluationArtifact({
          supabase,
          jobId: job.id,
          manuscriptId: job.manuscript_id,
          artifactType: 'pass_outputs_diagnostic_v1',
          artifactVersion: 'pass_outputs_diagnostic_v1',
          sourceHash: v2PassOutputsHash,
          content: {
            schema_version: 'pass_outputs_diagnostic_v1',
            created_at: v2GateFailedAt,
            job_id: job.id,
            manuscript_id: manuscript.id,
            failed_at: 'v2_gate',
            error_code: 'QG_FAILED',
            per_criterion: evaluationResult.criteria.map((c) => ({
              criterion_key: c.key,
              status: c.status,
              score: typeof c.score_0_10 === 'number' ? c.score_0_10 : null,
              confidence: c.confidence_score_0_100 ?? null,
              confidence_label: c.confidence_level ?? null,
              scorability_status: c.scorability_status ?? null,
              rationale: c.rationale,
              evidence_anchors: c.evidence
                .map((e) => e.snippet)
                .filter((s) => typeof s === 'string' && s.trim().length > 0),
            })),
          },
        });

        console.log(`[Processor] ${jobId}: persisted pass_outputs_diagnostic_v1 for V2 gate failure`);

        // Artifact 2: V2 gate's own view — per-criterion gate state + failed criteria.
        const v2GateDiagnosticsHash = stableSourceHash({
          manuscriptId: manuscript.id,
          jobId: job.id,
          userId: manuscriptWithContent.user_id,
          manuscriptText: manuscriptWithContent.content || '(No content provided)',
          promptVersion: `quality_gate_diagnostics_v1:QG_FAILED:v2_gate:${v2GateFailedAt}`,
          model: getCanonicalPipelineModel(openAiModel),
        });

        await upsertEvaluationArtifact({
          supabase,
          jobId: job.id,
          manuscriptId: job.manuscript_id,
          artifactType: 'quality_gate_diagnostics_v1',
          artifactVersion: 'quality_gate_diagnostics_v1',
          sourceHash: v2GateDiagnosticsHash,
          content: {
            schema_version: 'quality_gate_diagnostics_v1',
            created_at: v2GateFailedAt,
            job_id: job.id,
            manuscript_id: manuscript.id,
            failed_at: 'v2_gate',
            gate_id: 'v2_fidelity_score_confidence_alignment',
            gate_version: 'v2',
            score_cap_for_low_confidence: QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
            failed_checks: failedChecks,
            per_criterion: v2PerCriterion,
            failed_criteria: v2FailedCriteria,
            evidence_anchors_by_criterion: evidenceAnchorsByCriterion,
          },
        });

        console.log(`[Processor] ${jobId}: persisted quality_gate_diagnostics_v1 for V2 gate failure`);
      } catch (v2DiagnosticPersistError) {
        console.warn(
          `[Processor] ${jobId}: failed to persist V2 gate diagnostic artifacts (non-fatal)`,
          v2DiagnosticPersistError instanceof Error
            ? v2DiagnosticPersistError.message
            : String(v2DiagnosticPersistError),
          v2DiagnosticPersistError,
        );
      }

      await markFailed(gateError, 'QG_FAILED');

      return { success: false, error: gateError };
    }

    const artifactGateDecision = qualityGateV2.artifactGate ?? {
      verdict: 'PASS',
      reasonCodes: [] as string[],
      validatedAt: new Date().toISOString(),
      enforcementMode: 'enforce' as const,
    };

    const effectiveEvaluationResult =
      qualityGateV2.downgradedResult ?? evaluationResult;

    const effectiveArtifactCriteria = effectiveEvaluationResult.criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.score_0_10,
      reasoning: criterion.rationale,
      evidence: criterion.evidence.map((item) => item.snippet).filter(Boolean).join(' | '),
      interpretation: '',
    }));
    const effectiveScoreLedger =
      effectiveArtifactCriteria.length > 0
        ? buildScoreLedger({
            criteria: effectiveArtifactCriteria.map((criterion) => ({
              key: criterion.key,
              final_score_0_10: criterion.final_score_0_10,
            })),
          })
        : {
            rawTotal: 0,
            maxTotal: 0,
            normalized: 0,
            weighting: 'weighted' as const,
            authorityComposite: computeAuthorityComposite([]),
          };
    const effectiveExcellenceFilter = buildExcellenceFilter({
      criteria: effectiveArtifactCriteria.map((criterion) => ({
        key: criterion.key,
        final_score_0_10: criterion.final_score_0_10,
      })),
    });

    effectiveEvaluationResult.governance.warnings = [
      ...(effectiveEvaluationResult.governance.warnings ?? []),
      ...(qualityGateV2.warnings ?? []),
      ...(artifactGateDecision.reasonCodes.length > 0
        ? [
            `[ArtifactValidation:${artifactGateDecision.verdict}] reason_codes=${artifactGateDecision.reasonCodes.join(',')}`,
          ]
        : []),
      ...(nonEvaluativeWarning ? [nonEvaluativeWarning] : []),
    ];
    // D2 transparency fields — required by hasD2TransparencyFields() to release the report.
    // Build criteria_plan from the actual scored criteria: NOT_APPLICABLE → NA, all others → R.
    const d2CriteriaPlanR: string[] = [];
    const d2CriteriaPlanNA: string[] = [];
    for (const c of effectiveEvaluationResult.criteria) {
      if ((c as { status?: string }).status === 'NOT_APPLICABLE') {
        d2CriteriaPlanNA.push(c.key);
      } else {
        d2CriteriaPlanR.push(c.key);
      }
    }
    // Ensure every canonical key is accounted for (fail-safe: any missing key goes to R)
    for (const key of CRITERIA_KEYS) {
      if (!d2CriteriaPlanR.includes(key) && !d2CriteriaPlanNA.includes(key)) {
        d2CriteriaPlanR.push(key);
      }
    }
    const d2EvalRunId = effectiveEvaluationResult.ids?.evaluation_run_id ?? crypto.randomUUID();
    const d2MatrixVersion = 'work_type_matrix.v1';
    const d2WorkType = effectiveWorkType.toLowerCase().replace(/\s+/g, '_');
    const d2GeneratedAt = new Date().toISOString();
    const d2ReproAnchor = `${d2EvalRunId}|${d2GeneratedAt}|${d2MatrixVersion}`;

    effectiveEvaluationResult.governance.transparency = {
      ...(effectiveEvaluationResult.governance.transparency ?? {}),
      // D2 required fields (must remain non-empty for report gate to pass)
      final_work_type_used: d2WorkType,
      matrix_version: d2MatrixVersion,
      repro_anchor: d2ReproAnchor,
      criteria_plan: {
        R: d2CriteriaPlanR,
        O: [],
        NA: d2CriteriaPlanNA,
        C: [],
      },
      // Existing fields
      artifact_validation_result: artifactGateDecision.verdict,
      artifact_reason_codes: artifactGateDecision.reasonCodes,
      artifact_validated_at: artifactGateDecision.validatedAt,
      score_ledger: {
        raw_total: effectiveScoreLedger.rawTotal,
        max_total: effectiveScoreLedger.maxTotal,
        normalized_total: effectiveScoreLedger.normalized,
        weighting: effectiveScoreLedger.weighting,
      },
      excellence_filter: {
        verdict: effectiveExcellenceFilter.verdict,
        blocking_criteria: effectiveExcellenceFilter.blockingCriteria,
      },
    };

    const governanceBridgeProjection = mapEvaluationResultV2ToGovernanceEnvelope(
      effectiveEvaluationResult,
    );
    console.log(
      `[Processor] ${jobId}: governance bridge projected ${governanceBridgeProjection.criteria.length} scorable criterion/criteria`,
    );

    if (evalContextContaminationGuardEnabled) {
      const contaminationCheck = detectContextContamination({
        sourceText: manuscriptWithContent.content || '',
        evaluationResult: effectiveEvaluationResult,
      });

      if (contaminationCheck.contaminated) {
        console.error(`[Processor] ${jobId}: context contamination detected`, {
          offending_entities: contaminationCheck.offendingEntities,
          reasons: contaminationCheck.reasons,
        });
        const contaminationDetail = JSON.stringify({
          code: 'CONTEXT_CONTAMINATION_DETECTED',
          offending_entities: contaminationCheck.offendingEntities.slice(0, 10),
          reasons: contaminationCheck.reasons.slice(0, 10),
        });
        await markFailed(contaminationDetail, 'CONTEXT_CONTAMINATION_DETECTED');

        return { success: false, error: 'CONTEXT_CONTAMINATION_DETECTED' };
      }
    }

    const synthesisCoverage = pipelineResult.synthesis.coverage_scope;
    const promptCoverage = summarizePromptCoverage(manuscriptWithContent.content || '');
    const coverageForReporting = synthesisCoverage
      ? {
          sourceChars: synthesisCoverage.sourceChars,
          sourceWords: synthesisCoverage.sourceWords,
          analyzedChars: synthesisCoverage.analyzedChars,
          analyzedWords: synthesisCoverage.analyzedWords,
          strategy: synthesisCoverage.strategy,
        }
      : {
          sourceChars: promptCoverage.sourceChars,
          sourceWords: promptCoverage.sourceWords,
          analyzedChars: promptCoverage.analyzedChars,
          analyzedWords: promptCoverage.analyzedWords,
          strategy: promptCoverage.strategy,
        };
    const coverageIsFull =
      !pipelineResult.synthesis.partial_evaluation &&
      (coverageForReporting.strategy === 'full_text' ||
        coverageForReporting.strategy === 'full_chunk_map_reduce');

    effectiveEvaluationResult.metrics.manuscript = {
      ...effectiveEvaluationResult.metrics.manuscript,
      word_count: coverageForReporting.sourceWords,
      char_count: coverageForReporting.sourceChars,
      genre: manuscriptWithContent.work_type || 'Unknown',
    };
    effectiveEvaluationResult.metrics.processing = {
      ...effectiveEvaluationResult.metrics.processing,
      segment_count:
        chunkRouting.route === 'long_form'
          ? Math.max(1, chunkRouting.chunk_count)
          : coverageForReporting.strategy === 'sampled_beginning_middle_end'
            ? 3
            : 1,
    };
    effectiveEvaluationResult.governance.limitations = [
      coverageIsFull
        ? coverageForReporting.strategy === 'full_chunk_map_reduce'
          ? `Pass 1 and Pass 2 analyzed full submission coverage via chunk map/reduce (${coverageForReporting.sourceWords} words across ${Math.max(1, chunkRouting.chunk_count)} chunk(s)).`
          : `Pass 1 and Pass 2 analyzed the full submission (${coverageForReporting.sourceWords} words).`
        : coverageForReporting.strategy === 'partial_chunk_map_reduce'
          ? `Pass 1 and Pass 2 analyzed partial chunk coverage (~${coverageForReporting.analyzedWords} of ${coverageForReporting.sourceWords} words) and cannot claim manuscript-wide full coverage.`
          : `Pass 1 and Pass 2 analyzed a sampled prompt window (~${coverageForReporting.analyzedWords} of ${coverageForReporting.sourceWords} words; ${promptCoverage.budgetChars}-char budget).`,
      'Pass 3 synthesis uses the full manuscript for deep context grounding.',
      ...(nonEvaluativeWarning ? [nonEvaluativeWarning] : []),
      ...effectiveEvaluationResult.governance.limitations.filter(
        (item) =>
          item !== 'Single-chunk evaluation; multi-chunk synthesis in Phase 2.8' &&
          item !== 'Full manuscript context may not be captured if truncated',
      ),
    ];

    console.log(`[Processor] Canonical pipeline evaluation generated for job ${jobId}`);

    await assertJobWithinSla({
      supabase,
      jobId,
      hardDeadlineMs,
      stage: 'before_persistence',
      expectedLeaseToken,
      expectedClaimedBy,
    });

    // Declare persistence lock — tells watchdog "I'm in a critical section,
    // do NOT kill me." Uses future timestamp so watchdog's stale-pulse query
    // naturally skips this job.
    declarePersistenceLock('persistence/lock-acquired');
    await markRunning(
      'Persisting evaluation artifacts',
      98,
      executionPhase === 'phase_3' ? 'phase_3' : 'phase_2',
    );

    const existingProgress = { ...progressState };

    // 5. Persist canonical artifact with idempotent upsert (fail-closed)
    const manuscriptText = manuscriptWithContent.content || '(No content provided)';
    const model = effectiveEvaluationResult.engine?.model || 'unknown-model';
    const promptVersion = effectiveEvaluationResult.engine?.prompt_version || 'unknown-prompt';

    const sourceHash = stableSourceHash({
      manuscriptId: manuscript.id,
      jobId: job.id,
      userId: manuscriptWithContent.user_id,
      manuscriptText,
      promptVersion,
      model,
    });

    if (!Number.isFinite(job.manuscript_id) || job.manuscript_id <= 0) {
      const invalidManuscriptIdError = `Invalid job.manuscript_id for artifact persistence: ${job.manuscript_id}`;
      await markFailed(invalidManuscriptIdError);

      return { success: false, error: invalidManuscriptIdError };
    }

    // ── Template Completeness Gate ──────────────────────────────────────────
    // Validates that the evaluation artifact meets the short-form template's
    // structural requirements BEFORE persisting. If critical violations are
    // detected, the artifact is NOT persisted and support is alerted.
    const templateCompletenessCheck = validateTemplateCompleteness(effectiveEvaluationResult);
    if (!templateCompletenessCheck.pass) {
      console.error(
        `[Processor] ${jobId}: Template completeness gate FAILED — ${templateCompletenessCheck.violations.length} violation(s)`,
        templateCompletenessCheck.summary,
      );

      await markFailed(
        TEMPLATE_COMPLETENESS_USER_MESSAGE,
        TEMPLATE_COMPLETENESS_FAILURE_CODE,
        {
          pipelineStage: 'template_completeness_gate',
          reasonCodes: templateCompletenessCheck.violations.map((violation) => violation.code),
          diagnostics: {
            gate: 'template_completeness',
            summary: templateCompletenessCheck.summary,
            critical_count: templateCompletenessCheck.violations.filter(
              (violation) => violation.severity === 'critical',
            ).length,
            warning_count: templateCompletenessCheck.violations.filter(
              (violation) => violation.severity === 'warning',
            ).length,
            violations: templateCompletenessCheck.violations.map((violation) => ({
              code: violation.code,
              criterion: violation.criterion ?? null,
              severity: violation.severity,
              message: violation.message,
            })),
          },
        },
      );

      return { success: false, error: templateCompletenessCheck.summary };
    }

    if (templateCompletenessCheck.violations.length > 0) {
      console.warn(
        `[Processor] ${jobId}: Template completeness gate passed with ${templateCompletenessCheck.violations.length} warning(s)`,
        templateCompletenessCheck.violations.map((v) => v.code),
      );
    }

    declarePersistenceLock('persistence/after-template-completeness');

    const persistArtifactsStartedAt = startLatencyStage({
      jobId,
      stage: 'persist_artifacts',
      metadata: {
        manuscript_id: job.manuscript_id,
      },
    });

    try {
      console.log(
        `[Processor] ${jobId}: ENTER persistEvaluationResultV2 manuscriptId=${job.manuscript_id}`,
      );

      const finalizeStartedAt = startLatencyStage({
        jobId,
        stage: 'finalize',
        metadata: {
          state: 'completion_update_started',
        },
      });

      const persistenceResult = await persistEvaluationResultV2({
        supabase,
        jobId: job.id,
        manuscriptId: job.manuscript_id,
        evaluationResult: effectiveEvaluationResult,
        sourceHash,
        progressSnapshot: existingProgress,
        totalUnits: EVALUATION_PROGRESS_TOTAL_UNITS,
        completedUnits: EVALUATION_PROGRESS_TOTAL_UNITS,
        onHeartbeat: () => declarePersistenceLock('persistence/during-persist'),
      });

      if (!persistenceResult.persisted) {
        const failureReason = 'reason' in persistenceResult
          ? persistenceResult.reason
          : 'Boundary rejected persistence without reason';

        finishLatencyStage({
          jobId,
          stage: 'persist_artifacts',
          startedAt: persistArtifactsStartedAt,
          state: 'failed',
          metadata: {
            finish_reason: failureReason,
          },
        });

        finishLatencyStage({
          jobId,
          stage: 'finalize',
          startedAt: finalizeStartedAt,
          state: 'failed',
          metadata: {
            finish_reason: failureReason,
          },
        });

        return { success: false, error: failureReason };
      }

      // Release persistence lock — resume normal watchdog visibility.
      pulseWorker('persistence/lock-released');

      console.log(
        `[Processor] ${jobId}: EXIT persistEvaluationResultV2 artifactId=${persistenceResult.artifactId}`,
      );

      // Pass 3b artifact persistence moved to /api/workers/process-dream (issue #543).
      // DREAM worker polls for complete long-form jobs lacking longform_document_v1 artifact.

      finishLatencyStage({
        jobId,
        stage: 'persist_artifacts',
        startedAt: persistArtifactsStartedAt,
        state: 'completed',
      });

      finishLatencyStage({
        jobId,
        stage: 'finalize',
        startedAt: finalizeStartedAt,
        state: 'completed',
      });

      logProcessorStageBoundary({
        jobId,
        stage: 'finalized',
        state: 'complete',
        at: persistenceResult.completedAt,
      });

      // ── Phase 2 → Phase 3 handoff (WAVE Readiness Layer owns its own 720s invocation) ──
      // Evaluation is fully complete. If WAVE eligible, queue phase_3 for the next
      // cron tick. If not eligible, mark job complete now.
      // WAVE gate: wordCount >= 25,000 AND all 13 criteria final_score_0_10 >= 6.0
      //            AND CharacterLedgerV2 available (not empty/null from phase_1a)
      const phase2Now = new Date().toISOString();
      const coverageWords = coverageForReporting?.sourceWords ?? 0;
      const finalScores = pipelineResult.synthesis?.criteria ?? [];
      const isWaveEligibleWord = coverageWords >= WAVE_MIN_WORDS;
      const isWaveEligibleCriteria = finalScores.length === 13 &&
        finalScores.every((c: { final_score_0_10?: number; score_0_10?: number }) =>
          ((c.final_score_0_10 ?? c.score_0_10 ?? 0) >= WAVE_MIN_CRITERION_SCORE)
        );
      // CharacterLedgerV2 gate: must be present and non-empty.
      // pipelineResult.characterLedgerV2 is undefined when Pass 1A produced zero chunk
      // outputs (either in phase_1a soft-skip path or single-invocation fallback).
      const isWaveEligibleLedger = !!pipelineResult.characterLedgerV2;
      const isWaveEligible = isWaveEligibleWord && isWaveEligibleCriteria && isWaveEligibleLedger;

      console.log(`[Processor] ${jobId}: phase_2 complete — WAVE eligible=${isWaveEligible}`, {
        word_count: coverageWords,
        min_words: WAVE_MIN_WORDS,
        criteria_count: finalScores.length,
        wave_eligible_word: isWaveEligibleWord,
        wave_eligible_criteria: isWaveEligibleCriteria,
        wave_eligible_ledger: isWaveEligibleLedger,
      });

      if (isWaveEligible) {
        // Stabilization pause before WAVE — let synthesis artifacts fully commit.
        console.log(`[Processor] ${jobId}: stabilizing before WAVE`);
        await stabilize();

        if (executionPhase === 'phase_3') {
          // Already in phase_3 (Pass 3B synthesis just ran inline). Run WAVE
          // inline non-fatally and complete. Never re-queue phase_3.
          console.log(`[Processor] ${jobId}: phase_3 — synthesis persisted, running WAVE inline`);
          try {
            const synthesisP3 = pipelineResult.synthesis;
            const ledgerV2P3 = pipelineResult.characterLedgerV2 as CharacterLedgerV2 | undefined;
            const wordCountP3 = coverageForReporting?.sourceWords ?? 0;
            const waveHandoffP3 = {
              manuscriptText: manuscriptWithContent.content || '',
              synthesis: synthesisP3,
              characterLedgerV2: ledgerV2P3,
              wordCount: wordCountP3,
              jobId,
              manuscriptVersionId: (job.manuscript_version_id as string | null) ?? null,
            };
            const waveStartMsP3 = Date.now();
            let waveResultP3: import('@/lib/evaluation/waveRevision').WaveRevisionResult | null = null;
            try {
              waveResultP3 = await Promise.race([
                (await import('@/lib/evaluation/waveRevision')).executeWaveRevision(waveHandoffP3),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('WAVE_TIMEOUT')), 60_000)
                ),
              ]);
            } catch (waveErr) {
              const errMsg = waveErr instanceof Error ? waveErr.message : String(waveErr);
              const isTimeout = errMsg === 'WAVE_TIMEOUT';
              const reasonCode = isTimeout
                ? 'WAVE_TIMEOUT'
                : errMsg.includes('WAVE_SOURCE_VERSION_RESOLUTION_FAILED')
                  ? 'WAVE_SOURCE_VERSION_RESOLUTION_FAILED'
                  : errMsg.includes('createRevisionSession failed')
                    ? 'WAVE_SESSION_CREATE_FAILED'
                    : 'WAVE_ERROR';
              console.warn(`[WAVE/Phase3-inline] ${isTimeout ? 'Timeout' : 'Error'} for job ${jobId} (${Date.now() - waveStartMsP3}ms):`, errMsg);
              const failedPlan = {
                status: 'failed' as const,
                reason_code: reasonCode,
                reason: errMsg,
                retryable: isTimeout,
                generated_at: new Date().toISOString(),
              };
              try {
                const waveFailHash = stableSourceHash({
                  manuscriptId: manuscript.id,
                  jobId: job.id,
                  userId: manuscriptWithContent.user_id,
                  manuscriptText: manuscriptWithContent.content || '',
                  promptVersion: `wave_revision_plan_v1:${failedPlan.status}`,
                  model: 'wave_deterministic',
                });
                await upsertEvaluationArtifact({
                  supabase,
                  jobId: job.id,
                  manuscriptId: job.manuscript_id,
                  artifactType: 'wave_revision_plan_v1',
                  artifactVersion: 'wave_revision_plan_v1',
                  sourceHash: waveFailHash,
                  content: failedPlan,
                });
              } catch (artifactErr) {
                console.error(`[WAVE/Phase3-inline] Failed to persist failure artifact for job ${jobId} (non-fatal):`,
                  artifactErr instanceof Error ? artifactErr.message : String(artifactErr));
              }
            }
            if (waveResultP3) {
              try {
                const wavePlanHash = stableSourceHash({
                  manuscriptId: manuscript.id,
                  jobId: job.id,
                  userId: manuscriptWithContent.user_id,
                  manuscriptText: manuscriptWithContent.content || '',
                  promptVersion: `wave_revision_plan_v1:${waveResultP3.plan.status}`,
                  model: 'wave_deterministic',
                });
                await upsertEvaluationArtifact({
                  supabase,
                  jobId: job.id,
                  manuscriptId: job.manuscript_id,
                  artifactType: 'wave_revision_plan_v1',
                  artifactVersion: 'wave_revision_plan_v1',
                  sourceHash: wavePlanHash,
                  content: waveResultP3.plan,
                });
                console.log(`[WAVE/Phase3-inline] Artifact persisted for job ${jobId} — status=${waveResultP3.plan.status}`);
              } catch (artifactErr) {
                console.error(`[WAVE/Phase3-inline] Failed to persist success artifact for job ${jobId} (non-fatal):`,
                  artifactErr instanceof Error ? artifactErr.message : String(artifactErr));
              }
            }
          } catch (waveOuterErr) {
            // WAVE never blocks completion.
            console.error(`[WAVE/Phase3-inline] ${jobId}: outer WAVE error (non-fatal)`,
              waveOuterErr instanceof Error ? waveOuterErr.message : String(waveOuterErr));
          }

          // ── Canon Governance Runner (non-blocking, fire-and-forget) ──────
          try {
            const { runCanonGovernance } = await import('@/lib/evaluation/canonGovernanceRunner');
            const inlineCriteriaKeys = Array.isArray(finalScores)
              ? (finalScores as Array<{ key?: string }>).map(c => c.key).filter((k): k is string => typeof k === 'string')
              : [];
            const canonResult = await Promise.race([
              runCanonGovernance({
                manuscriptText: manuscriptWithContent.content || '',
                jobId: job.id,
                manuscriptId: job.manuscript_id,
                userId: manuscriptWithContent.user_id,
                criteriaKeys: inlineCriteriaKeys,
                wordCount: coverageWords,
              }, supabase),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
            ]);
            if (canonResult) {
              const layers = [
                canonResult.gate15 ? `Gate15=${canonResult.gate15.overallStatus}` : null,
                canonResult.goldenSpine ? `GoldenSpine=${canonResult.goldenSpine.overallStatus}` : null,
                canonResult.dialogueCanon ? `Dialogue=${canonResult.dialogueCanon.overallStatus}` : null,
                canonResult.revisionCanonMetadata ? `RevMeta=${canonResult.revisionCanonMetadata.overallStatus}` : null,
              ].filter(Boolean).join(', ');
              console.log(`[CanonGovernance/Phase3-inline] ${job.id}: ${layers}`);
            }
          } catch (canonErr) {
            console.error(`[CanonGovernance/Phase3-inline] ${job.id}: non-fatal error`,
              canonErr instanceof Error ? canonErr.message : String(canonErr));
          }

          // Complete the job — synthesis persisted, WAVE attempted.
          nextLifecycleStatus(JOB_STATUS.COMPLETE);
          const phase3InlineNow = new Date().toISOString();
          const { error: phase3CompleteErr } = await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.COMPLETE,
              phase: 'phase_3',
              phase_status: 'complete',
              completed_at: phase3InlineNow,
              updated_at: phase3InlineNow,
              progress: {
                ...progressState,
                completed_units: 100,
                phase: 'phase_3',
                phase_status: 'complete',
                message: 'Pass 3B synthesis + WAVE complete',
                phase3_completed_at: phase3InlineNow,
              },
            })
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING);
          if (phase3CompleteErr) {
            console.error(`[Processor] ${jobId}: phase_3 inline completion update failed`, phase3CompleteErr.message);
          }
          return { success: true };
        }

        // Default path (phase_2 → queue phase_3 for next invocation).
        const { data: phase3QueueRow, error: phase3QueueErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED,
            phase: 'phase_3',
            phase_status: JOB_STATUS.QUEUED,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            updated_at: phase2Now,
            progress: {
              ...progressState,
              completed_units: 90,
              phase: 'phase_2',
              phase_status: 'complete',
              message: 'Evaluation complete — queued for WAVE readiness layer',
              phase2_completed_at: phase2Now,
            },
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING)
          .select('id, status, phase, phase_status')
          .single();

        if (phase3QueueErr) {
          console.error(`[Processor] ${jobId}: phase_3 queue transition FAILED (non-fatal — evaluation complete)`, phase3QueueErr.message);
          // Fall through: mark job complete even if WAVE queue fails
        } else if (phase3QueueRow?.status === JOB_STATUS.QUEUED) {
          console.log(`[Processor] ${jobId}: phase_2 → phase_3 queued — stabilizing before WAVE invocation`);
          // Stabilization pause so the phase_3/queued write is visible to the next worker.
          await stabilize(STABILIZE_SELF_CHAIN_MS);
          return { success: true };
        }
        // If queue transition returned 0 rows, job already transitioned — fall through to complete
      }

      // Not WAVE eligible (or queue failed) — mark job complete now
      nextLifecycleStatus(JOB_STATUS.COMPLETE);
    } catch (artifactError) {
      finishLatencyStage({
        jobId,
        stage: 'persist_artifacts',
        startedAt: persistArtifactsStartedAt,
        state: 'failed',
        metadata: {
          finish_reason: artifactError instanceof Error ? artifactError.message : String(artifactError),
        },
      });

      const errorMsg = artifactError instanceof Error ? artifactError.message : String(artifactError);
      await markFailed(`Artifact persistence failed: ${errorMsg}`, 'ARTIFACT_PERSISTENCE_FAILED', {
        pipelineStage: 'phase_2',
        reasonCodes: ['ARTIFACT_PERSISTENCE_FAILED'],
      });

      return { success: false, error: `Artifact persistence failed: ${errorMsg}` };
    }

    console.log(`[Processor] Job ${jobId} completed successfully`);

    void pipelineLog({
      jobId,
      level: 'info',
      stage: 'processor_complete',
      message: 'Job completed',
      metadata: {
        status: 'complete',
        score: pipelineResult.synthesis?.overall?.overall_score_0_100 ?? null,
        totalMs: Date.now() - processorStartMs,
        failureCode: null,
      },
    });

    return { success: true };

  } catch (error) {
    if (isProcessorLeaseLostError(error)) {
      console.error('[Processor][PROCESSOR_LEASE_LOST] processor aborted without fallback mutation', {
        job_id: jobId,
        message: error.message,
      });
      return { success: false, error: error.message };
    }

    if (error instanceof PipelineSlaExceededError) {
      console.warn('[Processor] Job aborted at SLA boundary', {
        job_id: jobId,
      });
      return { success: false, error: error.message };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Processor] Error processing job ${jobId}:`, errorMessage);

    void pipelineLog({
      jobId,
      level: 'error',
      stage: 'processor_uncaught',
      message: 'Processor uncaught error',
      metadata: {
        status: 'failed',
        score: null,
        totalMs: Date.now() - processorStartMs,
        failureCode: 'PROCESSOR_UNCAUGHT_ERROR',
      },
    });

    const now = new Date().toISOString();
    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    if (lifecycleStatus && lifecycleStatus !== failedStatus) {
      assertValidJobStatusTransition(lifecycleStatus, failedStatus);
    }

    // Route uncaught errors through centralized failure finalizer
    try {
      if ((expectedLeaseToken && !expectedClaimedBy) || (!expectedLeaseToken && expectedClaimedBy)) {
        throw new Error(
          `[Processor] Incomplete claimed-owner metadata in uncaught path for job ${jobId}`,
        );
      }

      if (expectedLeaseToken && expectedClaimedBy) {
        await finalizeProcessorFailureWithLeaseGuard({
          jobId,
          expectedLeaseToken,
          expectedClaimedBy,
          errorEnvelope: {
            code: 'PROCESSOR_UNCAUGHT_ERROR',
            message: errorMessage,
            retryable: false, // Conservative: uncaught errors are terminal until investigated
          },
        });
      } else {
        await finalizeJobFailure({
          jobId,
          errorEnvelope: {
            code: 'PROCESSOR_UNCAUGHT_ERROR',
            message: errorMessage,
            retryable: false, // Conservative: uncaught errors are terminal until investigated
          },
        });
      }
    } catch (finalizeError) {
      if (isProcessorLeaseLostError(finalizeError)) {
        console.error('[Processor][PROCESSOR_LEASE_LOST] terminal write skipped in uncaught path; no fallback mutation attempted', {
          job_id: jobId,
          message:
            finalizeError instanceof Error
              ? finalizeError.message
              : String(finalizeError),
        });
        return { success: false, error: errorMessage };
      }

      console.error(
        `[Processor] Failed to finalize uncaught error for ${jobId}:`,
        finalizeError instanceof Error ? finalizeError.message : String(finalizeError)
      );

      // Fail-closed fallback persistence for uncaught failures.
      // Aligned with markFailed fallback: persist phase, progress, failure_code,
      // and clear lease metadata so the job is never left in a running-like state (#223).
      const { error: fallbackError } = await supabase
        .from('evaluation_jobs')
        .update({
          status: failedStatus,
          phase: progressState.phase ?? 'phase_1a',
          phase_status: 'failed',
          total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
          completed_units: typeof progressState.completed_units === 'number' ? progressState.completed_units : 0,
          progress: {
            ...progressState,
            phase_status: 'failed',
            message: 'Evaluation failed (uncaught error)',
            failed_at: now,
            error_code: 'PROCESSOR_UNCAUGHT_ERROR',
          },
          last_error: errorMessage,
          failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
          failed_at: now,
          claimed_by: null,
          claimed_at: null,
          lease_token: null,
          updated_at: now,
        })
        .eq('id', jobId);

      if (fallbackError) {
        throw new Error(
          `[Processor] Uncaught-error fallback finalization failed for ${jobId}: ${fallbackError.message}`,
        );
      }

      // Preserve processEvaluationJob contract: return { success: false } from catch path
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Atomically claim a batch of queued evaluation jobs using the claim_evaluation_jobs RPC.
 * Returns an array of claimed job objects (id + phase).
 * Fail-closed: throws if the RPC is unavailable or errors.
 */
export async function claimQueuedJobs(
  options: {
    workerId: string;
    batchSize?: number;
    leaseMs?: number;
  },
): Promise<Array<{ id: string; phase: string; claimedAt?: string }>> {
  const { evalWorkerBatchSize } = getProcessorRuntimeDeps();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const workerId = options.workerId;
  const batchSizeRaw = Number(options.batchSize ?? evalWorkerBatchSize);
  const leaseMsRaw = Number(options.leaseMs ?? 800_000);
  const batchSize = Number.isFinite(batchSizeRaw)
    ? Math.min(5, Math.max(1, Math.floor(batchSizeRaw)))
    : 5;
  // Ceiling raised to 800_000 (Vercel Pro/Enterprise fluid-compute hard limit = 800s).
  // The previous 600_000 ceiling caused legitimate 48-chunk evaluations to have their
  // lease expire before the Vercel function wall clock, triggering the stale reaper
  // and auto-failing jobs that were still running correctly.
  const leaseMs = Number.isFinite(leaseMsRaw)
    ? Math.min(800_000, Math.max(30_000, Math.floor(leaseMsRaw)))
    : 800_000;
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();

  console.log('[Processor] claim_evaluation_jobs request', {
    worker_id: workerId,
    batch_size: batchSize,
    lease_ms: leaseMs,
    lease_token: leaseToken,
    lease_expires_at: leaseExpiresAt,
  });

  const { data, error } = await supabase.rpc('claim_evaluation_jobs', {
    p_batch_size: batchSize,
    p_worker_id: workerId,
    p_lease_token: leaseToken,
    p_lease_expires_at: leaseExpiresAt,
  });

  if (error) {
    console.error('[Processor] claim_evaluation_jobs RPC error:', error);
    throw error;
  }

  console.log('[Processor] claim_evaluation_jobs raw result', {
    returned_rows: Array.isArray(data) ? data.length : 0,
    sample_job_ids: Array.isArray(data)
      ? data
          .slice(0, 3)
          .map((row) => (row && typeof row === 'object' && 'id' in row ? (row as { id?: unknown }).id : null))
      : [],
  });

  if (!data || data.length === 0) {
    console.log('[Processor] claim_evaluation_jobs returned no rows; no jobs matched claim predicate');
    return [];
  }

  const claimedRows = assertClaimedJobsContract(data);

  return claimedRows.map((row) => ({
    id: row.id,
    phase: row.phase,
    claimedAt: row.claimed_at ?? undefined,
  }));
}

/**
 * Atomically claim one specific queued evaluation job.
 * Used by post-submit worker kickoff so the API can prove the exact job it just
 * created was accepted by the worker, not merely that some older queued row was
 * claimed from the backlog.
 */
export async function claimQueuedJobById(
  options: {
    jobId: string;
    workerId: string;
    leaseMs?: number;
  },
): Promise<{ id: string; phase: string; claimedAt?: string } | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const leaseMsRaw = Number(options.leaseMs ?? 800_000);
  const leaseMs = Number.isFinite(leaseMsRaw)
    ? Math.min(800_000, Math.max(30_000, Math.floor(leaseMsRaw)))
    : 800_000;
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();

  console.log('[Processor] claim_evaluation_job_by_id request', {
    job_id: options.jobId,
    worker_id: options.workerId,
    lease_ms: leaseMs,
    lease_token: leaseToken,
    lease_expires_at: leaseExpiresAt,
  });

  const { data, error } = await supabase.rpc('claim_evaluation_job_by_id', {
    p_job_id: options.jobId,
    p_worker_id: options.workerId,
    p_lease_token: leaseToken,
    p_lease_expires_at: leaseExpiresAt,
  });

  if (error) {
    console.error('[Processor] claim_evaluation_job_by_id RPC error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('[Processor] claim_evaluation_job_by_id returned no rows', {
      job_id: options.jobId,
    });
    return null;
  }

  const [claimed] = assertClaimedJobsContract(data);
  return {
    id: claimed.id,
    phase: claimed.phase,
    claimedAt: claimed.claimed_at ?? undefined,
  };
}

/**
 * Process all queued evaluation jobs
 */
export async function processQueuedJobs(options?: {
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  targetJobId?: string;
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  claimed: number;
  targetJobId?: string;
  targetClaimed?: boolean;
  errors: Array<{ jobId: string; error: string }>;
}> {
  // Kill switch — refuse to claim before touching DB or runtime config.
  if (!isPipelineEnabled()) {
    console.warn('[PipelineGuard] EVAL_PIPELINE_ENABLED=false — refusing to claim jobs', {
      job_id: null,
    });
    return { processed: 0, succeeded: 0, failed: 0, claimed: 0, errors: [] };
  }

  // ── HARD KILL SWITCH: auto-fail jobs older than 2 hours ──────────────
  // Prevents runaway cost from stuck jobs cycling indefinitely.
  try {
    const MAX_JOB_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
    const killCutoff = new Date(Date.now() - MAX_JOB_AGE_MS).toISOString();
    const killNow = new Date().toISOString();
    const supabaseForKill = createClient(supabaseUrl, supabaseServiceKey);
    const { data: staleJobs } = await supabaseForKill
      .from('evaluation_jobs')
      .select('id,status,phase_status,created_at,updated_at,progress')
      .in('status', ['queued', 'running'])
      .lt('created_at', killCutoff)
      .limit(20);

    if (staleJobs && staleJobs.length > 0) {
      const killNowMs = Date.parse(killNow);
      const expiredJobs = (staleJobs as Array<{
        id: string;
        status: string;
        phase_status: string | null;
        created_at?: string | null;
        updated_at?: string | null;
        progress?: Record<string, unknown> | null;
      }>).filter((job) => isMaxAgeKillSwitchExpired(job, {
        nowMs: killNowMs,
        maxAgeMs: MAX_JOB_AGE_MS,
      }));

      const {
        runningIds,
        queuedEligibleIds,
        queuedSkippedIds,
      } = partitionMaxAgeKillSwitchCandidates(expiredJobs);

      if (queuedSkippedIds.length > 0) {
        console.warn('[Worker] KILL_SWITCH: skipped queued rows with non-queued phase_status', {
          queuedSkippedIds,
        });
      }

      // Legal transition sequence for queued rows:
      // queued/queued -> running/running (promote), then running -> failed.
      let promotedQueuedIds: string[] = [];
      if (queuedEligibleIds.length > 0) {
        const { data: promotedRows, error: promoteErr } = await supabaseForKill
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.RUNNING,
            phase_status: JOB_STATUS.RUNNING,
            claimed_by: 'watchdog:max-age-kill-switch',
            claimed_at: killNow,
            lease_token: randomUUID(),
            lease_until: new Date(Date.now() + 30_000).toISOString(),
            last_heartbeat_at: new Date(Date.now() - 120_000).toISOString(),
            updated_at: killNow,
          })
          .in('id', queuedEligibleIds)
          .eq('status', JOB_STATUS.QUEUED)
          .eq('phase_status', JOB_STATUS.QUEUED)
          .select('id');

        if (promoteErr) {
          console.warn('[Worker] KILL_SWITCH: queued->running promotion failed', {
            error: promoteErr.message,
            queuedEligibleIds,
          });
        } else {
          promotedQueuedIds = (promotedRows ?? []).map((row) => row.id as string);
        }
      }

      const failableIds = [...new Set([...runningIds, ...promotedQueuedIds])];
      if (failableIds.length > 0) {
        const { error: failErr } = await supabaseForKill
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.FAILED,
            phase_status: JOB_STATUS.FAILED,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            last_heartbeat_at: null,
            last_heartbeat: null,
            worker_pulse_at: null,
            last_error: `KILL_SWITCH: Job exceeded maximum age of 2 hours (created before ${killCutoff})`,
            failure_code: 'MAX_AGE_KILL_SWITCH',
            updated_at: killNow,
          })
          .in('id', failableIds)
          .eq('status', JOB_STATUS.RUNNING);

        if (failErr) {
          console.warn('[Worker] KILL_SWITCH: running->failed transition failed', {
            error: failErr.message,
            failableIds,
          });
        }
      }

      const hardStoppedCount = runningIds.length + promotedQueuedIds.length;
      if (hardStoppedCount > 0) {
        console.warn(`[Worker] KILL_SWITCH: force-failed ${hardStoppedCount} stale jobs older than 2h`, {
          runningIds,
          promotedQueuedIds,
          queuedSkippedIds,
        });
      }

      // Legacy fallback removed: direct queued->failed writes violate DB transition guard.
    }
  } catch (killErr) {
    console.error('[Worker] KILL_SWITCH error (non-fatal):', killErr);
  }

  const queuedHardStops = await terminalizeQueuedHardStops();
  if (queuedHardStops.shouldHaltProcessing) {
    console.warn('[Worker] queued hard-stop circuit breaker engaged', {
      hard_stopped: queuedHardStops.hardStopped,
      job_ids: queuedHardStops.ids,
    });
    return { processed: 0, succeeded: 0, failed: queuedHardStops.hardStopped, claimed: 0, errors: [] };
  }

  const { evalWorkerBatchSize } = getProcessorRuntimeDeps();
  const effectiveWorkerId = options?.workerId ?? randomUUID();
  const requestedBatchSize = options?.batchSize ?? evalWorkerBatchSize;
  const requestedLeaseMs = options?.leaseMs ?? 800_000;

  console.log('[Processor] Claim assumptions', {
    expected_status: JOB_STATUS.QUEUED,
    expected_phase_status: JOB_STATUS.QUEUED,
    expected_phases: ['phase_0', 'phase_1', 'phase_1a', 'phase_2', 'phase_3'],
    canonical_ownership_fields: ['claimed_by', 'lease_token', 'lease_until'],
    worker_id: effectiveWorkerId,
    requested_batch_size: requestedBatchSize,
    requested_lease_ms: requestedLeaseMs,
  });

  // Safety net: recover jobs left in running due to platform hard timeout/crash.
  await failStaleRunningJobs();

  // Self-heal recoverable failed jobs. Manual "Continue Evaluation" remains a
  // fallback, but platform/SLA/lease failures should requeue themselves on the
  // next worker/cron invocation unless their failure code is deterministic/fatal.
  const failedSelfRecovery = await selfRecoverRetryableFailedJobs({
    targetJobId: options?.targetJobId,
  });
  if (failedSelfRecovery.recovered > 0) {
    console.log('[Worker] self-requeued recoverable failed jobs before claim', failedSelfRecovery);
  }

  // Atomically claim the submitted job by ID when requested; otherwise claim a
  // batch of queued jobs via SKIP LOCKED RPC.
  let jobs: Array<{ id: string; phase: string; claimedAt?: string }> = [];
  let targetClaimed = false;
  try {
    if (options?.targetJobId) {
      const targetedJob = await claimQueuedJobById({
        jobId: options.targetJobId,
        workerId: effectiveWorkerId,
        leaseMs: requestedLeaseMs,
      });
      targetClaimed = Boolean(targetedJob);
      jobs = targetedJob ? [targetedJob] : [];
    } else {
      jobs = await claimQueuedJobs({
        workerId: effectiveWorkerId,
        batchSize: requestedBatchSize,
        leaseMs: requestedLeaseMs,
      });
    }
  } catch (claimError) {
    // If claiming fails hard, return early rather than silently double-processing.
    const message = claimError instanceof Error ? claimError.message : String(claimError);
    const stack = claimError instanceof Error ? claimError.stack : undefined;
    console.error('[Processor] Fatal error during job claiming; aborting batch', { message, stack });
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      claimed: 0,
      ...(options?.targetJobId ? { targetJobId: options.targetJobId, targetClaimed: false } : {}),
      errors: [{ jobId: 'claim', error: message }],
    };
  }

  if (jobs.length === 0) {
    console.log('[Processor] No queued jobs claimed');
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      claimed: 0,
      ...(options?.targetJobId ? { targetJobId: options.targetJobId, targetClaimed } : {}),
      errors: [],
    };
  }

  const phaseBreakdown = jobs.reduce<Record<string, number>>((acc, row) => {
    const phase = typeof row.phase === 'string' ? row.phase : 'unknown';
    acc[phase] = (acc[phase] || 0) + 1;
    return acc;
  }, {});

  console.log(`[Processor] Claimed ${jobs.length} job(s) for worker ${effectiveWorkerId}`);
  console.log(`[Processor] Claimed job phase breakdown: ${JSON.stringify(phaseBreakdown)}`);

  for (const job of jobs) {
    console.log('[Worker] Claimed job', {
      job_id: job.id,
      phase: job.phase,
      claimed_at: job.claimedAt ?? null,
      worker_id: effectiveWorkerId,
    });

    emitLatencyTrace({
      job_id: job.id,
      stage: 'claim',
      state: 'acquired',
      started_at: job.claimedAt ?? new Date().toISOString(),
      metadata: {
        worker_id: effectiveWorkerId,
        phase: job.phase,
      },
    });
  }

  const results = {
    processed: jobs.length,
    claimed: jobs.length,
    succeeded: 0,
    failed: 0,
    ...(options?.targetJobId ? { targetJobId: options.targetJobId, targetClaimed } : {}),
    errors: [] as Array<{ jobId: string; error: string }>
  };

  // Process each claimed job sequentially
  for (const job of jobs) {
    const result = await processEvaluationJob(job.id);
    
    if (result.success) {
      results.succeeded++;
    } else {
      results.failed++;
      results.errors.push({ jobId: job.id, error: result.error || 'Unknown error' });
    }
  }

  console.log(`[Processor] Completed: ${results.succeeded} succeeded, ${results.failed} failed (claimed: ${results.claimed})`);

  return results;
}
