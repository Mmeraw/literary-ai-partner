/**
 * Phase 2B: Atomic Transition Writer — TypeScript client
 * ALL job state changes MUST go through this module.
 * Direct mutation of evaluation_jobs.current_state is prohibited.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TransitionRequest {
  jobId: string;
  toState: string;
  leaseToken?: string;
  trigger?: 'worker' | 'admin' | 'system' | 'replay';
  workerId?: string;
  errorCode?: string;
  errorMessage?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  ok: boolean;
  from?: string;
  to?: string;
  jobId?: string;
  error?: string;
  idempotent?: boolean;
}

export async function transitionJobState(
  supabase: SupabaseClient,
  req: TransitionRequest
): Promise<TransitionResult> {
  const { data, error } = await supabase.rpc('transition_job_state', {
    p_job_id: req.jobId,
    p_to_state: req.toState,
    p_lease_token: req.leaseToken ?? null,
    p_trigger: req.trigger ?? 'worker',
    p_worker_id: req.workerId ?? null,
    p_error_code: req.errorCode ?? null,
    p_error_message: req.errorMessage ?? null,
    p_idempotency_key: req.idempotencyKey ?? null,
    p_metadata: req.metadata ?? {},
  });

  if (error) {
    console.error('[TransitionWriter] RPC error:', error.message);
    return { ok: false, error: `RPC_ERROR: ${error.message}` };
  }

  return data as TransitionResult;
}

/** Convenience: transition to failed with error classification */
export async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  errorCode: string,
  errorMessage: string,
  opts?: { leaseToken?: string; workerId?: string }
): Promise<TransitionResult> {
  return transitionJobState(supabase, {
    jobId,
    toState: 'failed',
    errorCode,
    errorMessage,
    leaseToken: opts?.leaseToken,
    workerId: opts?.workerId,
    trigger: 'worker',
  });
}

/** Convenience: quarantine a job */
export async function quarantineJob(
  supabase: SupabaseClient,
  jobId: string,
  reason: string,
  opts?: { leaseToken?: string; workerId?: string }
): Promise<TransitionResult> {
  return transitionJobState(supabase, {
    jobId,
    toState: 'quarantined',
    errorMessage: reason,
    leaseToken: opts?.leaseToken,
    workerId: opts?.workerId,
    trigger: 'worker',
  });
}
