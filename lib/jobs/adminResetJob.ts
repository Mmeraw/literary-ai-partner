/**
 * adminResetJob — canonical TypeScript wrapper for
 * admin_reset_evaluation_job() Postgres function.
 *
 * Full reset to phase_0/queued from ANY status.
 * - Wipes progress JSONB (preserves claim_events audit trail)
 * - Clears phase0_started_at, phase0_completed_at, attempt_count
 * - Progress bar on the UI will show clean queued state (no stale error messages)
 *
 * Use this (not raw SQL) whenever a job must be re-run from scratch.
 * Use rescueOrphanedJob for mid-run orphan recovery (running status only).
 */

import { createClient } from '@supabase/supabase-js';

export type ResetResult =
  | { reset: true;  jobId: string; phase: string; resetAt: string }
  | { reset: false; reason: string };

export async function adminResetJob(
  jobId: string,
  reason = 'admin_reset',
): Promise<ResetResult> {
  if (!jobId) return { reset: false, reason: 'jobId is required' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !serviceKey) {
    return { reset: false, reason: 'Missing Supabase credentials' };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('admin_reset_evaluation_job', {
    p_job_id: jobId,
    p_reason: reason,
  });

  if (error) {
    console.error(`[adminResetJob] RPC error for job ${jobId}:`, error.message);
    return { reset: false, reason: error.message };
  }

  const rows = data as Array<{
    id: string;
    status: string;
    phase: string;
    phase_status: string;
    reset_at: string;
  }> | null;

  if (!rows || rows.length === 0) {
    return { reset: false, reason: `Job ${jobId} not found` };
  }

  const row = rows[0];
  console.log(
    `[adminResetJob] Reset job ${row.id} to phase=${row.phase} at ${row.reset_at} reason="${reason}"`,
  );

  return { reset: true, jobId: row.id, phase: row.phase, resetAt: row.reset_at };
}
