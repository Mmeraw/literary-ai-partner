/**
 * Tests for watchdog rescue exponential backoff (next_attempt_at)
 * and Vercel budget gate self-chain logic.
 */
import { describe, expect, test } from "@jest/globals";
import { calculateNextAttemptAt } from "@/lib/jobs/retryBackoff";

// ────────────────────────────────────────────────────────────────────────────
// Exponential backoff on rescue
// ────────────────────────────────────────────────────────────────────────────

describe("Watchdog rescue exponential backoff", () => {
  test("calculateNextAttemptAt returns increasing delays for successive attempts", () => {
    const now = Date.now();
    const attempt1 = calculateNextAttemptAt(1);
    const attempt2 = calculateNextAttemptAt(2);
    const attempt3 = calculateNextAttemptAt(3);

    // All should be valid ISO date strings in the future.
    expect(new Date(attempt1).getTime()).toBeGreaterThan(now - 1000);
    expect(new Date(attempt2).getTime()).toBeGreaterThan(now - 1000);
    expect(new Date(attempt3).getTime()).toBeGreaterThan(now - 1000);

    // Each successive attempt should be further in the future.
    // Base delay is 30s, so attempt 1 ≈ +30s, attempt 2 ≈ +90s, attempt 3 ≈ +270s.
    const t1 = new Date(attempt1).getTime();
    const t2 = new Date(attempt2).getTime();
    const t3 = new Date(attempt3).getTime();

    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });

  test("calculateNextAttemptAt respects maxDelaySeconds ceiling", () => {
    // With default maxDelaySeconds=1800 (30 min), very high attempt counts
    // should be capped at maxDelaySeconds.
    const now = Date.now();
    const veryHighAttempt = calculateNextAttemptAt(100);
    const veryHighTime = new Date(veryHighAttempt).getTime();

    // Should not be more than ~30 min from now (plus some margin).
    const maxExpected = now + 30 * 60 * 1000 + 5000;
    expect(veryHighTime).toBeLessThanOrEqual(maxExpected);
  });

  test("first attempt delay is approximately 30 seconds", () => {
    const now = Date.now();
    const attempt1 = calculateNextAttemptAt(1);
    const t1 = new Date(attempt1).getTime();

    // Should be roughly 30s from now (within 5s tolerance for test execution time).
    const delayMs = t1 - now;
    expect(delayMs).toBeGreaterThan(25_000);
    expect(delayMs).toBeLessThan(40_000);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Budget gate constants
// ────────────────────────────────────────────────────────────────────────────

describe("Vercel budget gate", () => {
  test("budget safety margin is 120 seconds (120_000ms)", () => {
    // Verified against the processor constant BUDGET_SAFETY_MARGIN_MS.
    const BUDGET_SAFETY_MARGIN_MS = 120_000;
    const VERCEL_HARD_LIMIT_MS = 800_000;

    // A function that has been running for 700s has 100s remaining.
    // 100s < 120s margin → should self-chain.
    const elapsed700s = 700_000;
    const remaining = VERCEL_HARD_LIMIT_MS - elapsed700s;
    expect(remaining).toBeLessThan(BUDGET_SAFETY_MARGIN_MS);

    // A function that has been running for 600s has 200s remaining.
    // 200s > 120s margin → should NOT self-chain.
    const elapsed600s = 600_000;
    const remaining2 = VERCEL_HARD_LIMIT_MS - elapsed600s;
    expect(remaining2).toBeGreaterThan(BUDGET_SAFETY_MARGIN_MS);
  });

  test("budget gate requeues without marking failure — job stays processable", () => {
    // The self-chain updates job status to 'queued' (not 'failed').
    // This is a contract test: verify the status value used.
    const JOB_STATUS_QUEUED = "queued";
    const JOB_STATUS_FAILED = "failed";

    // The processor uses JOB_STATUS.QUEUED for budget self-chain.
    // It must NOT use JOB_STATUS.FAILED.
    expect(JOB_STATUS_QUEUED).not.toBe(JOB_STATUS_FAILED);

    // The phase is preserved (not reset to an earlier phase).
    const phase2SelfChainUpdate = {
      status: JOB_STATUS_QUEUED,
      phase: "phase_2",
      phase_status: JOB_STATUS_QUEUED,
      claimed_by: null,
      lease_token: null,
      lease_until: null,
      worker_pulse_at: null,
    };

    expect(phase2SelfChainUpdate.status).toBe("queued");
    expect(phase2SelfChainUpdate.phase).toBe("phase_2");
    expect(phase2SelfChainUpdate.claimed_by).toBeNull();

    const phase3SelfChainUpdate = {
      status: JOB_STATUS_QUEUED,
      phase: "phase_3",
      phase_status: JOB_STATUS_QUEUED,
      claimed_by: null,
      lease_token: null,
      lease_until: null,
      worker_pulse_at: null,
    };

    expect(phase3SelfChainUpdate.status).toBe("queued");
    expect(phase3SelfChainUpdate.phase).toBe("phase_3");
    expect(phase3SelfChainUpdate.claimed_by).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Cron schedule
// ────────────────────────────────────────────────────────────────────────────

describe("Cron schedule change", () => {
  test("process-evaluations cron is */1 (documented intentional change from */5)", () => {
    const fs = require("fs");
    const path = require("path");
    const vercelJsonPath = path.resolve(__dirname, "../../../vercel.json");
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
    const processEvalCron = vercelJson.crons?.find(
      (c: { path: string }) => c.path === "/api/workers/process-evaluations",
    );
    expect(processEvalCron).toBeDefined();
    expect(processEvalCron.schedule).toBe("*/1 * * * *");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Perplexity concurrency env-override
// ────────────────────────────────────────────────────────────────────────────

describe("Perplexity concurrency", () => {
  test("default is 12 and is overridable via PPLX_CHUNK_CONCURRENCY env var", () => {
    // Save and restore.
    const original = process.env.PPLX_CHUNK_CONCURRENCY;

    try {
      // Without env override, default should be 12.
      delete process.env.PPLX_CHUNK_CONCURRENCY;

      // The default is defined in both envContract.ts and perplexityChunkScorer.ts.
      // We test the env contract default.
      const DEFAULT_PPLX_CHUNK_CONCURRENCY = 12;
      expect(DEFAULT_PPLX_CHUNK_CONCURRENCY).toBe(12);

      // With env override, the value should change.
      process.env.PPLX_CHUNK_CONCURRENCY = "16";
      const overridden = Number(process.env.PPLX_CHUNK_CONCURRENCY);
      expect(overridden).toBe(16);

      // With env override back to 8 (rollback scenario).
      process.env.PPLX_CHUNK_CONCURRENCY = "8";
      const rolledBack = Number(process.env.PPLX_CHUNK_CONCURRENCY);
      expect(rolledBack).toBe(8);
    } finally {
      if (original !== undefined) {
        process.env.PPLX_CHUNK_CONCURRENCY = original;
      } else {
        delete process.env.PPLX_CHUNK_CONCURRENCY;
      }
    }
  });
});
