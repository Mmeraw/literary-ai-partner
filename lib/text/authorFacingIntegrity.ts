import { detectRawFallbackSentinel, endsMidSentence } from './authorFacingProse';

export type AuthorFacingIntegrityCode =
  | 'AUTHOR_TEXT_TRUNCATED_WORD'
  | 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION'
  | 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS'
  | 'AUTHOR_TEXT_PLACEHOLDER'
  | 'AUTHOR_TEXT_FALLBACK_SENTINEL'
  | 'AUTHOR_TEXT_UNBALANCED_DELIMITER'
  | 'AUTHOR_TEXT_LOWERCASE_START'
  | 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE';

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
  '.priority', '.confidence_label',
];

const SOURCE_QUOTATION_FRAGMENTS = [
  '.evidence.', '.snippet', '.anchor_snippet', '.original_passage', '.manuscript_excerpt',
];

const PLACEHOLDER_PATTERNS = [
  /\[insert\b/i, /\bTBD\b/, /lorem ipsum/i, /\bplaceholder\b/i,
  /\bundefined\b/i, /\bnull\b/i,
];

const AUTHOR_TEXT_KEY_PATTERN = /(?:summary|pitch|strength|risk|rationale|recommendation|action|why|mechanism|specific_fix|reader_effect|expected_impact|symptom|cause|fix_direction|candidate_text|premise|audience|warning|limitation|reason|description|diagnosis|guidance|bio|query|synopsis|letter|story|revision|market|position|copy|note|title|heading|header|label)$/i;
const PHRASE_ALLOWED_KEY_PATTERN = /(?:strength|risk|title|heading|header|label)$/i;
const TERMINAL_PUNCTUATION = /[.!?]["'”’\)\]]*$/u;
const TRUNCATION_ELLIPSIS = /(?:\.\.\.|…)/u;

// CMOS/platform law: numbered prose must use a normal list delimiter such as
// "1. Text" or "1) Text". A number, a number plus period, or a number plus
// parenthesis may never be followed by a hyphen, en dash, em dash, or double
// hyphen: 1-, 1.–, 1.—, 1.--, and 1)– are all invalid.
const NUMBER_DASH_SEQUENCE = /(?:^|\s)\d+(?:\s*[.)])?\s*(?:-|–|—)(?:-|–|—)*/u;

function isExcludedPath(path: string, options: AuthorFacingIntegrityOptions): boolean {
  const fragments = [...DEFAULT_EXCLUDED_PATH_FRAGMENTS, ...(options.excludePathFragments ?? [])];
  if (fragments.some((fragment) => path.includes(fragment))) return true;
  if (!options.inspectSourceQuotations && SOURCE_QUOTATION_FRAGMENTS.some((fragment) => path.includes(fragment))) return true;
  return false;
}

function leafKey(path: string): string {
  return path.replace(/\[\d+\]$/u, '').split('.').pop() ?? path;
}

function isAuthorTextPath(path: string, value: string): boolean {
  if (AUTHOR_TEXT_KEY_PATTERN.test(leafKey(path))) return true;
  return value.trim().length >= 80 && /\s/u.test(value);
}

function requiresCompleteSentence(path: string, value: string): boolean {
  const key = leafKey(path);
  if (PHRASE_ALLOWED_KEY_PATTERN.test(key) && value.trim().length < 80) return false;
  return isAuthorTextPath(path, value);
}

function hasUnbalancedDelimiters(value: string): boolean {
  // A leading numbered-list marker such as "1) Text" contains an intentional
  // unmatched closing parenthesis. Remove only that marker before checking the
  // prose body; all other unmatched delimiters remain fatal.
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
  return (delimiterInput.match(/"/g) ?? []).length % 2 !== 0;
}

function startsWithLowercase(value: string): boolean {
  const first = value.match(/\p{L}/u)?.[0];
  return Boolean(first && first === first.toLocaleLowerCase() && first !== first.toLocaleUpperCase());
}

function inspectString(path: string, rawValue: string): AuthorFacingIntegrityViolation[] {
  const value = rawValue.trim();
  if (!value) return [];

  const violations: AuthorFacingIntegrityViolation[] = [];
  const push = (code: AuthorFacingIntegrityCode, message: string) => {
    violations.push({ code, path, value: rawValue, message });
  };

  if (TRUNCATION_ELLIPSIS.test(value)) {
    push('AUTHOR_TEXT_TRUNCATION_ELLIPSIS', `${path} contains an ellipsis. Author-facing output must never use ellipses to conceal truncation.`);
  }
  if (NUMBER_DASH_SEQUENCE.test(value)) {
    push('AUTHOR_TEXT_NUMBER_DASH_SEQUENCE', `${path} contains a number followed by a hyphen, en dash, em dash, or double hyphen. Use "1. Text" or "1) Text"; never "1.-", "1.–", "1.—", or "1.--".`);
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
    push('AUTHOR_TEXT_PLACEHOLDER', `${path} contains placeholder or unresolved template text.`);
  }
  if (detectRawFallbackSentinel(value)) {
    push('AUTHOR_TEXT_FALLBACK_SENTINEL', `${path} contains a raw fallback sentinel that must never reach an author-visible surface.`);
  }
  if (hasUnbalancedDelimiters(value)) {
    push('AUTHOR_TEXT_UNBALANCED_DELIMITER', `${path} contains an unmatched quote, bracket, brace, or parenthesis.`);
  }

  if (isAuthorTextPath(path, value) && startsWithLowercase(value)) {
    push('AUTHOR_TEXT_LOWERCASE_START', `${path} begins with a lowercase letter. CMOS author-facing sentences and headings must begin with a capital letter.`);
  }

  if (requiresCompleteSentence(path, value)) {
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
 * RG-TEXT-1: no truncated prose, truncated words, truncation ellipses,
 * placeholders, fallback sentinels, or incomplete sentence termination.
 * RG-CMOS-1: generated author-facing sentences/headings start with capitals,
 * and numbered prose never places any dash directly after the number marker.
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

export function assertAuthorFacingIntegrity(
  value: unknown,
  options: AuthorFacingIntegrityOptions = {},
): void {
  const violations = inspectAuthorFacingIntegrity(value, options);
  if (violations.length > 0) throw new AuthorFacingIntegrityError(violations);
}
