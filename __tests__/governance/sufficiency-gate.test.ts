import { describe, it, expect } from 'vitest';
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
  it('passes when all required context is present', () => {
    const result = checkSufficiencyGate(makeCtx());
    expect(result.pass).toBe(true);
  });

  it('fails when sceneId is missing', () => {
    const result = checkSufficiencyGate(makeCtx({ sceneId: '' }));
    expect(result.pass).toBe(false);
  });

  it('fails when waveScores are empty', () => {
    const result = checkSufficiencyGate(makeCtx({ waveScores: {} as any }));
    expect(result.pass).toBe(false);
  });

  it('fails when mode is missing', () => {
    const result = checkSufficiencyGate(makeCtx({ mode: '' as any }));
    expect(result.pass).toBe(false);
  });

  it('provides a reason on failure', () => {
    const result = checkSufficiencyGate(makeCtx({ sceneId: '' }));
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });
});
