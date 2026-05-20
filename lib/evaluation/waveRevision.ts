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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum manuscript word count for WAVE eligibility */
export const WAVE_MIN_WORDS = 25_000;

/** Minimum per-criterion score (0–10) for WAVE eligibility — no red criteria */
export const WAVE_MIN_CRITERION_SCORE = 6.0;

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
  try {
    const session = await createRevisionSession({
      evaluation_run_id: handoff.jobId,
      source_version_id: handoff.manuscriptVersionId ?? handoff.jobId,
    });
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
