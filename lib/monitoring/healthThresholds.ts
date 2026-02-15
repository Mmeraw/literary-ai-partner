/**
 * Health Classification Thresholds
 *
 * Deterministic rules for queue health classification.
 * All thresholds are constants (not derived from db or dynamic sources).
 * This ensures consistent SLO evaluation across deployments.
 */

/**
 * Queue health levels
 */
export type QueueHealthLevel = 'healthy' | 'degraded' | 'critical';

/**
 * Threshold configuration for each health level
 */
export const HEALTH_THRESHOLDS = {
  /**
   * Healthy: queue is operating normally
   * - Old jobs start to backlog after 10 minutes
   * - <5% failure rate over last hour
   * - No jobs stuck running >15 minutes
   */
  healthy: {
    oldestQueuedSeconds: 600, // 10 minutes
    failureRateLastHour: 0.05,
    stuckRunningSeconds: 900, // 15 minutes
  },

  /**
   * Degraded: performance is slowing, investigate soon
   * - Old jobs start to alarm after 30 minutes
   * - <10% failure rate
   * - Jobs stuck >30 minutes
   */
  degraded: {
    oldestQueuedSeconds: 1800, // 30 minutes
    failureRateLastHour: 0.10,
    stuckRunningSeconds: 1800, // 30 minutes
  },

  /**
   * Critical: immediate action required
   * - Queue age >1 hour OR
   * - Failure rate >25% OR
   * - Jobs stuck >1 hour
   */
  critical: {
    oldestQueuedSeconds: 3600, // 1 hour
    failureRateLastHour: 0.25,
    stuckRunningSeconds: 3600, // 1 hour
  },
} as const;

/**
 * Queue health metrics (from database)
 */
export interface QueueHealthMetrics {
  queued_count: number;
  running_count: number;
  failed_last_hour: number;
  oldest_queued_seconds: number | null;
  failure_rate_last_hour: number;
  stuck_running_count: number;
  stuck_running_oldest_seconds: number | null;
}

/**
 * Health classification result
 */
export interface HealthClassification {
  health: QueueHealthLevel;
  reasons: string[];
}

/**
 * Classify queue health based on metrics and thresholds
 *
 * @param metrics - Queue health metrics from database
 * @returns Classification with health level and human-readable reasons
 */
export function classifyHealth(metrics: QueueHealthMetrics): HealthClassification {
  const reasons: string[] = [];

  // Rule 1: Check for stuck running jobs (highest priority)
  if (
    metrics.stuck_running_count > 0 &&
    metrics.stuck_running_oldest_seconds !== null &&
    metrics.stuck_running_oldest_seconds >= HEALTH_THRESHOLDS.critical.stuckRunningSeconds
  ) {
    reasons.push(
      `${metrics.stuck_running_count} job(s) stuck running for ${Math.round(
        metrics.stuck_running_oldest_seconds / 60
      )} minutes`
    );
    return { health: 'critical', reasons };
  }

  // Rule 2: Check failure rate
  if (metrics.failure_rate_last_hour >= HEALTH_THRESHOLDS.critical.failureRateLastHour) {
    reasons.push(
      `Failure rate ${(metrics.failure_rate_last_hour * 100).toFixed(1)}% exceeds critical threshold (25%)`
    );
    return { health: 'critical', reasons };
  }

  // Rule 3: Check oldest queued age
  if (
    metrics.oldest_queued_seconds !== null &&
    metrics.oldest_queued_seconds >= HEALTH_THRESHOLDS.critical.oldestQueuedSeconds
  ) {
    reasons.push(
      `Oldest queued job: ${Math.round(metrics.oldest_queued_seconds / 60)} minutes (critical: >60 min)`
    );
    return { health: 'critical', reasons };
  }

  // --- DEGRADED CHECKS ---

  // Rule 4: Stuck running at degraded threshold
  if (
    metrics.stuck_running_count > 0 &&
    metrics.stuck_running_oldest_seconds !== null &&
    metrics.stuck_running_oldest_seconds >= HEALTH_THRESHOLDS.degraded.stuckRunningSeconds
  ) {
    reasons.push(
      `${metrics.stuck_running_count} job(s) stuck running for ${Math.round(
        metrics.stuck_running_oldest_seconds / 60
      )} minutes`
    );
    return { health: 'degraded', reasons };
  }

  // Rule 5: Degraded failure rate
  if (metrics.failure_rate_last_hour >= HEALTH_THRESHOLDS.degraded.failureRateLastHour) {
    reasons.push(
      `Failure rate ${(metrics.failure_rate_last_hour * 100).toFixed(1)}% elevated (degraded threshold: 10%)`
    );
    return { health: 'degraded', reasons };
  }

  // Rule 6: Degraded queue age
  if (
    metrics.oldest_queued_seconds !== null &&
    metrics.oldest_queued_seconds >= HEALTH_THRESHOLDS.degraded.oldestQueuedSeconds
  ) {
    reasons.push(
      `Oldest queued job: ${Math.round(metrics.oldest_queued_seconds / 60)} minutes (degraded: >30 min)`
    );
    return { health: 'degraded', reasons };
  }

  // --- HEALTHY ---

  // Rule 7: Check if approaching healthy thresholds (informational)
  if (metrics.oldest_queued_seconds !== null) {
    if (metrics.oldest_queued_seconds >= HEALTH_THRESHOLDS.healthy.oldestQueuedSeconds * 0.8) {
      reasons.push(
        `Oldest queued job: ${Math.round(
          metrics.oldest_queued_seconds / 60
        )} minutes (note: approaching healthy threshold)`
      );
    } else if (metrics.oldest_queued_seconds > 0) {
      reasons.push(`Oldest queued job: ${Math.round(metrics.oldest_queued_seconds / 60)} minutes`);
    }
  }

  // If we have queued jobs but no old ones, still note it
  if (metrics.oldest_queued_seconds === null && metrics.queued_count > 0) {
    reasons.push(`${metrics.queued_count} job(s) queued, processing normally`);
  }

  // If queue is empty
  if (
    metrics.queued_count === 0 &&
    metrics.running_count === 0 &&
    metrics.failed_last_hour === 0 &&
    metrics.stuck_running_count === 0
  ) {
    reasons.push('Queue is idle');
  }

  return { health: 'healthy', reasons };
}
