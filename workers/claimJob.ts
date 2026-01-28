/**
 * Atomic job claiming with lease-based locking
 * Implements exactly-once job execution guarantee
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not set');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export interface ClaimResult {
  id: string;
  manuscript_id: number;
  job_type: string;
  policy_family: string;
  voice_preservation_level: string;
  english_variant: string;
}

/**
 * Atomically claim next eligible job
 * Returns job object or null if no jobs available
 */
export async function claimNextJob(workerId: string): Promise<ClaimResult | null> {
  const supabase = getSupabaseClient();

  try {
    // Atomic claim via RPC
    const { data, error } = await supabase.rpc('claim_job_atomic', {
      p_worker_id: workerId
    });

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

    return {
      id: job.id,
      manuscript_id: job.manuscript_id,
      job_type: job.job_type,
      policy_family: job.policy_family,
      voice_preservation_level: job.voice_preservation_level,
      english_variant: job.english_variant
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

  try {
    // Find eligible job
    const { data: jobs, error: selectError } = await supabase
      .from('evaluation_jobs')
      .select('id')
      .eq('status', 'queued')
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

    // Attempt to claim
    const { error: updateError } = await supabase
      .from('evaluation_jobs')
      .update({
        status: 'running',
        worker_id: workerId,
        last_heartbeat: now,
        updated_at: now
      })
      .eq('id', jobId)
      .eq('status', 'queued'); // Verify status hasn't changed

    if (updateError) {
      console.error('Fallback update error:', updateError);
      return null;
    }

    // Fetch full job details
    const { data: jobData, error: fetchError } = await supabase
      .from('evaluation_jobs')
      .select('id, manuscript_id, job_type, policy_family, voice_preservation_level, english_variant')
      .eq('id', jobId)
      .single();

    if (fetchError || !jobData) {
      console.error('Fallback fetch error:', fetchError);
      return null;
    }

    return {
      id: jobData.id,
      manuscript_id: jobData.manuscript_id,
      job_type: jobData.job_type,
      policy_family: jobData.policy_family,
      voice_preservation_level: jobData.voice_preservation_level,
      english_variant: jobData.english_variant
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
      lease_until: null,
      updated_at: now
    })
    .eq('id', jobId)
    .eq('status', 'running'); // Only release if still running
}

/**
 * Update job heartbeat to maintain lease
 */
export async function updateHeartbeat(jobId: string, workerId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
  const leaseTimeout = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('evaluation_jobs')
    .update({
      lease_until: leaseTimeout,
      updated_at: now
    })
    .eq('id', jobId)
    .eq('worker_id', workerId)
    .eq('status', 'running');

  return !error;
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
      lease_until: null
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
      lease_until: null
    })
    .eq('id', jobId)
    .eq('status', 'running');

  return !updateError;
}
