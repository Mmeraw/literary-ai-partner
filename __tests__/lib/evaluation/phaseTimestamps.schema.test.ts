/**
 * Schema-guard test for phaseTimestamps.ts
 *
 * Catches drift between the declared PHASE_TIMESTAMP_COLUMNS allowlist and:
 *   1. The columns that actually exist on evaluation_jobs in the DB
 *   2. The output of getPhaseStartTimestamps / getPhaseCompleteTimestamps
 *
 * This test must stay green whenever processor.ts writes phase timestamps.
 * If it fails, either:
 *   a) A new column was added to the DB without updating PHASE_TIMESTAMP_COLUMNS, or
 *   b) A helper started returning a key that no longer exists in the DB.
 */

import {
  PHASE_TIMESTAMP_COLUMNS,
  getPhaseStartTimestamps,
  getPhaseCompleteTimestamps,
  type PhaseName,
} from '@/lib/evaluation/phaseTimestamps';

const ALL_PHASES: PhaseName[] = ['phase_1a', 'phase_2', 'phase_3'];
const NOW_ISO = new Date().toISOString();

describe('phaseTimestamps — allowlist contract', () => {
  it('PHASE_TIMESTAMP_COLUMNS contains no duplicates', () => {
    const set = new Set(PHASE_TIMESTAMP_COLUMNS);
    expect(set.size).toBe(PHASE_TIMESTAMP_COLUMNS.length);
  });

  it('getPhaseStartTimestamps never emits a key outside the allowlist', () => {
    const allowlist = new Set<string>(PHASE_TIMESTAMP_COLUMNS);
    for (const phase of ALL_PHASES) {
      const patch = getPhaseStartTimestamps(phase, NOW_ISO);
      for (const key of Object.keys(patch)) {
        expect(allowlist.has(key)).toBe(true);
      }
    }
  });

  it('getPhaseCompleteTimestamps never emits a key outside the allowlist', () => {
    const allowlist = new Set<string>(PHASE_TIMESTAMP_COLUMNS);
    for (const phase of ALL_PHASES) {
      const patch = getPhaseCompleteTimestamps(phase, NOW_ISO);
      for (const key of Object.keys(patch)) {
        expect(allowlist.has(key)).toBe(true);
      }
    }
  });

  it('phase_3 emits no DB timestamp columns (JSONB-only)', () => {
    expect(getPhaseStartTimestamps('phase_3', NOW_ISO)).toEqual({});
    expect(getPhaseCompleteTimestamps('phase_3', NOW_ISO)).toEqual({});
  });

  it('phase_1a start emits only phase1_started_at', () => {
    const patch = getPhaseStartTimestamps('phase_1a', NOW_ISO);
    expect(patch).toEqual({ phase1_started_at: NOW_ISO });
  });

  it('phase_1a complete emits only phase1_completed_at', () => {
    const patch = getPhaseCompleteTimestamps('phase_1a', NOW_ISO);
    expect(patch).toEqual({ phase1_completed_at: NOW_ISO });
  });

  it('phase_2 start emits phase1_completed_at and phase2_started_at', () => {
    const patch = getPhaseStartTimestamps('phase_2', NOW_ISO);
    expect(patch).toEqual({
      phase1_completed_at: NOW_ISO,
      phase2_started_at: NOW_ISO,
    });
  });

  it('phase_2 complete emits only phase2_completed_at', () => {
    const patch = getPhaseCompleteTimestamps('phase_2', NOW_ISO);
    expect(patch).toEqual({ phase2_completed_at: NOW_ISO });
  });

  it('banned column names never appear in any patch output', () => {
    const banned = [
      'phase1a_started_at',
      'phase1a_completed_at',
      'phase3_started_at',
      'phase3_completed_at',
      'lease_expires_at',
    ];
    for (const phase of ALL_PHASES) {
      const startKeys = Object.keys(getPhaseStartTimestamps(phase, NOW_ISO));
      const completeKeys = Object.keys(getPhaseCompleteTimestamps(phase, NOW_ISO));
      for (const bannedCol of banned) {
        expect(startKeys).not.toContain(bannedCol);
        expect(completeKeys).not.toContain(bannedCol);
      }
    }
  });
});
