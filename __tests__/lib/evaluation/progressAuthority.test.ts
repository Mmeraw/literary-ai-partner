import {
  ProgressAuthority,
  createProgressAuthority,
  createInitialProgressSnapshot,
} from '@/lib/evaluation/progressAuthority';

describe('ProgressAuthority', () => {
  it('starts with a 0% running snapshot', () => {
    const authority = createProgressAuthority();
    const snapshot = authority.toSnapshot();

    expect(snapshot.status).toBe('running');
    expect(snapshot.overall.completed_units).toBe(0);
    expect(snapshot.overall.total_units).toBe(100);
    expect(snapshot.part1.completed_units).toBe(0);
    expect(snapshot.part2.completed_units).toBe(0);
    expect(snapshot.progress_high_water).toBe(0);
  });

  it('monotonically advances through phase_1a chunk progress', () => {
    const authority = createProgressAuthority();

    authority.report({ type: 'phase_started', phase: 'phase_0' });
    authority.report({ type: 'phase_progress', phase: 'phase_0', fraction: 1 });
    authority.report({ type: 'phase_started', phase: 'phase_1a' });

    expect(authority.toSnapshot().overall.completed_units).toBeGreaterThanOrEqual(5);
    expect(authority.toSnapshot().overall.completed_units).toBeLessThanOrEqual(35);

    authority.report({
      type: 'phase_progress',
      phase: 'phase_1a',
      fraction: 0.5,
      message: 'Analyzing writing (5/10 sections)',
    });

    const snapshot = authority.toSnapshot();
    expect(snapshot.overall.completed_units).toBeGreaterThanOrEqual(5);
    expect(snapshot.overall.completed_units).toBeLessThan(35);
    expect(snapshot.message).toBe('Analyzing writing (5/10 sections)');
    expect(snapshot.part1.status).toBe('running');
    expect(snapshot.part2.status).toBe('pending');
  });

  it('caps overall progress at 99% while finalizing', () => {
    const authority = createProgressAuthority();

    // Complete all Part 1 phases.
    authority.report({ type: 'phase_progress', phase: 'phase_0', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_1a', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'pass_3a', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_2', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_3', fraction: 1 });

    const beforeFinalize = authority.toSnapshot();
    expect(beforeFinalize.overall.completed_units).toBeLessThanOrEqual(90);

    authority.report({ type: 'finalizing', phase: 'finalization' });
    const finalizing = authority.toSnapshot();
    expect(finalizing.overall.completed_units).toBeLessThanOrEqual(99);
    expect(finalizing.status).toBe('running');
  });

  it('reaches 100% only on complete', () => {
    const authority = createProgressAuthority();

    authority.report({ type: 'phase_progress', phase: 'phase_0', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_1a', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'pass_3a', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_2', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_3', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'wave', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'finalization', fraction: 1 });

    authority.report({ type: 'complete' });

    const snapshot = authority.toSnapshot();
    expect(snapshot.status).toBe('complete');
    expect(snapshot.overall.completed_units).toBe(100);
    expect(snapshot.part1.completed_units).toBe(100);
    expect(snapshot.part2.completed_units).toBe(100);
    expect(snapshot.message).toBe('Evaluation complete');
  });

  it('never moves backward when a smaller fraction is reported', () => {
    const authority = createProgressAuthority();
    authority.report({ type: 'phase_started', phase: 'phase_1a' });
    authority.report({ type: 'phase_progress', phase: 'phase_1a', fraction: 0.8 });
    const high = authority.toSnapshot().overall.completed_units;

    authority.report({ type: 'phase_progress', phase: 'phase_1a', fraction: 0.2 });
    const low = authority.toSnapshot().overall.completed_units;

    expect(low).toBeGreaterThanOrEqual(high);
  });

  it('rehydrates completed phases from persisted timestamps', () => {
    const authority = ProgressAuthority.fromPersisted({
      phase0_completed_at: '2026-07-16T00:00:00Z',
      phase1_completed_at: '2026-07-16T00:01:00Z',
      phase: 'phase_2',
      completed_units: 70,
      progress_high_water: 70,
    });

    const snapshot = authority.toSnapshot();
    // Part 1 should account for the completed phases.
    expect(snapshot.part1.completed_units).toBeGreaterThanOrEqual(70);
    expect(snapshot.overall.completed_units).toBeGreaterThanOrEqual(70);
    expect(snapshot.progress_high_water).toBe(70);
  });

  it('part 1 can reach 100% independently of part 2', () => {
    const authority = createProgressAuthority();

    authority.report({ type: 'phase_progress', phase: 'phase_0', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_1a', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'pass_3a', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_2', fraction: 1 });
    authority.report({ type: 'phase_progress', phase: 'phase_3', fraction: 1 });

    const part1Complete = authority.finalizePart1();
    expect(part1Complete.part1.completed_units).toBe(100);
    expect(part1Complete.part1.status).toBe('complete');
    expect(part1Complete.part2.status).toBe('running');
    expect(part1Complete.status).toBe('running');
    expect(part1Complete.overall.completed_units).toBeLessThan(100);
  });
});
