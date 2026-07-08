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
 *   ✔ Trim text fields at word boundary (overview summary, pitches)
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

import { trimAtWordBoundary } from './evaluationCertificationGate';

export interface NormalizationRecord {
  field: string;
  before: string;
  after: string;
  operation: 'capitalize' | 'terminal_punct' | 'whitespace' | 'trim_word_boundary';
}

export interface NormalizeArtifactResult {
  normalizations: NormalizationRecord[];
}

/** Maximum chars for the executive summary / overview. */
const OVERVIEW_MAX_CHARS = 750;
/** Maximum chars for pitch fields. */
const PITCH_MAX_CHARS = 1000;

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

  // ── Overview summary: trim at word boundary ──────────────────────────────
  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const after = trimAtWordBoundary(before, OVERVIEW_MAX_CHARS);
    if (after !== before) {
      synthesis.overall.one_paragraph_summary = after;
      normalizations.push({ field: 'overview.one_paragraph_summary', before, after, operation: 'trim_word_boundary' });
    }
  }

  // ── Pitch fields: trim at word boundary ─────────────────────────────────
  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const after = trimAtWordBoundary(before, PITCH_MAX_CHARS);
    if (after !== before) {
      synthesis.overall.one_sentence_pitch = after;
      normalizations.push({ field: 'overview.one_sentence_pitch', before, after, operation: 'trim_word_boundary' });
    }
  }
  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const after = trimAtWordBoundary(before, PITCH_MAX_CHARS);
    if (after !== before) {
      synthesis.overall.one_paragraph_pitch = after;
      normalizations.push({ field: 'overview.one_paragraph_pitch', before, after, operation: 'trim_word_boundary' });
    }
  }

  // ── Recommendation normalization ─────────────────────────────────────────
  function normalizeRecs(
    recs: Array<{ action?: string }>,
    prefix: string,
  ) {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      if (!rec.action?.trim()) continue;
      let value = rec.action.trim();

      // Collapse whitespace
      const collapsed = value.replace(/\s+/g, ' ');
      if (collapsed !== value) {
        normalizations.push({ field: `${prefix}[${i}].action`, before: value, after: collapsed, operation: 'whitespace' });
        value = collapsed;
      }

      // Capitalize first letter
      if (value.length > 0 && value.charAt(0) !== value.charAt(0).toUpperCase()) {
        const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
        normalizations.push({ field: `${prefix}[${i}].action`, before: value, after: capitalized, operation: 'capitalize' });
        value = capitalized;
      }

      // Terminal punctuation
      if (!/[.!?…]$/.test(value)) {
        const punctuated = value + '.';
        normalizations.push({ field: `${prefix}[${i}].action`, before: value, after: punctuated, operation: 'terminal_punct' });
        value = punctuated;
      }

      rec.action = value;
    }
  }

  normalizeRecs(quickWins, 'recommendations.quick_wins');
  normalizeRecs(strategicRevisions, 'recommendations.strategic_revisions');

  // Also normalize criterion-level recommendations (for completeness)
  for (let ci = 0; ci < synthesis.criteria.length; ci++) {
    const criterion = synthesis.criteria[ci];
    if (!criterion.recommendations) continue;
    normalizeRecs(criterion.recommendations as Array<{ action?: string }>, `criteria[${ci}].recommendations`);
  }

  return { normalizations };
}
