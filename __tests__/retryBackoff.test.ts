/**
 * Phase A.2: Retry Backoff Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateNextAttemptAt,
  getBackoffDelay,
  hasExhaustedRetries,
} from '../lib/jobs/retryBackoff';

describe('Retry Backoff (Phase A.2)', () => {
  describe('calculateNextAttemptAt', () => {
    it('returns ISO 8601 timestamp', () => {
      const result = calculateNextAttemptAt(1);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('calculates 30s delay for attempt 1', () => {
      const before = Date.now();
      const result = calculateNextAttemptAt(1);
      const after = Date.now();
      const nextAttempt = new Date(result).getTime();
      
      // Should be ~30s from now (allow 1s margin for test execution)
      expect(nextAttempt).toBeGreaterThanOrEqual(before + 29000);
      expect(nextAttempt).toBeLessThanOrEqual(after + 31000);
    });

    it('calculates 90s delay for attempt 2', () => {
      const before = Date.now();
      const result = calculateNextAttemptAt(2);
      const nextAttempt = new Date(result).getTime();
      
      // Should be ~90s from now (30 * 3^1)
      expect(nextAttempt).toBeGreaterThanOrEqual(before + 89000);
      expect(nextAttempt).toBeLessThanOrEqual(before + 91000);
    });

    it('calculates 270s delay for attempt 3', () => {
      const before = Date.now();
      const result = calculateNextAttemptAt(3);
      const nextAttempt = new Date(result).getTime();
      
      // Should be ~270s from now (30 * 3^2)
      expect(nextAttempt).toBeGreaterThanOrEqual(before + 269000);
      expect(nextAttempt).toBeLessThanOrEqual(before + 271000);
    });

    it('caps delay at maxDelaySeconds', () => {
      const maxDelay = 60; // 60 seconds cap
      const result = calculateNextAttemptAt(10, 30, maxDelay);
      const nextAttempt = new Date(result).getTime();
      const now = Date.now();
      
      // Should be capped at 60s, not 30 * 3^9 = 590490s
      expect(nextAttempt).toBeLessThanOrEqual(now + maxDelay * 1000 + 1000);
    });

    it('uses custom base delay', () => {
      const baseDelay = 60; // 1 minute
      const before = Date.now();
      const result = calculateNextAttemptAt(1, baseDelay);
      const nextAttempt = new Date(result).getTime();
      
      // Should be ~60s from now
      expect(nextAttempt).toBeGreaterThanOrEqual(before + 59000);
      expect(nextAttempt).toBeLessThanOrEqual(before + 61000);
    });
  });

  describe('getBackoffDelay', () => {
    it('returns 30s for attempt 1', () => {
      expect(getBackoffDelay(1)).toBe(30);
    });

    it('returns 90s for attempt 2', () => {
      expect(getBackoffDelay(2)).toBe(90);
    });

    it('returns 270s for attempt 3', () => {
      expect(getBackoffDelay(3)).toBe(270);
    });

    it('returns 810s for attempt 4', () => {
      expect(getBackoffDelay(4)).toBe(810); // 30 * 3^3
    });

    it('uses custom base delay', () => {
      expect(getBackoffDelay(1, 60)).toBe(60);
      expect(getBackoffDelay(2, 60)).toBe(180); // 60 * 3^1
    });

    it('handles attempt 0 gracefully', () => {
      // Attempt 0 should use exponent 0 → baseDelay * 3^0 = baseDelay
      expect(getBackoffDelay(0)).toBe(30);
    });
  });

  describe('hasExhaustedRetries', () => {
    it('returns false when attempts < max', () => {
      expect(hasExhaustedRetries(0, 3)).toBe(false);
      expect(hasExhaustedRetries(1, 3)).toBe(false);
      expect(hasExhaustedRetries(2, 3)).toBe(false);
    });

    it('returns true when attempts = max', () => {
      expect(hasExhaustedRetries(3, 3)).toBe(true);
    });

    it('returns true when attempts > max', () => {
      expect(hasExhaustedRetries(4, 3)).toBe(true);
      expect(hasExhaustedRetries(10, 3)).toBe(true);
    });

    it('handles edge case of max=0', () => {
      expect(hasExhaustedRetries(0, 0)).toBe(true);
      expect(hasExhaustedRetries(1, 0)).toBe(true);
    });
  });

  describe('exponential backoff schedule', () => {
    it('follows correct exponential progression', () => {
      const delays = [1, 2, 3, 4, 5].map(attempt => getBackoffDelay(attempt));
      
      expect(delays).toEqual([
        30,    // 30 * 3^0
        90,    // 30 * 3^1
        270,   // 30 * 3^2
        810,   // 30 * 3^3
        2430,  // 30 * 3^4
      ]);
    });

    it('demonstrates capping behavior', () => {
      const attempts = [1, 2, 3, 4, 5, 10];
      const maxDelay = 300; // 5 minutes cap
      
      const delaysWithCap = attempts.map(attempt => {
        const delay = getBackoffDelay(attempt);
        return Math.min(delay, maxDelay);
      });
      
      // Attempts 3+ should all be capped at 300
      expect(delaysWithCap).toEqual([30, 90, 270, 300, 300, 300]);
    });
  });
});
