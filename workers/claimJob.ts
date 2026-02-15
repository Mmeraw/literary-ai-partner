/**
 * Atomic job claiming with lease-based locking
 * Implements exactly-once job execution guarantee
 */

import { createAdminClient } from '../lib/supabase/admin';
import { randomUUID } from 'crypto';


// Admin client wrapper: uses centralized createAdminClient factory
function getSupabaseClient() {
  return createAdminClient();
}
export interface ClaimResult {
  id: string;
  manuscript_id: number;
  job_type: string;
  policy_family: string;
  voice_preservation_level: string;
  english_variant: string;
  work_type: string | null;
  phase: string;
  status: string;
  lease_token: string;
  lease_until: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
}

type ClaimRpcArgs = {
  p_worker_id: string;
  p_now: string;
  p_lease_seconds: number;
};

const DEFAULT_LEASE_SECONDS = 5 * 60;

/**
 * Atomically claim next eligible job
 * Returns job object or null if no jobs available
 */
export async function claimNextJob(workerId: string): Promise<ClaimResult | null> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const leaseSeconds = DEFAULT_LEASE_SECONDS;

  try {
    // Atomic claim via RPC
    const args: ClaimRpcArgs = {
      p_worker_id: workerId,
      p_now: now,
      p_lease_seconds: leaseSeconds
    };

    const { data, error } = await supabase.rpc('claim_job_atomic', args);

    if (error) {
      // Fallback if RPC unavailable
      const msg = error.message || '';
      if (
        msg.includes('function') ||
        msg.includes('schema cache') ||
        msg.includes('does not exist')
      ) {
        return fallbackClaim(workerId);
      }
      // Log unexpected errors but don't crash
      console.error('Claim RPC error:', error);
      return null;
    }

    // Normalize: Supabase RPC can return null, object, or array depending on client/version
    const job = Array.isArray(data) ? data[0] : data;

    // Canon guard: treat any non-job as null (null, [], [null], {}, {id: null})
    if (!job?.id) {
      return null; // No jobs available
    }

    // Belt-and-suspenders: refuse to run if invariants are broken
    if (job.status !== 'running' || !job.lease_token || !job.lease_until) {
      console.warn('Claimed job violates invariants; ignoring', {
        jobId: job.id,
        status: job.status,
        hasLeaseToken: !!job.lease_token,
        hasLeaseUntil: !!job.lease_until
      });
      return null;
    }

    return {
      id: job.id,
      manuscript_id: job.manuscript_id,
      job_type: job.job_type,
      policy_family: job.policy_family,
      voice_preservation_level: job.voice_preservation_level,
      english_variant: job.english_variant,
      work_type: job.work_type ?? null,
      phase: job.phase,
      status: job.status,
      lease_token: job.lease_token,
      lease_until: job.lease_until,
      attempt_count: job.attempt_count ?? 0,
      max_attempts: job.max_attempts ?? 0,
      next_attempt_at: job.next_attempt_at ?? null
    };
  } catch (err) {
    console.error('Claim exception:', err);
    return null;
  }
}

/**
 * Fallback claim strategy if RPC not available
 * Less efficient but still safe via timestamp ordering
 */
async function fallbackClaim(workerId: string): Promise<ClaimResult | null> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + DEFAULT_LEASE_SECONDS * 1000).toISOString();
  const leaseToken = randomUUID();

  try {
    // Find eligible job
    const { data: jobs, error: selectError } = await supabase
      .from('evaluation_jobs')
      .select('id, status, attempt_count, max_attempts, next_attempt_at')
      .eq('status', 'queued')
      .or(`lease_until.is.null,lease_until.lt.${now}`)
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (selectError) {
      console.error('Fallback select error:', selectError);
      return null;
    }

    if (!jobs || jobs.length === 0) {
      return null; // No jobs available
    }

    const jobId = jobs[0].id;
    if ((jobs[0].attempt_count ?? 0) >= (jobs[0].max_attempts ?? 0)) {
      return null;
    }

    // Attempt to claim
    const { error: updateError } = await supabase
      .from('evaluation_jobs')
      .update({
        status: 'running',
        worker_id: workerId,
        lease_token: leaseToken,
        lease_until: leaseUntil,
        heartbeat_at: now,
        last_heartbeat: now,
        started_at: now,
        updated_at: now,
        next_attempt_at: null,
        attempt_count: (jobs[0].attempt_count ?? 0) + 1
      })
      .eq('id', jobId)
      .eq('status', 'queued')
      .or(`lease_until.is.null,lease_until.lt.${now}`)
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`);

    if (updateError) {
      console.error('Fallback update error:', updateError);
      return null;
    }

    // Fetch full job details
    const { data: jobData, error: fetchError } = await supabase
      .from('evaluation_jobs')
      .select('id, manuscript_id, job_type, policy_family, voice_preservation_level, english_variant, work_type, phase, status, lease_token, lease_until, attempt_count, max_attempts, next_attempt_at')
      .eq('id', jobId)
      .single();

    if (fetchError || !jobData) {
      console.error('Fallback fetch error:', fetchError);
      return null;
    }

    if (jobData.status !== 'running' || !jobData.lease_token || !jobData.lease_until) {
      console.warn('Fallback claim returned invalid job; ignoring', {
        jobId: jobData.id,
        status: jobData.status,
        hasLeaseToken: !!jobData.lease_token,
        hasLeaseUntil: !!jobData.lease_until
      });
      return null;
    }

    return {
      id: jobData.id,
      manuscript_id: jobData.manuscript_id,
      job_type: jobData.job_type,
      policy_family: jobData.policy_family,
      voice_preservation_level: jobData.voice_preservation_level,
      english_variant: jobData.english_variant,
      work_type: jobData.work_type ?? null,
      phase: jobData.phase,
      status: jobData.status,
      lease_token: jobData.lease_token,
      lease_until: jobData.lease_until,
      attempt_count: jobData.attempt_count ?? 0,
      max_attempts: jobData.max_attempts ?? 0,
      next_attempt_at: jobData.next_attempt_at ?? null
    };
  } catch (err) {
    console.error('Fallback exception:', err);
    return null;
  }
}

/**
 * Release job back to queue (on crash/shutdown)
 */
export async function releaseJob(jobId: string): Promise<void> {
    const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  await supabase
    .from('evaluation_jobs')
    .update({
      status: 'queued',
      worker_id: null,
      lease_token: null,
      lease_until: null,
      heartbeat_at: null,
      updated_at: now
    })
    .eq('id', jobId)
    .eq('status', 'running'); // Only release if still running
}

/**
 * Update job heartbeat to maintain lease (legacy - no token verification)
 * @deprecated Use renewLease() for Phase 2D token-verified renewal
 */
export async function updateHeartbeat(jobId: string, workerId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
  const leaseTimeout = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('evaluation_jobs')
    .update({
      lease_until: leaseTimeout,
      heartbeat_at: now,
      last_heartbeat: now,
      updated_at: now
    })
    .eq('id', jobId)
    .eq('worker_id', workerId)
    .eq('status', 'running');

  return !error;
}

/**
 * Renew job lease with token verification (Phase 2D Slice 3)
 * Prevents lease theft by requiring matching lease_token
 */
export async function renewLease(
  jobId: string,
  workerId: string,
  leaseToken: string,
  leaseSeconds: number = DEFAULT_LEASE_SECONDS
): Promise<{ success: boolean; leaseUntil?: Date; heartbeatAt?: Date }> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase.rpc('renew_lease', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lease_token: leaseToken,
    p_now: now,
    p_lease_seconds: leaseSeconds
  });

  if (error || !data || data.length === 0) {
    return { success: false };
  }

  const row = Array.isArray(data) ? data[0] : data;

  // Normalize field names (handles snake_case, camelCase, or any variation)
  const success =
    row?.success === true ||
    row?.SUCCESS === true;

  const leaseUntil =
    row?.lease_until ??
    row?.new_lease_until ??
    row?.leaseUntil ??
    null;

  const heartbeatAt =
    row?.heartbeat_at ??
    row?.new_heartbeat_at ??
    row?.heartbeatAt ??
    null;

  return {
    success,
    leaseUntil: leaseUntil ? new Date(leaseUntil) : undefined,
    heartbeatAt: heartbeatAt ? new Date(heartbeatAt) : undefined
  };
}

/**
 * Mark job complete
 */
export async function completeJob(jobId: string, result: any): Promise<boolean> {
    const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'complete',
      evaluation_result: result,
      updated_at: now,
      lease_token: null,
      lease_until: null,
      heartbeat_at: null
    })
    .eq('id', jobId)
    .eq('status', 'running');

  return !error;
}

/**
 * Mark job failed with error
 */
export async function failJob(jobId: string, error: string): Promise<boolean> {
    const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'failed',
      error: error,
      updated_at: now,
      lease_token: null,
      lease_until: null,
      heartbeat_at: null
    })
    .eq('id', jobId)
    .eq('status', 'running');

  return !updateError;
}

/**
 * Reconcile expired leases (stuck running jobs)
 * Returns number of jobs reclaimed
 */
export async function reconcileExpiredLeases(maxBatch = 50): Promise<number> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'queued',
      worker_id: null,
      lease_token: null,
      lease_until: null,
      heartbeat_at: null,
      updated_at: now
    })
    .eq('status', 'running')
    .lt('lease_until', now)
    .select('id');

  if (error) {
    console.error('Reconcile leases error:', error);
    return 0;
  }

  return data?.length ?? 0;
}
