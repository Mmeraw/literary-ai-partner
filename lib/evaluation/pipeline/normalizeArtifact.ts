/**
 * Artifact Normalization Pre-Stage
 *
 * Applies cosmetic-only formatting cleanup before certification, then validates
 * strict structural contracts for canonical evaluation prose. Canonical prose
 * is never shortened to satisfy a length policy: invalid output is rejected for
 * upstream regeneration.
 */

import {
  capitalizeFirstAlpha,
  collapseAdjacentDuplicateWords,
  endsMidSentence,
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

const RECOMMENDATION_PROSE_FIELDS = [
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
] as const;

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

    const collapsedWs = value.replace(/\s+/g, ' ');
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

    return value;
  }

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

  function normalizeRecs(recs: Array<Record<string, unknown>>, prefix: string) {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      for (const field of RECOMMENDATION_PROSE_FIELDS) {
        const value = normalizeStringValue(rec[field], `${prefix}[${i}].${field}`);
        if (value === null) continue;
        // RG-TEXT-1: never append punctuation to conceal incomplete generation.
        // The shared integrity authority below rejects incomplete prose so the
        // affected field can regenerate upstream.
        rec[field] = value;
      }
    }
  }

  normalizeRecs(quickWins, 'recommendations.quick_wins');
  normalizeRecs(strategicRevisions, 'recommendations.strategic_revisions');

  for (let ci = 0; ci < synthesis.criteria.length; ci++) {
    const criterion = synthesis.criteria[ci];
    for (const rationaleField of ['rationale', 'final_rationale'] as const) {
      const value = normalizeStringValue(criterion[rationaleField], `criteria[${ci}].${rationaleField}`);
      if (value !== null) {
        criterion[rationaleField] = value;
      }
    }
    if (!criterion.recommendations) continue;
    normalizeRecs(criterion.recommendations, `criteria[${ci}].recommendations`);
  }

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
