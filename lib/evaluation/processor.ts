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
 * • Calls OpenAI gpt-4o-mini with manuscript content
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

import { randomUUID } from 'crypto';
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
import { getEvaluationRuntimeConfig } from '@/lib/config/evaluationRuntimeConfig';
import {
  emitLatencyTrace,
  finishLatencyStage,
  startLatencyStage,
} from '@/lib/observability/latencyTrace';
import {
  assertValidJobStatusTransition,
  normalizeEvaluationJobStatus,
} from '@/lib/evaluation/status';
import { JOB_STATUS, type JobStatus } from '@/lib/jobs/types';
import { summarizePromptCoverage } from '@/lib/evaluation/pipeline/promptInput';
import { detectContextContamination } from '@/lib/evaluation/governance/contextContaminationGuard';
import { assertClaimedJobsContract } from '@/lib/jobs/contracts/claimEvaluationJobs.contract';
import { finalizeJobFailure } from '@/lib/jobs/jobStore.supabase';
import { ensureChunksFromText } from '@/lib/manuscripts/chunks';
import type { ManuscriptChunkEvidence } from '@/lib/evaluation/pipeline/types';

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
    evalWorkerBatchSize: getValidatedWorkerBatchSize(runtimeConfig.worker.batchSize, 5),
    evalContextContaminationGuardEnabled: runtimeConfig.contextContaminationGuardEnabled,
    evalPassTimeoutMs: getEvalPassTimeoutMs(),
    evalOpenAiTimeoutMs: getEvalOpenAiTimeoutMs(),
  };
}

const EVALUATION_PROGRESS_TOTAL_UNITS = 3;
const LONG_FORM_CHUNKING_THRESHOLD_WORDS = 25_000;

type ChunkRoutingTelemetry = {
  enabled: boolean;
  route: 'long_form' | 'short_form';
  threshold_words: number;
  manuscript_words: number;
  chunk_count: number;
  // Long-form chunk materialization proof fields (populated only on long_form route)
  ensure_chunks_returned_count?: number;
  persisted_chunk_count?: number;
  chunk_source?: 'processor_resolved_text';
  verified_at?: string;
}

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

type PipelineFailureContext = {
  pipelineStage?: string;
  reasonCodes?: string[];
  diagnostics?: unknown;
};

type PipelineFailureEnvelope = {
  failure_origin: string;
  error_code: string;
  error_message: string;
  reason_codes: string[];
  failed_at: string;
  pipeline_stage: string;
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

  return {
    failure_origin: 'processor',
    error_code: args.errorCode,
    error_message: args.errorMessage,
    reason_codes: normalizeReasonCodes(args.context?.reasonCodes, args.errorCode),
    failed_at: pipelineStage,
    pipeline_stage: pipelineStage,
  };
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

  const canonicalHeartbeatPayload = {
    // Canonical heartbeat fields used by stale sweeper and job forensics
    last_heartbeat_at: nowIso,
    last_heartbeat: nowIso,
    // Legacy heartbeat field retained for mixed-schema compatibility
    heartbeat_at: nowIso,
    // Canonical writable lease source column (lease_expires_at may be generated)
    lease_until: leaseUntilIso,
    updated_at: nowIso,
  };

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
    return { text: directContent };
  }

  // Priority 2: Reconstruct from manuscript_chunks
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
        `[Processor] manuscript ${manuscript.id} missing manuscripts.content; reconstructed text from ${chunks.length} chunk(s)`,
      );
      return { text: reconstructed, loadedChunks: validChunks };
    }
  }

  // Priority 3: Decode data URI from file_url (paste submissions store text here)
  const fileUrl = typeof manuscript.file_url === 'string' ? manuscript.file_url : '';
  if (fileUrl.startsWith('data:text/plain')) {
    try {
      const commaIndex = fileUrl.indexOf(',');
      if (commaIndex >= 0) {
        const encoded = fileUrl.substring(commaIndex + 1);
        const decoded = decodeURIComponent(encoded);
        if (decoded.trim().length > 0) {
          console.log(
            `[Processor] manuscript ${manuscript.id} resolved text from file_url data URI (${decoded.length} chars)`,
          );
          return { text: decoded };
        }
      }
    } catch (decodeError) {
      console.warn(
        `[Processor] manuscript ${manuscript.id} file_url data URI decode failed:`,
        decodeError,
      );
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

  if (manuscriptWords < LONG_FORM_CHUNKING_THRESHOLD_WORDS) {
    return {
      enabled: true,
      route: 'short_form',
      threshold_words: LONG_FORM_CHUNKING_THRESHOLD_WORDS,
      manuscript_words: manuscriptWords,
      chunk_count: 0,
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
    threshold_words: LONG_FORM_CHUNKING_THRESHOLD_WORDS,
    manuscript_words: manuscriptWords,
    chunk_count: chunkResult.ensured_count,
    ensure_chunks_returned_count: chunkResult.ensured_count,
    persisted_chunk_count: chunkResult.persisted_count,
    chunk_source: chunkResult.chunk_source,
    verified_at: chunkResult.verified_at,
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

export async function failStaleRunningJobs(): Promise<{
  staleFound: number;
  failed: number;
  ids: string[];
}> {
  const { staleRunningMinutes } = getProcessorRuntimeDeps();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - staleRunningMinutes * 60_000).toISOString();
  const runningStatus = normalizeEvaluationJobStatus(JOB_STATUS.RUNNING) as JobStatus;
  const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;

  // Collect IDs: stale by updated_at cutoff OR expired claim lease
  const { data: staleByAge, error: ageError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', runningStatus)
    .not('last_heartbeat_at', 'is', null)
    .lt('last_heartbeat_at', cutoff)
    .order('last_heartbeat_at', { ascending: true })
    .limit(25);

  if (ageError) {
    console.warn('[Processor] Failed to check stale running jobs (age):', ageError.message);
    return { staleFound: 0, failed: 0, ids: [] };
  }

  // Also collect jobs with expired claim leases. Canonical column is lease_expires_at.
  // For mixed-schema environments, fall back to legacy lease_until if needed.
  let staleByLease: Array<{ id: string }> | null = null;
  let leaseScanUsedLegacyColumn = false;
  let { data: leaseData, error: leaseError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', runningStatus)
    .not('lease_expires_at', 'is', null)
    .lt('lease_expires_at', now)
    .order('lease_expires_at', { ascending: true })
    .limit(25);

  if (leaseError && isMissingColumnError(leaseError, 'lease_expires_at')) {
    console.warn('[Processor] lease_expires_at unavailable in this schema; retrying stale-lease scan with lease_until');
    leaseScanUsedLegacyColumn = true;
    ({ data: leaseData, error: leaseError } = await supabase
      .from('evaluation_jobs')
      .select('id')
      .eq('status', runningStatus)
      .not('lease_until', 'is', null)
      .lt('lease_until', now)
      .order('lease_until', { ascending: true })
      .limit(25));
  }

  staleByLease = (leaseData as Array<{ id: string }> | null) ?? [];

  if (leaseError) {
    console.warn('[Processor] Failed to check stale running jobs (lease):', leaseError.message);
  }

  // Merge unique IDs from both sources
  const ageIds = (staleByAge ?? []).map((r) => r.id);
  const leaseIds = (staleByLease ?? []).map((r) => r.id);
  const staleIds = Array.from(new Set([...ageIds, ...leaseIds]));

  if (staleIds.length === 0) {
    return { staleFound: 0, failed: 0, ids: [] };
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
    ? {
        ...failureResetPayloadBase,
        lease_until: null,
      }
    : failureResetPayloadBase;

  let { data: failedRows, error: failError } = await supabase
    .from('evaluation_jobs')
    .update(failureResetPayload)
    .in('id', staleIds)
    .eq('status', runningStatus)
    .select('id');

  if (failError && leaseScanUsedLegacyColumn && isMissingColumnError(failError, 'lease_until')) {
    console.warn('[Processor] lease_until missing; retrying stale-fail update without lease_until clear');
    ({ data: failedRows, error: failError } = await supabase
      .from('evaluation_jobs')
      .update(failureResetPayloadBase)
      .in('id', staleIds)
      .eq('status', runningStatus)
      .select('id'));
  }

  if (failError) {
    console.warn('[Processor] Failed to auto-fail stale jobs:', failError.message);
    return { staleFound: staleIds.length, failed: 0, ids: staleIds };
  }

  const failedCount = failedRows?.length ?? 0;
  if (failedCount > 0) {
    console.log(`[Processor] Auto-failed ${failedCount} stale running job(s)`);
  }

  return {
    staleFound: staleIds.length,
    failed: failedCount,
    ids: staleIds,
  };
}

/**
 * Process a single evaluation job
 */
export async function processEvaluationJob(jobId: string): Promise<{ success: boolean; error?: string }> {
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

    const isPhase1CompleteHandoff =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      (job.phase === 'phase_1' || progress.phase === 'phase_1') &&
      (job.phase_status === 'complete' || progress.phase_status === 'complete');

    const isPhase1PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      (job.phase === 'phase_1' || progress.phase === 'phase_1') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const isPhase2PreClaimed =
      job.status === 'running' &&
      hasCanonicalPreClaimOwnership &&
      hasLivePreClaimLease &&
      (job.phase === 'phase_2' || progress.phase === 'phase_2') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const executionPhase: 'phase_1' | 'phase_2' =
      isPhase1CompleteHandoff || isPhase2PreClaimed ? 'phase_2' : 'phase_1';

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
      !isPhase1CompleteHandoff &&
      !isPhase1PreClaimed &&
      !isPhase2PreClaimed
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
    const hardDeadlineMs = resolveJobHardDeadlineMs({
      startedAt:
        typeof (job as Record<string, unknown>).started_at === 'string'
          ? ((job as Record<string, unknown>).started_at as string)
          : canonicalStartedAt,
      maxExecutionMs: runtimeConfig.worker.maxExecutionMs,
    });

    const markRunning = async (
      message: string,
      completedUnits: number,
      phase: 'phase_1' | 'phase_2' = 'phase_1',
    ) => {
      if (!hasCanonicalPreClaimOwnership || !hasLivePreClaimLease) {
        throw new Error('markRunning requires claimed job');
      }

      const now = new Date().toISOString();
      const stageTimestampPatch: Record<string, unknown> = {};

      if (phase === 'phase_1' && !progressState.phase1_started_at) {
        stageTimestampPatch.phase1_started_at = now;
      }
      if (phase === 'phase_2' && !progressState.phase2_started_at) {
        stageTimestampPatch.phase2_started_at = now;
      }
      if (phase === 'phase_2' && !progressState.phase1_completed_at) {
        stageTimestampPatch.phase1_completed_at = now;
      }

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

      logProcessorStageBoundary({
        jobId,
        stage: phase === 'phase_1' ? 'phase1' : 'phase2',
        state: 'start',
        at: now,
        metadata: {
          completed_units: completedUnits,
          message,
        },
      });

      const runningPayload = {
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
        // Per-stage timestamps (R4 observability)
        ...(stageTimestampPatch as {
          phase1_started_at?: string;
          phase2_started_at?: string;
          phase1_completed_at?: string;
        }),
      };

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
      const pipelineFailureEnvelope = buildPipelineFailureEnvelope({
        errorCode,
        errorMessage,
        context: failureContext,
      });
      const pipelineFailureDiagnostics = normalizeFailureDiagnostics(failureContext?.diagnostics);
      const failedPhase =
        progressState.phase === 'phase_2' || executionPhase === 'phase_2'
          ? 'phase_2'
          : 'phase_1';

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
    if (!resolvedManuscriptText || resolvedManuscriptText.trim().length === 0) {
      const contentError = 'Manuscript text unavailable: neither manuscripts.content nor manuscript_chunks.content found';
      await markFailed(contentError);

      return { success: false, error: contentError };
    }

    if (!isManuscriptTextLongEnough(resolvedManuscriptText, evalMinManuscriptWords)) {
      const shortContentError =
        `Manuscript text too short for reliable evaluation: ${resolvedManuscriptText.trim().split(/\s+/).length} words ` +
        `(minimum ${evalMinManuscriptWords} words)`;
      await markFailed(shortContentError);

      return { success: false, error: shortContentError };
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
      content: resolvedManuscriptText,
    };

    const chunkRouting = await maybeEnsureLongFormChunks({
      manuscriptId: manuscriptWithContent.id,
      jobId: String(job.id),
      manuscriptText: manuscriptWithContent.content || '',
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
        pipelineStage: 'phase_1',
        reasonCodes: ['LONG_FORM_CHUNK_MATERIALIZATION_FAILED'],
        diagnostics: { chunk_routing: chunkRouting },
      });
      return { success: false, error: chunkMaterializationError };
    }

    let manuscriptChunksForPipeline: ManuscriptChunkEvidence[] | undefined;
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
            pipelineStage: 'phase_1',
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
    }

    console.log('[Processor] chunk routing decision', {
      job_id: jobId,
      manuscript_id: manuscriptWithContent.id,
      ...chunkRouting,
    });

    // 4. Canonical evaluation via governed multi-pass pipeline (fail-closed)
    await markRunning('Running canonical evaluation pipeline', 1, executionPhase);

    const pass3StartedAt = new Date().toISOString();
    progressState.pass3_started_at = pass3StartedAt;
    logProcessorStageBoundary({
      jobId,
      stage: 'pass3',
      state: 'start',
      at: pass3StartedAt,
      metadata: {
        model: getCanonicalPipelineModel(openAiModel),
      },
    });

    const externalMode = getExternalAdjudicationMode();
    if ((externalMode === 'required' || externalMode === 'veto') && !perplexityApiKey) {
      const missingCrossCheckConfigError =
        `External adjudication mode '${externalMode}' requires PERPLEXITY_API_KEY`;
      await markFailed(missingCrossCheckConfigError);

      return { success: false, error: missingCrossCheckConfigError };
    }

    console.log(`[Processor] ${jobId}: ENTER runPipeline model=${getCanonicalPipelineModel(openAiModel)} passTimeoutMs=${evalPassTimeoutMs}`);
    const runPipelineStartedAt = startLatencyStage({
      jobId,
      stage: 'pipeline_run',
      metadata: {
        model: getCanonicalPipelineModel(openAiModel),
      },
    });

    await assertJobWithinSla({
      supabase,
      jobId,
      hardDeadlineMs,
      stage: 'before_runPipeline',
    });

    const leaseRenewalIntervalMs = 30_000;
    const leaseRenewalLoop = setInterval(() => {
      void renewEvaluationJobLease({
        supabase,
        jobId,
        leaseMs: runtimeConfig.worker.leaseMs,
        stage: 'runPipeline.interval',
        hardDeadlineMs,
      }).catch((error) => {
        console.warn('[Processor] In-flight lease renewal failed', {
          job_id: jobId,
          stage: 'runPipeline.interval',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, leaseRenewalIntervalMs);

    let pipelineResult;
    try {
      pipelineResult = await runPipeline({
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
        _passTimeoutMs: evalPassTimeoutMs,
        onHeartbeat: async (stage) => {
          await assertJobWithinSla({
            supabase,
            jobId,
            hardDeadlineMs,
            stage,
          });

          await renewEvaluationJobLease({
            supabase,
            jobId,
            leaseMs: runtimeConfig.worker.leaseMs,
            stage,
            hardDeadlineMs,
          });
        },
      });
    } finally {
      clearInterval(leaseRenewalLoop);
    }

    finishLatencyStage({
      jobId,
      stage: 'pipeline_run',
      startedAt: runPipelineStartedAt,
      state: pipelineResult.ok ? 'completed' : 'failed',
      metadata: {
        finish_reason: pipelineResult.ok
          ? 'ok'
          : ('error_code' in pipelineResult ? pipelineResult.error_code : 'pipeline_failed'),
      },
    });

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
      sourceText: manuscriptWithContent.content || "",
    });
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

    const scopeProfileForV2Gate =
      process.env.EVAL_SCOPE_PROFILE_ENABLED === 'true'
        ? classifySubmissionScope(manuscriptWithContent.content || '', 1)
        : undefined;

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

    const promptCoverage = summarizePromptCoverage(manuscriptWithContent.content || '');
    effectiveEvaluationResult.metrics.manuscript = {
      ...effectiveEvaluationResult.metrics.manuscript,
      word_count: promptCoverage.sourceWords,
      char_count: promptCoverage.sourceChars,
      genre: manuscriptWithContent.work_type || 'Unknown',
    };
    effectiveEvaluationResult.metrics.processing = {
      ...effectiveEvaluationResult.metrics.processing,
      segment_count: promptCoverage.truncated ? 3 : 1,
    };
    effectiveEvaluationResult.governance.limitations = [
      promptCoverage.truncated
        ? `Pass 1 and Pass 2 analyzed a sampled prompt window (~${promptCoverage.analyzedWords} of ${promptCoverage.sourceWords} words; ${promptCoverage.budgetChars}-char budget).`
        : `Pass 1 and Pass 2 analyzed the full submission (${promptCoverage.sourceWords} words).`,
      'Pass 3 synthesis uses a compressed manuscript reference window for arbitration context.',
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

    await markRunning('Persisting evaluation artifacts', 2, 'phase_2');

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
          phase: progressState.phase ?? 'phase_1',
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
  const leaseMsRaw = Number(options.leaseMs ?? 180_000);
  const batchSize = Number.isFinite(batchSizeRaw)
    ? Math.min(5, Math.max(1, Math.floor(batchSizeRaw)))
    : 5;
  const leaseMs = Number.isFinite(leaseMsRaw)
    ? Math.min(180_000, Math.max(30_000, Math.floor(leaseMsRaw)))
    : 180_000;
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
  const { evalWorkerBatchSize } = getProcessorRuntimeDeps();
  const effectiveWorkerId = options?.workerId ?? randomUUID();
  const requestedBatchSize = options?.batchSize ?? evalWorkerBatchSize;
  const requestedLeaseMs = options?.leaseMs ?? 180_000;

  console.log('[Processor] Claim assumptions', {
    expected_status: JOB_STATUS.QUEUED,
    expected_phase_status: JOB_STATUS.QUEUED,
    expected_phases: ['phase_1', 'phase_2'],
    canonical_ownership_fields: ['claimed_by', 'lease_token', 'lease_expires_at'],
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
  } catch {
    // If claiming fails hard, return early rather than silently double-processing.
    console.error('[Processor] Fatal error during job claiming; aborting batch');
    return { processed: 0, succeeded: 0, failed: 0, claimed: 0, errors: [] };
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
