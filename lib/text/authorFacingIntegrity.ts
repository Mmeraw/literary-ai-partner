import { detectRawFallbackSentinel, endsMidSentence } from './authorFacingProse';
import { isInternalNonRenderableFieldPath } from './authorFacingInternalFieldRegistry';

export type AuthorFacingIntegrityCode =
  | 'AUTHOR_TEXT_TRUNCATED_WORD'
  | 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION'
  | 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS'
  | 'AUTHOR_TEXT_PLACEHOLDER'
  | 'AUTHOR_TEXT_FALLBACK_SENTINEL'
  | 'AUTHOR_TEXT_UNBALANCED_DELIMITER'
  | 'AUTHOR_TEXT_LOWERCASE_START'
  | 'AUTHOR_TEXT_LOWERCASE_SENTENCE_START'
  | 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'
  | 'AUTHOR_TEXT_SPACE_BEFORE_PUNCTUATION'
  | 'AUTHOR_TEXT_MISSING_SPACE_AFTER_PUNCTUATION'
  | 'AUTHOR_TEXT_REPEATED_PUNCTUATION'
  | 'AUTHOR_TEXT_DOUBLE_HYPHEN'
  | 'AUTHOR_TEXT_REPEATED_WHITESPACE'
  | 'AUTHOR_TEXT_DUPLICATE_WORD';

export interface AuthorFacingIntegrityViolation {
  code: AuthorFacingIntegrityCode;
  path: string;
  value: string;
  message: string;
}

export interface AuthorFacingIntegrityOptions {
  rootPath?: string;
  excludePathFragments?: string[];
  inspectSourceQuotations?: boolean;
}

const DEFAULT_EXCLUDED_PATH_FRAGMENTS = [
  '.ids.', '.engine.', '.metrics.processing.', '.artifacts.', '.generated_at',
  '.created_at', '.schema_version', '.artifact_id', '.job_id', '.user_id',
  '.manuscript_id', '.project_id', '.evaluation_run_id', '.source_hash',
  '.prompt_version', '.policy_family', '.repro_anchor', '.manuscript_coordinates',
  '.criterion_key', '.key', '.status', '.verdict', '.effort', '.impact',
  '.priority', '.confidence_label', '.confidence_reasons',
];

const SOURCE_QUOTATION_FRAGMENTS = [
  '.evidence.', '.snippet', '.anchor_snippet', '.original_passage', '.manuscript_excerpt',
];

const PLACEHOLDER_PATTERNS = [
  /\[insert\b/i, /\bTBD\b/, /lorem ipsum/i, /\bplaceholder\b/i,
  /\bundefined\b/i, /\bnull\b/i,
];

// Author-facing scope is determined by semantic field names, never by an
// arbitrary character-count threshold. Singular and plural forms are both
// explicit so arrays such as top_3_strengths and top_3_risks are inspected.
const AUTHOR_TEXT_KEY_PATTERN = /(?:summar(?:y|ies)|pitch(?:es)?|strengths?|risks?|rationales?|recommendations?|actions?|why|mechanisms?|specific_fix(?:es)?|reader_effects?|expected_impacts?|symptoms?|causes?|fix_directions?|candidate_text(?:_[abc]|s)?|premises?|audiences?|warnings?|limitations?|reasons?|descriptions?|diagnoses?|guidance|bios?|queries|synopses|letters?|stories|revisions?|markets?|positions?|copy|notes?|titles?|headings?|headers?|labels?)$/i;

// These fields are intentionally rendered as labeled phrases or fragments, not
// standalone sentences. They still receive every structural integrity check
// (ellipsis, placeholder, delimiter, spacing, punctuation, duplicate words),
// but are not forced through terminal punctuation.
const PHRASE_ALLOWED_KEY_PATTERN = /(?:strengths?|risks?|titles?|headings?|headers?|labels?|mechanisms?|specific_fix(?:es)?|reader_effects?)$/i;
const RECOMMENDATION_FRAGMENT_KEY_PATTERN = /(?:symptoms?|causes?|rationales?|fix_directions?)$/i;

// Recommendation fields that are explicitly sentence fragments may start with a
// lowercase letter; all other author-facing fields must begin with a capital.
const FRAGMENT_KEY_PATTERN = /(?:mechanisms?|specific_fix(?:es)?|reader_effects?)$/i;
const TERMINAL_PUNCTUATION = /[.!?]["'”’)\]]*$/u;
const TRUNCATION_ELLIPSIS = /(?:\.\.\.|…)/u;

/**
 * RG-CMOS-4: malformed numbered-list markers are forbidden.
 *
 * This intentionally targets line/list starts so valid dates and ranges such as
 * "2026-07-14" and "2026–2027" are not misclassified. Invalid examples:
 * 1- Text, 1.- Text, 1.– Text, 1.— Text, 1.-- Text, and 1)— Text.
 */
const NUMBER_DASH_SEQUENCE = /(?:^|\n)\s*\d+(?:\s*[.)])?\s*(?:-|–|—)(?:-|–|—)*/u;
const SPACE_BEFORE_PUNCTUATION = /\s+[,:;.!?](?!\.)/u;
const MISSING_SPACE_AFTER_PUNCTUATION = /[,;:](?=[\p{L}])/u;
const REPEATED_PUNCTUATION = /(?:,,|;;|::|!!|\?\?|\.!|!\.|\?\.|\.\?)/u;
const DOUBLE_HYPHEN = /--/u;
const REPEATED_HORIZONTAL_WHITESPACE = /[^\n][ \t]{2,}[^\n]/u;

function hasLowercaseAfterSentence(text: string): boolean {
  const s = text;
  const stack: string[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '“': '”', '‘': '’', '"': '"', "'": "'" };
  const openChars = new Set(Object.keys(pairs));

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];

    if (openChars.has(ch)) {
      stack.push(ch);
      continue;
    }

    const top = stack[stack.length - 1];
    if (top && ch === pairs[top]) {
      stack.pop();
      continue;
    }

    if (stack.length === 0 && /[.!?]/u.test(ch)) {
      let j = i + 1;
      while (j < s.length && /["'”’)\]]/u.test(s[j])) j += 1;
      while (j < s.length && /\s/u.test(s[j])) j += 1;
      if (j < s.length && /[a-z]/u.test(s[j])) {
        return true;
      }
    }
  }
  return false;
}

const DUPLICATE_WORD = /\b([A-Za-z]{2,})\s+\1\b/iu;

export function isExcludedPath(path: string, options: AuthorFacingIntegrityOptions = {}): boolean {
  // Provenance contracts are classified centrally, rather than skipped ad hoc
  // by a caller. These values remain available to internal lineage gates but
  // are never author-facing prose.
  if (isInternalNonRenderableFieldPath(path)) return true;
  const fragments = [...DEFAULT_EXCLUDED_PATH_FRAGMENTS, ...(options.excludePathFragments ?? [])];
  if (fragments.some((fragment) => path.includes(fragment))) return true;
  if (!options.inspectSourceQuotations && SOURCE_QUOTATION_FRAGMENTS.some((fragment) => path.includes(fragment))) return true;
  return false;
}

function leafKey(path: string): string {
  return path.replace(/\[\d+\]$/u, '').split('.').pop() ?? path;
}

export function isAuthorTextPath(path: string): boolean {
  return AUTHOR_TEXT_KEY_PATTERN.test(leafKey(path));
}

function isRecommendationFragmentPath(path: string): boolean {
  return path.includes('.recommendations[') && RECOMMENDATION_FRAGMENT_KEY_PATTERN.test(leafKey(path));
}

function isPhraseAllowedPath(path: string): boolean {
  return PHRASE_ALLOWED_KEY_PATTERN.test(leafKey(path)) || isRecommendationFragmentPath(path);
}

function isFragmentPath(path: string): boolean {
  return FRAGMENT_KEY_PATTERN.test(leafKey(path)) || isRecommendationFragmentPath(path) || leafKey(path) === 'gap_summary';
}

function requiresCompleteSentence(path: string): boolean {
  if (isPhraseAllowedPath(path)) return false;
  return isAuthorTextPath(path);
}

function hasUnbalancedDelimiters(value: string): boolean {
  const delimiterInput = value.replace(/^\s*\d+\)\s+/u, '');
  const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']];
  for (const [open, close] of pairs) {
    let depth = 0;
    for (const char of delimiterInput) {
      if (char === open) depth += 1;
      if (char === close) depth -= 1;
      if (depth < 0) return true;
    }
    if (depth !== 0) return true;
  }

  if ((delimiterInput.match(/"/g) ?? []).length % 2 !== 0) return true;
  if ((delimiterInput.match(/“/g) ?? []).length !== (delimiterInput.match(/”/g) ?? []).length) return true;
  return false;
}

function startsWithLowercase(value: string): boolean {
  const body = value.replace(/^\s*\d+[.)]\s+/u, '');
  const first = body.match(/\p{L}/u)?.[0];
  return Boolean(first && first === first.toLocaleLowerCase() && first !== first.toLocaleUpperCase());
}

/**
 * Ellipses inside a balanced quotation are source-preview punctuation, not
 * concealed truncation of the generated editorial sentence. The surrounding
 * prose is still inspected normally, and unquoted ellipses remain fail-closed.
 */
function containsUnquotedEllipsis(value: string): boolean {
  const withoutBalancedQuotes = value
    .replace(/“[^”]*”/gu, '')
    .replace(/"[^"]*"/gu, '');
  return TRUNCATION_ELLIPSIS.test(withoutBalancedQuotes);
}

export interface InspectStringOptions {
  /** Override the path-derived decision about whether this field must end with terminal punctuation. */
  forceCompleteSentence?: boolean;
}

export function inspectString(
  path: string,
  rawValue: string,
  options?: InspectStringOptions,
): AuthorFacingIntegrityViolation[] {
  const value = rawValue.trim();
  if (!value) return [];

  const violations: AuthorFacingIntegrityViolation[] = [];
  const push = (code: AuthorFacingIntegrityCode, message: string) => {
    violations.push({ code, path, value: rawValue, message });
  };

  if (containsUnquotedEllipsis(value)) {
    push('AUTHOR_TEXT_TRUNCATION_ELLIPSIS', `${path} contains an ellipsis. Generated author-facing output must never use ellipses to conceal truncation.`);
  }
  if (NUMBER_DASH_SEQUENCE.test(value)) {
    push('AUTHOR_TEXT_NUMBER_DASH_SEQUENCE', `${path} contains a malformed numbered-list marker followed by a hyphen, en dash, em dash, or double hyphen. Use "1. Text" or "1) Text".`);
  }
  if (SPACE_BEFORE_PUNCTUATION.test(value)) {
    push('AUTHOR_TEXT_SPACE_BEFORE_PUNCTUATION', `${path} contains a space before punctuation.`);
  }
  if (MISSING_SPACE_AFTER_PUNCTUATION.test(value)) {
    push('AUTHOR_TEXT_MISSING_SPACE_AFTER_PUNCTUATION', `${path} is missing a space after a comma, semicolon, or colon.`);
  }
  if (REPEATED_PUNCTUATION.test(value)) {
    push('AUTHOR_TEXT_REPEATED_PUNCTUATION', `${path} contains malformed repeated punctuation.`);
  }
  if (DOUBLE_HYPHEN.test(value)) {
    push('AUTHOR_TEXT_DOUBLE_HYPHEN', `${path} contains a double hyphen. Use the correct punctuation mark and CMOS spacing.`);
  }
  if (REPEATED_HORIZONTAL_WHITESPACE.test(value)) {
    push('AUTHOR_TEXT_REPEATED_WHITESPACE', `${path} contains repeated horizontal whitespace.`);
  }
  if (DUPLICATE_WORD.test(value)) {
    push('AUTHOR_TEXT_DUPLICATE_WORD', `${path} contains an accidental adjacent duplicate word.`);
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
    push('AUTHOR_TEXT_PLACEHOLDER', `${path} contains placeholder or unresolved template text.`);
  }
  if (detectRawFallbackSentinel(value)) {
    push('AUTHOR_TEXT_FALLBACK_SENTINEL', `${path} contains a raw fallback sentinel that must never reach an author-visible surface.`);
  }
  if (hasUnbalancedDelimiters(value)) {
    push('AUTHOR_TEXT_UNBALANCED_DELIMITER', `${path} contains an unmatched quotation mark, bracket, brace, or parenthesis.`);
  }

  if (isAuthorTextPath(path) && !isFragmentPath(path) && startsWithLowercase(value)) {
    push('AUTHOR_TEXT_LOWERCASE_START', `${path} begins with a lowercase letter. CMOS author-facing sentences and headings must begin with a capital letter.`);
  }
  if (isAuthorTextPath(path) && hasLowercaseAfterSentence(value)) {
    push('AUTHOR_TEXT_LOWERCASE_SENTENCE_START', `${path} contains a sentence that begins with a lowercase letter.`);
  }

  const mustEndWithTerminalPunctuation =
    options?.forceCompleteSentence ?? requiresCompleteSentence(path);
  if (mustEndWithTerminalPunctuation) {
    if (endsMidSentence(value)) {
      push('AUTHOR_TEXT_MIDSENTENCE_TERMINATION', `${path} ends mid-sentence or with a dangling connective/punctuation mark.`);
    }
    if (/[\p{L}\p{N}]$/u.test(value) && !TERMINAL_PUNCTUATION.test(value)) {
      push('AUTHOR_TEXT_TRUNCATED_WORD', `${path} terminates in an unpunctuated token and may be truncated. Regenerate; never trim or append an ellipsis.`);
    }
  }

  return violations;
}

/**
 * Recursively inspect an author-visible artifact without mutating it.
 *
 * Governing standard: current Chicago Manual of Style, except where an explicit
 * RevisionGrade or publishing-industry contract overrides it.
 *
 * RG-TEXT-1: completeness, no truncation, no placeholders, no concealed repair.
 * RG-CMOS-1: capitalization and sentence starts.
 * RG-CMOS-2: balanced delimiters and quotation marks.
 * RG-CMOS-3: punctuation spacing.
 * RG-CMOS-4: numbered-list syntax.
 * RG-CMOS-5: dash and double-hyphen integrity.
 * RG-CMOS-6: quotation-mark consistency.
 * RG-CMOS-7: headings and labels begin with capitals.
 * RG-CMOS-8: no malformed punctuation, repeated whitespace, or duplicate words.
 * RG-CMOS-9: paragraph and sentence-boundary integrity.
 */
export function inspectAuthorFacingIntegrity(
  value: unknown,
  options: AuthorFacingIntegrityOptions = {},
): AuthorFacingIntegrityViolation[] {
  const rootPath = options.rootPath ?? '$';
  const violations: AuthorFacingIntegrityViolation[] = [];
  const seen = new WeakSet<object>();

  const visit = (current: unknown, path: string): void => {
    if (typeof current === 'string') {
      if (!isExcludedPath(path, options)) violations.push(...inspectString(path, current));
      return;
    }
    if (current === null || current === undefined || typeof current !== 'object') return;
    if (seen.has(current as object)) return;
    seen.add(current as object);

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      visit(child, `${path}.${key}`);
    }
  };

  visit(value, rootPath);
  return violations;
}

export class AuthorFacingIntegrityError extends Error {
  readonly code = 'AUTHOR_FACING_TEXT_INTEGRITY_FAILED';

  constructor(readonly violations: AuthorFacingIntegrityViolation[]) {
    super(`AUTHOR_FACING_TEXT_INTEGRITY_FAILED: ${violations.length} violation(s): ` + violations.map((violation) => `${violation.path}:${violation.code}`).join(', '));
    this.name = 'AuthorFacingIntegrityError';
  }
}

export function isAuthorFacingIntegrityError(err: unknown): err is AuthorFacingIntegrityError {
  return (
    err instanceof AuthorFacingIntegrityError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === 'AUTHOR_FACING_TEXT_INTEGRITY_FAILED' &&
      Array.isArray((err as { violations?: unknown }).violations))
  );
}

export function assertAuthorFacingIntegrity(
  value: unknown,
  options: AuthorFacingIntegrityOptions = {},
): void {
  const violations = inspectAuthorFacingIntegrity(value, options);
  if (violations.length > 0) throw new AuthorFacingIntegrityError(violations);
}
