/**
 * Job Diagnostics & Metrics
 * 
 * Provides observability data for the admin diagnostics dashboard.
 * All queries are read-only and governance-compliant.
 * 
 * @module lib/jobs/diagnostics
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Diagnostic metrics snapshot
 */
export interface DiagnosticsSnapshot {
  /** Jobs grouped by canonical status */
  jobsByStatus: {
    queued: number;
    running: number;
    complete: number;
    failed: number;
  };
  
  /** Failed jobs in the last 24 hours */
  failedJobsLast24h: number;
  
  /** Average processing time in milliseconds (for completed jobs) */
  avgProcessingTimeMs: number | null;
  
  /** Retry success rate (0-100) */
  retrySuccessRate: number | null;
  
  /** Total jobs in system */
  totalJobs: number;
  
  /** Timestamp of snapshot */
  snapshotAt: string;
}

/**
 * Job status breakdown with details
 */
export interface JobStatusDetail {
  status: string;
  count: number;
  oldestJobCreatedAt: string | null;
  newestJobCreatedAt: string | null;
}

/**
 * Phase timing metrics
 */
export interface PhaseTimingMetrics {
  phase: string;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  count: number;
}

/**
 * Get current diagnostics snapshot
 * 
 * @returns Promise<DiagnosticsSnapshot>
 */
export async function getDiagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Jobs by status
  const { data: statusCounts, error: statusError } = await supabase
    .from("evaluation_jobs")
    .select("status");

  if (statusError) {
    console.error("[diagnostics] Error fetching job status counts:", statusError);
    throw statusError;
  }

  const jobsByStatus = {
    queued: 0,
    running: 0,
    complete: 0,
    failed: 0,
  };

  statusCounts?.forEach((job) => {
    const status = job.status as keyof typeof jobsByStatus;
    if (status in jobsByStatus) {
      jobsByStatus[status]++;
    }
  });

  const totalJobs = statusCounts?.length || 0;

  // Failed jobs in last 24h
  const { count: failedCount, error: failedError } = await supabase
    .from("evaluation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("updated_at", twentyFourHoursAgo);

  if (failedError) {
    console.error("[diagnostics] Error fetching failed jobs count:", failedError);
  }

  const failedJobsLast24h = failedCount || 0;

  // Average processing time (completed jobs only)
  const { data: completedJobs, error: completedError } = await supabase
    .from("evaluation_jobs")
    .select("created_at, updated_at")
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(100); // Sample recent completed jobs

  let avgProcessingTimeMs: number | null = null;
  if (!completedError && completedJobs && completedJobs.length > 0) {
    const durations = completedJobs.map((job) => {
      const created = new Date(job.created_at).getTime();
      const updated = new Date(job.updated_at).getTime();
      return updated - created;
    });
    avgProcessingTimeMs = Math.round(
      durations.reduce((sum, d) => sum + d, 0) / durations.length
    );
  }

  // Retry success rate
  const { data: retriedJobs, error: retriedError } = await supabase
    .from("evaluation_jobs")
    .select("status, attempt_count")
    .gt("attempt_count", 1); // Jobs that have been retried

  let retrySuccessRate: number | null = null;
  if (!retriedError && retriedJobs && retriedJobs.length > 0) {
    const successfulRetries = retriedJobs.filter((job) => job.status === "complete").length;
    retrySuccessRate = Math.round((successfulRetries / retriedJobs.length) * 100);
  }

  return {
    jobsByStatus,
    failedJobsLast24h,
    avgProcessingTimeMs,
    retrySuccessRate,
    totalJobs,
    snapshotAt: now,
  };
}

/**
 * Get detailed status breakdown
 * 
 * @returns Promise<JobStatusDetail[]>
 */
export async function getJobStatusDetails(): Promise<JobStatusDetail[]> {
  const supabase = createAdminClient();

  const { data: jobs, error } = await supabase
    .from("evaluation_jobs")
    .select("status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[diagnostics] Error fetching job status details:", error);
    throw error;
  }

  // Group by status
  const statusMap = new Map<string, { count: number; dates: string[] }>();
  
  jobs?.forEach((job) => {
    const status = job.status;
    if (!statusMap.has(status)) {
      statusMap.set(status, { count: 0, dates: [] });
    }
    const entry = statusMap.get(status)!;
    entry.count++;
    entry.dates.push(job.created_at);
  });

  // Convert to array with oldest/newest
  const details: JobStatusDetail[] = [];
  statusMap.forEach((value, status) => {
    const dates = value.dates.sort();
    details.push({
      status,
      count: value.count,
      oldestJobCreatedAt: dates[0] || null,
      newestJobCreatedAt: dates[dates.length - 1] || null,
    });
  });

  return details.sort((a, b) => b.count - a.count);
}

/**
 * Get phase timing metrics
 * 
 * @returns Promise<PhaseTimingMetrics[]>
 */
export async function getPhaseTimingMetrics(): Promise<PhaseTimingMetrics[]> {
  const supabase = createAdminClient();

  // This is a simplified version - in production you'd want to track
  // phase start/end times more explicitly in the database
  const { data: jobs, error } = await supabase
    .from("evaluation_jobs")
    .select("progress, created_at, updated_at")
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[diagnostics] Error fetching phase timing:", error);
    throw error;
  }

  // Group by phase and calculate durations
  const phaseMetrics = new Map<string, number[]>();

  jobs?.forEach((job) => {
    const progress = job.progress as { phase?: string } | null;
    const phase = progress?.phase || "unknown";
    const duration = new Date(job.updated_at).getTime() - new Date(job.created_at).getTime();
    
    if (!phaseMetrics.has(phase)) {
      phaseMetrics.set(phase, []);
    }
    phaseMetrics.get(phase)!.push(duration);
  });

  // Calculate stats for each phase
  const metrics: PhaseTimingMetrics[] = [];
  phaseMetrics.forEach((durations, phase) => {
    durations.sort((a, b) => a - b);
    const count = durations.length;
    const avgDurationMs = Math.round(durations.reduce((sum, d) => sum + d, 0) / count);
    const p50DurationMs = durations[Math.floor(count * 0.5)];
    const p95DurationMs = durations[Math.floor(count * 0.95)];

    metrics.push({
      phase,
      avgDurationMs,
      p50DurationMs,
      p95DurationMs,
      count,
    });
  });

  return metrics.sort((a, b) => b.count - a.count);
}

/**
 * Get recent failed jobs with error details
 * 
 * @param limit Maximum number of jobs to return
 * @returns Promise<Array<{ id: string; manuscript_id: string; phase: string; last_error: unknown; failed_at: string }>>
 */
export async function getRecentFailedJobs(limit = 20) {
  const supabase = createAdminClient();

  const { data: jobs, error } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, progress, last_error, updated_at")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[diagnostics] Error fetching recent failed jobs:", error);
    throw error;
  }

  return jobs?.map((job) => {
    const progress = job.progress as { phase?: string } | null;
    return {
      id: job.id,
      manuscript_id: job.manuscript_id,
      phase: progress?.phase || "unknown",
      last_error: job.last_error,
      failed_at: job.updated_at,
    };
  }) || [];
}
