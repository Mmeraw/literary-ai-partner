/**
 * run-revision-pipeline.ts
 * MANDATORY ENTRY POINT for all revision operations.
 *
 * This is the ONLY path through which model calls for revision may occur.
 * All governance gates are enforced here in sequence. If ANY gate rejects,
 * the entire pipeline halts (fail-closed).
 *
 * Invariants:
 *   - No raw model calls exist outside this orchestrator path
 *   - Diagnostic mode NEVER generates patches
 *   - Perfect scene returns NO_CHANGE_REQUIRED
 *   - Vignette is never escalated; human scene never gains Realm voice
 *   - Protected spans are inviolable
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GovernanceContext,
  GovernanceResult,
  WaveId,
  WAVE_ORDER,
  RevisionMode,
  SceneType,
} from './governance/types';
import { checkSufficiencyGate } from './governance/sufficiency-gate';
import { checkWaveEligibility } from './governance/wave-eligibility';
import { checkDestructionGuards } from './governance/destruction-guards';
import { checkPatchIntegrity } from './governance/patch-integrity';
import { logGovernanceEvent, logGovernanceBatch } from './persistence/log-governance-event';
import {
  markWaveStarted,
  markWavePassed,
  markWaveFailed,
  markWaveBlocked,
} from './persistence/persist-wave-execution-attempt';

export interface PipelineInput {
  sceneId: string;
  sceneText: string;
  sceneType: SceneType;
  mode: RevisionMode;
  waveScores: Record<WaveId, number>;
  protectedSpanIds: string[];
  metadata?: Record<string, unknown>;
}

export interface PipelineOutput {
  runId: string;
  status: 'completed' | 'halted' | 'no_change';
  wavesExecuted: WaveId[];
  wavesSkipped: WaveId[];
  wavesBlocked: WaveId[];
  patches: Array<{ waveId: WaveId; patch: string }>;
  governanceLogs: Array<{ gate: string; result: GovernanceResult }>;
}

export async function runRevisionPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const runId = uuidv4();
  const governanceLogs: PipelineOutput['governanceLogs'] = [];
  const patches: PipelineOutput['patches'] = [];
  const wavesExecuted: WaveId[] = [];
  const wavesSkipped: WaveId[] = [];
  const wavesBlocked: WaveId[] = [];

  const ctx: GovernanceContext = {
    runId,
    sceneId: input.sceneId,
    sceneType: input.sceneType,
    mode: input.mode,
    waveScores: input.waveScores,
    protectedSpanIds: input.protectedSpanIds,
  };

  // ── Gate 1: Sufficiency ──────────────────────────────────────────
  const sufficiency = checkSufficiencyGate(ctx);
  governanceLogs.push({ gate: 'sufficiency', result: sufficiency });
  await logGovernanceEvent(runId, 'sufficiency', sufficiency, { sceneId: input.sceneId });

  if (!sufficiency.pass) {
    return {
      runId,
      status: 'halted',
      wavesExecuted,
      wavesSkipped,
      wavesBlocked,
      patches,
      governanceLogs,
    };
  }

  // If all scores are perfect → NO_CHANGE_REQUIRED
  const allPerfect = WAVE_ORDER.every((w) => (input.waveScores[w] ?? 0) >= 9.5);
  if (allPerfect) {
    await logGovernanceEvent(runId, 'no_change_required', { pass: true, reason: 'All scores >= 9.5' });
    return {
      runId,
      status: 'no_change',
      wavesExecuted,
      wavesSkipped,
      wavesBlocked,
      patches,
      governanceLogs,
    };
  }

  // ── Wave loop ────────────────────────────────────────────────────
  for (const waveId of WAVE_ORDER) {
    // Gate 2: Wave eligibility
    const eligibility = checkWaveEligibility(ctx, waveId);
    governanceLogs.push({ gate: `eligibility:${waveId}`, result: eligibility });
    await logGovernanceEvent(runId, `eligibility:${waveId}`, eligibility);

    if (!eligibility.pass) {
      wavesSkipped.push(waveId);
      continue;
    }

    // Gate 3: Destruction guards (pre-execution)
    const destruction = checkDestructionGuards(ctx, waveId);
    governanceLogs.push({ gate: `destruction:${waveId}`, result: destruction });
    await logGovernanceEvent(runId, `destruction:${waveId}`, destruction);

    if (!destruction.pass) {
      wavesBlocked.push(waveId);
      await markWaveBlocked(runId, waveId, destruction.reason ?? 'destruction guard');
      continue;
    }

    // ── Execute wave ───────────────────────────────────────────────
    await markWaveStarted(runId, waveId);
    const startTime = Date.now();

    try {
      // Diagnostic mode: evaluate only, never patch
      if (input.mode === 'diagnostic') {
        wavesExecuted.push(waveId);
        await markWavePassed(runId, waveId, Date.now() - startTime);
        continue;
      }

      // TODO: Call the actual wave revision function here
      // const patch = await executeWaveRevision(waveId, input.sceneText, ctx);
      const patch = ''; // placeholder until orchestrator wiring

      // Gate 4: Patch integrity (post-execution)
      if (patch) {
        const integrity = checkPatchIntegrity(ctx, waveId, input.sceneText, patch);
        governanceLogs.push({ gate: `integrity:${waveId}`, result: integrity });
        await logGovernanceEvent(runId, `integrity:${waveId}`, integrity);

        if (!integrity.pass) {
          wavesBlocked.push(waveId);
          await markWaveFailed(runId, waveId, integrity.reason ?? 'integrity check', Date.now() - startTime);
          continue;
        }

        patches.push({ waveId, patch });
      }

      wavesExecuted.push(waveId);
      await markWavePassed(runId, waveId, Date.now() - startTime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      wavesBlocked.push(waveId);
      await markWaveFailed(runId, waveId, msg, Date.now() - startTime);
      // Fail-closed: halt pipeline on unexpected error
      return {
        runId,
        status: 'halted',
        wavesExecuted,
        wavesSkipped,
        wavesBlocked,
        patches,
        governanceLogs,
      };
    }
  }

  // Persist batch summary
  await logGovernanceBatch(runId, governanceLogs);

  return {
    runId,
    status: 'completed',
    wavesExecuted,
    wavesSkipped,
    wavesBlocked,
    patches,
    governanceLogs,
  };
}
