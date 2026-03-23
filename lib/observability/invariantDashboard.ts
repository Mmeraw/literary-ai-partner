import { createAdminClient } from "@/lib/supabase/admin";

export type ClaimMetrics = {
  windowStart: string;
  windowEnd: string;
  claimAttempts: number;
  claimSuccesses: number;
  emptyClaims: number;
  sampledJobs: number;
};

export type RetryMetrics = {
  windowStart: string;
  windowEnd: string;
  retryAttempts: number;
  retryChanged: number;
  retryNoStateChange: number;
  sampledJobs: number;
};

export type LeaseExpiredPoint = {
  bucketDate: string;
  count: number;
};

export type LeaseExpiredMetrics = {
  windowStart: string;
  windowEnd: string;
  totalExpired: number;
  points: LeaseExpiredPoint[];
};

export type JobStatusMetrics = {
  queued: number;
  running: number;
  complete: number;
  failed: number;
};

export type InvariantDashboardMetrics = {
  claims: ClaimMetrics;
  retries: RetryMetrics;
  leaseExpired: LeaseExpiredMetrics;
  jobs: JobStatusMetrics;
};

type EvaluationJobRow = {
  id: string;
  status: string;
  attempt_count: number | null;
  lease_until: string | null;
  updated_at: string;
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function toDateBucket(isoTimestamp: string): string {
  return new Date(isoTimestamp).toISOString().slice(0, 10);
}

export async function getClaimMetrics(windowDays = 7): Promise<ClaimMetrics> {
  const supabase = createAdminClient();
  const windowStart = isoDaysAgo(windowDays);
  const windowEnd = new Date().toISOString();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, attempt_count, updated_at")
    .gte("updated_at", windowStart);

  if (error) {
    throw new Error(`getClaimMetrics failed: ${error.message}`);
  }

  const rows = (data as Array<Pick<EvaluationJobRow, "id" | "attempt_count">>) ?? [];

  const claimAttempts = rows.reduce((sum, row) => sum + Math.max(row.attempt_count ?? 0, 0), 0);
  const claimSuccesses = rows.filter((row) => (row.attempt_count ?? 0) > 0).length;

  // Derived proxy: attempts beyond first successful claim per job.
  // Represents contention/reclaim pressure when no explicit worker metric row exists.
  const emptyClaims = Math.max(claimAttempts - claimSuccesses, 0);

  return {
    windowStart,
    windowEnd,
    claimAttempts,
    claimSuccesses,
    emptyClaims,
    sampledJobs: rows.length,
  };
}

export async function getRetryMetrics(windowDays = 7): Promise<RetryMetrics> {
  const supabase = createAdminClient();
  const windowStart = isoDaysAgo(windowDays);
  const windowEnd = new Date().toISOString();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, status, attempt_count, updated_at")
    .gte("updated_at", windowStart)
    .gt("attempt_count", 1);

  if (error) {
    throw new Error(`getRetryMetrics failed: ${error.message}`);
  }

  const rows = (data as EvaluationJobRow[]) ?? [];

  const retryAttempts = rows.reduce((sum, row) => sum + Math.max((row.attempt_count ?? 1) - 1, 0), 0);
  const retryChanged = rows.filter((row) => row.status === "complete" || row.status === "failed").length;
  const retryNoStateChange = Math.max(retryAttempts - retryChanged, 0);

  return {
    windowStart,
    windowEnd,
    retryAttempts,
    retryChanged,
    retryNoStateChange,
    sampledJobs: rows.length,
  };
}

export async function getLeaseExpiredMetrics(windowDays = 7): Promise<LeaseExpiredMetrics> {
  const supabase = createAdminClient();
  const windowStart = isoDaysAgo(windowDays);
  const windowEnd = new Date().toISOString();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, status, lease_until, updated_at")
    .eq("status", "running")
    .lt("lease_until", windowEnd)
    .gte("updated_at", windowStart)
    .order("updated_at", { ascending: true });

  if (error) {
    throw new Error(`getLeaseExpiredMetrics failed: ${error.message}`);
  }

  const rows =
    ((data as Array<Pick<EvaluationJobRow, "id" | "lease_until" | "updated_at">>) ?? []).filter(
      (row) => row.lease_until !== null,
    );

  const bucketCounts = new Map<string, number>();
  for (const row of rows) {
    const bucket = toDateBucket(row.updated_at);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }

  const points = Array.from(bucketCounts.entries())
    .map(([bucketDate, count]) => ({ bucketDate, count }))
    .sort((a, b) => a.bucketDate.localeCompare(b.bucketDate));

  return {
    windowStart,
    windowEnd,
    totalExpired: rows.length,
    points,
  };
}

export async function getJobStatusMetrics(): Promise<JobStatusMetrics> {
  const supabase = createAdminClient();

  const [queuedRes, runningRes, completeRes, failedRes] = await Promise.all([
    supabase.from("evaluation_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("evaluation_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
    supabase.from("evaluation_jobs").select("id", { count: "exact", head: true }).eq("status", "complete"),
    supabase.from("evaluation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const errors = [queuedRes.error, runningRes.error, completeRes.error, failedRes.error].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(`getJobStatusMetrics failed: ${errors[0]?.message}`);
  }

  return {
    queued: queuedRes.count ?? 0,
    running: runningRes.count ?? 0,
    complete: completeRes.count ?? 0,
    failed: failedRes.count ?? 0,
  };
}

export async function getInvariantDashboardMetrics(windowDays = 7): Promise<InvariantDashboardMetrics> {
  const [claims, retries, leaseExpired, jobs] = await Promise.all([
    getClaimMetrics(windowDays),
    getRetryMetrics(windowDays),
    getLeaseExpiredMetrics(windowDays),
    getJobStatusMetrics(),
  ]);

  return {
    claims,
    retries,
    leaseExpired,
    jobs,
  };
}
