/**
 * rescueOrphanedJob — canonical TypeScript wrapper for
 * admin_rescue_orphaned_evaluation_job() Postgres function.
 *
 * This is the ONE authorised path for rescuing stuck/orphaned evaluation jobs.
 * Direct DB updates on production jobs are forbidden outside this function.
 *
 * An orphaned job is:
 *   - status = 'running'
 *   - claimed_by / lease_token present
 *   - worker_pulse_at IS NULL (processor crashed before first pulse)
 *     OR worker_pulse_at older than threshold AND lease_until expired
 *
 * The DB function:
 *   - Clears claimed_by, lease_token, lease_until, worker_pulse_at
 *   - Sets status = 'queued', phase_status = 'queued'
 *   - Preserves phase (no rewind)
 *   - Appends _rescue_event to progress JSONB (audit trail)
 *   - Never deletes the job or manuscript
 *   - Is idempotent (second call on same job is a no-op)
 */

import { createClient } from '@supabase/supabase-js';

export type RescueResult =
  | { rescued: true; jobId: string; phase: string; rescuedAt: string }
  | { rescued: false; reason: 'not_found_or_not_running' | 'rpc_error'; error?: string };

/**
 * Rescue a single orphaned job using the canonical DB function.
 *
 * @param jobId   - UUID of the evaluation job to rescue
 * @param reason  - Human-readable reason string appended to the audit trail
 */
export async function rescueOrphanedJob(
  jobId: string,
  reason: string = 'orphan_detected',
): Promise<RescueResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !supabaseKey) {
    return { rescued: false, reason: 'rpc_error', error: 'Missing Supabase credentials' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc('admin_rescue_orphaned_evaluation_job', {
    p_job_id: jobId,
    p_reason: reason,
  });

  if (error) {
    console.error(`[rescueOrphanedJob] RPC error for job ${jobId}:`, error.message);
    return { rescued: false, reason: 'rpc_error', error: error.message };
  }

  const rows = data as Array<{
    id: string;
    status: string;
    phase: string;
    phase_status: string;
    rescued_at: string;
  }> | null;

  if (!rows || rows.length === 0) {
    // Job was not in 'running' state — already terminal, queued, or doesn't exist.
    return { rescued: false, reason: 'not_found_or_not_running' };
  }

  const row = rows[0];

  // Canonical rescue leaves the progress.phase_status and per-phase start
  // timestamps stale. Patch them so the queue sweeper doesn't see a split-brain
  // state and immediately hard-stop the job.
  const { data: progressRow } = await supabase
    .from('evaluation_jobs')
    .select('progress')
    .eq('id', jobId)
    .single();

  const existingProgress = (progressRow?.progress && typeof progressRow.progress === 'object')
    ? (progressRow.progress as Record<string, unknown>)
    : {};

  const cleanedProgress = {
    ...existingProgress,
    phase: row.phase,
    phase_status: 'queued',
    phase1_started_at: null,
    phase1a_started_at: null,
    phase2_started_at: null,
    phase3_started_at: null,
    hard_stop_at: null,
    hard_stop_code: null,
    hard_stop_reason: null,
    hard_stop_internal_reason: null,
    hard_stop_halted: false,
    dashboard_status: null,
    message: 'Rescued by admin rescue RPC',
    watchdog_rescue_at: row.rescued_at,
    watchdog_rescue_reason: reason,
  };

  const { error: patchErr } = await supabase
    .from('evaluation_jobs')
    .update({
      phase1_started_at: null,
      phase2_started_at: null,
      progress: cleanedProgress,
    })
    .eq('id', jobId);

  if (patchErr) {
    console.warn(`[rescueOrphanedJob] progress patch failed for job ${jobId}:`, patchErr.message);
  }

  console.log(`[rescueOrphanedJob] Rescued job ${row.id}: phase=${row.phase} rescuedAt=${row.rescued_at} reason="${reason}"`);

  return {
    rescued: true,
    jobId: row.id,
    phase: row.phase,
    rescuedAt: row.rescued_at,
  };
}
