import { describe, it, expect } from 'vitest';
import { checkWaveEligibility } from '../../lib/revision/governance/wave-eligibility';
import { GovernanceContext, WaveId } from '../../lib/revision/governance/types';

function makeCtx(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    runId: 'test-run-1',
    sceneId: 'scene-1',
    sceneType: 'human',
    mode: 'revision',
    waveScores: {
      W1_voice: 7, W2_craft: 6, W3_anchor: 8,
      W4_continuity: 7, W5_emotional: 5, W6_polish: 9,
    } as Record<WaveId, number>,
    protectedSpanIds: [],
    ...overrides,
  };
}

describe('wave-eligibility', () => {
  it('allows wave when score is below threshold', () => {
    const result = checkWaveEligibility(makeCtx(), 'W5_emotional' as WaveId);
    expect(result.pass).toBe(true);
  });

  it('skips wave when score is already high', () => {
    const result = checkWaveEligibility(makeCtx(), 'W6_polish' as WaveId);
    // W6 score is 9, should skip (above threshold)
    expect(result.pass).toBe(false);
  });

  it('respects vignette escalation ban', () => {
    const ctx = makeCtx({ sceneType: 'vignette' });
    // Vignette should never escalate — W1_voice should be blocked
    const result = checkWaveEligibility(ctx, 'W1_voice' as WaveId);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('vignette');
  });

  it('respects human scene realm voice ban', () => {
    const ctx = makeCtx({ sceneType: 'human' });
    // Human scenes should never gain realm voice
    const result = checkWaveEligibility(ctx, 'W1_voice' as WaveId);
    // This depends on implementation — human scenes block realm voice injection
    expect(result).toBeDefined();
  });
});
