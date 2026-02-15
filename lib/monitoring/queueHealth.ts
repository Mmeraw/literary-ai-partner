/**
 * Queue Health Helper
 *
 * Fetches real-time queue metrics from evaluation_jobs table.
 * Used by /api/health endpoint (authenticated only).
 *
 * Query strategy:
 * - Uses service_role client to bypass RLS (safe for internal endpoint)
 * - Single aggregation query grouped by status
 * - Computes max age for oldest jobs
 * - Identifies stuck running jobs (running > 15 minutes typically)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { QueueHealthMetrics, HealthClassification } from './healthThresholds';
import { classifyHealth, HEALTH_THRESHOLDS } from './healthThresholds';

/**
 * Get a service-role Supabase client
 * (Used to bypass RLS for internal observability)
 */
function getServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Fetch queue health metrics from evaluation_jobs table
 *
 * @returns metrics: raw database counts and ages
 */
async function fetchQueueMetrics(): Promise<QueueHealthMetrics> {
  const supabase = getServiceRoleClient();

  // Get current timestamp for age calculations
  const now = new Date();

  // Query 1: Count jobs by status and get oldest queued
  const { data: statusData, error: statusError } = await supabase
    .from('evaluation_jobs')
    .select('status, created_at, updated_at', { count: 'exact', head: false })
    .order('created_at', { ascending: true });

  if (statusError) {
    throw new Error(`Failed to fetch queue status: ${statusError.message}`);
  }

  if (!statusData || statusData.length === 0) {
    // Empty queue
    return {
      queued_count: 0,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: null,
      failure_rate_last_hour: 0,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };
  }

  // Aggregate counts by status
  let queued_count = 0;
  let running_count = 0;
  let failed_last_hour = 0;
  let oldest_queued_seconds: number | null = null;
  let stuck_running_count = 0;
  let stuck_running_oldest_seconds: number | null = null;

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  for (const job of statusData) {
    if (job.status === 'queued') {
      queued_count++;
      if (!oldest_queued_seconds) {
        const created = new Date(job.created_at);
        oldest_queued_seconds = Math.round((now.getTime() - created.getTime()) / 1000);
      }
    } else if (job.status === 'running') {
      running_count++;

      // Check if stuck (older than threshold)
      const updated = new Date(job.updated_at);
      const stuckSeconds = Math.round((now.getTime() - updated.getTime()) / 1000);
      if (stuckSeconds >= HEALTH_THRESHOLDS.healthy.stuckRunningSeconds) {
        stuck_running_count++;
        if (!stuck_running_oldest_seconds || stuckSeconds > stuck_running_oldest_seconds) {
          stuck_running_oldest_seconds = stuckSeconds;
        }
      }
    } else if (job.status === 'failed') {
      const updated = new Date(job.updated_at);
      if (updated >= oneHourAgo) {
        failed_last_hour++;
      }
    }
  }

  // Calculate failure rate (failed per total in queue, capped at 1.0)
  const totalJobs = statusData.length;
  const failure_rate_last_hour = totalJobs > 0 ? Math.min(failed_last_hour / totalJobs, 1.0) : 0;

  return {
    queued_count,
    running_count,
    failed_last_hour,
    oldest_queued_seconds,
    failure_rate_last_hour,
    stuck_running_count,
    stuck_running_oldest_seconds,
  };
}

/**
 * Get full queue health report (metrics + classification)
 *
 * @returns { metrics, classification }
 */
export async function getQueueHealth(): Promise<{
  metrics: QueueHealthMetrics;
  classification: HealthClassification;
}> {
  const metrics = await fetchQueueMetrics();
  const classification = classifyHealth(metrics);

  return {
    metrics,
    classification,
  };
}

/**
 * Export for testing purposes
 */
export { fetchQueueMetrics };
