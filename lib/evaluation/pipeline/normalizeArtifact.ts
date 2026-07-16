/**
 * Artifact Normalization Pre-Stage
 *
 * Applies Tier-1 cosmetic formatting cleanup to every governed author-facing
 * string in the synthesis envelope before certification, then validates strict
 * structural contracts for canonical evaluation prose. Canonical prose is never
 * shortened to satisfy a length policy: invalid output is rejected for upstream
 * regeneration.
 */

import {
  capitalizeFirstAlpha,
  collapseAdjacentDuplicateWords,
  endsMidSentence,
  endsWithDanglingConnective,
  ensureSingleSpaceAfterColon,
  ensureTerminalPunctuation,
  normalizeDuplicateCloseQuotes,
} from '@/lib/text/authorFacingProse';
import { assertAuthorFacingIntegrity } from '@/lib/text/authorFacingIntegrity';
import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
} from '@/lib/config/lengthPolicy';
import {
  isCanonicalAuthorFacingField,
  isExcludedAuthorFacingPath,
} from './authorFacingFieldRegistry';

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

/** Backward-compatible call surface for existing pipeline callers. */
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

const STRING_ARRAY_FIELD_KEYS = new Set([
  'top_3_strengths',
  'top_3_risks',
  'pressure_points',
  'decision_points',
]);

/**
 * Fields whose contract is complete author-facing prose rather than a label,
 * fragment, quotation, or candidate-text surface. Missing terminal punctuation
 * is safe to repair only for these governed fields.
 */
const TERMINAL_PUNCTUATION_REQUIRED_FIELDS = new Set([
  'one_paragraph_summary',
  'one_sentence_pitch',
  'one_paragraph_pitch',
  'top_3_strengths',
  'top_3_risks',
  'rationale',
  'final_rationale',
  'fit_summary',
  'gap_summary',
  'delta_explanation',
  'deferred_consequence_risk',
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
  'author_facing_reason',
]);

function isAuthorFacingFieldKey(key: string): boolean {
  return isCanonicalAuthorFacingField(key);
}

function isStringArrayFieldKey(key: string): boolean {
  return STRING_ARRAY_FIELD_KEYS.has(key);
}

function leafKey(path: string): string {
  return path.replace(/\[\d+\]$/u, '').split('.').pop() ?? path;
}

function mayRepairTerminalPunctuation(value: string, key: string): boolean {
  if (!TERMINAL_PUNCTUATION_REQUIRED_FIELDS.has(key)) return false;
  if (endsWithDanglingConnective(value)) return false;
  // A terminal dash or open delimiter is a strong truncation signal and must
  // remain visible to authorFacingIntegrity rather than being papered over.
  if (/[\-–—([{]\s*$/u.test(value)) return false;
  return true;
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

  function record(field: string, before: string, after: string, operation: NormalizationRecord['operation']): void {
    if (before !== after) normalizations.push({ field, before, after, operation });
  }

  function normalizeStringValue(raw: unknown, field: string): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    let value = raw.trim();
    const key = leafKey(field);

    const collapsedWs = value
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/(?<!\n)\n(?!\n)/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    record(field, value, collapsedWs, 'whitespace');
    value = collapsedWs;

    const dedup = collapseAdjacentDuplicateWords(value);
    record(field, value, dedup, 'whitespace');
    value = dedup;

    const capitalized = capitalizeFirstAlpha(value);
    record(field, value, capitalized, 'capitalize');
    value = capitalized;

    const colonSpaced = ensureSingleSpaceAfterColon(value);
    record(field, value, colonSpaced, 'punctuation');
    value = colonSpaced;

    const dedupedQuotes = normalizeDuplicateCloseQuotes(value);
    record(field, value, dedupedQuotes, 'punctuation');
    value = dedupedQuotes;

    if (mayRepairTerminalPunctuation(value, key)) {
      const terminalized = ensureTerminalPunctuation(value);
      record(field, value, terminalized, 'punctuation');
      value = terminalized;
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
        out.push(arr[i]);
      } else {
        out.push(String(arr[i]));
      }
    }
    return changed ? out : (arr as string[]);
  }

  type NodeSetter = (value: unknown) => void;

  function visit(current: unknown, path: string, set: NodeSetter): void {
    if (current === null || current === undefined || isExcludedAuthorFacingPath(path)) return;

    if (typeof current === 'string') {
      const key = leafKey(path);
      if (isAuthorFacingFieldKey(key)) {
        const normalized = normalizeStringValue(current, path);
        if (normalized !== null && normalized !== current) set(normalized);
      }
      return;
    }

    if (Array.isArray(current)) {
      const key = path.split('.').pop() ?? path;
      if (isStringArrayFieldKey(key)) {
        const normalized = normalizeStringArray(current, path);
        if (normalized !== current) set(normalized);
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
      const recordValue = current as Record<string, unknown>;
      for (const [key, child] of Object.entries(recordValue)) {
        const childPath = `${path}.${key}`;
        if (isExcludedAuthorFacingPath(childPath)) continue;
        visit(child, childPath, (value) => {
          recordValue[key] = value;
        });
      }
    }
  }

  // Normalize canonical overview prose before its strict prose contracts run.
  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const normalized = normalizeStringValue(before, 'synthesis.overall.one_paragraph_summary') ?? before;
    validateEvaluationProse(normalized, OVERVIEW_TECHNICAL_CEILING, 'overview.one_paragraph_summary');
    synthesis.overall.one_paragraph_summary = normalized;
  }

  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const normalized = (normalizeStringValue(before, 'synthesis.overall.one_sentence_pitch') ?? before).replace(/\s+/g, ' ');
    assertOneSentencePitch(normalized, ONE_SENTENCE_PITCH_TECHNICAL_CEILING, 'overview.one_sentence_pitch');
    synthesis.overall.one_sentence_pitch = normalized;
  }

  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const normalized = normalizeStringValue(before, 'synthesis.overall.one_paragraph_pitch') ?? before;
    assertOneParagraphPitch(normalized, ONE_PARAGRAPH_PITCH_TECHNICAL_CEILING, 'overview.one_paragraph_pitch');
    synthesis.overall.one_paragraph_pitch = normalized;
  }

  // Universal author-facing text normalization for short-form, long-form,
  // multi-layer, retry, and replay routes that converge on normalizeArtifact.
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
