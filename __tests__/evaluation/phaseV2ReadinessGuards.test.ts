import {
  assertManuscriptReadingTracksMayStart,
  assertPass3aMayStart,
  assertPhase1aMayStart,
} from '../../lib/evaluation/phase-architecture-v2/readinessGuards';

describe('Phase Architecture v2 — manuscript-reading readiness guards', () => {
  it('blocks manuscript-reading tracks before Phase 0 completes', () => {
    const result = assertManuscriptReadingTracksMayStart({
      phase0_status: 'running',
      chunk_manifest_status: 'done',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PHASE0_NOT_COMPLETE');
  });

  it('blocks manuscript-reading tracks before chunk manifest is durable', () => {
    const result = assertManuscriptReadingTracksMayStart({
      phase0_status: 'done',
      chunk_manifest_status: 'running',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHUNK_MANIFEST_NOT_DURABLE');
  });

  it('allows manuscript-reading tracks only after Phase 0 and chunk manifest are complete', () => {
    const result = assertManuscriptReadingTracksMayStart({
      phase0_status: 'done',
      chunk_manifest_status: 'done',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('MANUSCRIPT_READING_TRACKS_READY');
  });

  it('allows Phase 1A from the shared readiness rule', () => {
    const result = assertPhase1aMayStart({
      phase0_status: 'complete',
      chunk_manifest_status: 'complete',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('PHASE1A_MAY_START');
  });

  it('allows Pass 3A from the shared readiness rule', () => {
    const result = assertPass3aMayStart({
      phase0_status: 'completed',
      chunk_manifest_status: 'completed',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('PASS3A_MAY_START');
  });
});
