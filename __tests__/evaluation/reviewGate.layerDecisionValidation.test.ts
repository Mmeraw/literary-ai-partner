import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';
import { validateLayerDecisionsForApproval } from '@/lib/evaluation/reviewGate/layerDecisionValidation';

function buildDecision(status: string, comment = 'ok') {
  return { status, comment };
}

function buildValidLayerDecisionSet() {
  return Object.fromEntries(
    STORY_LAYER_KEYS.map((key) => [key, buildDecision('accepted')]),
  );
}

describe('validateLayerDecisionsForApproval', () => {
  it('passes for exactly 9 canonical layer decisions', () => {
    const result = validateLayerDecisionsForApproval(buildValidLayerDecisionSet());
    expect(result).toEqual({ ok: true });
  });

  it('fails when an unknown layer key is included', () => {
    const withUnknown = {
      ...buildValidLayerDecisionSet(),
      fake_layer: buildDecision('accepted'),
    } as Record<string, unknown>;
    delete withUnknown[STORY_LAYER_KEYS[0]];

    const result = validateLayerDecisionsForApproval(withUnknown);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not recognized/i);
    }
  });

  it('fails when status requires comment and comment is blank', () => {
    const invalid = {
      ...buildValidLayerDecisionSet(),
      [STORY_LAYER_KEYS[0]]: { status: 'accepted_with_comment', comment: '   ' },
    };

    const result = validateLayerDecisionsForApproval(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/requires a non-empty comment/i);
    }
  });

  it('fails when status is not part of canonical contract', () => {
    const invalid = {
      ...buildValidLayerDecisionSet(),
      [STORY_LAYER_KEYS[0]]: { status: 'approved', comment: 'x' },
    };

    const result = validateLayerDecisionsForApproval(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid status/i);
    }
  });
});
