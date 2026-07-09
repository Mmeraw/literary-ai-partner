/**
 * Unit tests — deterministic three-part length policy (lib/config/lengthPolicy).
 *
 * Proves:
 *   1. Every policy satisfies MIN <= BASE <= CAP and CAP = BASE + OVERAGE.
 *   2. There are NO percentages: bounds are literal integers only.
 *   3. evaluateLength() returns below_min / ok / above_cap by hard comparison.
 *   4. The three synopsis tiers map to Mike's 150 / 450 / 750 targets.
 *   5. A 40-word pitch is valid (min 25, cap 75).
 */

import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
  SYNOPSIS_POLICY,
  SECTION_POLICY,
  evaluateLength,
  countWords,
  type LengthPolicy,
} from '../lengthPolicy';

const ALL_POLICIES: Array<[string, LengthPolicy]> = [
  ['summary', SUMMARY_POLICY],
  ['one_sentence_pitch', ONE_SENTENCE_PITCH_POLICY],
  ['one_paragraph_pitch', ONE_PARAGRAPH_PITCH_POLICY],
  ['synopsis.short', SYNOPSIS_POLICY.short],
  ['synopsis.medium', SYNOPSIS_POLICY.medium],
  ['synopsis.long', SYNOPSIS_POLICY.long],
  ['query_letter', SECTION_POLICY.query_letter],
  ['what_makes_unique', SECTION_POLICY.what_makes_unique],
  ['query_pitch', SECTION_POLICY.query_pitch],
  ['comparables', SECTION_POLICY.comparables],
  ['author_bio', SECTION_POLICY.author_bio],
];

describe('length policy — structural invariants', () => {
  it.each(ALL_POLICIES)('%s satisfies min <= base <= cap and cap = base + overage', (_name, p) => {
    expect(p.min).toBeLessThanOrEqual(p.base);
    expect(p.base).toBeLessThanOrEqual(p.cap);
    expect(p.cap).toBe(p.base + p.overage);
  });

  it.each(ALL_POLICIES)('%s uses whole integers only (no fractional/percentage bounds)', (_name, p) => {
    for (const v of [p.min, p.base, p.overage, p.cap]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('synopsis tiers map to 150 / 450 / 750 targets', () => {
  it('short base is 150 words', () => expect(SYNOPSIS_POLICY.short.base).toBe(150));
  it('medium base is 450 words', () => expect(SYNOPSIS_POLICY.medium.base).toBe(450));
  it('long base is 750 words', () => expect(SYNOPSIS_POLICY.long.base).toBe(750));
  it('all three are word-measured', () => {
    expect(SYNOPSIS_POLICY.short.unit).toBe('words');
    expect(SYNOPSIS_POLICY.medium.unit).toBe('words');
    expect(SYNOPSIS_POLICY.long.unit).toBe('words');
  });
});

describe('evaluateLength — deterministic verdicts', () => {
  it('flags below_min when under the floor', () => {
    const short = 'word '.repeat(SUMMARY_POLICY.min - 10 > 0 ? 5 : 5); // few chars
    expect(evaluateLength('short', SUMMARY_POLICY).status).toBe('below_min');
  });

  it('passes ok inside the band (over base, under cap)', () => {
    // 900-char summary: over base 750, under cap 1000 → ok
    const text = 'x'.repeat(900);
    expect(evaluateLength(text, SUMMARY_POLICY).status).toBe('ok');
  });

  it('flags above_cap when over the hard ceiling', () => {
    const text = 'x'.repeat(SUMMARY_POLICY.cap + 50);
    expect(evaluateLength(text, SUMMARY_POLICY).status).toBe('above_cap');
  });

  it('a 40-word query pitch is valid (min 25, cap 75)', () => {
    const pitch = Array(40).fill('word').join(' ');
    expect(countWords(pitch)).toBe(40);
    expect(evaluateLength(pitch, SECTION_POLICY.query_pitch).status).toBe('ok');
  });

  it('a 20-word query pitch is below the 25-word floor', () => {
    const pitch = Array(20).fill('word').join(' ');
    expect(evaluateLength(pitch, SECTION_POLICY.query_pitch).status).toBe('below_min');
  });
});
