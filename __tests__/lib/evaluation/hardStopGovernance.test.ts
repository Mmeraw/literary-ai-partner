export {};

import {
  classifyQueuedHardStop,
  classifySplitBrain,
  isPostPhase0HandoffLimbo,
  partitionMaxAgeKillSwitchCandidates,
  isSplitBrainState,
  resolveProviderBudget,
} from '../../../lib/evaluation/hardStopGovernance';

describe('hardStopGovernance', () => {
  test('detects split-brain phase mismatches', () => {
    expect(
      isSplitBrainState({
        id: 'job-1',
        status: 'queued',
        phase: 'phase_1a',
        phase_status: 'queued',
        progress: { phase: 'phase_0', phase_status: 'queued' },
      }),
    ).toBe(true);
  });

  test('detects post-phase0 limbo when seeds are missing and grace elapses', () => {
    expect(
      isPostPhase0HandoffLimbo(
        {
          id: 'job-1',
          status: 'queued',
          phase: 'phase_1a',
          phase_status: 'queued',
          phase0_completed_at: '2026-06-01T03:00:00.000Z',
          updated_at: '2026-06-01T03:00:01.000Z',
        },
        { nowMs: Date.parse('2026-06-01T03:02:30.000Z'), graceMs: 90_000, hasSeedArtifacts: false },
      ),
    ).toBe(true);
  });

  test('resolves a hard-capped provider budget from workload size', () => {
    const budget = resolveProviderBudget({ chunkCount: 52, manuscriptWordCount: 165_000 });
    expect(budget.maxCalls).toBeGreaterThanOrEqual(4);
    expect(budget.maxCalls).toBeLessThanOrEqual(12);
    expect(budget.maxEstimatedTokens).toBeGreaterThan(0);
  });

  test('classifies queued hard stop reasons in priority order', () => {
    const decision = classifyQueuedHardStop(
      {
        id: 'job-1',
        status: 'queued',
        phase: 'phase_1a',
        phase_status: 'queued',
        progress: { phase: 'phase_0', phase_status: 'queued' },
      },
      {
        nowMs: Date.now(),
        graceMs: 90_000,
        shortFormSlaMs: 15 * 60_000,
        longFormSlaMs: 60 * 60_000,
        hasSeedArtifacts: false,
      },
    );

    expect(decision?.code).toBe('STATE_SPLIT_BRAIN_DETECTED');
  });

  test('classifySplitBrain returns healable when only phase_status diverges', () => {
    expect(
      classifySplitBrain({
        id: 'job-1',
        status: 'queued',
        phase: 'phase_1a',
        phase_status: 'queued',
        progress: { phase: 'phase_1a', phase_status: 'running' },
      }),
    ).toBe('healable');
  });

  test('classifySplitBrain returns structural when phase diverges', () => {
    expect(
      classifySplitBrain({
        id: 'job-1',
        status: 'queued',
        phase: 'phase_1a',
        phase_status: 'queued',
        progress: { phase: 'phase_0', phase_status: 'queued' },
      }),
    ).toBe('structural');
  });

  test('classifySplitBrain returns none when no divergence', () => {
    expect(
      classifySplitBrain({
        id: 'job-1',
        status: 'queued',
        phase: 'phase_1a',
        phase_status: 'queued',
        progress: { phase: 'phase_1a', phase_status: 'queued' },
      }),
    ).toBe('none');
  });

  test('partitions max-age kill-switch rows into legal transition buckets', () => {
    const partition = partitionMaxAgeKillSwitchCandidates([
      { id: 'run-1', status: 'running', phase_status: 'running' },
      { id: 'q-ok', status: 'queued', phase_status: 'queued' },
      { id: 'q-await', status: 'queued', phase_status: 'awaiting_approval' },
      { id: 'q-null', status: 'queued', phase_status: null },
    ]);

    expect(partition.runningIds).toEqual(['run-1']);
    expect(partition.queuedEligibleIds).toEqual(['q-ok']);
    expect(partition.queuedSkippedIds).toEqual(['q-await', 'q-null']);
  });
});
