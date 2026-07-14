/**
 * Artifact Normalization Pre-Stage
 *
 * Applies deterministic, cosmetic-only normalizations to the synthesis output
 * BEFORE the Artifact Certification Authority (ECG) runs.
 *
 * This stage never changes scores or meaning. Strict author-facing text
 * contracts are enforced locally here without changing the backward-compatible
 * behavior of the shared prose helpers.
 */

import {
  capitalizeFirstAlpha,
  ensureTerminalPunctuation,
  collapseAdjacentDuplicateWords,
  endsMidSentence,
  trimAtSentenceBoundary,
} from '@/lib/text/authorFacingProse';
import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
} from '@/lib/config/lengthPolicy';

export type ArtifactTextContractReason =
  | 'NO_COMPLETE_SENTENCE_WITHIN_CAP'
  | 'ONE_SENTENCE_PITCH_OVER_CAP'
  | 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES'
  | 'ONE_SENTENCE_PITCH_ENDS_WITH_ELLIPSIS';

/**
 * A Phase 3 generation/normalization contract failure. This is deliberately
 * separate from ECG certification: ECG has not run when this error is thrown.
 */
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

const RECOMMENDATION_PROSE_FIELDS = [
  'action',
  'symptom',
  'cause',
  'mechanism',
  'fix_direction',
  'specific_fix',
  'reader_effect',
  'expected_impact',
] as const;

export interface NormalizationRecord {
  field: string;
  before: string;
  after: string;
  operation: 'capitalize' | 'terminal_punct' | 'whitespace' | 'trim_sentence_boundary' | 'trim_whitespace';
}

export interface NormalizeArtifactResult {
  normalizations: NormalizationRecord[];
}

// Existing central policy values, including explicit integer overages.
const OVERVIEW_MAX_CHARS = SUMMARY_POLICY.cap;
const ONE_SENTENCE_PITCH_MAX_CHARS = ONE_SENTENCE_PITCH_POLICY.cap;
const ONE_PARAGRAPH_PITCH_MAX_CHARS = ONE_PARAGRAPH_PITCH_POLICY.cap;

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

/**
 * Strict Pass 3 wrapper around the existing backward-compatible helper.
 *
 * The shared helper may return an ellipsis-trimmed word-boundary fallback when
 * no complete sentence fits. That behavior remains unchanged for existing
 * callers. This wrapper rejects that fallback for certified author-facing
 * summary/pitch fields and raises a typed regeneration-required error instead.
 */
export function trimToLastCompleteSentence(text: string, maxLength: number, field: string): string {
  if (!text.trim()) {
    contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', text.length, maxLength);
  }

  let result = trimAtSentenceBoundary(text, maxLength);

  // Within-cap text is intentionally returned unchanged by the shared helper.
  // Drop only a trailing incomplete fragment by invoking its complete-sentence
  // mode, then validate the result strictly.
  if (endsMidSentence(result)) {
    result = trimAtSentenceBoundary(result);
  }

  if (!result || endsWithEllipsis(result) || endsMidSentence(result)) {
    contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', text.length, maxLength);
  }

  return result;
}

/**
 * Validate rather than trim a one-sentence pitch. It must remain complete and
 * within the unchanged policy cap; no earlier sentence is selected and no
 * ellipsis fallback is permitted.
 */
function assertOneSentencePitch(text: string, maxLength: number, field: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const len = trimmed.length;

  if (len > maxLength) {
    contractError(field, 'ONE_SENTENCE_PITCH_OVER_CAP', len, maxLength);
  }
  if (endsWithEllipsis(trimmed)) {
    contractError(field, 'ONE_SENTENCE_PITCH_ENDS_WITH_ELLIPSIS', len, maxLength);
  }
  if (!trimmed || endsMidSentence(trimmed)) {
    contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', len, maxLength);
  }

  // Use the same sentence shape already used by authorFacingProse's canonical
  // splitter; this is validation only and does not introduce a second trimming
  // authority. More than one completed sentence violates the field contract.
  const sentences =
    trimmed
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
  if (sentences.length !== 1) {
    contractError(field, 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES', len, maxLength);
  }

  return trimmed;
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
      recommendations?: Array<{ action?: string }> | null;
    }>;
  },
  quickWins: Array<{ action?: string }>,
  strategicRevisions: Array<{ action?: string }>,
): NormalizeArtifactResult {
  const normalizations: NormalizationRecord[] = [];

  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const after = trimToLastCompleteSentence(before, OVERVIEW_MAX_CHARS, 'overview.one_paragraph_summary');
    if (after !== before) {
      synthesis.overall.one_paragraph_summary = after;
      normalizations.push({
        field: 'overview.one_paragraph_summary',
        before,
        after,
        operation: 'trim_sentence_boundary',
      });
    }
  }

  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const after = assertOneSentencePitch(before, ONE_SENTENCE_PITCH_MAX_CHARS, 'overview.one_sentence_pitch');
    if (after !== before) {
      synthesis.overall.one_sentence_pitch = after;
      normalizations.push({
        field: 'overview.one_sentence_pitch',
        before,
        after,
        operation: 'trim_whitespace',
      });
    }
  }

  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const after = trimToLastCompleteSentence(before, ONE_PARAGRAPH_PITCH_MAX_CHARS, 'overview.one_paragraph_pitch');
    if (after !== before) {
      synthesis.overall.one_paragraph_pitch = after;
      normalizations.push({
        field: 'overview.one_paragraph_pitch',
        before,
        after,
        operation: 'trim_sentence_boundary',
      });
    }
  }

  function normalizeRecs(recs: Array<Record<string, unknown>>, prefix: string) {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      for (const field of RECOMMENDATION_PROSE_FIELDS) {
        const raw = rec[field];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        let value = raw.trim();

        const collapsedWs = value.replace(/\s+/g, ' ');
        if (collapsedWs !== value) {
          normalizations.push({
            field: `${prefix}[${i}].${field}`,
            before: value,
            after: collapsedWs,
            operation: 'whitespace',
          });
          value = collapsedWs;
        }

        const dedup = collapseAdjacentDuplicateWords(value);
        if (dedup !== value) {
          normalizations.push({
            field: `${prefix}[${i}].${field}`,
            before: value,
            after: dedup,
            operation: 'whitespace',
          });
          value = dedup;
        }

        const capitalized = capitalizeFirstAlpha(value);
        if (capitalized !== value) {
          normalizations.push({
            field: `${prefix}[${i}].${field}`,
            before: value,
            after: capitalized,
            operation: 'capitalize',
          });
          value = capitalized;
        }

        const punctuated = ensureTerminalPunctuation(value);
        if (punctuated !== value) {
          normalizations.push({
            field: `${prefix}[${i}].${field}`,
            before: value,
            after: punctuated,
            operation: 'terminal_punct',
          });
          value = punctuated;
        }

        rec[field] = value;
      }
    }
  }

  normalizeRecs(quickWins as Array<Record<string, unknown>>, 'recommendations.quick_wins');
  normalizeRecs(strategicRevisions as Array<Record<string, unknown>>, 'recommendations.strategic_revisions');

  for (let ci = 0; ci < synthesis.criteria.length; ci++) {
    const criterion = synthesis.criteria[ci];
    if (!criterion.recommendations) continue;
    normalizeRecs(criterion.recommendations as Array<Record<string, unknown>>, `criteria[${ci}].recommendations`);
  }

  return { normalizations };
}
