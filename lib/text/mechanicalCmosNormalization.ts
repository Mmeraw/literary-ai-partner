import {
  capitalizeFirstAlpha,
  collapseAdjacentDuplicateWords,
  ensureSingleSpaceAfterColon,
  ensureTerminalPunctuation,
  normalizeDuplicateCloseQuotes,
} from './authorFacingProse';

export type MechanicalCmosNormalizationCode =
  | 'CMOS_NORMALIZE_WHITESPACE'
  | 'CMOS_COLLAPSE_DUPLICATE_WORD'
  | 'CMOS_CAPITALIZE_OPENING'
  | 'CMOS_CAPITALIZE_SENTENCE_START'
  | 'CMOS_SPACE_AFTER_COLON'
  | 'CMOS_REMOVE_SPACE_BEFORE_PUNCTUATION'
  | 'CMOS_ADD_SPACE_AFTER_PUNCTUATION'
  | 'CMOS_COLLAPSE_REPEATED_PUNCTUATION'
  | 'CMOS_REPLACE_DOUBLE_HYPHEN'
  | 'CMOS_REPAIR_NUMBERED_LIST_MARKER'
  | 'CMOS_NORMALIZE_DUPLICATE_CLOSE_QUOTE'
  | 'CMOS_ENSURE_TERMINAL_PUNCTUATION';

export interface MechanicalCmosMutation {
  code: MechanicalCmosNormalizationCode;
  changeCount: number;
}

export interface MechanicalCmosNormalizationOptions {
  ensureTerminalPunctuation?: boolean;
}

export interface MechanicalCmosNormalizationResult {
  value: string;
  mutations: MechanicalCmosMutation[];
}

const COMMON_ABBREVIATIONS = new Set([
  'a.m.',
  'p.m.',
  'e.g.',
  'i.e.',
  'etc.',
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'sr.',
  'jr.',
  'st.',
  'vs.',
  'no.',
  'fig.',
  'vol.',
  'pp.',
]);

function recordMutation(
  mutations: MechanicalCmosMutation[],
  code: MechanicalCmosNormalizationCode,
  count: number,
): void {
  if (count <= 0) return;
  const existing = mutations.find((mutation) => mutation.code === code);
  if (existing) {
    existing.changeCount += count;
  } else {
    mutations.push({ code, changeCount: count });
  }
}

function applyTransform(
  value: string,
  mutations: MechanicalCmosMutation[],
  code: MechanicalCmosNormalizationCode,
  transform: (input: string) => string,
): string {
  const next = transform(value);
  if (next !== value) recordMutation(mutations, code, 1);
  return next;
}

function isAbbreviationBoundary(text: string, periodIndex: number): boolean {
  const prefix = text.slice(0, periodIndex + 1).toLowerCase();
  for (const abbreviation of COMMON_ABBREVIATIONS) {
    if (prefix.endsWith(abbreviation)) return true;
  }

  // Preserve initials and initialisms such as “J. R. R. Tolkien” and “U.S. policy.”
  if (/(?:^|\s)(?:[a-z]\.){1,4}$/iu.test(prefix)) return true;
  return false;
}

function capitalizeSentenceStarts(text: string): { value: string; count: number } {
  if (!text) return { value: text, count: 0 };

  let output = '';
  let cursor = 0;
  let count = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (!/[.!?]/u.test(char)) continue;
    if (char === '.' && isAbbreviationBoundary(text, i)) continue;

    let next = i + 1;
    while (next < text.length && /["'”’\)\]]/u.test(text[next])) next += 1;
    if (next >= text.length || !/\s/u.test(text[next])) continue;
    while (next < text.length && /\s/u.test(text[next])) next += 1;
    if (next >= text.length || !/[a-z]/u.test(text[next])) continue;

    output += text.slice(cursor, next) + text[next].toUpperCase();
    cursor = next + 1;
    count += 1;
    i = next;
  }

  if (count === 0) return { value: text, count: 0 };
  output += text.slice(cursor);
  return { value: output, count };
}

function normalizeWhitespace(text: string): { value: string; count: number } {
  let count = 0;
  const value = text
    .replace(/\r\n?/g, () => {
      count += 1;
      return '\n';
    })
    .replace(/[ \t]+/g, (match) => {
      if (match.length > 1 || match !== ' ') count += 1;
      return ' ';
    })
    .replace(/(?<!\n)\n(?!\n)/g, () => {
      count += 1;
      return ' ';
    })
    .replace(/\n{3,}/g, (match) => {
      count += Math.max(1, match.length - 2);
      return '\n\n';
    })
    .trim();
  return { value, count: value === text ? 0 : Math.max(1, count) };
}

function removeSpaceBeforePunctuation(text: string): { value: string; count: number } {
  let count = 0;
  const value = text.replace(/\s+([,:;.!?])(?!\.)/gu, (_match, punctuation: string) => {
    count += 1;
    return punctuation;
  });
  return { value, count };
}

function addSpaceAfterPunctuation(text: string): { value: string; count: number } {
  let count = 0;
  const value = text.replace(/([,;:])(?=[\p{L}])/gu, (_match, punctuation: string) => {
    count += 1;
    return `${punctuation} `;
  });
  return { value, count };
}

function collapseRepeatedPunctuation(text: string): { value: string; count: number } {
  let count = 0;
  const value = text.replace(/(?:,,+|;;+|::+|!!+|\?\?+|\.!|!\.|\?\.|\.\?)/gu, (match) => {
    count += 1;
    if (match.includes('!')) return '!';
    if (match.includes('?')) return '?';
    return match[0];
  });
  return { value, count };
}

function replaceDoubleHyphen(text: string): { value: string; count: number } {
  let count = 0;
  const value = text.replace(/\s*--+\s*/gu, () => {
    count += 1;
    return '—';
  });
  return { value, count };
}

function repairNumberedListMarkers(text: string): { value: string; count: number } {
  let count = 0;
  const value = text.replace(
    /(^|\n)(\s*)(\d+)(?:\s*([.)]))?\s*(?:-|–|—)(?:-|–|—)*\s*/gu,
    (_match, lineStart: string, indent: string, number: string, marker?: string) => {
      count += 1;
      return `${lineStart}${indent}${number}${marker === ')' ? ')' : '.'} `;
    },
  );
  return { value, count };
}

/**
 * Apply the complete catalog of mechanically safe CMOS repairs used before the
 * author-facing integrity gate. The function is pure and idempotent. It never
 * stores or returns raw before/after mutation evidence; callers receive only
 * normalization codes and change counts.
 */
export function normalizeMechanicalCmos(
  text: string,
  options: MechanicalCmosNormalizationOptions = {},
): MechanicalCmosNormalizationResult {
  const mutations: MechanicalCmosMutation[] = [];
  let value = text;

  const whitespace = normalizeWhitespace(value);
  value = whitespace.value;
  recordMutation(mutations, 'CMOS_NORMALIZE_WHITESPACE', whitespace.count);

  value = applyTransform(
    value,
    mutations,
    'CMOS_COLLAPSE_DUPLICATE_WORD',
    collapseAdjacentDuplicateWords,
  );
  value = applyTransform(value, mutations, 'CMOS_CAPITALIZE_OPENING', capitalizeFirstAlpha);

  const sentenceStarts = capitalizeSentenceStarts(value);
  value = sentenceStarts.value;
  recordMutation(mutations, 'CMOS_CAPITALIZE_SENTENCE_START', sentenceStarts.count);

  value = applyTransform(value, mutations, 'CMOS_SPACE_AFTER_COLON', ensureSingleSpaceAfterColon);

  const beforePunctuation = removeSpaceBeforePunctuation(value);
  value = beforePunctuation.value;
  recordMutation(mutations, 'CMOS_REMOVE_SPACE_BEFORE_PUNCTUATION', beforePunctuation.count);

  const afterPunctuation = addSpaceAfterPunctuation(value);
  value = afterPunctuation.value;
  recordMutation(mutations, 'CMOS_ADD_SPACE_AFTER_PUNCTUATION', afterPunctuation.count);

  const repeatedPunctuation = collapseRepeatedPunctuation(value);
  value = repeatedPunctuation.value;
  recordMutation(mutations, 'CMOS_COLLAPSE_REPEATED_PUNCTUATION', repeatedPunctuation.count);

  const doubleHyphen = replaceDoubleHyphen(value);
  value = doubleHyphen.value;
  recordMutation(mutations, 'CMOS_REPLACE_DOUBLE_HYPHEN', doubleHyphen.count);

  const listMarkers = repairNumberedListMarkers(value);
  value = listMarkers.value;
  recordMutation(mutations, 'CMOS_REPAIR_NUMBERED_LIST_MARKER', listMarkers.count);

  value = applyTransform(
    value,
    mutations,
    'CMOS_NORMALIZE_DUPLICATE_CLOSE_QUOTE',
    normalizeDuplicateCloseQuotes,
  );

  if (options.ensureTerminalPunctuation) {
    value = applyTransform(
      value,
      mutations,
      'CMOS_ENSURE_TERMINAL_PUNCTUATION',
      ensureTerminalPunctuation,
    );
  }

  return { value, mutations };
}
