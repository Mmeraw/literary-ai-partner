/**
 * Read-time sanitization for download exports.
 *
 * Applies the same malformed-text repairs that the write-time persistence
 * sanitizer uses, but at download time so that EXISTING stored artifacts
 * (persisted before the write-time sanitizer was deployed) also produce
 * clean downloads.
 *
 * This is the permanent fix for the "temporarily unavailable" download
 * blocker: contaminated text in stored artifacts no longer fails the
 * parity gate because it's cleaned before validation.
 *
 * All forbidden patterns are imported from the shared registry
 * (reportForbiddenPatterns.ts) — the single source of truth.
 */

import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';
import { getForbiddenReplacements } from '@/lib/evaluation/reportForbiddenPatterns';

const DOWNLOAD_SANITIZER_PATTERNS = getForbiddenReplacements();

function sanitizeText(value: string): string {
  if (!value) return value;
  let result = value;
  for (const pattern of DOWNLOAD_SANITIZER_PATTERNS) {
    result = result.replace(pattern.re, pattern.replacement);
  }
  return mistakeProofText(result, '').trim() || value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Sanitizes an evaluation result object in-place for download export.
 * Cleans all known malformed text patterns from author-facing fields
 * so the downstream parity gate passes cleanly.
 *
 * Returns the same object reference (mutated) for convenience.
 */
export function sanitizeResultForDownload<T extends Record<string, unknown>>(result: T): T {
  // Sanitize overview fields
  if (isRecord(result.overview)) {
    const overview = result.overview as Record<string, unknown>;
    if (typeof overview.one_paragraph_summary === 'string') {
      overview.one_paragraph_summary = sanitizeText(overview.one_paragraph_summary);
    }
    if (Array.isArray(overview.top_3_strengths)) {
      overview.top_3_strengths = overview.top_3_strengths.map((item: unknown) =>
        typeof item === 'string' ? sanitizeText(item) : item,
      );
    }
    if (Array.isArray(overview.top_3_risks)) {
      overview.top_3_risks = overview.top_3_risks.map((item: unknown) =>
        typeof item === 'string' ? sanitizeText(item) : item,
      );
    }
  }

  // Sanitize criteria rationales and recommendation fields
  if (Array.isArray(result.criteria)) {
    for (const criterion of result.criteria as Array<Record<string, unknown>>) {
      if (!isRecord(criterion)) continue;

      if (typeof criterion.rationale === 'string') {
        criterion.rationale = sanitizeText(criterion.rationale);
      }

      if (Array.isArray(criterion.recommendations)) {
        for (const rec of criterion.recommendations as Array<Record<string, unknown>>) {
          if (!isRecord(rec)) continue;
          if (typeof rec.action === 'string') rec.action = sanitizeText(rec.action);
          if (typeof rec.specific_fix === 'string') rec.specific_fix = sanitizeText(rec.specific_fix);
          if (typeof rec.expected_impact === 'string') rec.expected_impact = sanitizeText(rec.expected_impact);
          if (typeof rec.mechanism === 'string') rec.mechanism = sanitizeText(rec.mechanism);
          if (typeof rec.anchor_snippet === 'string') rec.anchor_snippet = sanitizeText(rec.anchor_snippet);
          if (typeof rec.reader_effect === 'string') rec.reader_effect = sanitizeText(rec.reader_effect);
          if (typeof rec.symptom === 'string') rec.symptom = sanitizeText(rec.symptom);
          if (typeof rec.mistake_proofing === 'string') rec.mistake_proofing = sanitizeText(rec.mistake_proofing);
        }
      }

      // Sanitize evidence_snippets
      if (Array.isArray(criterion.evidence_snippets)) {
        for (const snippet of criterion.evidence_snippets as Array<Record<string, unknown>>) {
          if (!isRecord(snippet)) continue;
          if (typeof snippet.snippet === 'string') snippet.snippet = sanitizeText(snippet.snippet);
          if (typeof snippet.note === 'string') snippet.note = sanitizeText(snippet.note);
        }
      }
    }
  }

  // Sanitize cross-cutting recommendations
  if (isRecord(result.recommendations)) {
    const recs = result.recommendations as Record<string, unknown>;
    if (Array.isArray(recs.quick_wins)) {
      for (const item of recs.quick_wins as Array<Record<string, unknown>>) {
        if (!isRecord(item)) continue;
        if (typeof item.action === 'string') item.action = sanitizeText(item.action);
        if (typeof item.why === 'string') item.why = sanitizeText(item.why);
      }
    }
    if (Array.isArray(recs.strategic_revisions)) {
      for (const item of recs.strategic_revisions as Array<Record<string, unknown>>) {
        if (!isRecord(item)) continue;
        if (typeof item.action === 'string') item.action = sanitizeText(item.action);
        if (typeof item.why === 'string') item.why = sanitizeText(item.why);
      }
    }
  }

  return result;
}
