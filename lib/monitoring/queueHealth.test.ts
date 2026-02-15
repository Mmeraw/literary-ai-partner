/**
 * Queue Health Classification Tests
 *
 * Lock down the SLO thresholds with deterministic unit tests.
 * Tests cover boundary conditions and ensure reasons are human-readable.
 */

import { classifyHealth, HEALTH_THRESHOLDS } from './healthThresholds';
import type { QueueHealthMetrics } from './healthThresholds';

describe('classifyHealth', () => {
  // ============================================================================
  // CRITICAL: Stuck Running
  // ============================================================================

  it('should classify CRITICAL when stuck running exceeds critical threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 1,
      failed_last_hour: 0,
      oldest_queued_seconds: 300,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 1,
      stuck_running_oldest_seconds: HEALTH_THRESHOLDS.critical.stuckRunningSeconds + 1,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('critical');
    expect(result.reasons[0]).toContain('stuck running');
    expect(result.reasons[0]).toContain('minutes');
  });

  it('should not classify CRITICAL for stuck running at degraded threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 1,
      failed_last_hour: 0,
      oldest_queued_seconds: 300,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 1,
      stuck_running_oldest_seconds: HEALTH_THRESHOLDS.degraded.stuckRunningSeconds,
    };

    const result = classifyHealth(metrics);
    expect(result.health).not.toBe('critical');
  });

  // ============================================================================
  // CRITICAL: Failure Rate
  // ============================================================================

  it('should classify CRITICAL when failure rate exceeds critical threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 100,
      running_count: 0,
      failed_last_hour: 26, // 26% failure rate
      oldest_queued_seconds: 300,
      failure_rate_last_hour: HEALTH_THRESHOLDS.critical.failureRateLastHour + 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('critical');
    expect(result.reasons[0]).toContain('Failure rate');
    expect(result.reasons[0]).toContain('%');
  });

  it('should not classify CRITICAL at degraded failure rate threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 100,
      running_count: 0,
      failed_last_hour: 10,
      oldest_queued_seconds: 300,
      failure_rate_last_hour: HEALTH_THRESHOLDS.degraded.failureRateLastHour,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).not.toBe('critical');
  });

  // ============================================================================
  // CRITICAL: Queue Age
  // ============================================================================

  it('should classify CRITICAL when oldest queued exceeds critical threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: HEALTH_THRESHOLDS.critical.oldestQueuedSeconds + 1,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('critical');
    expect(result.reasons[0]).toContain('Oldest queued');
    expect(result.reasons[0]).toContain('minutes');
  });

  it('should not classify CRITICAL at degraded queue age threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: HEALTH_THRESHOLDS.degraded.oldestQueuedSeconds,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).not.toBe('critical');
  });

  // ============================================================================
  // DEGRADED: Stuck Running
  // ============================================================================

  it('should classify DEGRADED when stuck running exceeds degraded threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 0,
      running_count: 1,
      failed_last_hour: 0,
      oldest_queued_seconds: null,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 1,
      stuck_running_oldest_seconds: HEALTH_THRESHOLDS.degraded.stuckRunningSeconds + 1,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('degraded');
    expect(result.reasons[0]).toContain('stuck running');
  });

  // ============================================================================
  // DEGRADED: Failure Rate
  // ============================================================================

  it('should classify DEGRADED when failure rate is elevated', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 100,
      running_count: 0,
      failed_last_hour: 12, // 12% failure rate (exceeds degraded threshold of 10%)
      oldest_queued_seconds: 300,
      failure_rate_last_hour: HEALTH_THRESHOLDS.degraded.failureRateLastHour + 0.02, // 0.12 = 12%
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('degraded');
    expect(result.reasons[0]).toContain('Failure rate');
  });

  // ============================================================================
  // DEGRADED: Queue Age
  // ============================================================================

  it('should classify DEGRADED when oldest queued exceeds degraded threshold', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: HEALTH_THRESHOLDS.degraded.oldestQueuedSeconds + 1,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('degraded');
    expect(result.reasons[0]).toContain('Oldest queued');
  });

  // ============================================================================
  // HEALTHY: Normal Operation
  // ============================================================================

  it('should classify HEALTHY with normal queue metrics', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 5,
      running_count: 2,
      failed_last_hour: 0,
      oldest_queued_seconds: 300,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('healthy');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should classify HEALTHY with empty queue', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 0,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: null,
      failure_rate_last_hour: 0,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('healthy');
    expect(result.reasons[0]).toContain('idle');
  });

  it('should classify HEALTHY with zero failure rate', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 10,
      running_count: 5,
      failed_last_hour: 0,
      oldest_queued_seconds: 200,
      failure_rate_last_hour: 0,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('healthy');
  });

  // ============================================================================
  // BOUNDARY CONDITIONS
  // ============================================================================

  it('should classify correctly just below healthy threshold for queue age', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: HEALTH_THRESHOLDS.healthy.oldestQueuedSeconds - 10,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('healthy');
  });

  it('should classify correctly at degraded boundary for queue age', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: HEALTH_THRESHOLDS.degraded.oldestQueuedSeconds,
      failure_rate_last_hour: 0.01,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('degraded');
  });

  // ============================================================================
  // REASON MESSAGES
  // ============================================================================

  it('should provide human-readable reason messages', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 1,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: 1200, // 20 minutes
      failure_rate_last_hour: 0.02,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.reasons.length).toBeGreaterThan(0);
    result.reasons.forEach((reason) => {
      expect(reason).toBeTruthy();
      expect(reason.length).toBeGreaterThan(0);
    });
  });

  it('should not return empty reasons for healthy state', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 0,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: null,
      failure_rate_last_hour: 0,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  it('should handle null oldest_queued_seconds', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 0,
      running_count: 0,
      failed_last_hour: 0,
      oldest_queued_seconds: null,
      failure_rate_last_hour: 0,
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    expect(() => classifyHealth(metrics)).not.toThrow();
    const result = classifyHealth(metrics);
    expect(result.health).toBe('healthy');
  });

  it('should handle high failure rates (>100% capped)', () => {
    const metrics: QueueHealthMetrics = {
      queued_count: 10,
      running_count: 0,
      failed_last_hour: 20,
      oldest_queued_seconds: 300,
      failure_rate_last_hour: 1.0, // capped at 100%
      stuck_running_count: 0,
      stuck_running_oldest_seconds: null,
    };

    const result = classifyHealth(metrics);
    expect(result.health).toBe('critical');
    expect(result.reasons[0]).toContain('100');
  });
});
