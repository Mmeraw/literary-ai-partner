import { describe, it, expect } from '@jest/globals';
import { checkSufficiencyGate } from '../../lib/revision/governance/sufficiency-gate';
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

describe('sufficiency-gate', () => {
  it('returns permissive pass while adapter wiring is pending', () => {
    const result = checkSufficiencyGate(makeCtx());
    expect(result.pass).toBe(true);
    expect(result.reason).toContain('always passes');
  });

  it('remains permissive when sceneId is missing', () => {
    const result = checkSufficiencyGate(makeCtx({ sceneId: '' }));
    expect(result.pass).toBe(true);
  });

  it('remains permissive when waveScores are empty', () => {
    const result = checkSufficiencyGate(makeCtx({ waveScores: {} as any }));
    expect(result.pass).toBe(true);
  });

  it('remains permissive when mode is missing', () => {
    const result = checkSufficiencyGate(makeCtx({ mode: '' as any }));
    expect(result.pass).toBe(true);
  });

  it('provides a reason string describing stub behavior', () => {
    const result = checkSufficiencyGate(makeCtx({ sceneId: '' }));
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });
});
