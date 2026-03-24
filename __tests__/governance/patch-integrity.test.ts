import { describe, it, expect } from 'vitest';
import { checkPatchIntegrity } from '../../lib/revision/governance/patch-integrity';
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
    protectedSpanIds: ['span-golden'],
    ...overrides,
  };
}

const ORIGINAL = 'The sun rose over the mountains. [span-golden]She remembered everything.[/span-golden] The birds sang.';

describe('patch-integrity', () => {
  it('passes when patch preserves protected spans', () => {
    const patch = 'The sun rose over the mountains. [span-golden]She remembered everything.[/span-golden] The birds sang sweetly.';
    const result = checkPatchIntegrity(makeCtx(), 'W6_polish' as WaveId, ORIGINAL, patch);
    expect(result.pass).toBe(true);
  });

  it('fails when patch modifies a protected span', () => {
    const patch = 'The sun rose over the mountains. [span-golden]She forgot everything.[/span-golden] The birds sang.';
    const result = checkPatchIntegrity(makeCtx(), 'W6_polish' as WaveId, ORIGINAL, patch);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('protected');
  });

  it('fails when patch removes a protected span entirely', () => {
    const patch = 'The sun rose over the mountains. The birds sang.';
    const result = checkPatchIntegrity(makeCtx(), 'W6_polish' as WaveId, ORIGINAL, patch);
    expect(result.pass).toBe(false);
  });

  it('passes when no protected spans exist', () => {
    const ctx = makeCtx({ protectedSpanIds: [] });
    const patch = 'Completely rewritten text.';
    const result = checkPatchIntegrity(ctx, 'W2_craft' as WaveId, ORIGINAL, patch);
    expect(result.pass).toBe(true);
  });

  it('fails when patch is empty', () => {
    const result = checkPatchIntegrity(makeCtx(), 'W2_craft' as WaveId, ORIGINAL, '');
    expect(result.pass).toBe(false);
  });
});
