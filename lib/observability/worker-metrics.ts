/**
 * A4.1 — Worker-Emitted Metrics for Claim, Retry, and Lease Paths
 *
 * Instruments the worker so claim, retry, and lease behavior is observable
 * via metrics instead of inferred from database inspection.
 *
 * Metrics emitted:
 *   job_claim_attempt_total   - Worker attempted to claim a job
 *   job_claim_success_total   - Claim succeeded (job acquired)
 *   job_claim_empty_total     - Claim returned empty (contention or no eligible jobs)
 *   job_retry_attempt_total   - Retry was attempted
 *   job_retry_changed_total   - Retry resulted in state change
 *   job_lease_expired_total   - Lease expiration detected
 *
 * Labels: work_type, phase, job_type (low-cardinality only)
 * Avoid: job_id, manuscript_id, user_id (high-cardinality)
 *
 * Closes #5
 */

import { logger } from "./logger";

type MetricTags = Record<string, string>;

interface MetricEvent {
  event: "metric";
  metric: string;
  value: number;
  tags: MetricTags;
  timestamp: string;
}

/**
 * Emit a structured metric event to logs.
 * In production these appear in Vercel logs and can be scraped or searched.
 */
function emitMetric(metric: string, value: number = 1, tags: MetricTags = {}): void {
  const entry: MetricEvent = {
    event: "metric",
    metric,
    value,
    tags,
    timestamp: new Date().toISOString(),
  };
  logger.info(`Metric: ${metric}`, entry as unknown as Record<string, unknown>);
}

// ── Claim Metrics ──────────────────────────────────────────────

export function onClaimAttempt(tags: MetricTags = {}): void {
  emitMetric("job_claim_attempt_total", 1, tags);
}

export function onClaimSuccess(tags: MetricTags = {}): void {
  emitMetric("job_claim_success_total", 1, tags);
}

export function onClaimEmpty(tags: MetricTags = {}): void {
  emitMetric("job_claim_empty_total", 1, tags);
}

// ── Retry Metrics ──────────────────────────────────────────────

export function onRetryAttempt(tags: MetricTags = {}): void {
  emitMetric("job_retry_attempt_total", 1, tags);
}

export function onRetryChanged(tags: MetricTags = {}): void {
  emitMetric("job_retry_changed_total", 1, tags);
}

// ── Lease Metrics ──────────────────────────────────────────────

export function onLeaseExpired(tags: MetricTags = {}): void {
  emitMetric("job_lease_expired_total", 1, tags);
}

// ── Convenience: Claim lifecycle wrapper ───────────────────────

export async function instrumentClaim<T>(
  claimFn: () => Promise<T | null>,
  tags: MetricTags = {},
): Promise<T | null> {
  onClaimAttempt(tags);
  const result = await claimFn();
  if (result) {
    onClaimSuccess(tags);
  } else {
    onClaimEmpty(tags);
  }
  return result;
}

// ── Summary helper for dashboards ─────────────────────────────

export const WORKER_METRIC_NAMES = [
  "job_claim_attempt_total",
  "job_claim_success_total",
  "job_claim_empty_total",
  "job_retry_attempt_total",
  "job_retry_changed_total",
  "job_lease_expired_total",
] as const;

export type WorkerMetricName = (typeof WORKER_METRIC_NAMES)[number];
