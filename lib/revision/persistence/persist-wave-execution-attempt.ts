/**
 * persist-wave-execution-attempt.ts
 * Records every wave execution attempt (pass/fail/skip) to Supabase
 * wave_execution_attempts table for audit and debugging.
 */

import { createClient } from '@supabase/supabase-js';
import { WaveId } from '../governance/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type WaveAttemptStatus = 'started' | 'passed' | 'failed' | 'skipped' | 'blocked';

export interface WaveExecutionAttempt {
  run_id: string;
  wave_id: WaveId;
  status: WaveAttemptStatus;
  blocked_by: string | null;
  error_message: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function persistWaveExecutionAttempt(
  runId: string,
  waveId: WaveId,
  status: WaveAttemptStatus,
  opts: {
    blockedBy?: string;
    errorMessage?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const attempt: WaveExecutionAttempt = {
    run_id: runId,
    wave_id: waveId,
    status,
    blocked_by: opts.blockedBy ?? null,
    error_message: opts.errorMessage ?? null,
    duration_ms: opts.durationMs ?? null,
    metadata: opts.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('wave_execution_attempts')
    .insert(attempt);

  if (error) {
    console.error(
      `[wave-attempt] Failed to persist attempt for wave ${waveId} in run ${runId}:`,
      error.message
    );
  }
}

export async function markWaveStarted(runId: string, waveId: WaveId): Promise<void> {
  await persistWaveExecutionAttempt(runId, waveId, 'started');
}

export async function markWavePassed(
  runId: string,
  waveId: WaveId,
  durationMs: number
): Promise<void> {
  await persistWaveExecutionAttempt(runId, waveId, 'passed', { durationMs });
}

export async function markWaveFailed(
  runId: string,
  waveId: WaveId,
  errorMessage: string,
  durationMs: number
): Promise<void> {
  await persistWaveExecutionAttempt(runId, waveId, 'failed', { errorMessage, durationMs });
}

export async function markWaveBlocked(
  runId: string,
  waveId: WaveId,
  blockedBy: string
): Promise<void> {
  await persistWaveExecutionAttempt(runId, waveId, 'blocked', { blockedBy });
}
