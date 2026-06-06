export {};

import {
  classifyQueuedHardStop,
  classifySplitBrain,
 a  decideSplitBrainRecovery,
  isGlobalSlaExceeded,
  isPostPhase0HandoffLimbo,
  partitionMaxAgeKillSwitchCandidates,
  isSplitBrainState,
  REVISIONGRADE_SUPPORT_EMAIL,
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

  test('does not hard-stop normal queued handoff from completed previous phase', () => {
    const job = {
      id: 'job-1',
      status: 'queued',
      phase: 'phase_3',
      phase_status: 'queued',
      progress: { phase: 'phase_2', phase_status: 'complete' },
    };

    expect(isSplitBrainState(job)).toBe(true);
    expect(classifySplitBrain(job)).toBe('healable');
    expect(
      classifyQueuedHardStop(job, {
        nowMs: Date.now(),
        graceMs: 90_000,
        shortFormSlaMs: 15 * 60_000,
        longFormSlaMs: 60 * 60_000,
        hasSeedArtifacts: true,
      }),
    ).toBeNull();
  });

  test('does not hard-stop expected queued handoffs across all evaluation phases and passes', () => {
    const handoffs: Array<[string, string]> = [
      ['phase_0', 'seed_0_5a'],
      ['seed_0_5a', 'seed_0_5b'],
      ['seed_0_5b', 'phase_1a'],
      ['phase_1a', 'review_gate'],
      ['review_gate', 'phase_2'],
      ['phase_1a', 'phase_2'],    // short-form: bypasses review_gate
      ['phase_2', 'phase_3a'],
      ['phase_2', 'phase_3'],     // short-form: bypasses phase_3a
      ['phase_3a', 'phase_3'],
      ['phase_3', 'phase_3b'],
      ['phase_3b', 'wave_revision'],
      ['wave_revision', 'phase_5'],
      ['pass_2', 'pass_3a'],
      ['pass_2', 'pass_3'],
      ['pass_3b', 'wave'],
      ['wave', 'revision_queue'],
    ];

    for (const [previousPhase, nextPhase] of handoffs) {
      const job = {
        id: `job-${previousPhase}-${nextPhase}`,
        status: 'queued',
        phase: nextPhase,
        phase_status: 'queued',
        progress: { phase: previousPhase, phase_status: 'complete' },
      };

      expect(classifySplitBrain(job)).toBe('healable');
      expect(
        classifyQueuedHardStop(job, {
          nowMs: Date.now(),
          graceMs: 90_000,
          shortFormSlaMs: 15 * 60_000,
          longFormSlaMs: 60 * 60_000,
          hasSeedArtifacts: true,
        }),
      ).toBeNull();
    }
  });

  test('keeps non-sequential phase mismatches structural', () => {
    const job = {
      id: 'job-1',
      status: 'queued',
      phase: 'phase_3',
      phase_status: 'queued',
      progress: { phase: 'phase_0', phase_status: 'complete' },
    };

    expect(classifySplitBrain(job)).toBe('structural');
    expect(
      classifyQueuedHardStop(job, {
        nowMs: Date.now(),
        graceMs: 90_000,
        shortFormSlaMs: 15 * 60_000,
        longFormSlaMs: 60 * 60_000,
        hasSeedArtifacts: true,
      })?.code,
    ).toBe('STATE_SPLIT_BRAIN_DETECTED');
  });

  test('structural split-brain creates recovery key and support alert', () => {
    const decision = classifyQueuedHardStop(
      {
        id: 'job-structural',
        status: 'queued',
        phase: 'phase_3',
        phase_status: 'queued',
        progress: { phase: 'phase_0', phase_status: 'complete' },
      },
      {
        nowMs: Date.now(),
        graceMs: 90_000,
        shortFormSlaMs: 15 * 60_000,
        longFormSlaMs: 60 * 60_000,
        hasSeedArtifacts: true,
      },
    );

    expect(decision?.code).toBe('STATE_SPLIT_BRAIN_DETECTED');
    expect(decision?.reason).not.toMatch(/Split-brain state detected/);
    expect(decision?.internalReason).toMatch(/Split-brain state detected/);
    expect(decision?.recoveryKey).toContain('SPLIT_BRAIN:STRUCTURAL:job-structural');
    expect(decision?.recoveryAction).toBe('halt_for_engineering_review');
    expect(decision?.notifySupport?.to).toBe(REVISIONGRADE_SUPPORT_EMAIL);
    expect(decision?.notifySupport?.severity).toBe('critical');
  });

  test('healable split-brain chooses deterministic recovery without hard stop', () => {
    const recovery = decideSplitBrainRecovery({
      id: 'job-healable',
      status: 'queued',
      phase: 'phase_3',
      phase_status: 'queued',
      progress: { phase: 'phase_2', phase_status: 'complete' },
    });

    expect(recovery.state).toBe('healable');
    expect(recovery.action).toBe('repair_to_expected_handoff');
    expect(recovery.recoveryKey).toContain('SPLIT_BRAIN:HEALABLE:job-healable');
    expect(recovery.notifySupport?.to).toBe(REVISIONGRADE_SUPPORT_EMAIL);
    expect(recovery.notifySupport?.severity).toBe('warning');
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

  test('classifySplitBrain returns structural when phase diverges outside a clean handoff', () => {
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

  test('isGlobalSlaExceeded resets clock on resume_requested_at', () => {
    const createdAt = '2026-06-05T05:00:00.000Z';
    const resumeAt = '2026-06-05T06:00:00.000Z';
    const nowMs = Date.parse('2026-06-05T06:10:00.000Z');

    expect(
      isGlobalSlaExceeded(
        {
          id: 'job-1',
          status: 'queued',
          phase: 'phase_1a',
          phase_status: 'queued',
          created_at: createdAt,
          progress: {},
        },
        { nowMs, shortFormSlaMs: 15 * 60_000, longFormSlaMs: 60 * 60_000 },
      ),
    ).toBe(true);

    expect(
      isGlobalSlaExceeded(
        {
          id: 'job-1',
          status: 'queued',
          phase: 'phase_1a',
          phase_status: 'queued',
          created_at: createdAt,
          progress: { resume_requested_at: resumeAt },
        },
        { nowMs, shortFormSlaMs: 15 * 60_000, longFormSlaMs: 60 * 60_000 },
      ),
    ).toBe(false);
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
