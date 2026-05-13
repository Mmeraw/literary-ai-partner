import { describe, expect, it } from '@jest/globals';
import { buildPass2aStructuredContext } from '@/lib/evaluation/pipeline/buildPass2aStructuredContext';

describe('buildPass2aStructuredContext prep hardening', () => {
  it('extracts duration anchors for spelled-out quantities and orderings', () => {
    const manuscriptText = [
      'Three years later, Newton returned to the ridge.',
      'After seven years, Rana spoke to Thorander again.',
      'Two years after, Snappy guarded the crossing.',
      'A decade later the herd split and reformed.',
      'Centuries later, the doctrine changed.',
      'A generation later, the old promise was tested.',
    ].join(' ');

    const context = buildPass2aStructuredContext({ manuscriptText });
    const durationAnchors = context.timeline_anchors.filter((a) => a.anchor_type === 'duration');

    expect(durationAnchors.length).toBeGreaterThan(0);
    expect(durationAnchors.map((a) => a.anchor_text.toLowerCase())).toEqual(
      expect.arrayContaining([
        'three years later',
        'after seven years',
        'two years after',
        'a decade later',
        'centuries later',
        'a generation later',
      ]),
    );
  });

  it('keeps timeline anchors non-empty when only spelled-out temporal anchors are present', () => {
    const manuscriptText =
      'One year later the ridge was silent. After eleven years the elders returned. A century later the lake remembered.';

    const context = buildPass2aStructuredContext({ manuscriptText });

    expect(context.timeline_anchors.length).toBeGreaterThan(0);
    expect(context.timeline_anchors.some((a) => a.anchor_type === 'duration')).toBe(true);
  });

  it('preserves apostrophes, hyphens, and non-ASCII names in ledger and scene index matching', () => {
    const manuscriptText =
      "O’Neil met D’Arcy and Sa’id near Méraw Ridge. Jean-Luc joined O’Neil after three years.";

    const context = buildPass2aStructuredContext({ manuscriptText });

    const names = context.character_ledger.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining(["O'Neil", "D'Arcy", "Sa'id", 'Méraw Ridge', 'Jean-Luc']));

    const sceneEntities = context.scene_index[0]?.named_entities ?? [];
    expect(sceneEntities).toEqual(
      expect.arrayContaining(["O'Neil", "D'Arcy", "Sa'id", 'Méraw Ridge', 'Jean-Luc']),
    );
  });
});
