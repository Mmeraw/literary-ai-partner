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
 * This processor enforces the WAVE Revision Guide canonical authority
 * as defined in docs/WAVE_REVISION_GUIDE_CANON.md.
 * 
 * Authority Chain:
 * 1. WAVE Revision Guide (docs/WAVE_REVISION_GUIDE_CANON.md) — canonical
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
import { createClient } from '@supabase/supabase-js';
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
  buildScoreLedger,
  computeAuthorityComposite,
} from '@/lib/evaluation/pipeline/buildScoreLedger';
import { buildExcellenceFilter } from '@/lib/evaluation/pipeline/buildExcellenceFilter';
import { mapEvaluationResultV2ToGovernanceEnvelope } from '@/lib/governance/evaluationBridge';
import {
  getCanonicalPipelineModel,
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
import { ensureChunksFromText } from '@/lib/manuscripts/chunks';
import {
  selectChunkerConfig,
  selectChunkerBracket,
} from '@/lib/manuscripts/chunking';
import { ManuscriptExceedsHardCeilingError } from '@/lib/evaluation/pipeline/failures';
import {
  buildNonEvaluativeWarning,
  stripNonEvaluativeSections,
} from '@/lib/manuscripts/nonEvaluativeSections';
import type { ManuscriptChunkEvidence, SinglePassOutput, Pass1aCharacterLedger, CharacterLedgerV2, Pass3PreflightDraft, Pass1aChunkOutput } from '@/lib/evaluation/pipeline/types';
import { runPass1a, type Pass1aChunkCacheArtifact } from '@/lib/evaluation/pipeline/runPass1a';
import { runPass3Preflight } from '@/lib/evaluation/pipeline/runPass3Preflight';
import { reduceCharacterEvidence, buildCharacterLedgerV2 } from '@/lib/evaluation/pipeline/characterReducer';
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

// ─────────────────────────────────────────────────────────────────────────────
// WAVE Phase 3 constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum manuscript word count for WAVE eligibility */
const WAVE_MIN_WORDS = 25_000;

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

const EVALUATION_PROGRESS_TOTAL_UNITS = 3;

// Below this word count we evaluate as a single structural unit (one chunk).
// Above this, the adaptive chunker engages and emits chapter-aligned chunks.
const STRUCTURAL_CHUNKING_THRESHOLD_WORDS = 3_000;

// Hard manuscript ceiling. Above this, we fail-closed before any AI call.
// The website upload page displays this as the supported max.
const HARD_MANUSCRIPT_CEILING_WORDS = 300_000;

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

  await finalizeJobFailure({
    jobId: args.jobId,
    errorEnvelope: {
      code: 'PIPELINE_SLA_EXCEEDED',
      message: 'Evaluation exceeded hard SLA; worker aborted before stale sweeper',
      retryable: false,
    },
  });

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
];

/**
 * Returns true if a failure code is terminal (must NOT be rescued or retried).
 * A terminal failure means re-running will produce the same failure.
 */
export function isTerminalFailureCode(code: string | null | undefined): boolean {
  if (!code) return false; // Unknown code: assume rescuable (conservative)
  return TERMINAL_FAILURE_PREFIXES.some((prefix) => code.startsWith(prefix));
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
 *    - Corrective action is STATE-AWARE with four guards:
 *        a) Terminal failure code (QG_*, PASS4_REFUSAL_*, governance) → kill, never rescue.
 *        b) attempt_count >= max_attempts → kill terminally, no more rescues.
 *        c) Same stage + same error_code repeated twice → kill, not an infra problem.
 *        d) pass12_handoff_v1 artifact exists → rescue to phase_2/queued.
 *        e) Otherwise → true freeze mid-pipeline, mark failed (resume button appears).
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
    .select('id, manuscript_id, phase_status, progress, failure_code, attempt_count, max_attempts')
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
      const maxAttempts   = (row.max_attempts   as number | null) ?? 3;

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
      //   Condition 3: neither artifact present AND no handoff → keep waiting,
      //                BUT if >600s elapsed, mark failed (terminal — no artifacts
      //                ever written, job can't self-rescue)
      if (currentPhase === 'phase_1a') {
        const hasLedger    = ledgerJobIds.has(row.id);
        const hasPreflight = preflightJobIds.has(row.id);
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
        console.log(`[Watchdog] ${row.id}: phase_1a frozen but artifacts not ready — no rescue (hasLedger=${hasLedger} hasPreflight=${hasPreflight} elapsed=${Math.round(elapsedSincePhase1aStartMs / 1000)}s)`);
        continue;
      }

      // ─ GUARD E: True freeze mid-pipeline — no checkpoint, mark failed ─────────
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
            .select('progress, attempt_count')
            .eq('id', entry.id)
            .single();

          const currentProgress = (currentRow?.progress && typeof currentRow.progress === 'object')
            ? (currentRow.progress as Record<string, unknown>)
            : {};
          const currentAttempts = (currentRow?.attempt_count as number | null) ?? 0;

          const rescuedProgress = {
            ...currentProgress,
            watchdog_last_rescue_at:    rescueNow,
            watchdog_last_rescue_code:  currentProgress.error_code ?? null,
            watchdog_last_rescue_phase: currentProgress.phase ?? null,
            watchdog_rescue_count:      ((currentProgress.watchdog_rescue_count as number | null) ?? 0) + 1,
          };

          // Determine rescue target phase:
          //   - entry.targetPhase set explicitly (split-brain → phase_2 or phase_3
          //     based on evaluation_result_v2 presence) → honor it
              //   - phase_1a frozen → rescue to phase_2 (Pass 3 will re-run Pass 1A if ledger missing)
          //   - phase_2+ frozen → rescue to phase_2 (safe retry)
          const currentPhaseForRescue = (currentProgress.phase as string | undefined) ?? 'phase_1a';
          const rescueTargetPhase = entry.targetPhase
            ?? (currentPhaseForRescue === 'phase_1a' ? 'phase_2' : 'phase_2');

          const { data: updateResult, error: updateErr } = await supabase
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
              updated_at: rescueNow,
              progress: rescuedProgress,
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
                attempt_count_after: currentAttempts + 1,
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
  let staleByLease: Array<{ id: string }> | null = null;
  let leaseScanUsedLegacyColumn = false;
  let { data: leaseData, error: leaseError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', runningStatus)
    .neq('phase_status', 'complete')   // ← guard
    .not('lease_expires_at', 'is', null)
    .lt('lease_expires_at', now)
    .order('lease_expires_at', { ascending: true })
    .limit(25);

  if (leaseError && isMissingColumnError(leaseError, 'lease_expires_at')) {
    console.warn('[Processor] lease_expires_at unavailable; retrying with lease_until');
    leaseScanUsedLegacyColumn = true;
    ({ data: leaseData, error: leaseError } = await supabase
      .from('evaluation_jobs')
      .select('id')
      .eq('status', runningStatus)
      .neq('phase_status', 'complete') // ← guard
      .not('lease_until', 'is', null)
      .lt('lease_until', now)
      .order('lease_until', { ascending: true })
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

  // Rescue if: handoff OR (ledger + preflight) OR (ledger + stale >400s)
  const staleToRescue = staleIds.filter((id) => {
    if (staleHandoffJobIds.has(id)) return true;
    const hasLedger    = staleLedgerJobIds.has(id);
    const hasPreflight = stalePreflightJobIds.has(id);
    if (hasLedger && hasPreflight) return true;
    if (hasLedger) return true; // stale-by-lease already implies timeout elapsed
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
        const rescueTargetPhase = currentPhaseForRescue === 'phase_1a' ? 'phase_2' : 'phase_2';

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
    claimed_by: null,
    claimed_at: null,
    lease_token: null,
    updated_at: now,
  };

  const failureResetPayload = leaseScanUsedLegacyColumn
    ? { ...failureResetPayloadBase, lease_until: null }
    : failureResetPayloadBase;

  let { data: failedRows, error: failError } = await supabase
    .from('evaluation_jobs')
    .update(failureResetPayload)
    .in('id', staleIds_final)
    .eq('status', runningStatus)
    .neq('phase_status', 'complete')   // ← final guard on the UPDATE itself
    .select('id');

  if (failError && leaseScanUsedLegacyColumn && isMissingColumnError(failError, 'lease_until')) {
    console.warn('[Processor] lease_until missing; retrying without it');
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
    const hasLivePreClaimLease = hasLiveLeaseExpiration(job.lease_expires_at);

    // NOTE: isPhase1CompleteHandoff and isPhase1PreClaimed removed — phase_1 is dead.
    // All new jobs start at phase_1a. No job will arrive here with phase='phase_1'.

    const isPhase1aPreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      (job.phase === 'phase_1a' || progress.phase === 'phase_1a') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const isPhase2PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      (job.phase === 'phase_2' || progress.phase === 'phase_2') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const isPhase3PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      (job.phase === 'phase_3' || progress.phase === 'phase_3') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const executionPhase: 'phase_1a' | 'phase_2' | 'phase_3' =
      isPhase3PreClaimed ? 'phase_3' :
      isPhase2PreClaimed ? 'phase_2' :
      'phase_1a'; // default — all new jobs enter at phase_1a

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
        lease_is_live: hasLivePreClaimLease,
      });

      return {
        success: false,
        error:
          `Job not eligible for processing. status=${job.status}, phase=${job.phase}, phase_status=${job.phase_status}, ` +
          `claimed_by=${Boolean(job.claimed_by)}, lease_token=${Boolean(job.lease_token)}, ` +
          `lease_expires_at=${job.lease_expires_at ?? 'null'}`,
      };
    }

    progressState =
      job.progress && typeof job.progress === 'object' ? { ...job.progress } : {};

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

      // DB column patch — only columns that physically exist on evaluation_jobs.
      // Never build this inline: use getPhaseStartTimestamps so column drift
      // is caught by the schema-guard test in CI.
      const stageTimestampPatch = getPhaseStartTimestamps(phase as PhaseName, now);

      const nextProgress = {
        ...progressState,
        ...stageTimestampPatch,
        phase,
        phase_status: 'running',
        total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
        completed_units: completedUnits,
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
        updated_at: now,
        // Per-stage timestamps — only real DB columns via getPhaseStartTimestamps
        ...stageTimestampPatch,
      });

      const { error: markRunningWriteError } = await supabase
        .from('evaluation_jobs')
        .update(runningPayload)
        .eq('id', jobId);

      if (markRunningWriteError) {
        const message = `Running state update failed for job ${jobId}: ${markRunningWriteError.message}`;
        console.error(`[Processor] ${message}`);
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
        failed_at: now,
        updated_at: now,
      };

      try {
        // Route through centralized failure finalizer — atomic, retryable-aware, audited
        const finalizeResult = await finalizeJobFailure({
          jobId,
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
            progress: nextProgress,
            updated_at: now,
          })
          .eq('id', jobId);

        if (progressPatchError) {
          console.warn(
            `[Processor] Envelope progress patch failed for ${jobId}: ${progressPatchError.message}`,
          );
        }

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
    };

    // 2. Update status to running
    await markRunning('Fetching manuscript', 0, executionPhase);

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

    // ── PHASE 3 EXECUTION PATH (Pass 3B Synthesis + WAVE Revision) ─────────────
    // Own 720s Vercel invocation. Owns Pass 3B synthesis AND WAVE revision.
    //   - If pass12_handoff_v1 missing → terminal failure (PHASE3_MISSING_HANDOFF)
    //   - If evaluation_result_v2 already exists → skip synthesis, run WAVE inline
    //   - If evaluation_result_v2 missing + handoff present → run Pass 3B synthesis
    //     via runPipeline (with cached P1+P2 injected), persist result, then fall
    //     through to the canonical persistence path. The WAVE-queue block at the
    //     bottom of the persistence path detects executionPhase==='phase_3' and
    //     runs WAVE inline instead of re-queueing phase_3.
    if (executionPhase === 'phase_3') {
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
        try {
          await finalizeJobFailure({
            jobId,
            errorEnvelope: {
              code: 'PHASE3_MISSING_HANDOFF',
              message: 'phase_3 entered without pass12_handoff_v1 — cannot synthesize',
              retryable: false,
            },
          });
        } catch (finalizeErr) {
          console.error(`[phase_3] ${jobId}: finalizeJobFailure failed (fallback to direct update)`,
            finalizeErr instanceof Error ? finalizeErr.message : String(finalizeErr));
          const failNow = new Date().toISOString();
          await supabase
            .from('evaluation_jobs')
            .update({
              status: normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus,
              phase: 'phase_3',
              phase_status: 'failed',
              last_error: 'PHASE3_MISSING_HANDOFF',
              failure_code: 'PHASE3_MISSING_HANDOFF',
              failed_at: failNow,
              updated_at: failNow,
              claimed_by: null,
              claimed_at: null,
              lease_token: null,
              lease_until: null,
            })
            .eq('id', job.id);
        }
        return { success: false };
      }

      // ── Pass 3B synthesis path: handoff exists, eval_result missing ──────────
      // Read handoff + ledger + preflight, build runners, run runPipeline,
      // assign outer pipelineResult, fall through to persistence path.
      if (!hasEvalResult) {
        await markRunning('Running Pass 3B synthesis', 1, 'phase_3');
        refreshPhaseDeadline(progressState.phase3_started_at as string | undefined);

        const { data: handoffRow, error: handoffReadError } = await supabase
          .from('evaluation_artifacts')
          .select('content')
          .eq('job_id', job.id)
          .eq('artifact_type', 'pass12_handoff_v1')
          .maybeSingle();

        if (handoffReadError || !handoffRow?.content) {
          console.error(`[phase_3] ${jobId}: handoff artifact read failed`,
            handoffReadError?.message ?? 'no_content');
          try {
            await finalizeJobFailure({
              jobId,
              errorEnvelope: {
                code: 'PHASE3_MISSING_HANDOFF',
                message: 'phase_3 handoff read failed',
                retryable: false,
              },
            });
          } catch (finalizeErr) {
            console.error(`[phase_3] ${jobId}: finalizeJobFailure failed`,
              finalizeErr instanceof Error ? finalizeErr.message : String(finalizeErr));
          }
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

        const phase3Runners = cachedPass2 !== null
          ? {
              runPass1: async () => cachedPass1,
              runPass2: async () => cachedPass2,
            }
          : {
              runPass1: async () => cachedPass1,
            };

        // Read prebuilt character ledger (built by phase_1a)
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
        let prebuiltPreflightDraftP3: Pass3PreflightDraft | undefined;
        try {
          const { data: preflightArtifactP3 } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', job.id)
            .eq('artifact_type', 'pass3_preflight_draft_v1')
            .maybeSingle();
          if (preflightArtifactP3?.content?.schema_version === 'pass3_preflight_draft_v1') {
            prebuiltPreflightDraftP3 = preflightArtifactP3.content as Pass3PreflightDraft;
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

        const runPipelineStartedAtP3 = startLatencyStage({
          jobId,
          stage: 'pipeline_run',
          metadata: { model: getCanonicalPipelineModel(openAiModel), phase: 'phase_3_synthesis' },
        });

        let pipelineResultP3;
        try {
          pipelineResultP3 = await runPipeline({
            manuscriptText: manuscriptWithContent.content || '',
            manuscriptChunks: manuscriptChunksForPipeline,
            workType: manuscriptWithContent.work_type || 'novel',
            title: manuscriptWithContent.title,
            jobId: String(job.id),
            model: getCanonicalPipelineModel(openAiModel),
            openaiApiKey,
            perplexityApiKey: perplexityApiKey || undefined,
            manuscriptId: String(manuscriptWithContent.id),
            executionMode: 'TRUSTED_PATH',
            _passTimeoutMs: timeoutResolution.passTimeoutMs,
            _openAiTimeoutMs: timeoutResolution.openAiTimeoutMs,
            _runners: phase3Runners,
            ...(prebuiltCharacterLedgerP3 ? { _prebuiltCharacterLedger: prebuiltCharacterLedgerP3 } : {}),
            ...(prebuiltPreflightDraftP3 ? { _prebuiltPreflightDraft: prebuiltPreflightDraftP3 } : {}),
            onHeartbeat: async (stage) => {
              await assertJobWithinSla({ supabase, jobId, hardDeadlineMs, stage });
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
        await markRunning('Running WAVE revision engine', 2, 'phase_3');
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
              progress: {
                ...progressState,
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
          console.warn(`[WAVE/Phase3] ${isTimeout ? 'Timeout' : 'Error'} for job ${jobId} (${Date.now() - waveStartMs}ms):`, errMsg);

          // Normalize: status is always "failed"; use reason_code to distinguish
          // timeout vs other errors. Keeps the status enum clean:
          //   complete | skipped | failed
          const failedPlan = {
            status: 'failed' as const,
            reason_code: isTimeout ? 'WAVE_TIMEOUT' : 'WAVE_ERROR',
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

        // WAVE outcome never blocks job completion — mark complete regardless.
        clearInterval(leaseRenewalLoopP3);
        console.log(`[Processor] ${jobId}: phase_3 WAVE complete — marking job complete`);
        nextLifecycleStatus(JOB_STATUS.COMPLETE);
        const phase3Now = new Date().toISOString();
        const { error: phase3CompleteErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.COMPLETE,
            phase: 'phase_3',
            phase_status: 'complete',
            completed_at: phase3Now,
            updated_at: phase3Now,
            progress: {
              ...progressState,
              phase: 'phase_3',
              phase_status: 'complete',
              message: 'WAVE revision complete',
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
            updated_at: errNow,
            progress: {
              ...progressState,
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
      await markRunning('Running Pass 1A character sweep', 1, 'phase_1a');
      refreshPhaseDeadline(progressState.phase1a_started_at as string | undefined);

      const phase1aStartMs = Date.now();

      // Heartbeat renewal loop — keeps lease alive and last_heartbeat_at current
      // so the watchdog doesn't kill us mid-sweep on a large manuscript.
      const leaseRenewalIntervalMsP1a = 30_000;
      const leaseRenewalLoopP1a = setInterval(() => {
        void renewEvaluationJobLease({
          supabase,
          jobId,
          leaseMs: runtimeConfig.worker.leaseMs,
          stage: 'phase_1a_pass1a_renewal',
          hardDeadlineMs,
        }).catch((err: unknown) => {
          console.warn('[Processor] phase_1a lease renewal failed (non-fatal)',
            err instanceof Error ? err.message : String(err));
        });
      }, leaseRenewalIntervalMsP1a);

      try {
        const pass1aChunks = manuscriptChunksForPipeline;

        // ── PR-E chunk checkpoint: read existing pass1a_chunk_cache_v1 artifact ──
        // If the source_hash matches the current job/manuscript/chunk-count
        // identity, pre-populate the in-memory cache so already-completed chunks
        // are skipped. Otherwise the cache is ignored and all chunks re-run.
        const pass1aChunkCount = Array.isArray(pass1aChunks) ? pass1aChunks.length : 1;
        const pass1aSourceHash = createHash('sha256')
          .update(`${String(job.id)}:${String(job.manuscript_id)}:${pass1aChunkCount}`)
          .digest('hex');

        const pass1aCacheMap = new Map<number, Pass1aChunkOutput>();

        try {
          const { data: pass1aCacheRow } = await supabase
            .from('evaluation_artifacts')
            .select('content')
            .eq('job_id', String(job.id))
            .eq('artifact_type', 'pass1a_chunk_cache_v1')
            .maybeSingle();

          const existingPass1aCache = pass1aCacheRow?.content as
            | Pass1aChunkCacheArtifact
            | null
            | undefined;

          if (existingPass1aCache && existingPass1aCache.source_hash === pass1aSourceHash) {
            for (const [k, v] of Object.entries(existingPass1aCache.chunks ?? {})) {
              pass1aCacheMap.set(Number(k), v.result);
            }
            console.log(
              `[phase_1a] Resuming from cache: ${pass1aCacheMap.size}/${pass1aChunkCount} chunks already done`,
            );
          } else if (existingPass1aCache) {
            console.log(
              `[phase_1a] Ignoring stale pass1a_chunk_cache_v1 (source_hash mismatch)`,
            );
          }
        } catch (cacheReadErr) {
          console.warn(
            `[phase_1a] pass1a_chunk_cache_v1 read failed (non-fatal, will run fresh)`,
            cacheReadErr instanceof Error ? cacheReadErr.message : String(cacheReadErr),
          );
        }

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
            total_expected: pass1aChunkCount,
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
        };

        // ── phase_1: P1A (c=5) + P3A (c=2) run in parallel ───────────────────────
        // Both read the raw manuscript independently. Neither waits for the other.
        // P3A is non-fatal: a failed preflight → degraded artifact, job continues.
        console.log(`[Processor] ${jobId}: phase_1a — launching P1A(c=5) + P3A(c=2) in parallel`);

        const [pass1aSettled, pass3aSettled] = await Promise.allSettled([
          // P1A: character arc sweep, concurrency=5
          runPass1a({
            manuscriptText: manuscriptWithContent.content || '',
            manuscriptChunks: pass1aChunks,
            workType: manuscriptWithContent.work_type || 'novel',
            title: manuscriptWithContent.title,
            openaiApiKey,
            jobId: String(job.id),
            _chunkCache: pass1aCacheMap,
            _onChunkComplete: onPass1aChunkComplete,
          }),
          // P3A: independent full-manuscript read, concurrency=2
          runPass3Preflight({
            manuscriptChunks: pass1aChunks ?? [],
            title: manuscriptWithContent.title,
            workType: manuscriptWithContent.work_type || 'novel',
            jobId: String(job.id),
            manuscriptId: Number(job.manuscript_id),
            openaiApiKey,
            supabase,
            _chunkConcurrency: 2,
            _onChunkHeartbeat: () => {
              // Non-blocking heartbeat for watchdog — P3A chunks are small, no DB write needed
            },
          }),
        ]);

        // Unwrap P1A result — fatal if failed
        if (pass1aSettled.status === 'rejected') {
          throw pass1aSettled.reason instanceof Error
            ? pass1aSettled.reason
            : new Error(String(pass1aSettled.reason));
        }
        const pass1aResult = pass1aSettled.value;

        // Unwrap P3A result — non-fatal
        if (pass3aSettled.status === 'rejected') {
          console.warn(`[Processor] ${jobId}: phase_1a — P3A failed (non-fatal, degraded preflight persisted):`,
            pass3aSettled.reason instanceof Error ? pass3aSettled.reason.message : String(pass3aSettled.reason));
        } else {
          console.log(`[Processor] ${jobId}: phase_1a — P3A complete:`, {
            authority: pass3aSettled.value.preflight.preflight_authority,
            coverage: `${pass3aSettled.value.preflight.manuscript_read_status.chunks_received}/${pass3aSettled.value.preflight.manuscript_read_status.chunks_expected}`,
            duration_ms: pass3aSettled.value.durationMs,
          });
        }

        if (pass1aResult.chunkOutputs.length === 0) {
          // Soft-skip: the ledger is an enrichment layer, not the paid product.
          // Persist an empty-sentinel artifact so phase_2 knows the ledger is
          // unavailable, then queue phase_2 anyway. Pass 3 will run without
          // character-ledger grounding; WAVE will skip with reason
          // CHARACTER_LEDGER_V2_MISSING. The evaluation report is still delivered.
          console.warn(`[Processor] ${jobId}: phase_1a — Pass 1A produced zero chunk outputs — persisting empty sentinel and continuing to phase_2`);

          const emptyLedgerHash = `pass1a_ledger_empty_${String(job.id)}`;
          try {
            await upsertEvaluationArtifact({
              supabase,
              jobId: String(job.id),
              manuscriptId: Number(job.manuscript_id),
              artifactType: 'pass1a_character_ledger_v1',
              content: {
                job_id: String(job.id),
                manuscript_id: Number(job.manuscript_id),
                created_at: new Date().toISOString(),
                schema_version: 'pass1a_character_ledger_v1',
                status: 'empty',
                reason_code: 'PASS1A_LEDGER_EMPTY',
                ledger_v1: null,
                ledger_v2: null,
                summary: { entries: 0 },
              },
              sourceHash: emptyLedgerHash,
              artifactVersion: 'pass1a_character_ledger_v1',
            });
          } catch (emptyArtifactErr) {
            console.error(`[Processor] ${jobId}: phase_1a — failed to persist empty ledger artifact (non-fatal)`,
              emptyArtifactErr instanceof Error ? emptyArtifactErr.message : String(emptyArtifactErr));
          }

          // Queue phase_2 — evaluation must continue
          const emptyNow = new Date().toISOString();
          const { data: emptyHandoffRow, error: emptyHandoffErr } = await supabase
            .from('evaluation_jobs')
            .update({
              status: JOB_STATUS.QUEUED,
              phase: 'phase_2',
              phase_status: JOB_STATUS.QUEUED,
              claimed_by: null,
              claimed_at: null,
              lease_token: null,
              lease_until: null,
              updated_at: emptyNow,
              progress: {
                ...progressState,
                phase: 'phase_1a',
                phase_status: 'complete',
                message: 'Phase 1A produced empty ledger — WAVE will be skipped; proceeding to Pass 3',
                phase1a_completed_at: emptyNow,
                ledger_entries: 0,
                ledger_status: 'empty',
              },
            })
            .eq('id', job.id)
            .eq('status', JOB_STATUS.RUNNING)
            .select('id, status, phase, phase_status')
            .single();

          if (emptyHandoffErr) {
            console.error(`[Processor] ${jobId}: phase_1a empty-ledger phase_2 queue FAILED`, emptyHandoffErr.message);
            throw new Error(`Phase 1A empty-ledger handoff failed: ${emptyHandoffErr.message}`);
          }

          console.log(`[Processor] ${jobId}: phase_1a empty-ledger handoff confirmed — status=queued phase=phase_2`);
          return { success: true };
        }

        const totalChunksPhase1a = Array.isArray(pass1aChunks) ? pass1aChunks.length : 1;

        const characterLedger: Pass1aCharacterLedger = reduceCharacterEvidence({
          chunkOutputs: pass1aResult.chunkOutputs,
          jobId: String(job.id),
          totalChunksInManuscript: totalChunksPhase1a,
        });

        const characterLedgerV2Phase1a: CharacterLedgerV2 = buildCharacterLedgerV2({
          ledger: characterLedger,
          chunkOutputs: pass1aResult.chunkOutputs,
          jobId: String(job.id),
          totalChunksInManuscript: totalChunksPhase1a,
        });

        console.log(`[Processor] ${jobId}: phase_1a — character ledger ready`, {
          duration_ms: Date.now() - phase1aStartMs,
          entries: characterLedger.entries.length,
          v2_active_blockers: characterLedgerV2Phase1a.activeBlockers.length,
        });

        // Persist the character ledger artifact
        await upsertEvaluationArtifact({
          supabase,
          jobId: String(job.id),
          manuscriptId: Number(job.manuscript_id),
          artifactType: 'pass1a_character_ledger_v1',
          content: {
            job_id: String(job.id),
            manuscript_id: Number(job.manuscript_id),
            created_at: new Date().toISOString(),
            schema_version: 'pass1a_character_ledger_v1',
            ledger_v1: characterLedger,
            ledger_v2: characterLedgerV2Phase1a,
            summary: {
              entries: characterLedger.entries.length,
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

        console.log(`[Processor] ${jobId}: phase_1a — ledger artifact persisted, queuing phase_2`);

        // Transition to phase_2 (Pass 3 synthesis)
        const phase1aNow = new Date().toISOString();
        const phase1aHandoffProgress = {
          ...progressState,
          phase: 'phase_1a',
          phase_status: 'complete',
          message: 'Phase 1A complete — character ledger ready, awaiting Pass 3 synthesis',
          phase1a_completed_at: phase1aNow,
          ledger_entries: characterLedger.entries.length,
        };

        const { data: phase1aHandoffRow, error: phase1aHandoffErr } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED,
            phase: 'phase_2',
            phase_status: JOB_STATUS.QUEUED,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            updated_at: phase1aNow,
            progress: phase1aHandoffProgress,
          })
          .eq('id', job.id)
          .eq('status', JOB_STATUS.RUNNING)
          .select('id, status, phase, phase_status')
          .single();

        if (phase1aHandoffErr) {
          console.error(`[Processor] ${jobId}: phase_1a handoff DB transition FAILED`, phase1aHandoffErr.message);
          throw new Error(`Phase 1A handoff DB transition failed: ${phase1aHandoffErr.message}`);
        }

        if (!phase1aHandoffRow || phase1aHandoffRow.status !== JOB_STATUS.QUEUED) {
          console.warn(`[Processor] ${jobId}: phase_1a handoff 0 rows — job already transitioned`, { returned: phase1aHandoffRow ?? null });
          return { success: true };
        }

        console.log(`[Processor] ${jobId}: phase_1a handoff confirmed — status=queued phase=phase_2`);
        return { success: true };
      } catch (phase1aErr) {
        const errMsg = phase1aErr instanceof Error ? phase1aErr.message : String(phase1aErr);
        console.error(`[Processor] ${jobId}: phase_1a fatal error`, errMsg);
        clearInterval(leaseRenewalLoopP1a);
        await markFailed(
          `Phase 1A character sweep failed: ${errMsg}`,
          'PASS1A_LEDGER_MISSING',
          { pipelineStage: 'phase_1a', bucket: 'openai_provider' },
        );
        return { success: false, error: errMsg };
      } finally {
        clearInterval(leaseRenewalLoopP1a);
      }
    } // end phase_1a execution

    if (executionPhase === 'phase_2') {
      await markRunning('Resuming from phase 1 handoff', 1, 'phase_2');
      refreshPhaseDeadline(progressState.phase2_started_at as string | undefined);

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

          let capturedPass1: SinglePassOutput | undefined;
          let capturedPass2: SinglePassOutput | undefined;
          const { runPass1: realRunPass1 } = await import('@/lib/evaluation/pipeline/runPass1');
          const { runPass2: realRunPass2 } = await import('@/lib/evaluation/pipeline/runPass2');

          try {
            const p2CaptureResult = await runPipeline({
              manuscriptText: manuscriptWithContent.content || '',
              manuscriptChunks: manuscriptChunksForPipeline,
              workType: manuscriptWithContent.work_type || 'novel',
              title: manuscriptWithContent.title,
              jobId: String(job.id),
              model: getCanonicalPipelineModel(openAiModel),
              openaiApiKey,
              manuscriptId: String(manuscriptWithContent.id),
              executionMode: 'TRUSTED_PATH',
              _passTimeoutMs: timeoutResolution.passTimeoutMs,
              _openAiTimeoutMs: timeoutResolution.openAiTimeoutMs,
              ...(prebuiltLedgerP2 ? { _prebuiltCharacterLedger: prebuiltLedgerP2 } : {}),
              _runners: {
                runPass1: async (opts) => {
                  const result = await realRunPass1(opts);
                  capturedPass1 = result;
                  return result;
                },
                runPass2: async (opts) => {
                  const result = await realRunPass2(opts);
                  capturedPass2 = result;
                  return result;
                },
              },
              onHeartbeat: async (stage) => {
                await assertJobWithinSla({ supabase, jobId, hardDeadlineMs, stage });
                await renewEvaluationJobLease({
                  supabase, jobId, leaseMs: runtimeConfig.worker.leaseMs, stage, hardDeadlineMs,
                });
              },
            });

            if (!p2CaptureResult.ok) {
              const errCode = 'error_code' in p2CaptureResult ? p2CaptureResult.error_code : 'PHASE2_PASS12_FAILED';
              console.error(`[phase_2] ${jobId}: Pass 1+2 failed`, errCode);
              await markFailed(String(errCode), 'PHASE2_PASS12_FAILED', { pipelineStage: 'phase_2' });
              return { success: false, error: String(errCode) };
            }
          } catch (pipelineRunErrP2) {
            const errMsg = pipelineRunErrP2 instanceof Error ? pipelineRunErrP2.message : String(pipelineRunErrP2);
            console.error(`[phase_2] ${jobId}: Pass 1+2 pipeline threw`, errMsg);
            await markFailed(errMsg, 'PHASE2_PASS12_FAILED', { pipelineStage: 'phase_2' });
            return { success: false, error: errMsg };
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
                phase: 'phase_2',
                phase_status: 'complete',
                message: 'Pass 1+2 complete — handoff written, queued for Pass 3B synthesis',
                phase2_completed_at: p2HandoffNow,
              },
            })
            .eq('id', job.id)
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

        const leaseRenewalLoopP2Short = setInterval(() => {
          void renewEvaluationJobLease({ supabase, jobId, leaseMs: runtimeConfig.worker.leaseMs, stage: 'phase_2_short_renewal', hardDeadlineMs }).catch(() => {});
        }, 30_000);

        let capturedPass1Short: SinglePassOutput | undefined;
        let capturedPass2Short: SinglePassOutput | undefined;
        const { runPass1: realRunPass1Short } = await import('@/lib/evaluation/pipeline/runPass1');
        const { runPass2: realRunPass2Short } = await import('@/lib/evaluation/pipeline/runPass2');

        try {
          const p2ShortResult = await runPipeline({
            manuscriptText: manuscriptWithContent.content || '',
            manuscriptChunks: manuscriptChunksForPipeline,
            workType: manuscriptWithContent.work_type || 'novel',
            title: manuscriptWithContent.title,
            jobId: String(job.id),
            model: getCanonicalPipelineModel(openAiModel),
            openaiApiKey,
            manuscriptId: String(manuscriptWithContent.id),
            executionMode: 'TRUSTED_PATH',
            _passTimeoutMs: timeoutResolution.passTimeoutMs,
            _openAiTimeoutMs: timeoutResolution.openAiTimeoutMs,
            ...(prebuiltLedgerP2Short ? { _prebuiltCharacterLedger: prebuiltLedgerP2Short } : {}),
            _runners: {
              runPass1: async (opts) => { const r = await realRunPass1Short(opts); capturedPass1Short = r; return r; },
              runPass2: async (opts) => { const r = await realRunPass2Short(opts); capturedPass2Short = r; return r; },
            },
            onHeartbeat: async (stage) => {
              await assertJobWithinSla({ supabase, jobId, hardDeadlineMs, stage });
              await renewEvaluationJobLease({ supabase, jobId, leaseMs: runtimeConfig.worker.leaseMs, stage, hardDeadlineMs });
            },
          });
          if (!p2ShortResult.ok) {
            const errCode = 'error_code' in p2ShortResult ? p2ShortResult.error_code : 'PHASE2_SHORT_PASS12_FAILED';
            await markFailed(String(errCode), 'PHASE2_PASS12_FAILED', { pipelineStage: 'phase_2' });
            return { success: false, error: String(errCode) };
          }
        } catch (p2ShortErr) {
          const errMsg = p2ShortErr instanceof Error ? p2ShortErr.message : String(p2ShortErr);
          await markFailed(errMsg, 'PHASE2_PASS12_FAILED', { pipelineStage: 'phase_2' });
          return { success: false, error: errMsg };
        } finally {
          clearInterval(leaseRenewalLoopP2Short);
        }

        if (!capturedPass1Short) {
          await markFailed('phase_2 short: Pass 1 output not captured', 'PHASE2_PASS1_MISSING', { pipelineStage: 'phase_2' });
          return { success: false, error: 'phase_2 short: Pass 1 output not captured' };
        }

        const handoffContentP2Short = {
          pass1Output: capturedPass1Short,
          pass2Output: capturedPass2Short ?? capturedPass1Short,
          chunk_count: manuscriptChunksForPipeline?.length ?? 1,
          captured_at: new Date().toISOString(),
          schema_version: 'pass12_handoff_v1',
        };
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
        const { error: p2ShortPhase3Err } = await supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED, phase: 'phase_3', phase_status: JOB_STATUS.QUEUED,
            claimed_by: null, claimed_at: null, lease_token: null, lease_until: null,
            updated_at: p2ShortNow,
            progress: { ...progressState, phase: 'phase_2', phase_status: 'complete',
              message: 'Pass 1+2 complete (short-form) — handoff written, queued for Pass 3B',
              phase2_completed_at: p2ShortNow },
          })
          .eq('id', job.id);
        if (p2ShortPhase3Err) {
          return { success: false, error: p2ShortPhase3Err.message };
        }
        console.log(`[phase_2] ${jobId}: short-form Pass 1+2 → handoff written → phase_3 queued`);
        return { success: true };
      } else {
        // Handoff artifact found — phase_2 has nothing to do. Pass 3B synthesis
        // is owned by phase_3 now. Queue phase_3 and return immediately.
        // DO NOT delete pass12_handoff_v1 — phase_3 reads it for synthesis.
        console.log(
          `[Processor] ${jobId}: phase_2 — handoff present, queueing phase_3 (Pass 3B synthesis owns synthesis)`,
        );

        const phase3QueueNow = new Date().toISOString();
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
              phase: 'phase_2',
              phase_status: 'complete',
              message: 'Phase 1+2 handoff present — queued for Pass 3B synthesis',
              phase2_completed_at: phase3QueueNow,
            },
          })
          .eq('id', job.id)
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
      scopeProfile: scopeProfileForV2Gate,
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

    const qualityGateV2 = runQualityGateV2(evaluationResult, {
      criteria: artifactCriteria,
      ledger: scoreLedger,
      efg: excellenceFilter,
    }, scopeProfileForV2Gate);

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
    effectiveEvaluationResult.governance.transparency = {
      ...(effectiveEvaluationResult.governance.transparency ?? {}),
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
    });

    await markRunning(
      'Persisting evaluation artifacts',
      2,
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

      // ── Phase 2 → Phase 3 handoff (WAVE revision owns its own 720s invocation) ──
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
              console.warn(`[WAVE/Phase3-inline] ${isTimeout ? 'Timeout' : 'Error'} for job ${jobId} (${Date.now() - waveStartMsP3}ms):`, errMsg);
              const failedPlan = {
                status: 'failed' as const,
                reason_code: isTimeout ? 'WAVE_TIMEOUT' : 'WAVE_ERROR',
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
              phase: 'phase_2',
              phase_status: 'complete',
              message: 'Evaluation complete — queued for WAVE revision',
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
          console.log(`[Processor] ${jobId}: phase_2 → phase_3 queued — WAVE will run in next invocation`);
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
      await finalizeJobFailure({
        jobId,
        errorEnvelope: {
          code: 'PROCESSOR_UNCAUGHT_ERROR',
          message: errorMessage,
          retryable: false, // Conservative: uncaught errors are terminal until investigated
        },
      });
    } catch (finalizeError) {
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
 * Process all queued evaluation jobs
 */
export async function processQueuedJobs(options?: {
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  claimed: number;
  errors: Array<{ jobId: string; error: string }>;
}> {
  // Kill switch — refuse to claim before touching DB or runtime config.
  if (!isPipelineEnabled()) {
    console.warn('[PipelineGuard] EVAL_PIPELINE_ENABLED=false — refusing to claim jobs', {
      job_id: null,
    });
    return { processed: 0, succeeded: 0, failed: 0, claimed: 0, errors: [] };
  }

  const { evalWorkerBatchSize } = getProcessorRuntimeDeps();
  const effectiveWorkerId = options?.workerId ?? randomUUID();
  const requestedBatchSize = options?.batchSize ?? evalWorkerBatchSize;
  const requestedLeaseMs = options?.leaseMs ?? 800_000;

  console.log('[Processor] Claim assumptions', {
    expected_status: JOB_STATUS.QUEUED,
    expected_phase_status: JOB_STATUS.QUEUED,
    expected_phases: ['phase_1a', 'phase_2', 'phase_3'],
    canonical_ownership_fields: ['claimed_by', 'lease_token', 'lease_until'],
    worker_id: effectiveWorkerId,
    requested_batch_size: requestedBatchSize,
    requested_lease_ms: requestedLeaseMs,
  });

  // Safety net: recover jobs left in running due to platform hard timeout/crash.
  await failStaleRunningJobs();

  // Atomically claim a batch of queued jobs via SKIP LOCKED RPC.
  let jobs: Array<{ id: string; phase: string; claimedAt?: string }> = [];
  try {
    jobs = await claimQueuedJobs({
      workerId: effectiveWorkerId,
      batchSize: requestedBatchSize,
      leaseMs: requestedLeaseMs,
    });
  } catch (claimError) {
    // If claiming fails hard, return early rather than silently double-processing.
    const message = claimError instanceof Error ? claimError.message : String(claimError);
    const stack = claimError instanceof Error ? claimError.stack : undefined;
    console.error('[Processor] Fatal error during job claiming; aborting batch', { message, stack });
    return { processed: 0, succeeded: 0, failed: 0, claimed: 0, errors: [{ jobId: 'claim', error: message }] };
  }

  if (jobs.length === 0) {
    console.log('[Processor] No queued jobs claimed');
    return { processed: 0, succeeded: 0, failed: 0, claimed: 0, errors: [] };
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
