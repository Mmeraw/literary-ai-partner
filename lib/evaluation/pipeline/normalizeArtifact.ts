/**
 * Artifact Normalization Pre-Stage
 *
 * Applies Tier-1 cosmetic formatting cleanup to every author-facing string in the
 * synthesis envelope before certification, then validates strict structural
 * contracts for canonical evaluation prose. Canonical prose is never shortened
 * to satisfy a length policy: invalid output is rejected for upstream
 * regeneration.
 */

import {
  capitalizeFirstAlpha,
  collapseAdjacentDuplicateWords,
  ensureTerminalPunctuation,
  endsMidSentence,
  endsWithDanglingConnective,
  normalizePunctuationSpacing,
  normalizeDuplicateCloseQuotes,
} from '@/lib/text/authorFacingProse';
import { assertAuthorFacingIntegrity } from '@/lib/text/authorFacingIntegrity';
import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
} from '@/lib/config/lengthPolicy';

export type ArtifactTextContractReason =
  | 'EVALUATION_PROSE_OVER_TECHNICAL_CEILING'
  | 'NO_COMPLETE_SENTENCE_WITHIN_CAP'
  | 'ONE_SENTENCE_PITCH_OVER_CAP'
  | 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES'
  | 'ONE_SENTENCE_PITCH_ENDS_WITH_ELLIPSIS'
  | 'ONE_PARAGRAPH_PITCH_MULTIPLE_PARAGRAPHS';

export class ArtifactTextContractError extends Error {
  readonly code = 'ARTIFACT_TEXT_CONTRACT_FAILED';

  constructor(
    readonly field: string,
    readonly reason: ArtifactTextContractReason,
    readonly actualLength: number,
    readonly cap: number,
  ) {
    super(
      `${field} failed its text contract: ${reason} (actual=${actualLength}, cap=${cap}). ` +
        'Regenerate the field upstream.',
    );
    this.name = 'ArtifactTextContractError';
  }
}

export function isArtifactTextContractError(err: unknown): err is ArtifactTextContractError {
  return (
    err instanceof ArtifactTextContractError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === 'ARTIFACT_TEXT_CONTRACT_FAILED')
  );
}

export interface NormalizationRecord {
  field: string;
  before: string;
  after: string;
  operation: 'capitalize' | 'whitespace' | 'trim_whitespace' | 'punctuation';
}

export interface NormalizeArtifactResult {
  normalizations: NormalizationRecord[];
}

const OVERVIEW_TECHNICAL_CEILING = SUMMARY_POLICY.cap;
const ONE_SENTENCE_PITCH_TECHNICAL_CEILING = ONE_SENTENCE_PITCH_POLICY.cap;
const ONE_PARAGRAPH_PITCH_TECHNICAL_CEILING = ONE_PARAGRAPH_PITCH_POLICY.cap;

function contractError(
  field: string,
  reason: ArtifactTextContractReason,
  actualLength: number,
  cap: number,
): never {
  throw new ArtifactTextContractError(field, reason, actualLength, cap);
}

function endsWithEllipsis(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith('…') || trimmed.endsWith('...');
}

/** Harmless cleanup only: normalize line endings, trailing horizontal whitespace, and outer whitespace. */
export function normalizeAuthorFacingFormatting(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** Validate complete canonical evaluation prose without deleting or rewriting any content. */
export function validateEvaluationProse(text: string, maxLength: number, field: string): string {
  const len = text.length;
  if (len > maxLength) {
    contractError(field, 'EVALUATION_PROSE_OVER_TECHNICAL_CEILING', len, maxLength);
  }
  if (!text || endsMidSentence(text)) {
    contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', len, maxLength);
  }
  return text;
}

/**
 * Backward-compatible call surface for existing pipeline callers.
 *
 * Despite the legacy name, this function no longer trims. It performs harmless
 * formatting cleanup and validates the complete canonical prose, throwing for
 * upstream regeneration when the text is incomplete or exceeds the technical
 * safeguard.
 */
export function trimToLastCompleteSentence(text: string, maxLength: number, field: string): string {
  const formatted = normalizeAuthorFacingFormatting(text);
  return validateEvaluationProse(formatted, maxLength, field);
}

function assertOneSentencePitch(text: string, maxLength: number, field: string): string {
  const len = text.length;
  if (len > maxLength) {
    contractError(field, 'ONE_SENTENCE_PITCH_OVER_CAP', len, maxLength);
  }
  if (endsWithEllipsis(text)) {
    contractError(field, 'ONE_SENTENCE_PITCH_ENDS_WITH_ELLIPSIS', len, maxLength);
  }
  validateEvaluationProse(text, maxLength, field);

  const sentences =
    text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
  if (sentences.length !== 1) {
    contractError(field, 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES', len, maxLength);
  }
  return text;
}

function assertOneParagraphPitch(text: string, maxLength: number, field: string): string {
  validateEvaluationProse(text, maxLength, field);
  if (/\n\s*\n/u.test(text)) {
    contractError(field, 'ONE_PARAGRAPH_PITCH_MULTIPLE_PARAGRAPHS', text.length, maxLength);
  }
  return text;
}

/**
 * Explicit allowlist of leaf field names that hold author-facing prose in the
 * synthesis envelope. Fields such as evidence snippets, anchor snippets, IDs,
 * status codes, scores, and model names are intentionally omitted.
 */
const AUTHOR_FACING_FIELD_KEYS = new Set([
  // overview
  'one_paragraph_summary',
  'one_sentence_pitch',
  'one_paragraph_pitch',
  'top_3_strengths',
  'top_3_risks',
  // criterion body
  'rationale',
  'final_rationale',
  'fit_summary',
  'gap_summary',
  'delta_explanation',
  'deferred_consequence_risk',
  'pressure_points',
  'decision_points',
  // recommendation / action item prose
  'action',
  'why',
  'symptom',
  'cause',
  'mechanism',
  'fix_direction',
  'specific_fix',
  'reader_effect',
  'expected_impact',
  'mistake_proofing',
  'candidate_text_a',
  'candidate_text_b',
  'candidate_text_c',
  // technical defect surface
  'author_facing_reason',
]);

const STRING_ARRAY_FIELD_KEYS = new Set([
  'top_3_strengths',
  'top_3_risks',
  'pressure_points',
  'decision_points',
]);

const PHRASE_ALLOWED_FIELD_KEYS = new Set([
  'top_3_strengths',
  'top_3_risks',
  'pressure_points',
  'decision_points',
  'title',
  'heading',
  'header',
  'label',
  'mechanism',
  'specific_fix',
  'reader_effect',
]);

function shouldEnsureTerminalPunctuation(fieldPath: string): boolean {
  const key = fieldPath.replace(/\[\d+\]$/u, '').split('.').pop() ?? fieldPath;
  return isAuthorFacingFieldKey(key) && !PHRASE_ALLOWED_FIELD_KEYS.has(key);
}

function isAuthorFacingFieldKey(key: string): boolean {
  return AUTHOR_FACING_FIELD_KEYS.has(key);
}

function isStringArrayFieldKey(key: string): boolean {
  return STRING_ARRAY_FIELD_KEYS.has(key);
}

export function normalizeArtifact(
  synthesis: {
    overall: {
      one_paragraph_summary?: string;
      one_sentence_pitch?: string;
      one_paragraph_pitch?: string;
      top_3_strengths?: string[];
      top_3_risks?: string[];
    };
    criteria: Array<{
      rationale?: string;
      final_rationale?: string;
      recommendations?: Array<Record<string, unknown>> | null;
    }>;
  },
  quickWins: Array<Record<string, unknown>>,
  strategicRevisions: Array<Record<string, unknown>>,
): NormalizeArtifactResult {
  const normalizations: NormalizationRecord[] = [];

  function normalizeStringValue(raw: unknown, field: string): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    let value = raw.trim();

    // Tier-1 whitespace cleanup: collapse horizontal runs and isolated line
    // breaks into single spaces, but preserve paragraph breaks (\n\n) so
    // multi-paragraph author-facing prose remains structurally valid.
    const collapsedWs = value
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/(?<!\n)\n(?!\n)/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (collapsedWs !== value) {
      normalizations.push({ field, before: value, after: collapsedWs, operation: 'whitespace' });
      value = collapsedWs;
    }

    const dedup = collapseAdjacentDuplicateWords(value);
    if (dedup !== value) {
      normalizations.push({ field, before: value, after: dedup, operation: 'whitespace' });
      value = dedup;
    }

    const capitalized = capitalizeFirstAlpha(value);
    if (capitalized !== value) {
      normalizations.push({ field, before: value, after: capitalized, operation: 'capitalize' });
      value = capitalized;
    }

    const dedupedQuotes = normalizeDuplicateCloseQuotes(value);
    if (dedupedQuotes !== value) {
      normalizations.push({ field, before: value, after: dedupedQuotes, operation: 'punctuation' });
      value = dedupedQuotes;
    }

    const punctuationSpaced = normalizePunctuationSpacing(value);
    if (punctuationSpaced !== value) {
      normalizations.push({ field, before: value, after: punctuationSpaced, operation: 'punctuation' });
      value = punctuationSpaced;
    }

    // Deterministic punctuation-only mistake-proofing for complete sentence
    // fields. If a field ends with a dangling connective, we do NOT patch it;
    // integrity validation must fail closed and force regeneration.
    if (shouldEnsureTerminalPunctuation(field) && !endsWithDanglingConnective(value)) {
      const punctuated = ensureTerminalPunctuation(value);
      if (punctuated !== value) {
        normalizations.push({ field, before: value, after: punctuated, operation: 'punctuation' });
        value = punctuated;
      }
    }

    return value;
  }

  function normalizeStringArray(arr: unknown[], field: string): string[] {
    const out: string[] = [];
    let changed = false;
    for (let i = 0; i < arr.length; i++) {
      const normalized = normalizeStringValue(arr[i], `${field}[${i}]`);
      if (normalized !== null) {
        out.push(normalized);
        if (normalized !== arr[i]) changed = true;
      } else if (typeof arr[i] === 'string') {
        out.push(arr[i] as string);
      } else {
        out.push(String(arr[i]));
      }
    }
    return changed ? out : (arr as string[]);
  }

  type NodeSetter = (value: unknown) => void;

  function visit(current: unknown, path: string, set: NodeSetter): void {
    if (current === null || current === undefined) return;

    if (typeof current === 'string') {
      const key = path.replace(/\[\d+\]$/u, '').split('.').pop() ?? path;
      if (isAuthorFacingFieldKey(key)) {
        const normalized = normalizeStringValue(current, path);
        if (normalized !== null && normalized !== current) {
          set(normalized);
        }
      }
      return;
    }

    if (Array.isArray(current)) {
      const key = path.split('.').pop() ?? path;
      if (isStringArrayFieldKey(key)) {
        const normalized = normalizeStringArray(current, path);
        if (normalized !== current) {
          set(normalized);
        }
        return;
      }
      for (let i = 0; i < current.length; i++) {
        visit(current[i], `${path}[${i}]`, (value) => {
          current[i] = value;
        });
      }
      return;
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      for (const [key, child] of Object.entries(record)) {
        // Never descend into evidence/quotation objects; they contain manuscript
        // source text that must not be rewritten.
        if (key === 'evidence' || key === 'snippet' || key === 'anchor_snippet') continue;
        visit(child, `${path}.${key}`, (value) => {
          record[key] = value;
        });
      }
    }
  }

  // ── Overview canonical prose contracts ─────────────────────────────────────
  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const formatted = normalizeAuthorFacingFormatting(before);
    validateEvaluationProse(formatted, OVERVIEW_TECHNICAL_CEILING, 'overview.one_paragraph_summary');
    if (formatted !== before) {
      synthesis.overall.one_paragraph_summary = formatted;
      normalizations.push({
        field: 'overview.one_paragraph_summary',
        before,
        after: formatted,
        operation: 'trim_whitespace',
      });
    }
  }

  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const formatted = normalizeAuthorFacingFormatting(before).replace(/\s+/g, ' ');
    assertOneSentencePitch(formatted, ONE_SENTENCE_PITCH_TECHNICAL_CEILING, 'overview.one_sentence_pitch');
    if (formatted !== before) {
      synthesis.overall.one_sentence_pitch = formatted;
      normalizations.push({
        field: 'overview.one_sentence_pitch',
        before,
        after: formatted,
        operation: 'trim_whitespace',
      });
    }
  }

  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const formatted = normalizeAuthorFacingFormatting(before);
    assertOneParagraphPitch(
      formatted,
      ONE_PARAGRAPH_PITCH_TECHNICAL_CEILING,
      'overview.one_paragraph_pitch',
    );
    if (formatted !== before) {
      synthesis.overall.one_paragraph_pitch = formatted;
      normalizations.push({
        field: 'overview.one_paragraph_pitch',
        before,
        after: formatted,
        operation: 'trim_whitespace',
      });
    }
  }

  // ── Universal Tier-1 author-facing text normalization ────────────────────────
  // Walk the entire synthesis envelope, normalizing only explicitly allowed
  // author-facing strings. Manuscript evidence, IDs, scores, status codes, and
  // model metadata are skipped by omission from the allowlist.
  visit(synthesis, 'synthesis', () => {});
  visit(quickWins, 'recommendations.quick_wins', () => {});
  visit(strategicRevisions, 'recommendations.strategic_revisions', () => {});

  assertAuthorFacingIntegrity(
    {
      overview: synthesis.overall,
      criteria: synthesis.criteria,
      recommendations: {
        quick_wins: quickWins,
        strategic_revisions: strategicRevisions,
      },
    },
    { rootPath: 'evaluation_result_v2' },
  );

  return { normalizations };
}
