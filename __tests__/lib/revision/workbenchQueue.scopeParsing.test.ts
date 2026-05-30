import { __testing } from '@/lib/revision/workbenchQueue';

describe('scopeFromCoordinates', () => {
  const { scopeFromCoordinates } = __testing;

  it.each([
    ['line:12', 'Line'],
    ['passage:ch1:p3', 'Passage'],
    ['scene:market-fight', 'Scene'],
    ['chapter:7', 'Chapter'],
    ['structural:arc-midpoint', 'Structural'],
    ['manuscript:global', 'Manuscript'],
  ] as const)('maps %s -> %s', (coordinates, expected) => {
    expect(scopeFromCoordinates(coordinates)).toBe(expected);
  });

  it('falls back safely for malformed coordinates', () => {
    expect(scopeFromCoordinates('unknown')).toBe('Passage');
    expect(scopeFromCoordinates('totally malformed coordinates')).toBe('Passage');
    expect(scopeFromCoordinates('xchapter:12')).toBe('Passage');
  });

  it('does not misclassify by substring matches', () => {
    expect(scopeFromCoordinates('note:this mentions manuscript but is not typed')).toBe('Passage');
    expect(scopeFromCoordinates('meta:chapter-like wording only')).toBe('Passage');
  });
});
