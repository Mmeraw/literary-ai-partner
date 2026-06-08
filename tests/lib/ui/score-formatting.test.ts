import {
  floorScoreForDisplay,
  formatScoreForDisplay,
  formatScoreFractionForDisplay,
  formatSignedScoreForDisplay,
} from '@/lib/ui/score-formatting';

describe('score display formatting', () => {
  it('floors numeric scores without rounding upward', () => {
    expect(floorScoreForDisplay(9.9)).toBe(9);
    expect(floorScoreForDisplay(0.9)).toBe(0);
    expect(formatScoreForDisplay(64.9)).toBe('64');
  });

  it('floors numeric string scores without rounding upward', () => {
    expect(formatScoreForDisplay('7.9')).toBe('7');
    expect(formatScoreForDisplay(' 0.9 ')).toBe('0');
  });

  it('formats score fractions with floored numerator only', () => {
    expect(formatScoreFractionForDisplay(7.9, 10)).toBe('7/10');
    expect(formatScoreFractionForDisplay(64.9, 100)).toBe('64/100');
  });

  it('supports signed score deltas without decimals', () => {
    expect(formatSignedScoreForDisplay(2.9)).toBe('+2');
    expect(formatSignedScoreForDisplay(-0.1)).toBe('-1');
    expect(formatSignedScoreForDisplay(0.9)).toBe('0');
  });

  it('uses fallbacks for missing or non-finite scores', () => {
    expect(formatScoreForDisplay(null)).toBe('—');
    expect(formatScoreForDisplay(Number.NaN, 'N/A')).toBe('N/A');
    expect(formatScoreFractionForDisplay(undefined, 10, 'Not scored')).toBe('Not scored/10');
  });
});
