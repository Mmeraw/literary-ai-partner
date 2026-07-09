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

import { trimAtSentenceBoundary } from './evaluationCertificationGate';
import {
  SUMMARY_POLICY,
  ONE_SENTENCE_PITCH_POLICY,
  ONE_PARAGRAPH_PITCH_POLICY,
} from '@/lib/config/lengthPolicy';

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
  // CAP, and then only at a complete-sentence boundary.
  if (synthesis.overall.one_paragraph_summary) {
    const before = synthesis.overall.one_paragraph_summary;
    const after = trimAtSentenceBoundary(before, OVERVIEW_MAX_CHARS);
    if (after !== before) {
      synthesis.overall.one_paragraph_summary = after;
      normalizations.push({ field: 'overview.one_paragraph_summary', before, after, operation: 'trim_sentence_boundary' });
    }
  }

  // ── Pitch fields: hard-capped, sentence-boundary trim at CAP ─────────────
  if (synthesis.overall.one_sentence_pitch) {
    const before = synthesis.overall.one_sentence_pitch;
    const after = trimAtSentenceBoundary(before, ONE_SENTENCE_PITCH_MAX_CHARS);
    if (after !== before) {
      synthesis.overall.one_sentence_pitch = after;
      normalizations.push({ field: 'overview.one_sentence_pitch', before, after, operation: 'trim_sentence_boundary' });
    }
  }
  if (synthesis.overall.one_paragraph_pitch) {
    const before = synthesis.overall.one_paragraph_pitch;
    const after = trimAtSentenceBoundary(before, ONE_PARAGRAPH_PITCH_MAX_CHARS);
    if (after !== before) {
      synthesis.overall.one_paragraph_pitch = after;
      normalizations.push({ field: 'overview.one_paragraph_pitch', before, after, operation: 'trim_sentence_boundary' });
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
