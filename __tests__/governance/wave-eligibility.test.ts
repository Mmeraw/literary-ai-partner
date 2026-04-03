import { describe, it, expect } from '@jest/globals';
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
  it('returns permissive pass while adapter wiring is pending', () => {
    const result = checkWaveEligibility(makeCtx(), 'W5_emotional' as WaveId);
    expect(result.pass).toBe(true);
    expect(result.reason).toContain('always passes');
  });

  it('remains permissive even for scenarios future wiring may reject', () => {
    const result = checkWaveEligibility(makeCtx(), 'W6_polish' as WaveId);
    expect(result.pass).toBe(true);
  });

  it('documents current stub behavior for vignette scenarios', () => {
    const ctx = makeCtx({ sceneType: 'vignette' });
    const result = checkWaveEligibility(ctx, 'W1_voice' as WaveId);
    expect(result.pass).toBe(true);
  });

  it('returns a governance result shape for human scene checks', () => {
    const ctx = makeCtx({ sceneType: 'human' });
    const result = checkWaveEligibility(ctx, 'W1_voice' as WaveId);
    expect(result).toBeDefined();
    expect(result.pass).toBe(true);
  });
});
