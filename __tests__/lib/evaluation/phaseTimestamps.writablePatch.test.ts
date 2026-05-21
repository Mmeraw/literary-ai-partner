/**
 * Hardening tests for buildWritablePatch and FORBIDDEN_PATCH_COLUMNS.
 *
 * These tests guard against the class of bugs that caused three processor.ts
 * crashes this session:
 *   - phase1a_started_at written as a top-level DB column (does not exist)
 *   - phase3_started_at  written as a top-level DB column (does not exist)
 *   - lease_expires_at   written directly (GENERATED ALWAYS AS column — Postgres rejects it)
 *
 * The buildWritablePatch() function is the runtime boundary that prevents
 * any forbidden column from ever reaching Supabase.
 */
import { describe, it, expect, jest } from '@jest/globals';
import {
  buildWritablePatch,
  FORBIDDEN_PATCH_COLUMNS,
  getPhaseStartTimestamps,
  getPhaseCompleteTimestamps,
  PHASE_TIMESTAMP_COLUMNS,
  type ForbiddenPatchColumn,
} from '@/lib/evaluation/phaseTimestamps';

// ---------------------------------------------------------------------------
// buildWritablePatch — core contract
// ---------------------------------------------------------------------------

describe('buildWritablePatch — forbidden column stripping', () => {
  it('passes through a clean patch unchanged', () => {
    const patch = {
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      lease_until: '2026-05-21T03:59:00.000Z',
      updated_at: '2026-05-21T03:29:00.000Z',
    };
    const result = buildWritablePatch(patch);
    expect(result).toEqual(patch);
  });

  it('strips lease_expires_at (generated column)', () => {
    const patch = {
      status: 'running',
      lease_until: '2026-05-21T03:59:00.000Z',
      lease_expires_at: '2026-05-21T03:59:00.000Z', // FORBIDDEN — generated always as
      updated_at: '2026-05-21T03:29:00.000Z',
    };
    const result = buildWritablePatch(patch);
    expect(result).not.toHaveProperty('lease_expires_at');
    expect(result).toHaveProperty('lease_until');
    expect(result).toHaveProperty('status', 'running');
  });

  it('strips phase1a_started_at (column does not exist on evaluation_jobs)', () => {
    const patch = {
      status: 'running',
      phase1a_started_at: '2026-05-21T02:28:00.000Z', // FORBIDDEN
      phase1_started_at: '2026-05-21T02:28:00.000Z',  // ALLOWED — real column
    };
    const result = buildWritablePatch(patch);
    expect(result).not.toHaveProperty('phase1a_started_at');
    expect(result).toHaveProperty('phase1_started_at');
  });

  it('strips phase1a_completed_at (column does not exist on evaluation_jobs)', () => {
    const patch = {
      status: 'queued',
      phase1a_completed_at: '2026-05-21T02:29:00.000Z', // FORBIDDEN
      phase1_completed_at: '2026-05-21T02:29:00.000Z',  // ALLOWED — real column
    };
    const result = buildWritablePatch(patch);
    expect(result).not.toHaveProperty('phase1a_completed_at');
    expect(result).toHaveProperty('phase1_completed_at');
  });

  it('strips phase3_started_at (column does not exist on evaluation_jobs)', () => {
    const patch = {
      status: 'running',
      phase3_started_at: '2026-05-21T02:45:00.000Z', // FORBIDDEN
    };
    const result = buildWritablePatch(patch);
    expect(result).not.toHaveProperty('phase3_started_at');
  });

  it('strips phase3_completed_at (column does not exist on evaluation_jobs)', () => {
    const patch = {
      status: 'complete',
      phase3_completed_at: '2026-05-21T02:51:00.000Z', // FORBIDDEN
      completed_at: '2026-05-21T02:51:00.000Z',         // ALLOWED — real column
    };
    const result = buildWritablePatch(patch);
    expect(result).not.toHaveProperty('phase3_completed_at');
    expect(result).toHaveProperty('completed_at');
  });

  it('strips ALL forbidden columns simultaneously', () => {
    const patch: Record<string, string> = {
      status: 'running',
      updated_at: '2026-05-21T02:28:00.000Z',
    };
    // Inject every forbidden column
    for (const col of FORBIDDEN_PATCH_COLUMNS) {
      patch[col] = '2026-05-21T02:28:00.000Z';
    }
    const result = buildWritablePatch(patch);
    for (const col of FORBIDDEN_PATCH_COLUMNS) {
      expect(result).not.toHaveProperty(col);
    }
    expect(result).toHaveProperty('status', 'running');
    expect(result).toHaveProperty('updated_at');
  });

  it('emits a console.warn for each stripped column', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    buildWritablePatch({
      status: 'running',
      lease_expires_at: 'some-value',
      phase3_started_at: 'some-value',
    });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toContain('lease_expires_at');
    expect(warnSpy.mock.calls[1][0]).toContain('phase3_started_at');
    warnSpy.mockRestore();
  });

  it('returns empty object when all keys are forbidden', () => {
    const patch: Record<string, string> = {};
    for (const col of FORBIDDEN_PATCH_COLUMNS) {
      patch[col] = '2026-05-21T02:28:00.000Z';
    }
    const result = buildWritablePatch(patch);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getPhaseStartTimestamps — never emits forbidden columns
// ---------------------------------------------------------------------------

describe('getPhaseStartTimestamps — output never contains forbidden columns', () => {
  const now = '2026-05-21T02:28:00.000Z';
  const phases = ['phase_1a', 'phase_2', 'phase_3'] as const;
  const forbidden = new Set<string>(FORBIDDEN_PATCH_COLUMNS);

  for (const phase of phases) {
    it(`phase ${phase} produces no forbidden columns`, () => {
      const patch = getPhaseStartTimestamps(phase, now);
      for (const key of Object.keys(patch)) {
        expect(forbidden.has(key)).toBe(false);
      }
    });
  }

  it('phase_1a writes phase1_started_at only', () => {
    const patch = getPhaseStartTimestamps('phase_1a', now);
    expect(patch).toEqual({ phase1_started_at: now });
  });

  it('phase_2 writes phase1_completed_at + phase2_started_at (inherits handoff time)', () => {
    const patch = getPhaseStartTimestamps('phase_2', now);
    expect(patch).toEqual({ phase1_completed_at: now, phase2_started_at: now });
  });

  it('phase_3 writes nothing (no DB timestamp columns exist for phase_3)', () => {
    const patch = getPhaseStartTimestamps('phase_3', now);
    expect(patch).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getPhaseCompleteTimestamps — never emits forbidden columns
// ---------------------------------------------------------------------------

describe('getPhaseCompleteTimestamps — output never contains forbidden columns', () => {
  const now = '2026-05-21T02:29:00.000Z';
  const phases = ['phase_1a', 'phase_2', 'phase_3'] as const;
  const forbidden = new Set<string>(FORBIDDEN_PATCH_COLUMNS);

  for (const phase of phases) {
    it(`phase ${phase} produces no forbidden columns`, () => {
      const patch = getPhaseCompleteTimestamps(phase, now);
      for (const key of Object.keys(patch)) {
        expect(forbidden.has(key)).toBe(false);
      }
    });
  }

  it('phase_1a writes phase1_completed_at only', () => {
    const patch = getPhaseCompleteTimestamps('phase_1a', now);
    expect(patch).toEqual({ phase1_completed_at: now });
  });

  it('phase_2 writes phase2_completed_at only', () => {
    const patch = getPhaseCompleteTimestamps('phase_2', now);
    expect(patch).toEqual({ phase2_completed_at: now });
  });

  it('phase_3 writes nothing (no DB timestamp columns exist for phase_3)', () => {
    const patch = getPhaseCompleteTimestamps('phase_3', now);
    expect(patch).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// PHASE_TIMESTAMP_COLUMNS — cross-check against FORBIDDEN_PATCH_COLUMNS
// ---------------------------------------------------------------------------

describe('PHASE_TIMESTAMP_COLUMNS vs FORBIDDEN_PATCH_COLUMNS — no overlap', () => {
  it('no real DB timestamp column appears in the forbidden list', () => {
    const allowed = new Set<string>(PHASE_TIMESTAMP_COLUMNS);
    const forbidden = new Set<string>(FORBIDDEN_PATCH_COLUMNS);
    for (const col of allowed) {
      expect(forbidden.has(col)).toBe(false);
    }
  });

  it('phase1_started_at is allowed (real DB column)', () => {
    expect(PHASE_TIMESTAMP_COLUMNS).toContain('phase1_started_at');
    expect(FORBIDDEN_PATCH_COLUMNS).not.toContain('phase1_started_at' as ForbiddenPatchColumn);
  });

  it('phase1a_started_at is forbidden (not a real DB column)', () => {
    expect(FORBIDDEN_PATCH_COLUMNS).toContain('phase1a_started_at');
    expect(PHASE_TIMESTAMP_COLUMNS).not.toContain('phase1a_started_at' as never);
  });

  it('lease_expires_at is forbidden (generated column)', () => {
    expect(FORBIDDEN_PATCH_COLUMNS).toContain('lease_expires_at');
  });
});
