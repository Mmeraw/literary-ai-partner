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
  trimAtSentenceBoundary,
  EvaluationCertificationFailedError,
  type ECGResult,
  type ECGViolation,
} from './evaluationCertificationGate';
import {
  capitalizeFirstAlpha,
  ensureTerminalPunctuation,
  collapseAdjacentDuplicateWords,
  endsMidSentence,
} from '@/lib/text/authorFacingProse';
import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
} from '@/lib/config/lengthPolicy';

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
  operation: 'capitalize' | 'terminal_punct' | 'whitespace' | 'trim_sentence_boundary';
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

function failAsCertificationError(field: string, message: string): never {
  const certified_at = new Date().toISOString();
  const violation: ECGViolation = {
    code: 'ECG_TEXT_MIDSENTENCE_TERMINATION',
    domain: 'TEXT',
    severity: 'FATAL',
    message,
    section: field,
    authority: 'normalizeArtifact() pre-stage',
  };
  const ecgResult: ECGResult = {
    status: 'CERTIFICATION_FAILED',
    mode: 'ENFORCE',
    violations: [violation],
    fatal: [violation],
    advisory: [],
    certified_at,
    summary: `ECG CERTIFICATION_FAILED (mode=ENFORCE) — 1 fatal, 0 advisory. Score=0. Fatals: ECG_TEXT_MIDSENTENCE_TERMINATION.`,
  };
  throw new EvaluationCertificationFailedError(ecgResult);
}

/**
 * Trim author-facing prose to a hard character ceiling, then ensure it ends on a
 * complete sentence. Multi-sentence fields may drop the trailing incomplete sentence
 * or fragment. A one-sentence pitch or any field that cannot be made to end on a
 * complete sentence within the cap is a certification failure — it must be
 * regenerated upstream, not ellipsis-truncated.
 *
 * Two-step discipline:
 *   1. trimAtSentenceBoundary(text, maxLength) handles over-CAP text.
 *   2. If the result still ends mid-sentence (incomplete trailing fragment within
 *      CAP), trimAtSentenceBoundary(no max) drops the dangling fragment by finding
 *      the last sentence terminator.
 *   3. If no complete sentence fits within the cap, fail with a typed
 *      ECG_TEXT_MIDSENTENCE_TERMINATION error. We never emit an ellipsis-truncated
 *      incomplete sentence.
 */
function trimToCompleteSentenceOrFail(text: string, maxLength: number, field: string): string {
  const bounded = trimAtSentenceBoundary(text, maxLength);
  if (bounded.endsWith('…') || bounded.endsWith('...')) {
    failAsCertificationError(
      field,
      `${field} cannot be trimmed to a complete sentence within the ${maxLength}-character cap; ` +
        `trimAtSentenceBoundary produced an ellipsis-truncated fragment. Regenerate the field upstream.`,
    );
  }
  if (!endsMidSentence(bounded)) {
    return bounded;
  }
  const complete = trimAtSentenceBoundary(bounded);
  if (!endsMidSentence(complete) && complete.trim().length > 0) {
    return complete;
  }
  failAsCertificationError(
    field,
    `${field} ends mid-sentence and cannot be normalized to a complete sentence within the ${maxLength}-character cap. ` +
      `Regenerate the field upstream.`,
  );
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
  // Author-facing prose: "more is more". We do NOT trim it back toward base —
  // it may run over base freely and is only trimmed if it exceeds the hard
  // CAP, and then only at a complete-sentence boundary.  We also drop any
  // incomplete trailing fragment that happens to fit within the CAP so the
  // certified artifact never ends mid-sentence.
  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const after = trimToCompleteSentenceOrFail(before, OVERVIEW_MAX_CHARS, 'overview.one_paragraph_summary');
    if (after !== before) {
      synthesis.overall.one_paragraph_summary = after;
      normalizations.push({ field: 'overview.one_paragraph_summary', before, after, operation: 'trim_sentence_boundary' });
    }
  }

  // ── Pitch fields: hard-capped, sentence-boundary trim at CAP ─────────────
  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const after = trimToCompleteSentenceOrFail(before, ONE_SENTENCE_PITCH_MAX_CHARS, 'overview.one_sentence_pitch');
    if (after !== before) {
      synthesis.overall.one_sentence_pitch = after;
      normalizations.push({ field: 'overview.one_sentence_pitch', before, after, operation: 'trim_sentence_boundary' });
    }
  }
  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const after = trimToCompleteSentenceOrFail(before, ONE_PARAGRAPH_PITCH_MAX_CHARS, 'overview.one_paragraph_pitch');
    if (after !== before) {
      synthesis.overall.one_paragraph_pitch = after;
      normalizations.push({ field: 'overview.one_paragraph_pitch', before, after, operation: 'trim_sentence_boundary' });
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
