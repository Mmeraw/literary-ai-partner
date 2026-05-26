/**
 * WAVE Revision Phase
 *
 * Runs the WAVE revision engine as an inline post-evaluation phase.
 * Called by processor.ts after persistEvaluationResultV2 succeeds,
 * wrapped in a 60-second hard timeout.
 *
 * Architecture:
 *   Pass 1 + Pass 1A + Pass 2
 *           ↓
 *   Pass 3 synthesis (evaluation complete)
 *           ↓
 *   Quality gate validates
 *           ↓
 *   persistEvaluationResultV2 ← job complete regardless of WAVE
 *           ↓
 *   WAVE gate check (25k words + all criteria ≥ 6.0)
 *           ↓ eligible
 *   executeWaveRevision() ← this module
 *           ↓
 *   wave_revision_plan_v1 + wave_runs persisted
 *           ↓
 *   job = complete
 *
 * WAVE modules are fully deterministic — zero LLM calls.
 * No timeout risk from individual modules; the 60s cap is a safety net only.
 *
 * Naming: "wave_revision" — NOT "pass4" (pass4 = QualityGate in this codebase).
 *
 * Artifact semantics:
 *   status="complete"  — WAVE ran, plan persisted
 *   status="skipped"   — gate failed (manuscript too short or criteria below floor)
 *   status="failed"    — gate passed but execution threw or timed out
 *   status="timeout"   — WAVE_TIMEOUT specifically (retryable=true)
 */

import type { SynthesisOutput, CharacterLedgerV2 } from '@/lib/evaluation/pipeline/types';
import { executeWaveLayer } from '@/lib/pipeline/wave-execution-layer';
import { executeWaveModules } from '@/lib/revision/wave-executor';
import { createRevisionSession } from '@/lib/revision/sessions';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createDerivedVersion,
  createInitialVersion,
  getVersionById,
} from '@/lib/manuscripts/versions';
import { getLatestVersionForManuscript } from '@/lib/db/manuscriptVersions';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum manuscript word count for WAVE eligibility */
export const WAVE_MIN_WORDS = 25_000;

/** Minimum per-criterion score (0–10) for WAVE eligibility — no red criteria */
export const WAVE_MIN_CRITERION_SCORE = 6.0;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WAVE_SOURCE_VERSION_RESOLUTION_WARN_MS = 1_500;
const WAVE_SESSION_CREATE_WARN_MS = 1_500;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WaveHandoff {
  manuscriptText: string;
  synthesis: SynthesisOutput;
  characterLedgerV2: CharacterLedgerV2 | undefined;
  wordCount: number;
  jobId: string;
  manuscriptVersionId: string | null;
}

export interface WaveRevisionPlanArtifact {
  status: 'complete' | 'skipped' | 'failed' | 'timeout';
  reason?: string;
  reason_codes?: string[];
  lowest_criteria?: Array<{ key: string; score: number }>;
  retryable?: boolean;
  modules_run?: number;
  modules_with_findings?: number;
  revision_session_id?: string;
  wave_plan_summary?: Record<string, unknown>;
  generated_at: string;
}

export interface WaveRunRecord {
  job_id: string;
  status: 'complete' | 'failed' | 'skipped' | 'timeout';
  gate_result: {
    passed: boolean;
    reasons: string[];
  };
  duration_ms: number;
  modules_run?: number;
  error?: string;
  generated_at: string;
}

export interface WaveRevisionResult {
  plan: WaveRevisionPlanArtifact;
  runRecord: WaveRunRecord;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Resolve a valid manuscript_versions.id for WAVE revision session creation.
 *
 * Root-cause fix:
 * - Older jobs may have null/invalid evaluation_jobs.manuscript_version_id.
 * - Falling back to jobId violates revision_sessions.source_version_id FK.
 *
 * Strategy:
 * 1) Use handoff.manuscriptVersionId if present and exists.
 * 2) Else use evaluation_jobs.manuscript_version_id if present and exists.
 * 3) Else create/bind a manuscript version snapshot from evaluated text.
 */
export async function resolveWaveSourceVersionId(handoff: WaveHandoff): Promise<string> {
  const directCandidate = handoff.manuscriptVersionId?.trim() ?? null;
  if (isUuid(directCandidate)) {
    const existing = await getVersionById(directCandidate);
    if (existing) {
      return directCandidate;
    }
    console.warn(
      `[WAVE] handoff manuscriptVersionId ${directCandidate} not found; recovering via evaluation job binding`,
      { job_id: handoff.jobId },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error('WAVE source version resolution failed: Supabase admin client unavailable');
  }

  const { data: jobRow, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, user_id, manuscript_version_id')
    .eq('id', handoff.jobId)
    .single();

  if (jobError || !jobRow) {
    throw new Error(
      `WAVE source version resolution failed for job ${handoff.jobId}: ${jobError?.message ?? 'job not found'}`,
    );
  }

  const dbCandidate =
    typeof jobRow.manuscript_version_id === 'string'
      ? jobRow.manuscript_version_id.trim()
      : null;
  if (isUuid(dbCandidate)) {
    const existing = await getVersionById(dbCandidate);
    if (existing) {
      return dbCandidate;
    }
    console.warn(
      `[WAVE] evaluation_jobs.manuscript_version_id ${dbCandidate} not found; creating fresh snapshot`,
      { job_id: handoff.jobId },
    );
  }

  const manuscriptId = Number(jobRow.manuscript_id);
  if (!Number.isInteger(manuscriptId) || manuscriptId <= 0) {
    throw new Error(
      `WAVE source version resolution failed for job ${handoff.jobId}: invalid manuscript_id ${String(jobRow.manuscript_id)}`,
    );
  }

  const createdBy = typeof jobRow.user_id === 'string' ? jobRow.user_id : null;
  const latestVersion = await getLatestVersionForManuscript(manuscriptId);

  let resolvedVersionId: string;
  if (!latestVersion) {
    const initial = await createInitialVersion({
      manuscript_id: manuscriptId,
      raw_text: handoff.manuscriptText,
      word_count: handoff.wordCount,
      created_by: createdBy,
    });
    resolvedVersionId = initial.id;
  } else {
    const handoffText = handoff.manuscriptText ?? '';
    const textMatches = latestVersion.raw_text === handoffText;
    const wordsMatch = latestVersion.word_count === handoff.wordCount;

    if (handoffText.trim().length === 0 || (textMatches && wordsMatch)) {
      resolvedVersionId = latestVersion.id;
    } else {
      const derived = await createDerivedVersion({
        manuscript_id: manuscriptId,
        source_version_id: latestVersion.id,
        raw_text: handoffText,
        word_count: handoff.wordCount,
        created_by: createdBy,
      });
      resolvedVersionId = derived.id;
    }
  }

  const { error: bindError } = await supabase
    .from('evaluation_jobs')
    .update({ manuscript_version_id: resolvedVersionId })
    .eq('id', handoff.jobId);

  if (bindError) {
    console.warn(
      `[WAVE] Failed to bind evaluation_jobs.manuscript_version_id for job ${handoff.jobId} (non-fatal): ${bindError.message}`,
    );
  }

  if (!isUuid(resolvedVersionId)) {
    throw new Error(
      `WAVE_SOURCE_VERSION_RESOLUTION_FAILED: resolved non-uuid source_version_id for job ${handoff.jobId}`,
    );
  }

  const finalVersion = await getVersionById(resolvedVersionId);
  if (!finalVersion) {
    throw new Error(
      `WAVE_SOURCE_VERSION_RESOLUTION_FAILED: resolved source_version_id not found for job ${handoff.jobId} (${resolvedVersionId})`,
    );
  }

  return resolvedVersionId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate check
// ─────────────────────────────────────────────────────────────────────────────

export interface WaveGateResult {
  passed: boolean;
  reasons: string[];
  lowestCriteria: Array<{ key: string; score: number }>;
}

export function checkWaveGate(handoff: WaveHandoff): WaveGateResult {
  const reasons: string[] = [];
  const lowestCriteria: Array<{ key: string; score: number }> = [];

  // Gate 1: word count
  if (handoff.wordCount < WAVE_MIN_WORDS) {
    reasons.push(`WORD_COUNT_BELOW_THRESHOLD: ${handoff.wordCount} < ${WAVE_MIN_WORDS}`);
  }

  // Gate 2: all 13 criteria ≥ 6.0 — no red criteria allowed
  const belowFloor = handoff.synthesis.criteria
    .filter(c => c.final_score_0_10 < WAVE_MIN_CRITERION_SCORE)
    .map(c => ({ key: c.key, score: c.final_score_0_10 }))
    .sort((a, b) => a.score - b.score);

  if (belowFloor.length > 0) {
    reasons.push(
      `CRITERION_BELOW_FLOOR: ${belowFloor.map(c => `${c.key}=${c.score}`).join(', ')}`,
    );
    lowestCriteria.push(...belowFloor);
  }

  // Gate 3: character ledger available (soft — warn but don't block)
  if (!handoff.characterLedgerV2) {
    console.warn(`[WAVE] characterLedgerV2 unavailable for job ${handoff.jobId} — proceeding without it`);
  }

  return {
    passed: reasons.length === 0,
    reasons,
    lowestCriteria,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main executor
// ─────────────────────────────────────────────────────────────────────────────

export async function executeWaveRevision(
  handoff: WaveHandoff,
): Promise<WaveRevisionResult> {
  const startMs = Date.now();
  const generatedAt = new Date().toISOString();

  const gate = checkWaveGate(handoff);

  // ── Gate failed: return skipped artifact ──────────────────────────────────
  if (!gate.passed) {
    const durationMs = Date.now() - startMs;
    console.log(`[WAVE] Gate failed for job ${handoff.jobId} — skipping revision phase`, {
      reasons: gate.reasons,
    });

    return {
      plan: {
        status: 'skipped',
        reason: 'STRUCTURAL_FLOOR_NOT_MET',
        reason_codes: gate.reasons,
        lowest_criteria: gate.lowestCriteria.length > 0 ? gate.lowestCriteria : undefined,
        generated_at: generatedAt,
      },
      runRecord: {
        job_id: handoff.jobId,
        status: 'skipped',
        gate_result: { passed: false, reasons: gate.reasons },
        duration_ms: durationMs,
        generated_at: generatedAt,
      },
    };
  }

  // ── Gate passed: run WAVE ─────────────────────────────────────────────────
  console.log(`[WAVE] Gate passed for job ${handoff.jobId} — starting revision phase`, {
    word_count: handoff.wordCount,
    criteria_count: handoff.synthesis.criteria.length,
  });

  // Build pass3_findings shape that wavePlanner.deriveWaveTargetsFromFindings expects:
  // { recommendations: [...], criteria: [...] }
  const pass3Findings: Record<string, unknown> = {
    criteria: handoff.synthesis.criteria.map(c => ({
      key: c.key,
      final_score_0_10: c.final_score_0_10,
      recommendations: c.recommendations,
      pressure_points: c.pressure_points,
      decision_points: c.decision_points,
    })),
    overall: handoff.synthesis.overall,
  };

  // Step 1: Create revision session
  let revisionSessionId: string;
  let sourceVersionResolutionMs = 0;
  let revisionSessionCreateMs = 0;
  try {
    const sourceVersionResolutionStartMs = Date.now();
    const sourceVersionId = await resolveWaveSourceVersionId(handoff);
    sourceVersionResolutionMs = Date.now() - sourceVersionResolutionStartMs;
    if (sourceVersionResolutionMs > WAVE_SOURCE_VERSION_RESOLUTION_WARN_MS) {
      console.warn(`[WAVE] source version resolution latency high for job ${handoff.jobId}`, {
        source_version_resolution_ms: sourceVersionResolutionMs,
        warn_threshold_ms: WAVE_SOURCE_VERSION_RESOLUTION_WARN_MS,
      });
    }

    const revisionSessionCreateStartMs = Date.now();
    const session = await createRevisionSession({
      evaluation_run_id: handoff.jobId,
      source_version_id: sourceVersionId,
    });
    revisionSessionCreateMs = Date.now() - revisionSessionCreateStartMs;
    if (revisionSessionCreateMs > WAVE_SESSION_CREATE_WARN_MS) {
      console.warn(`[WAVE] revision session create latency high for job ${handoff.jobId}`, {
        revision_session_create_ms: revisionSessionCreateMs,
        warn_threshold_ms: WAVE_SESSION_CREATE_WARN_MS,
      });
    }

    revisionSessionId = session.id;
    console.log(`[WAVE] Created revision session ${revisionSessionId} for job ${handoff.jobId}`);
  } catch (sessionErr) {
    const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
    console.error(`[WAVE] Failed to create revision session for job ${handoff.jobId}:`, msg);
    throw sessionErr; // Caller handles with 60s timeout wrapper
  }

  // Step 2: Derive wave targets and build plan
  const layerResult = await executeWaveLayer({
    revision_session_id: revisionSessionId,
    revision_mode: 'standard',
    pass3_findings: pass3Findings,
  });

  console.log(`[WAVE] Wave plan built for job ${handoff.jobId}`, {
    derived_wave_ids: layerResult.derived_wave_ids.length,
    plan_valid: layerResult.validation.valid,
    violations: layerResult.validation.violations,
  });

  // Step 3: Execute wave modules against the full manuscript text.
  // WavePlan uses orderedWaveIds — build targets from that list.
  const requestedWaveIds = layerResult.plan.orderedWaveIds;

  const waveTargets = requestedWaveIds.map((waveId: number) => ({
    zone: 'full_manuscript',
    issueType: `wave_${waveId}`,
    recommendedWave: waveId,
    priority: 'medium',
    directive: '',
  }));

  const moduleResult = await executeWaveModules({
    pipelineRunId: handoff.jobId,
    revisionSessionId,
    text: handoff.manuscriptText,
    targets: waveTargets,
    requestedWaves: requestedWaveIds,
    mode: 'standard',
  });

  const modulesWithFindings = moduleResult.results.filter(
    r => r.changes && r.changes.length > 0,
  ).length;

  const durationMs = Date.now() - startMs;

  console.log(`[WAVE] Revision phase complete for job ${handoff.jobId}`, {
    modules_run: moduleResult.results.length,
    modules_with_findings: modulesWithFindings,
    duration_ms: durationMs,
    success: moduleResult.success,
  });

  return {
    plan: {
      status: 'complete',
      modules_run: moduleResult.results.length,
      modules_with_findings: modulesWithFindings,
      revision_session_id: revisionSessionId,
      wave_plan_summary: {
        derived_wave_ids: layerResult.derived_wave_ids,
        plan_valid: layerResult.validation.valid,
        violations: layerResult.validation.violations,
        persisted: layerResult.persisted,
        source_version_resolution_ms: sourceVersionResolutionMs,
        revision_session_create_ms: revisionSessionCreateMs,
      },
      generated_at: generatedAt,
    },
    runRecord: {
      job_id: handoff.jobId,
      status: 'complete',
      gate_result: { passed: true, reasons: [] },
      duration_ms: durationMs,
      modules_run: moduleResult.results.length,
      generated_at: generatedAt,
    },
  };
}
