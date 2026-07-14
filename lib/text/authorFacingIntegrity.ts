import { detectRawFallbackSentinel, endsMidSentence } from './authorFacingProse';

export type AuthorFacingIntegrityCode =
  | 'AUTHOR_TEXT_TRUNCATED_WORD'
  | 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION'
  | 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS'
  | 'AUTHOR_TEXT_PLACEHOLDER'
  | 'AUTHOR_TEXT_FALLBACK_SENTINEL'
  | 'AUTHOR_TEXT_UNBALANCED_DELIMITER';

export interface AuthorFacingIntegrityViolation {
  code: AuthorFacingIntegrityCode;
  path: string;
  value: string;
  message: string;
}

export interface AuthorFacingIntegrityOptions {
  /** Root name used in diagnostic JSON paths. */
  rootPath?: string;
  /** Additional path fragments that contain technical metadata, not author prose. */
  excludePathFragments?: string[];
  /** When true, verbatim source quotations are inspected too. Defaults false. */
  inspectSourceQuotations?: boolean;
}

const DEFAULT_EXCLUDED_PATH_FRAGMENTS = [
  '.ids.',
  '.engine.',
  '.metrics.processing.',
  '.artifacts.',
  '.generated_at',
  '.created_at',
  '.schema_version',
  '.artifact_id',
  '.job_id',
  '.user_id',
  '.manuscript_id',
  '.project_id',
  '.evaluation_run_id',
  '.source_hash',
  '.prompt_version',
  '.policy_family',
  '.repro_anchor',
  '.manuscript_coordinates',
  '.criterion_key',
  '.key',
  '.status',
  '.verdict',
  '.effort',
  '.impact',
  '.priority',
  '.confidence_label',
];

const SOURCE_QUOTATION_FRAGMENTS = [
  '.evidence.',
  '.snippet',
  '.anchor_snippet',
  '.original_passage',
  '.manuscript_excerpt',
];

const PLACEHOLDER_PATTERNS = [
  /\[insert\b/i,
  /\bTBD\b/,
  /lorem ipsum/i,
  /\bplaceholder\b/i,
  /\bundefined\b/i,
  /\bnull\b/i,
];

const PROSE_KEY_PATTERN = /(?:summary|pitch|strength|risk|rationale|recommendation|action|why|mechanism|specific_fix|reader_effect|expected_impact|symptom|cause|fix_direction|candidate_text|premise|audience|warning|limitation|reason|description|diagnosis|guidance|bio|query|synopsis|letter|story|revision|market|position|copy|note)$/i;
const TERMINAL_PUNCTUATION = /[.!?]["'”’\)\]]*$/u;
const TRUNCATION_ELLIPSIS = /(?:\.\.\.|…)/u;

function isExcludedPath(path: string, options: AuthorFacingIntegrityOptions): boolean {
  const fragments = [...DEFAULT_EXCLUDED_PATH_FRAGMENTS, ...(options.excludePathFragments ?? [])];
  if (fragments.some((fragment) => path.includes(fragment))) return true;
  if (!options.inspectSourceQuotations && SOURCE_QUOTATION_FRAGMENTS.some((fragment) => path.includes(fragment))) {
    return true;
  }
  return false;
}

function leafKey(path: string): string {
  return path.replace(/\[\d+\]$/u, '').split('.').pop() ?? path;
}

function isProsePath(path: string, value: string): boolean {
  if (PROSE_KEY_PATTERN.test(leafKey(path))) return true;
  return value.trim().length >= 80 && /\s/u.test(value);
}

function hasUnbalancedDelimiters(value: string): boolean {
  const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']];
  for (const [open, close] of pairs) {
    let depth = 0;
    for (const char of value) {
      if (char === open) depth += 1;
      if (char === close) depth -= 1;
      if (depth < 0) return true;
    }
    if (depth !== 0) return true;
  }
  const straightDoubleQuotes = (value.match(/"/g) ?? []).length;
  return straightDoubleQuotes % 2 !== 0;
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
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
    push('AUTHOR_TEXT_PLACEHOLDER', `${path} contains placeholder or unresolved template text.`);
  }
  if (detectRawFallbackSentinel(value)) {
    push('AUTHOR_TEXT_FALLBACK_SENTINEL', `${path} contains a raw fallback sentinel that must never reach an author-visible surface.`);
  }
  if (hasUnbalancedDelimiters(value)) {
    push('AUTHOR_TEXT_UNBALANCED_DELIMITER', `${path} contains an unmatched quote, bracket, brace, or parenthesis.`);
  }

  if (isProsePath(path, value)) {
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
 * Law RG-TEXT-1:
 * No author-facing artifact may contain truncated prose, truncated words,
 * truncation ellipses, placeholders, fallback sentinels, or incomplete sentence
 * termination. Violations are fatal and must regenerate upstream.
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
    super(
      `AUTHOR_FACING_TEXT_INTEGRITY_FAILED: ${violations.length} violation(s): ` +
        violations.map((violation) => `${violation.path}:${violation.code}`).join(', '),
    );
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
