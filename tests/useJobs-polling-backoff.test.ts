import type { EvaluationJobRow } from "../lib/db/schema";
import {
  getPollingInterval,
  POLLING_INTERVALS,
  POLLING_THRESHOLDS,
} from "../lib/jobs/polling";
import {
  makeJobRow,
  makeJobRowWithAge,
} from "./test-helpers/job-factory";

/**
 * Unit tests for polling backoff strategy in lib/jobs/polling.ts
 * Ensures adaptive backoff reduces server load without regressing UX
 *
 * Tests the real polling logic (not a duplicate implementation)
 * using centralized intervals and thresholds as single source of truth
 */

describe("Polling Backoff Strategy", () => {
  describe("getPollingInterval (real implementation)", () => {
    it("should use FAST interval for jobs < 30s old", () => {
      const jobs = [
        makeJobRowWithAge(0), // brand new
        makeJobRowWithAge(5000), // 5s old
        makeJobRowWithAge(29000), // 29s old
      ];

      expect(getPollingInterval(jobs)).toBe(POLLING_INTERVALS.FAST);
    });

    it("should use MEDIUM interval for jobs 30s–2min old", () => {
      const jobs = [
        makeJobRowWithAge(30000), // 30s old (at boundary)
        makeJobRowWithAge(60000), // 1min old
        makeJobRowWithAge(119000), // 119s old (just under 2min)
      ];

      expect(getPollingInterval([jobs[0]])).toBe(POLLING_INTERVALS.MEDIUM);
      expect(getPollingInterval([jobs[1]])).toBe(POLLING_INTERVALS.MEDIUM);
      expect(getPollingInterval([jobs[2]])).toBe(POLLING_INTERVALS.MEDIUM);
    });

    it("should use SLOW interval for jobs 2min–10min old", () => {
      const jobs = [
        makeJobRowWithAge(120000), // 2min old (at boundary)
        makeJobRowWithAge(300000), // 5min old
        makeJobRowWithAge(599000), // 599s old (just under 10min)
      ];

      expect(getPollingInterval([jobs[0]])).toBe(POLLING_INTERVALS.SLOW);
      expect(getPollingInterval([jobs[1]])).toBe(POLLING_INTERVALS.SLOW);
      expect(getPollingInterval([jobs[2]])).toBe(POLLING_INTERVALS.SLOW);
    });

    it("should use SLOWEST interval for jobs 10min+ old", () => {
      const jobs = [
        makeJobRowWithAge(600000), // 10min old (at boundary)
        makeJobRowWithAge(900000), // 15min old
        makeJobRowWithAge(1800000), // 30min old
      ];

      expect(getPollingInterval([jobs[0]])).toBe(POLLING_INTERVALS.SLOWEST);
      expect(getPollingInterval([jobs[1]])).toBe(POLLING_INTERVALS.SLOWEST);
      expect(getPollingInterval([jobs[2]])).toBe(POLLING_INTERVALS.SLOWEST);
    });

    it("should return FAST interval when no jobs present", () => {
      expect(getPollingInterval([])).toBe(POLLING_INTERVALS.FAST);
    });

    it("should ignore terminal jobs and use oldest active job's age", () => {
      const jobs = [
        makeJobRowWithAge(0, "complete"), // terminal, ignore
        makeJobRowWithAge(15000, "failed"), // terminal, ignore
        makeJobRowWithAge(5000, "running"), // active, 5s old → FAST
      ];

      expect(getPollingInterval(jobs)).toBe(POLLING_INTERVALS.FAST);
    });

    it("should transition to MEDIUM when oldest active job hits threshold", () => {
      const jobs = [
        makeJobRowWithAge(25000, "complete"), // terminal, ignore
        makeJobRowWithAge(30000, "running"), // active, at FAST_MEDIUM threshold
      ];

      expect(getPollingInterval(jobs)).toBe(POLLING_INTERVALS.MEDIUM);
    });

    it("should use the oldest job's age when multiple active jobs exist", () => {
      const jobs = [
        makeJobRowWithAge(2000, "running"), // newer (2s old)
        makeJobRowWithAge(150000, "running"), // older (2.5min old) → SLOW
      ];

      expect(getPollingInterval(jobs)).toBe(POLLING_INTERVALS.SLOW);
    });

    it("should handle edge case: all jobs terminal", () => {
      const jobs = [
        makeJobRowWithAge(100000, "complete"),
        makeJobRowWithAge(50000, "failed"),
        makeJobRowWithAge(30000, "complete"), // changed from "canceled" (non-canonical)
      ];

      expect(getPollingInterval(jobs)).toBe(POLLING_INTERVALS.FAST);
    });
  });

  describe("Load Reduction Verification", () => {
    it("should reduce load to 40% at FAST→MEDIUM transition", () => {
      // Create a job that triggers MEDIUM interval
      const mediumJob = makeJobRowWithAge(
        POLLING_THRESHOLDS.FAST_MEDIUM * 1000
      );
      const mediumInterval = getPollingInterval([mediumJob]);

      // Create a job that triggers FAST interval
      const fastJob = makeJobRowWithAge(
        (POLLING_THRESHOLDS.FAST_MEDIUM - 1) * 1000
      );
      const fastInterval = getPollingInterval([fastJob]);

      // Verify the actual intervals produce ~40% load ratio
      const loadRatio = fastInterval / mediumInterval;
      expect(loadRatio).toBeCloseTo(0.4, 1);
    });

    it("should reduce load to 20% at steady state (FAST→SLOW)", () => {
      // Create a job that triggers SLOW interval
      const slowJob = makeJobRowWithAge(
        POLLING_THRESHOLDS.MEDIUM_SLOW * 1000
      );
      const slowInterval = getPollingInterval([slowJob]);

      // Create a job that triggers FAST interval
      const fastJob = makeJobRowWithAge(1000);
      const fastInterval = getPollingInterval([fastJob]);

      // Verify the actual intervals produce ~20% load ratio
      const loadRatio = fastInterval / slowInterval;
      expect(loadRatio).toBeCloseTo(0.2, 1);
    });

    it("should achieve extreme load reduction at SLOWEST tier", () => {
      // Create a job that triggers SLOWEST interval
      const slowestJob = makeJobRowWithAge(
        POLLING_THRESHOLDS.SLOW_SLOWEST * 1000 + 1000
      );
      const slowestInterval = getPollingInterval([slowestJob]);

      // Create a job that triggers FAST interval
      const fastJob = makeJobRowWithAge(1000);
      const fastInterval = getPollingInterval([fastJob]);

      // SLOWEST should be 15x slower than FAST (30s vs 2s)
      const loadRatio = fastInterval / slowestInterval;
      expect(loadRatio).toBeCloseTo(1 / 15, 1);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle null/undefined created_at gracefully", () => {
      const job = makeJobRow({ created_at: null as any });
      expect(() => getPollingInterval([job])).not.toThrow();
    });

    it("should handle jobs with very recent created_at (0ms age)", () => {
      const job = makeJobRowWithAge(0, "running");
      expect(getPollingInterval([job])).toBe(POLLING_INTERVALS.FAST);
    });

    it("should handle jobs with very old age (> 1 hour)", () => {
      const job = makeJobRowWithAge(3600000, "running"); // 1 hour
      expect(getPollingInterval([job])).toBe(POLLING_INTERVALS.SLOWEST);
    });
  });

  describe("Consistency: Thresholds and Intervals", () => {
    it("should have thresholds and intervals properly ordered", () => {
      // Verify thresholds are in ascending order
      expect(POLLING_THRESHOLDS.FAST_MEDIUM).toBeLessThan(
        POLLING_THRESHOLDS.MEDIUM_SLOW
      );
      expect(POLLING_THRESHOLDS.MEDIUM_SLOW).toBeLessThan(
        POLLING_THRESHOLDS.SLOW_SLOWEST
      );

      // Verify intervals are in ascending order
      expect(POLLING_INTERVALS.FAST).toBeLessThan(POLLING_INTERVALS.MEDIUM);
      expect(POLLING_INTERVALS.MEDIUM).toBeLessThan(POLLING_INTERVALS.SLOW);
      expect(POLLING_INTERVALS.SLOW).toBeLessThan(POLLING_INTERVALS.SLOWEST);
    });

    it("each threshold transition should move to next interval tier", () => {
      // Verify that crossing thresholds produces the expected interval changes
      const justBeforeMedium = makeJobRowWithAge(
        (POLLING_THRESHOLDS.FAST_MEDIUM - 1) * 1000
      );
      const atMediumThreshold = makeJobRowWithAge(
        POLLING_THRESHOLDS.FAST_MEDIUM * 1000
      );

      expect(getPollingInterval([justBeforeMedium])).toBe(
        POLLING_INTERVALS.FAST
      );
      expect(getPollingInterval([atMediumThreshold])).toBe(
        POLLING_INTERVALS.MEDIUM
      );
    });
  });
});
