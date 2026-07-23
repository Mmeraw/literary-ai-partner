import { normalizeMechanicalCmos } from '@/lib/text/mechanicalCmosNormalization';

describe('normalizeMechanicalCmos', () => {
  test.each([
    ['lowercase opening', 'the opening works.', 'The opening works.', 'CMOS_CAPITALIZE_OPENING'],
    ['lowercase sentence start after period', 'The opening works. then Kim arrives.', 'The opening works. Then Kim arrives.', 'CMOS_CAPITALIZE_SENTENCE_START'],
    ['lowercase sentence start after question mark', 'Does it work? yes, it does.', 'Does it work? Yes, it does.', 'CMOS_CAPITALIZE_SENTENCE_START'],
    ['lowercase sentence start after exclamation point', 'It works! now continue.', 'It works! Now continue.', 'CMOS_CAPITALIZE_SENTENCE_START'],
    ['repeated whitespace', 'The  opening\tworks.', 'The opening works.', 'CMOS_NORMALIZE_WHITESPACE'],
    ['space before punctuation', 'The opening works , clearly.', 'The opening works, clearly.', 'CMOS_REMOVE_SPACE_BEFORE_PUNCTUATION'],
    ['missing space after punctuation', 'The opening works,but slowly.', 'The opening works, but slowly.', 'CMOS_ADD_SPACE_AFTER_PUNCTUATION'],
    ['repeated punctuation', 'The opening works!!', 'The opening works!', 'CMOS_COLLAPSE_REPEATED_PUNCTUATION'],
    ['double hyphen', 'The opening--not the ending--works.', 'The opening—not the ending—works.', 'CMOS_REPLACE_DOUBLE_HYPHEN'],
    ['malformed numbered list marker', '1- Revise the opening.', '1. Revise the opening.', 'CMOS_REPAIR_NUMBERED_LIST_MARKER'],
    ['malformed parenthetical list marker', '1)—Revise the opening.', '1) Revise the opening.', 'CMOS_REPAIR_NUMBERED_LIST_MARKER'],
    ['safe duplicate word', 'Revise the the opening.', 'Revise the opening.', 'CMOS_COLLAPSE_DUPLICATE_WORD'],
  ])('%s', (_name, input, expected, code) => {
    const result = normalizeMechanicalCmos(input);
    expect(result.value).toBe(expected);
    expect(result.mutations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, changeCount: expect.any(Number) })]),
    );
  });

  test('normalizes the full safe catalog in one centralized pass', () => {
    const result = normalizeMechanicalCmos(
      '  the  opening--not the ending--works ,but then fails!! then revise it.\n1- fix the the ending  ',
      { ensureTerminalPunctuation: true },
    );

    expect(result.value).toBe(
      'The opening—not the ending—works, but then fails! Then revise it. 1. Fix the ending.',
    );
    expect(result.mutations.map((mutation) => mutation.code)).toEqual(
      expect.arrayContaining([
        'CMOS_NORMALIZE_WHITESPACE',
        'CMOS_COLLAPSE_DUPLICATE_WORD',
        'CMOS_CAPITALIZE_OPENING',
        'CMOS_CAPITALIZE_SENTENCE_START',
        'CMOS_REMOVE_SPACE_BEFORE_PUNCTUATION',
        'CMOS_ADD_SPACE_AFTER_PUNCTUATION',
        'CMOS_COLLAPSE_REPEATED_PUNCTUATION',
        'CMOS_REPLACE_DOUBLE_HYPHEN',
        'CMOS_REPAIR_NUMBERED_LIST_MARKER',
        'CMOS_ENSURE_TERMINAL_PUNCTUATION',
      ]),
    );
  });

  test('is idempotent and emits no second-pass mutations', () => {
    const first = normalizeMechanicalCmos('the opening works. then Kim arrives.');
    const second = normalizeMechanicalCmos(first.value);

    expect(second.value).toBe(first.value);
    expect(second.mutations).toEqual([]);
  });

  test('does not capitalize after common abbreviations or initials', () => {
    const input = 'The note uses e.g. lowercase examples. J. R. R. Tolkien remains intact.';
    const result = normalizeMechanicalCmos(input);

    expect(result.value).toBe(input);
    expect(result.mutations).toEqual([]);
  });

  test('records only code and count, never raw before/after prose', () => {
    const result = normalizeMechanicalCmos('the  opening works.');

    for (const mutation of result.mutations) {
      expect(Object.keys(mutation).sort()).toEqual(['changeCount', 'code']);
      expect(mutation).not.toHaveProperty('before');
      expect(mutation).not.toHaveProperty('after');
      expect(mutation).not.toHaveProperty('value');
    }
  });

  test('leaves unsafe or ambiguous defects for the integrity validator', () => {
    const input = 'The opening trails off…';
    const result = normalizeMechanicalCmos(input);

    expect(result.value).toBe(input);
    expect(result.mutations).toEqual([]);
  });
});
