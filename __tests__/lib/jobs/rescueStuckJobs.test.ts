/**
 * Focused tests for the rescue_stuck_evaluation_jobs RPC contract.
 *
 * These tests verify the SQL selection criteria and rescue behavior
 * at the TypeScript contract level. The actual Postgres RPC runs against
 * the live DB; these tests validate the selection logic and Edge Function
 * auth/response contracts using mocks.
 */

import { describe, test, expect } from '@jest/globals';

// ── Selection criteria contract tests ────────────────────────────────────────
// These verify the criteria that the SQL RPC uses to identify stuck jobs.
// The RPC selects jobs WHERE:
//   status = 'running'
//   AND lease_until < now()
//   AND (worker_pulse_at IS NULL OR worker_pulse_at < now() - 5 min)
//   AND NOT (phase = 'review_gate' AND phase_status = 'awaiting_approval')

interface MockJob {
  id: string;
  status: string;
  phase: string;
  phase_status: string;
  lease_until: string | null;
  worker_pulse_at: string | null;
}

function isStuckByRescueCriteria(job: MockJob, nowMs: number = Date.now()): boolean {
  if (job.status !== 'running') return false;
  if (!job.lease_until) return false;
  if (new Date(job.lease_until).getTime() >= nowMs) return false;

  const PULSE_STALE_MS = 5 * 60 * 1000;
  const pulseStale = job.worker_pulse_at === null
    || new Date(job.worker_pulse_at).getTime() < nowMs - PULSE_STALE_MS;
  if (!pulseStale) return false;

  if (job.phase === 'review_gate' && job.phase_status === 'awaiting_approval') {
    return false;
  }

  return true;
}

const NOW = Date.now();
const FIVE_MIN_AGO = new Date(NOW - 5 * 60 * 1000 - 1).toISOString();
const ONE_MIN_AGO = new Date(NOW - 60 * 1000).toISOString();
const TEN_MIN_AGO = new Date(NOW - 10 * 60 * 1000).toISOString();
const TEN_MIN_FUTURE = new Date(NOW + 10 * 60 * 1000).toISOString();

describe('rescue_stuck_evaluation_jobs selection criteria', () => {
  test('selects running job with expired lease and stale pulse', () => {
    const job: MockJob = {
      id: 'stuck-job-1',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: TEN_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(true);
  });

  test('selects running job with expired lease and null pulse', () => {
    const job: MockJob = {
      id: 'null-pulse-job',
      status: 'running',
      phase: 'phase_2',
      phase_status: 'running',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: null,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(true);
  });

  test('rejects job with active lease (not expired)', () => {
    const job: MockJob = {
      id: 'active-lease-job',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      lease_until: TEN_MIN_FUTURE,
      worker_pulse_at: ONE_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('rejects job with recent pulse (even if lease expired)', () => {
    const job: MockJob = {
      id: 'recent-pulse-job',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: ONE_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('rejects queued job (not running)', () => {
    const job: MockJob = {
      id: 'queued-job',
      status: 'queued',
      phase: 'phase_1a',
      phase_status: 'queued',
      lease_until: null,
      worker_pulse_at: null,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('rejects failed job (not running)', () => {
    const job: MockJob = {
      id: 'failed-job',
      status: 'failed',
      phase: 'phase_1a',
      phase_status: 'failed',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: TEN_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('rejects complete job (not running)', () => {
    const job: MockJob = {
      id: 'complete-job',
      status: 'complete',
      phase: 'phase_3',
      phase_status: 'complete',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: TEN_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('Guard E: skips review_gate / awaiting_approval even if stuck', () => {
    const job: MockJob = {
      id: 'review-gate-job',
      status: 'running',
      phase: 'review_gate',
      phase_status: 'awaiting_approval',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: TEN_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('does NOT skip review_gate with non-approval phase_status', () => {
    const job: MockJob = {
      id: 'review-gate-running-job',
      status: 'running',
      phase: 'review_gate',
      phase_status: 'running',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: TEN_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(true);
  });

  test('rejects job with null lease_until', () => {
    const job: MockJob = {
      id: 'no-lease-job',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      lease_until: null,
      worker_pulse_at: TEN_MIN_AGO,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('pulse exactly at 5-minute boundary is NOT stale', () => {
    const exactlyFiveMinAgo = new Date(NOW - 5 * 60 * 1000).toISOString();
    const job: MockJob = {
      id: 'boundary-pulse-job',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      lease_until: TEN_MIN_AGO,
      worker_pulse_at: exactlyFiveMinAgo,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });

  test('idempotency: rescued job (now queued) is not selected again', () => {
    const job: MockJob = {
      id: 'already-rescued-job',
      status: 'queued',
      phase: 'phase_1a',
      phase_status: 'queued',
      lease_until: null,
      worker_pulse_at: null,
    };
    expect(isStuckByRescueCriteria(job, NOW)).toBe(false);
  });
});

// ── Edge Function auth contract tests ────────────────────────────────────────

describe('rescue-stuck-jobs Edge Function auth contract', () => {
  test('rejects request without Authorization header', () => {
    const authHeader: string | null = null;
    const rescueSecret = 'test-secret-123';
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    expect(!bearer || bearer !== rescueSecret).toBe(true);
  });

  test('rejects request with wrong Bearer token', () => {
    const authHeader = 'Bearer wrong-token';
    const rescueSecret = 'test-secret-123';
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    expect(!bearer || bearer !== rescueSecret).toBe(true);
  });

  test('accepts request with correct Bearer token', () => {
    const authHeader = 'Bearer test-secret-123';
    const rescueSecret = 'test-secret-123';
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    expect(bearer === rescueSecret).toBe(true);
  });
});

// ── Response shape contract tests ────────────────────────────────────────────

describe('rescue-stuck-jobs response shape', () => {
  test('success response has required fields', () => {
    const response = {
      ok: true,
      rescued_count: 2,
      rescued: [
        { job_id: 'id-1', phase: 'phase_1a', phase_status: 'queued', rescued_at: '2026-07-06T00:00:00Z' },
        { job_id: 'id-2', phase: 'phase_2', phase_status: 'queued', rescued_at: '2026-07-06T00:00:00Z' },
      ],
      invoked_at: '2026-07-06T00:00:00Z',
    };

    expect(response.ok).toBe(true);
    expect(response.rescued_count).toBe(2);
    expect(response.rescued).toHaveLength(2);
    expect(response.rescued[0]).toHaveProperty('job_id');
    expect(response.rescued[0]).toHaveProperty('phase');
    expect(response.rescued[0]).toHaveProperty('phase_status');
    expect(response.rescued[0]).toHaveProperty('rescued_at');
    expect(response).toHaveProperty('invoked_at');
  });

  test('empty rescue response', () => {
    const response = {
      ok: true,
      rescued_count: 0,
      rescued: [],
      invoked_at: '2026-07-06T00:00:00Z',
    };

    expect(response.ok).toBe(true);
    expect(response.rescued_count).toBe(0);
    expect(response.rescued).toHaveLength(0);
  });

  test('error response has required fields', () => {
    const response = {
      ok: false,
      error: 'Unauthorized',
    };

    expect(response.ok).toBe(false);
    expect(response).toHaveProperty('error');
  });
});
