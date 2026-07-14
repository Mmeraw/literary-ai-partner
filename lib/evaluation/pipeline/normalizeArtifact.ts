/**
 * Artifact Normalization Pre-Stage
 *
 * Applies deterministic, cosmetic-only normalizations to the synthesis output
 * BEFORE the Artifact Certification Authority (ECG) runs.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  This stage may ONLY perform deterministic cosmetic fixes.      ║
 * ║  It must NEVER alter semantic content, scores, or meaning.      ║
 * ║  If a problem requires semantic judgment → it must fail the ECG ║
 * ║  and be regenerated upstream, not silently repaired here.       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Permitted operations:
 *   ✔ Capitalize first letter of recommendation action
 *   ✔ Add terminal punctuation to recommendation action
 *   ✔ Collapse multiple whitespace in text fields
 *   ✔ Trim over-CAP text fields at a COMPLETE-SENTENCE boundary
 *     (NO_MIDSENTENCE_TRUNCATION) — never mid-sentence, never mid-word.
 *
 * Length policy (lib/config/lengthPolicy.ts) — hard integers only, no %:
 *   summary  MIN 300 · BASE 750 · CAP 1000 chars (author prose: runs over
 *            base freely; only sentence-trimmed if it exceeds CAP)
 *   pitches  hard-capped single sentence / single paragraph; sentence-trim
 *            at CAP
 *   below MIN ⇒ handled upstream as INSUFFICIENT_EXPLANATION kickback, NOT
 *            padded here (this stage never fabricates content).
 *
 * Forbidden operations:
 *   ✗ Score replacement or injection
 *   ✗ Rewriting summaries or pitches
 *   ✗ Deduplication of content across fields
 *   ✗ Filling missing fields with fallback content
 *   ✗ Any operation that changes meaning
 *
 * Pipeline position:
 *   Pass 3 output → normalizeArtifact() → ECG → persist
 */

import {
  capitalizeFirstAlpha,
  ensureTerminalPunctuation,
  collapseAdjacentDuplicateWords,
} from '@/lib/text/authorFacingProse';
import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
} from '@/lib/config/lengthPolicy';

export type ArtifactTextContractReason =
  | 'NO_COMPLETE_SENTENCE_WITHIN_CAP'
  | 'ONE_SENTENCE_PITCH_OVER_CAP'
  | 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES';

/**
 * Thrown when an author-facing text field cannot satisfy its length/sentence
 * contract without being mechanically truncated or mutated. This is a
 * Phase-3-output contract failure, not an ECG certification failure.
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

/**
 * Diagnostic fields on a recommendation/opportunity that carry author-facing
 * prose. Each is capitalized + terminally punctuated (A3/A4/D2) and has
 * accidental adjacent-word duplication collapsed (A4). anchor_snippet is
 * intentionally excluded — it is a verbatim quote.
 */
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

// Hard caps come from the central length policy (no percentages anywhere).
// Summary CAP is the generous author-prose ceiling (base 750 + 250 overage);
// pitches keep their by-design single-sentence / single-paragraph caps.
const OVERVIEW_MAX_CHARS = SUMMARY_POLICY.cap; // 1000
const ONE_SENTENCE_PITCH_MAX_CHARS = ONE_SENTENCE_PITCH_POLICY.cap; // 220
const ONE_PARAGRAPH_PITCH_MAX_CHARS = ONE_PARAGRAPH_PITCH_POLICY.cap; // 750

// Common abbreviations and titles whose periods must not be counted as sentence
// terminators. The token checked is the text immediately preceding the
// punctuation (e.g. "U.S" for the final period in "U.S.").
const ABBREVIATIONS = new Set<string>([
  'U.S',
  'U.K',
  'e.g',
  'i.e',
  'vs',
  'Dr',
  'Mr',
  'Mrs',
  'Ms',
  'St',
  'vol',
  'etc',
  'Inc',
  'Ltd',
  'Jr',
  'Sr',
  'A.M',
  'P.M',
  'Ph.D',
  'M.D',
  'B.A',
  'M.A',
  'B.S',
  'M.S',
]);

function contractError(
  field: string,
  reason: ArtifactTextContractReason,
  actualLength: number,
  cap: number,
): never {
  throw new ArtifactTextContractError(field, reason, actualLength, cap);
}

function tokenBeforePunctuation(text: string, index: number): string {
  let i = index - 1;
  while (i >= 0 && !/\s/.test(text[i])) {
    i--;
  }
  return text.slice(i + 1, index);
}

function isEllipsisPeriod(text: string, index: number): boolean {
  if (text[index] !== '.') return false;
  // The third (or later) dot of a run of consecutive periods ("...").
  return text[index - 1] === '.' && text[index - 2] === '.';
}

function isSentenceTerminator(text: string, index: number): boolean {
  const ch = text[index];
  if (!/[.!?]/.test(ch)) return false;
  if (ch === '.' && isEllipsisPeriod(text, index)) return false;

  const next = text[index + 1];
  if (next !== undefined && !/\s/.test(next)) return false;

  const token = tokenBeforePunctuation(text, index);
  if (ABBREVIATIONS.has(token) || /^[A-Z]$/.test(token)) return false;

  return true;
}

function findSentenceTerminators(text: string): Array<{ index: number; length: number }> {
  const matches: Array<{ index: number; length: number }> = [];
  for (let i = 0; i < text.length; i++) {
    if (isSentenceTerminator(text, i)) {
      matches.push({ index: i, length: 1 });
    }
  }
  return matches;
}

function isCompleteSentence(text: string): boolean {
  const trimmed = text.trim();
  const terms = findSentenceTerminators(trimmed);
  if (terms.length === 0) return false;
  const last = terms[terms.length - 1];
  return last.index === trimmed.length - 1;
}

/**
 * Trim a multi-sentence field to the last complete sentence that fits within the
 * hard cap. The trailing incomplete sentence or fragment is dropped. We never
 * emit an ellipsis-truncated sentence; if no complete sentence fits within the
 * cap, we fail with a typed contract error instead.
 */
export function trimToLastCompleteSentence(text: string, maxLength: number, field: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    if (isCompleteSentence(trimmed)) {
      return trimmed;
    }
    const terms = findSentenceTerminators(trimmed);
    if (terms.length > 0) {
      const last = terms[terms.length - 1];
      return trimmed.slice(0, last.index + 1);
    }
    contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', trimmed.length, maxLength);
  }

  let lastTerm = -1;
  for (let i = 0; i < Math.min(trimmed.length, maxLength); i++) {
    if (isSentenceTerminator(trimmed, i)) {
      lastTerm = i;
    }
  }
  if (lastTerm >= 0) {
    return trimmed.slice(0, lastTerm + 1);
  }
  contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', trimmed.length, maxLength);
}

/**
 * The one-sentence pitch is a distinct contract: exactly one complete sentence,
 * within the unchanged cap, no truncation, no selection of an earlier sentence
 * from a multi-sentence response, and no ellipsis ending. Anything else is a
 * contract failure that must be regenerated.
 */
function assertOneSentencePitch(text: string, maxLength: number, field: string): string {
  // Collapse whitespace only; do not mutate content or punctuation.
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const len = trimmed.length;

  if (len > maxLength) {
    contractError(field, 'ONE_SENTENCE_PITCH_OVER_CAP', len, maxLength);
  }

  const terms = findSentenceTerminators(trimmed);
  if (terms.length === 0) {
    contractError(field, 'NO_COMPLETE_SENTENCE_WITHIN_CAP', len, maxLength);
  }
  if (terms.length > 1) {
    contractError(field, 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES', len, maxLength);
  }

  const end = terms[0].index + terms[0].length;
  if (end !== trimmed.length && trimmed.slice(end).trim().length > 0) {
    contractError(field, 'ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES', len, maxLength);
  }

  return trimmed;
}

/**
 * Apply all permitted cosmetic normalizations to `synthesis` in-place.
 * Returns a log of what was changed for observability.
 *
 * @param synthesis  The SynthesisOutput object (mutated in-place).
 * @param quickWins  The assembled quick_wins array (mutated in-place).
 * @param strategicRevisions  The assembled strategic_revisions array (mutated in-place).
 */
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

  // ── Overview summary: allow overage up to CAP, sentence-boundary trim ─────
  // Multi-sentence author-facing prose may run over base freely; it is only
  // trimmed when it exceeds the hard CAP, and then only at a complete-sentence
  // boundary.  We also drop any incomplete trailing fragment that happens to
  // fit within the CAP so the certified artifact never ends mid-sentence.
  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const after = trimToLastCompleteSentence(before, OVERVIEW_MAX_CHARS, 'overview.one_paragraph_summary');
    if (after !== before) {
      synthesis.overall.one_paragraph_summary = after;
      normalizations.push({ field: 'overview.one_paragraph_summary', before, after, operation: 'trim_sentence_boundary' });
    }
  }

  // ── One-sentence pitch: exact one-sentence contract, no truncation ────────
  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const after = assertOneSentencePitch(before, ONE_SENTENCE_PITCH_MAX_CHARS, 'overview.one_sentence_pitch');
    if (after !== before) {
      synthesis.overall.one_sentence_pitch = after;
      normalizations.push({ field: 'overview.one_sentence_pitch', before, after, operation: 'trim_whitespace' });
    }
  }

  // ── One-paragraph pitch: multi-sentence, last complete sentence within CAP ─
  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const after = trimToLastCompleteSentence(before, ONE_PARAGRAPH_PITCH_MAX_CHARS, 'overview.one_paragraph_pitch');
    if (after !== before) {
      synthesis.overall.one_paragraph_pitch = after;
      normalizations.push({ field: 'overview.one_paragraph_pitch', before, after, operation: 'trim_sentence_boundary' });
    }
  }

  // ── Strengths and risks: each bullet must be a complete sentence ──────────
  for (const listKey of ['top_3_strengths', 'top_3_risks'] as const) {
    const list = synthesis.overall[listKey];
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (typeof item !== 'string') continue;
        const before = item;
        const after = trimToLastCompleteSentence(before, before.length, `overview.${listKey}[${i}]`);
        if (after !== before) {
          list[i] = after;
          normalizations.push({ field: `overview.${listKey}[${i}]`, before, after, operation: 'trim_sentence_boundary' });
        }
      }
    }
  }

  // ── Recommendation normalization ─────────────────────────────────────────
  // Cosmetic-only repairs via shared, idempotent helpers (never alter meaning):
  //   whitespace collapse → adjacent-duplicate-word collapse (A4) →
  //   capitalize first alpha (A3/A4/D2) → ensure terminal punctuation (A3/A4).
  function normalizeRecs(
    recs: Array<Record<string, unknown>>,
    prefix: string,
  ) {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      for (const field of RECOMMENDATION_PROSE_FIELDS) {
        const raw = rec[field];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        let value = raw.trim();

        const collapsedWs = value.replace(/\s+/g, ' ');
        if (collapsedWs !== value) {
          normalizations.push({ field: `${prefix}[${i}].${field}`, before: value, after: collapsedWs, operation: 'whitespace' });
          value = collapsedWs;
        }

        const dedup = collapseAdjacentDuplicateWords(value);
        if (dedup !== value) {
          normalizations.push({ field: `${prefix}[${i}].${field}`, before: value, after: dedup, operation: 'whitespace' });
          value = dedup;
        }

        const capitalized = capitalizeFirstAlpha(value);
        if (capitalized !== value) {
          normalizations.push({ field: `${prefix}[${i}].${field}`, before: value, after: capitalized, operation: 'capitalize' });
          value = capitalized;
        }

        const punctuated = ensureTerminalPunctuation(value);
        if (punctuated !== value) {
          normalizations.push({ field: `${prefix}[${i}].${field}`, before: value, after: punctuated, operation: 'terminal_punct' });
          value = punctuated;
        }

        rec[field] = value;
      }
    }
  }

  normalizeRecs(quickWins as Array<Record<string, unknown>>, 'recommendations.quick_wins');
  normalizeRecs(strategicRevisions as Array<Record<string, unknown>>, 'recommendations.strategic_revisions');

  // Also normalize criterion-level recommendations (for completeness)
  for (let ci = 0; ci < synthesis.criteria.length; ci++) {
    const criterion = synthesis.criteria[ci];
    if (!criterion.recommendations) continue;
    normalizeRecs(criterion.recommendations as Array<Record<string, unknown>>, `criteria[${ci}].recommendations`);
  }

  return { normalizations };
}
