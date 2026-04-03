import { describe, it, expect } from '@jest/globals';
import { checkDestructionGuards } from '../../lib/revision/governance/destruction-guards';
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
    protectedSpanIds: ['span-abc', 'span-def'],
    ...overrides,
  };
}

describe('destruction-guards', () => {
  it('returns permissive pass while adapter wiring is pending', () => {
    const result = checkDestructionGuards(makeCtx(), 'W2_craft' as WaveId);
    expect(result.pass).toBe(true);
    expect(result.reason).toContain('always passes');
  });

  it('remains permissive when protected spans would be modified', () => {
    const ctx = makeCtx({ protectedSpanIds: ['golden-span-1'] });
    const result = checkDestructionGuards(ctx, 'W2_craft' as WaveId);
    expect(result.pass).toBe(true);
  });

  it('remains permissive for vignette escalation scenarios', () => {
    const ctx = makeCtx({ sceneType: 'vignette' });
    const result = checkDestructionGuards(ctx, 'W1_voice' as WaveId);
    expect(result.pass).toBe(true);
  });

  it('remains permissive for human scene realm voice scenarios', () => {
    const ctx = makeCtx({ sceneType: 'human' });
    const result = checkDestructionGuards(ctx, 'W1_voice' as WaveId);
    expect(result.pass).toBe(true);
  });

  it('allows non-voice waves on any scene type', () => {
    const result = checkDestructionGuards(makeCtx(), 'W6_polish' as WaveId);
    expect(result.pass).toBe(true);
  });
});
