/**
 * Tests for Pass 3 semantic normalization contract.
 *
 * Exercises the normalizers in recommendationSemantics.ts directly.
 * These are the helpers wired into runPass3Synthesis at the parse boundary.
 *
 * Required-field enforcement (missing issue_family, submission_readiness) is
 * tested via the e2e contract suite in pipeline-e2e.test.ts.
 */

import { normalizeIssueFamily, normalizeStrategicLever, normalizeRevisionGranularity, buildRedundancyKey } from '../recommendationSemantics';

describe('normalizeIssueFamily', () => {
  it('passes through canonical values', () => {
    expect(normalizeIssueFamily('pacing')).toBe('pacing');
    expect(normalizeIssueFamily('voice')).toBe('voice');
    expect(normalizeIssueFamily('market_positioning')).toBe('market_positioning');
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeIssueFamily('PACING')).toBe('pacing');
    expect(normalizeIssueFamily('  voice  ')).toBe('voice');
  });

  it('normalizes variants to canonical', () => {
    expect(normalizeIssueFamily('prose')).toBe('prose_control');
    expect(normalizeIssueFamily('style')).toBe('prose_control');
    expect(normalizeIssueFamily('structure')).toBe('scene_structure');
    expect(normalizeIssueFamily('market')).toBe('market_positioning');
    expect(normalizeIssueFamily('marketability')).toBe('market_positioning');
    expect(normalizeIssueFamily('grammar')).toBe('prose_control');
  });

  it('returns undefined for non-string or unknown input', () => {
    expect(normalizeIssueFamily(null)).toBeUndefined();
    expect(normalizeIssueFamily(123)).toBeUndefined();
    expect(normalizeIssueFamily('invalid_unknown_category')).toBeUndefined();
  });
});

describe('normalizeStrategicLever', () => {
  it('passes through canonical values', () => {
    expect(normalizeStrategicLever('momentum_visibility')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('prose_compression')).toBe('prose_compression');
  });

  it('normalizes momentum-related phrasings', () => {
    expect(normalizeStrategicLever('forward momentum')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('vary rhythm')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('interleave action')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('increase momentum')).toBe('momentum_visibility');
  });

  it('normalizes dialogue-related phrasings', () => {
    expect(normalizeStrategicLever('on the nose dialogue')).toBe('dialogue_exposition_density');
    expect(normalizeStrategicLever('reduce exposition in dialogue')).toBe(
      'dialogue_exposition_density',
    );
  });

  it('normalizes prose/tension phrasings', () => {
    expect(normalizeStrategicLever('cut wordiness')).toBe('prose_compression');
    expect(normalizeStrategicLever('escalate tension')).toBe('tension_escalation');
    expect(normalizeStrategicLever('raise stakes')).toBe('tension_escalation');
  });

  it('returns undefined for non-string or unknown input', () => {
    expect(normalizeStrategicLever(null)).toBeUndefined();
    expect(normalizeStrategicLever('unknown_lever_xyz')).toBeUndefined();
  });
});

describe('normalizeRevisionGranularity', () => {
  it('passes through canonical values', () => {
    expect(normalizeRevisionGranularity('line')).toBe('line');
    expect(normalizeRevisionGranularity('scene')).toBe('scene');
    expect(normalizeRevisionGranularity('manuscript')).toBe('manuscript');
  });

  it('normalizes variants to canonical levels', () => {
    expect(normalizeRevisionGranularity('word')).toBe('line');
    expect(normalizeRevisionGranularity('sentence')).toBe('line');
    expect(normalizeRevisionGranularity('paragraph')).toBe('beat');
    expect(normalizeRevisionGranularity('block')).toBe('beat');
    expect(normalizeRevisionGranularity('chapter')).toBe('chapter');
    expect(normalizeRevisionGranularity('section')).toBe('chapter');
    expect(normalizeRevisionGranularity('book')).toBe('manuscript');
    expect(normalizeRevisionGranularity('full')).toBe('manuscript');
  });

  it('returns undefined for non-string or unknown input', () => {
    expect(normalizeRevisionGranularity(null)).toBeUndefined();
    expect(normalizeRevisionGranularity('unknown_level')).toBeUndefined();
  });
});

describe('buildRedundancyKey', () => {
  it('builds deterministic key from three fields', () => {
    const key = buildRedundancyKey('pacing', 'momentum_visibility', 'scene');
    expect(key).toBe('pacing:momentum_visibility:scene');
  });

  it('handles undefined fields gracefully', () => {
    const key1 = buildRedundancyKey(undefined, 'momentum_visibility', 'scene');
    expect(key1).toBe('unknown:momentum_visibility:scene');

    const key2 = buildRedundancyKey('pacing', undefined, undefined);
    expect(key2).toBe('pacing:unknown:unknown');
  });

  it('is stable across calls', () => {
    const key1 = buildRedundancyKey('pacing', 'momentum_visibility', 'scene');
    const key2 = buildRedundancyKey('pacing', 'momentum_visibility', 'scene');
    expect(key1).toBe(key2);
  });
});

