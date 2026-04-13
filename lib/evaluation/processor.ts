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
 * • Returns structured EvaluationResultV1 with criterion-specific analysis
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
import type { EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import { validateEvaluationResult } from '@/schemas/evaluation-result-v1';
import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import { WAVE_GUIDE_SUMMARY, WAVE_GUIDE_VERSION } from './WAVE_GUIDE';
import { stableSourceHash, upsertEvaluationArtifact } from './artifactPersistence';
import {
  runPipeline,
  synthesisToEvaluationResult,
} from '@/lib/evaluation/pipeline/runPipeline';
import {
  getCanonicalPipelineModel,
  getExternalAdjudicationMode,
} from '@/lib/evaluation/policy';
import {
  assertEvalTimeoutConfig,
  getEvalOpenAiTimeoutMs,
  getEvalPassTimeoutMs,
} from '@/lib/evaluation/config';
import { summarizePromptCoverage } from '@/lib/evaluation/pipeline/promptInput';
import { detectContextContamination } from '@/lib/evaluation/governance/contextContaminationGuard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY;
const perplexityApiKey = process.env.PERPLEXITY_API_KEY ?? "";
const evalDebugEnabled = process.env.EVAL_DEBUG === '1';
const evalMinManuscriptChars = (() => {
  if (process.env.EVAL_MIN_MANUSCRIPT_WORDS) {
    const parsed = Number.parseInt(process.env.EVAL_MIN_MANUSCRIPT_WORDS, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      // Convert words to chars (avg ~5 chars/word)
      return parsed * 5;
    }
  }
  if (process.env.EVAL_MIN_MANUSCRIPT_CHARS) {
    console.warn(
      '[Processor] EVAL_MIN_MANUSCRIPT_CHARS is deprecated. Use EVAL_MIN_MANUSCRIPT_WORDS instead. Defaulting to 200 words.',
    );
  }
  return 200 * 5; // 200 words default
})();
const openAiModel = (process.env.EVAL_OPENAI_MODEL || 'o3').trim() || 'o3';
const evalPassTimeoutMs = getEvalPassTimeoutMs();
const evalOpenAiTimeoutMs = getEvalOpenAiTimeoutMs();
assertEvalTimeoutConfig();
const EVALUATION_PROGRESS_TOTAL_UNITS = 3;
const staleRunningMinutes = (() => {
  const parsed = Number.parseInt(process.env.EVAL_STALE_RUNNING_MINUTES || '10', 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 240 ? parsed : 10;
})();
const evalWorkerBatchSize = (() => {
  const parsed = Number.parseInt(process.env.EVAL_WORKER_BATCH_SIZE || '5', 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 5;
})();
const evalContextContaminationGuardEnabled = (() => {
  const raw = (process.env.EVAL_CONTEXT_CONTAMINATION_GUARD || 'auto').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') {
    return true;
  }
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
})();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function evalDebugLog(message: string, ...args: unknown[]): void {
  if (!evalDebugEnabled) {
    return;
  }
  console.log(message, ...args);
}

function evalDebugWarn(message: string, ...args: unknown[]): void {
  if (!evalDebugEnabled) {
    return;
  }
  console.warn(message, ...args);
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
): Promise<string> {
  // Priority 1: Direct content column
  const directContent = typeof manuscript.content === 'string' ? manuscript.content.trim() : '';
  if (directContent.length > 0) {
    return directContent;
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
    const reconstructed = (chunks as Array<{ content?: unknown }>)
      .map((chunk) => (typeof chunk.content === 'string' ? chunk.content.trim() : ''))
      .filter((part) => part.length > 0)
      .join('\n');

    if (reconstructed.length > 0) {
      evalDebugWarn(
        `[Processor] manuscript ${manuscript.id} missing manuscripts.content; reconstructed text from ${chunks.length} chunk(s)`,
      );
      return reconstructed;
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
          return decoded;
        }
      }
    } catch (decodeError) {
      console.warn(
        `[Processor] manuscript ${manuscript.id} file_url data URI decode failed:`,
        decodeError,
      );
    }
  }

  return '';
}

export function isManuscriptTextLongEnough(
  text: string,
  minChars = evalMinManuscriptChars,
): boolean {
  return text.trim().length >= minChars;
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
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - staleRunningMinutes * 60_000).toISOString();

  // Collect IDs: stale by updated_at cutoff OR expired claim lease
  const { data: staleByAge, error: ageError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', 'running')
    .not('last_heartbeat_at', 'is', null)
    .lt('last_heartbeat_at', cutoff)
    .order('last_heartbeat_at', { ascending: true })
    .limit(25);

  if (ageError) {
    console.warn('[Processor] Failed to check stale running jobs (age):', ageError.message);
    return { staleFound: 0, failed: 0, ids: [] };
  }

  // Also collect jobs with expired claim leases (lease_expires_at in the past)
  const { data: staleByLease, error: leaseError } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', 'running')
    .not('lease_expires_at', 'is', null)
    .lt('lease_expires_at', now)
    .order('lease_expires_at', { ascending: true })
    .limit(25);

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

  const { data: failedRows, error: failError } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'failed',
      last_error:
        'Auto-failed stale running job: worker timed out or crashed before completion update',
      claimed_by: null,
      claimed_at: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .in('id', staleIds)
    .eq('status', 'running')
    .select('id');

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
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const progress =
      job.progress && typeof job.progress === 'object'
        ? (job.progress as Record<string, unknown>)
        : {};

    const isPhase1CompleteHandoff =
      job.status === 'running' &&
      (job.phase === 'phase_1' || progress.phase === 'phase_1') &&
      (job.phase_status === 'complete' || progress.phase_status === 'complete');

    const isPhase1QueuedCandidate =
      job.status === 'queued' &&
      (job.phase === 'phase_1' || progress.phase === 'phase_1') &&
      (job.phase_status === 'queued' || progress.phase_status === 'queued');

    const isPhase2QueuedCandidate =
      job.status === 'queued' &&
      (job.phase === 'phase_2' || progress.phase === 'phase_2') &&
      (job.phase_status === 'queued' || progress.phase_status === 'queued');

    // Pre-claimed running jobs: atomically claimed by the processor (claimed_by is set,
    // phase_status=running, lease not yet expired). These were transitioned queued->running
    // by claim_evaluation_jobs RPC before being handed to this function.
    const isPhase1PreClaimed =
      job.status === 'running' &&
      !!job.claimed_by &&
      (job.phase === 'phase_1' || progress.phase === 'phase_1') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const isPhase2PreClaimed =
      job.status === 'running' &&
      !!job.claimed_by &&
      (job.phase === 'phase_2' || progress.phase === 'phase_2') &&
      (job.phase_status === 'running' || progress.phase_status === 'running');

    const executionPhase: 'phase_1' | 'phase_2' =
      isPhase2QueuedCandidate || isPhase2PreClaimed ? 'phase_2' : 'phase_1';

    if (
      !isPhase1QueuedCandidate &&
      !isPhase1CompleteHandoff &&
      !isPhase2QueuedCandidate &&
      !isPhase1PreClaimed &&
      !isPhase2PreClaimed
    ) {
      return {
        success: false,
        error: `Job not eligible for processing. status=${job.status}, phase=${job.phase}, phase_status=${job.phase_status}`,
      };
    }

    const progressState =
      job.progress && typeof job.progress === 'object' ? { ...job.progress } : {};

    const markRunning = async (
      message: string,
      completedUnits: number,
      phase: 'phase_1' | 'phase_2' = 'phase_1',
    ) => {
      const now = new Date().toISOString();
      const nextProgress = {
        ...progressState,
        phase,
        phase_status: 'running',
        total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
        completed_units: completedUnits,
        message,
        last_heartbeat_at: now,
      };

      Object.assign(progressState, nextProgress);

      await supabase
        .from('evaluation_jobs')
        .update({
          status: 'running',
          phase,
          phase_status: 'running',
          total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
          completed_units: completedUnits,
          progress: nextProgress,
          started_at: job.started_at ?? now,
          last_heartbeat: now,
          last_heartbeat_at: now,
          heartbeat_at: now,
          updated_at: now,
        })
        .eq('id', jobId);
    };

    const markFailed = async (errorMessage: string) => {
      const now = new Date().toISOString();
      const nextProgress = {
        ...progressState,
        phase:
          progressState.phase === 'phase_2' || progressState.phase === 'phase_1'
            ? progressState.phase
            : executionPhase,
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
      };

      Object.assign(progressState, nextProgress);

      try {
        await supabase
          .from('evaluation_jobs')
          .update({
            status: 'failed',
            phase: nextProgress.phase,
            phase_status: 'failed',
            total_units: nextProgress.total_units,
            completed_units: nextProgress.completed_units,
            progress: nextProgress,
            last_error: errorMessage,
            updated_at: now,
          })
          .eq('id', jobId);
      } catch (writeError) {
        console.error(`[Processor] Failed writing failure state for job ${jobId}:`, writeError);
      }
    };

    // 2. Update status to running
    await markRunning('Fetching manuscript', 0, executionPhase);

    console.log(`[Processor] Job ${jobId} status updated to running`);

    // 3. Fetch the manuscript
    const { data: manuscript, error: manuscriptError } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('id', job.manuscript_id)
      .single();

    if (manuscriptError || !manuscript) {
      const message = `Manuscript not found: ${manuscriptError?.message}`;
      await markFailed(message);
      return { success: false, error: message };
    }

    console.log(`[Processor] Manuscript ${manuscript.id} fetched: "${manuscript.title}"`);

    const resolvedManuscriptText = await resolveManuscriptText(supabase, manuscript as Manuscript);
    if (!resolvedManuscriptText || resolvedManuscriptText.trim().length === 0) {
      const contentError = 'Manuscript text unavailable: neither manuscripts.content nor manuscript_chunks.content found';
      await markFailed(contentError);

      return { success: false, error: contentError };
    }

    if (!isManuscriptTextLongEnough(resolvedManuscriptText, evalMinManuscriptChars)) {
      const shortContentError =
        `Manuscript text too short for reliable evaluation: ${resolvedManuscriptText.trim().length} chars ` +
        `(minimum ${evalMinManuscriptChars})`;
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

    // 4. Canonical evaluation via governed multi-pass pipeline (fail-closed)
    await markRunning('Running canonical evaluation pipeline', 1, executionPhase);

    const externalMode = getExternalAdjudicationMode();
    if ((externalMode === 'required' || externalMode === 'veto') && !perplexityApiKey) {
      const missingCrossCheckConfigError =
        `External adjudication mode '${externalMode}' requires PERPLEXITY_API_KEY`;
      await markFailed(missingCrossCheckConfigError);

      return { success: false, error: missingCrossCheckConfigError };
    }

    console.log(`[Processor] ${jobId}: ENTER runPipeline model=${getCanonicalPipelineModel(openAiModel)} passTimeoutMs=${evalPassTimeoutMs}`);
    const pipelineResult = await runPipeline({
      manuscriptText: manuscriptWithContent.content || '',
      workType: manuscriptWithContent.work_type || 'novel',
      title: manuscriptWithContent.title,
      model: getCanonicalPipelineModel(openAiModel),
      openaiApiKey,
      perplexityApiKey: perplexityApiKey || undefined,
      manuscriptId: String(manuscriptWithContent.id),
      executionMode: 'TRUSTED_PATH',
      _passTimeoutMs: evalPassTimeoutMs,
    });
    console.log(
      `[Processor] ${jobId}: EXIT runPipeline ok=${pipelineResult.ok}` +
        (pipelineResult.ok === false
          ? ` failed_at=${pipelineResult.failed_at} code=${pipelineResult.error_code}`
          : ''),
    );

    if (pipelineResult.ok === false) {
      const pipelineError = `[Pipeline:${pipelineResult.failed_at}] ${pipelineResult.error_code} ${pipelineResult.error}`;
      console.error(`[Processor] Pipeline failed for job ${jobId}: ${pipelineError}`);
      await markFailed(pipelineError);

      return { success: false, error: pipelineError };
    }

    if ((externalMode === 'required' || externalMode === 'veto') && !pipelineResult.cross_check) {
      const missingCrossCheckResultError =
        `External adjudication mode '${externalMode}' requires cross-check output`;
      await markFailed(missingCrossCheckResultError);

      return { success: false, error: missingCrossCheckResultError };
    }

    const evaluationResult = synthesisToEvaluationResult({
      synthesis: pipelineResult.synthesis,
      ids: {
        evaluation_run_id: crypto.randomUUID(),
        job_id: job.id,
        manuscript_id: manuscript.id,
        user_id: manuscript.user_id,
      },
      crossCheckResult: pipelineResult.cross_check,
      pass4Governance: pipelineResult.pass4_governance,
    });
    console.log(
      `[Processor] ${jobId}: evaluationResult synthesized overall=${evaluationResult.overview.overall_score_0_100}`,
    );

    if (evalContextContaminationGuardEnabled) {
      const contaminationCheck = detectContextContamination({
        sourceText: manuscriptWithContent.content || '',
        evaluationResult,
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
        await markFailed(contaminationDetail);

        return { success: false, error: 'CONTEXT_CONTAMINATION_DETECTED' };
      }
    }

    const promptCoverage = summarizePromptCoverage(manuscriptWithContent.content || '');
    evaluationResult.metrics.manuscript = {
      ...evaluationResult.metrics.manuscript,
      word_count: promptCoverage.sourceWords,
      char_count: promptCoverage.sourceChars,
      genre: manuscriptWithContent.work_type || 'Unknown',
    };
    evaluationResult.metrics.processing = {
      ...evaluationResult.metrics.processing,
      segment_count: promptCoverage.truncated ? 3 : 1,
    };
    evaluationResult.governance.limitations = [
      promptCoverage.truncated
        ? `Pass 1 and Pass 2 analyzed a sampled prompt window (~${promptCoverage.analyzedWords} of ${promptCoverage.sourceWords} words; ${promptCoverage.budgetChars}-char budget).`
        : `Pass 1 and Pass 2 analyzed the full submission (${promptCoverage.sourceWords} words).`,
      'Pass 3 synthesis uses a compressed manuscript reference window for arbitration context.',
      ...evaluationResult.governance.limitations.filter(
        (item) =>
          item !== 'Single-chunk evaluation; multi-chunk synthesis in Phase 2.8' &&
          item !== 'Full manuscript context may not be captured if truncated',
      ),
    ];

    console.log(`[Processor] Canonical pipeline evaluation generated for job ${jobId}`);

    await markRunning('Persisting evaluation artifacts', 2, 'phase_2');

    const completionTime = new Date().toISOString();
    const existingProgress = { ...progressState };

    // 5. Persist canonical artifact with idempotent upsert (fail-closed)
    const manuscriptText = manuscriptWithContent.content || '(No content provided)';
    const model = evaluationResult.engine?.model || 'unknown-model';
    const promptVersion = evaluationResult.engine?.prompt_version || 'unknown-prompt';

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

    try {
      console.log(
        `[Processor] ${jobId}: ENTER upsertEvaluationArtifact manuscriptId=${job.manuscript_id}`,
      );
      const artifactId = await upsertEvaluationArtifact({
        supabase,
        jobId: job.id,
        manuscriptId: job.manuscript_id,
        artifactType: 'evaluation_result_v1',
        content: evaluationResult,
        sourceHash,
        artifactVersion: 'evaluation_result_v1',
      });

      console.log(`[Processor] ${jobId}: EXIT upsertEvaluationArtifact id=${artifactId}`);
      console.log(`[Processor] Canonical artifact upserted: ${artifactId}`);
    } catch (artifactError) {
      const errorMsg = artifactError instanceof Error ? artifactError.message : String(artifactError);
      await markFailed(`Artifact persistence failed: ${errorMsg}`);

      return { success: false, error: `Artifact persistence failed: ${errorMsg}` };
    }

    // 6. Store evaluation result and mark complete only after artifact exists
    console.log(`[Processor] ${jobId}: ENTER completion update`);
    const { error: updateError } = await supabase
      .from('evaluation_jobs')
      .update({
        status: 'complete',
        phase: 'phase_2',
        phase_status: 'complete',
        total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
        completed_units: EVALUATION_PROGRESS_TOTAL_UNITS,
        progress: {
          ...existingProgress,
          phase: 'phase_2',
          phase_status: 'complete',
          total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
          completed_units: EVALUATION_PROGRESS_TOTAL_UNITS,
          message: 'Evaluation completed',
          finished_at: completionTime,
        },
        evaluation_result: evaluationResult,
        evaluation_result_version: 'evaluation_result_v1',
        last_heartbeat: completionTime,
        last_heartbeat_at: completionTime,
        heartbeat_at: completionTime,
        last_error: null,
        updated_at: completionTime
      })
      .eq('id', jobId);
    console.log(
      `[Processor] ${jobId}: EXIT completion update error=${updateError ? updateError.message : 'none'}`,
    );

    if (updateError) {
      await markFailed(`Completion update failed: ${updateError.message}`);

      console.error(`[Processor] Failed to update job ${jobId}:`, updateError);
      return { success: false, error: `Failed to store result: ${updateError.message}` };
    }

    console.log(`[Processor] Job ${jobId} completed successfully`);

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Processor] Error processing job ${jobId}:`, errorMessage);

    // Update job status to failed
    const now = new Date().toISOString();
    try {
      await supabase
        .from('evaluation_jobs')
        .update({
          status: 'failed',
          total_units: EVALUATION_PROGRESS_TOTAL_UNITS,
          completed_units: 0,
          phase_status: 'failed',
          last_error: errorMessage,
          updated_at: now,
        })
        .eq('id', jobId);
    } catch (updateError) {
      console.error(`[Processor] Failed to update job status to failed:`, updateError);
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Atomically claim a batch of queued evaluation jobs using the claim_evaluation_jobs RPC.
 * Returns an array of claimed job objects (id + phase).
 * Falls back to an empty array if the RPC is unavailable (graceful degradation).
 */
export async function claimQueuedJobs(
  options: {
    workerId: string;
    batchSize?: number;
    leaseMs?: number;
  },
): Promise<Array<{ id: string; phase: string }>> {
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

  const { data, error } = await supabase.rpc('claim_evaluation_jobs', {
    p_batch_size: batchSize,
    p_worker_id: workerId,
    p_lease_token: leaseToken,
    p_lease_expires_at: leaseExpiresAt,
  });

  if (error) {
    const msg = error.message || '';
    // Graceful degradation: if the RPC doesn't exist yet, return empty so the
    // caller can fall through to the legacy SELECT path.
    if (msg.includes('function') || msg.includes('does not exist') || msg.includes('schema cache')) {
      console.warn('[Processor] claim_evaluation_jobs RPC unavailable, falling back to legacy SELECT');
      return [];
    }
    console.error('[Processor] claim_evaluation_jobs RPC error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as Array<{ id: string; phase: string }>).map((row) => ({
    id: row.id,
    phase: row.phase,
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
  const effectiveWorkerId = options?.workerId ?? randomUUID();
  const requestedBatchSize = options?.batchSize ?? evalWorkerBatchSize;
  const requestedLeaseMs = options?.leaseMs ?? 180_000;

  // Safety net: recover jobs left in running due to platform hard timeout/crash.
  await failStaleRunningJobs();

  // Atomically claim a batch of queued jobs via SKIP LOCKED RPC.
  let jobs: Array<{ id: string; phase: string }> = [];
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
