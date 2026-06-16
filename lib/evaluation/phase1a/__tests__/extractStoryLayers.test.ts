import { describe, it, expect } from 'vitest';
import { extractStoryLayers } from '@/lib/evaluation/phase1a/storyLayerArtifactWriters';
import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';

type StoryLayerExtractionFailure = Extract<ReturnType<typeof extractStoryLayers>, { ok: false }>;

/**
 * Regression tests for extractStoryLayers().
 *
 * PR #890 introduced a short-form auto-approval path that checked for
 * `storyLayerPayload.layers`, but buildStoryLayerFromLedger() returns
 * a flat object with 10 top-level canonical keys — no `.layers` wrapper.
 * This caused every short-form eval since June 1 to persist
 * `accepted_story_ledger_v1.layers = {}`, starving Pass 3.
 *
 * extractStoryLayers() handles both shapes so both short-form and
 * long-form (kick-forward) paths use one extraction function.
 */

function buildFlatPayload(): Record<string, Record<string, unknown>> {
  const payload: Record<string, Record<string, unknown>> = {};
  for (const key of STORY_LAYER_KEYS) {
    payload[key] = { diagnostic: `data for ${key}`, score: 42 };
  }
  return payload;
}

function buildWrappedPayload(): { layers: Record<string, Record<string, unknown>> } {
  return { layers: buildFlatPayload() };
}

function expectExtractionFailure(result: ReturnType<typeof extractStoryLayers>): StoryLayerExtractionFailure {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  return result as StoryLayerExtractionFailure;
}

describe('extractStoryLayers', () => {
  describe('flat shape (buildStoryLayerFromLedger return value)', () => {
    it('should extract all 10 canonical layer keys', () => {
      const result = extractStoryLayers(buildFlatPayload());

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.shape).toBe('flat');
      expect(Object.keys(result.layers).length).toBe(STORY_LAYER_KEYS.length);
      for (const key of STORY_LAYER_KEYS) {
        expect(result.layers[key]).toBeDefined();
        expect(typeof result.layers[key]).toBe('object');
      }
      expect(result.missing_keys).toEqual([]);
    });

    it('should detect missing keys in partial flat payload', () => {
      const partial = buildFlatPayload();
      delete partial.threat_antagonist_ending_layer;
      delete partial.object_symbol_layer;

      const result = extractStoryLayers(partial);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.shape).toBe('flat');
      expect(Object.keys(result.layers).length).toBe(7);
      expect(result.missing_keys).toContain('threat_antagonist_ending_layer');
      expect(result.missing_keys).toContain('object_symbol_layer');
    });
  });

  describe('wrapped shape (persisted artifact content)', () => {
    it('should extract all 10 canonical layer keys from .layers', () => {
      const result = extractStoryLayers(buildWrappedPayload());

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.shape).toBe('wrapped');
      expect(Object.keys(result.layers).length).toBe(STORY_LAYER_KEYS.length);
      for (const key of STORY_LAYER_KEYS) {
        expect(result.layers[key]).toBeDefined();
        expect(typeof result.layers[key]).toBe('object');
      }
      expect(result.missing_keys).toEqual([]);
    });

    it('should detect missing keys in partial wrapped payload', () => {
      const wrapped = buildWrappedPayload();
      delete wrapped.layers.source_integrity_layer;

      const result = extractStoryLayers(wrapped);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.shape).toBe('wrapped');
      expect(Object.keys(result.layers).length).toBe(8);
      expect(result.missing_keys).toContain('source_integrity_layer');
    });
  });

  describe('malformed / empty payloads → failure, not silent {}', () => {
    it('should reject null input', () => {
      const result = extractStoryLayers(null);
      expect(expectExtractionFailure(result).reason).toContain('null/undefined');
    });

    it('should reject undefined input', () => {
      const result = extractStoryLayers(undefined);
      expect(expectExtractionFailure(result).reason).toContain('null/undefined');
    });

    it('should reject empty object', () => {
      const result = extractStoryLayers({});
      expect(expectExtractionFailure(result).reason).toContain('no .layers key and no canonical layer keys');
    });

    it('should reject wrapped shape with empty layers (the PR #890 bug)', () => {
      const result = extractStoryLayers({ layers: {} });
      expect(expectExtractionFailure(result).reason).toContain('layers object is empty');
    });

    it('should reject object with unrecognized keys only', () => {
      const result = extractStoryLayers({ foo: 'bar', baz: 123 });
      expect(expectExtractionFailure(result).reason).toContain('no .layers key and no canonical layer keys');
    });

    it('should reject flat payload where canonical keys have non-object values', () => {
      const badPayload: Record<string, unknown> = {};
      for (const key of STORY_LAYER_KEYS) {
        badPayload[key] = 'string_not_object';
      }

      const result = extractStoryLayers(badPayload);
      expect(expectExtractionFailure(result).reason).toContain('no valid layer objects extracted');
    });

    it('should reject array input', () => {
      const result = extractStoryLayers([1, 2, 3]);
      // Arrays are objects but won't have canonical keys
      expect(result.ok).toBe(false);
    });
  });

  describe('canonical key count must be exactly 10', () => {
    it('STORY_LAYER_KEYS has exactly 10 entries', () => {
      expect(STORY_LAYER_KEYS.length).toBe(10);
    });

    it('full flat payload produces 10 layers with 0 missing', () => {
      const result = extractStoryLayers(buildFlatPayload());
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(Object.keys(result.layers).length).toBe(STORY_LAYER_KEYS.length);
      expect(result.missing_keys.length).toBe(0);
    });

    it('full wrapped payload produces 10 layers with 0 missing', () => {
      const result = extractStoryLayers(buildWrappedPayload());
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(Object.keys(result.layers).length).toBe(STORY_LAYER_KEYS.length);
      expect(result.missing_keys.length).toBe(0);
    });
  });
});
