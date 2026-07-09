import type { EvaluationCriterionV2, EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { ShortFormEvidenceGateResult } from './shortFormEvidenceGate';
import {
  collapseAdjacentDuplicateWords,
  endsWithDanglingConnective,
  capitalizeFirstAlpha,
} from '@/lib/text/authorFacingProse';

export type ShortFormFinalSanityCheck = {
  schema_version: 'short_form_final_sanity_check_v1';
  verdict: 'PASS' | 'WARN' | 'BLOCK';
  codes: string[];
  blocking: boolean;
  public_safe_reason?: string;
  internal_reason?: string;
};

// Matches only the internal pipeline labels that should never appear in user-facing text.
// "PHASE" alone is intentionally excluded — it is common editorial prose (e.g. "each phase
// of the narrative arc"). Only explicit pipeline identifiers are blocked.
const INTERNAL_PROCESS_PATTERNS = /\b(Pass\s*[1234]|Phase\s*3B|Phase\s*[012](?:[._a-z]|\s|$)|WAVE\s+internals|seed\s+names|job\s+pipeline|pipeline\s+internals)\b/i;
const WHOLE_MANUSCRIPT_PATTERNS = /\b(full[- ]novel|whole[- ]book|whole[- ]manuscript|entire manuscript|complete manuscript|ending payoff|whole-book arc|market ready)\b/i;

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function criterionHasAnchor(criterion: EvaluationCriterionV2): boolean {
  return Array.isArray(criterion.evidence) && criterion.evidence.some((anchor) => anchor.snippet?.trim().length >= 12);
}

function collectUserFacingText(result: EvaluationResultV2): string {
  return [
    result.overview?.verdict,
    result.overview?.one_paragraph_summary,
    (result.overview as { summary?: unknown } | undefined)?.summary,
    ...(Array.isArray(result.criteria) ? result.criteria.map((criterion) => criterion.rationale) : []),
  ].filter((value): value is string => typeof value === 'string').join('\n');
}

// Prose fields carried on each recommendation/opportunity. anchor_snippet and
// candidate_text_* are intentionally excluded (verbatim quotes / strategy copy).
const OPPORTUNITY_PROSE_FIELDS = [
  'action', 'expected_impact', 'symptom', 'mechanism', 'specific_fix', 'reader_effect',
] as const;

/**
 * Individual author-facing prose segments (rationale + every opportunity
 * diagnostic field). Each must independently be a complete, well-formed
 * sentence — so the copy-integrity checks run PER SEGMENT rather than on a
 * joined blob (which would mask a mid-sentence end inside the text).
 */
function collectDiagnosticSegments(result: EvaluationResultV2): string[] {
  const segments: string[] = [];
  const criteria = Array.isArray(result.criteria) ? result.criteria : [];
  for (const criterion of criteria) {
    if (typeof criterion.rationale === 'string') segments.push(criterion.rationale);
    const recs = Array.isArray(criterion.recommendations) ? criterion.recommendations : [];
    for (const rec of recs) {
      for (const field of OPPORTUNITY_PROSE_FIELDS) {
        const value = (rec as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.trim().length > 0) segments.push(value);
      }
    }
  }
  return segments;
}

export function runShortFormFinalSanityCheck(input: {
  wordCount: number;
  evaluationResult: EvaluationResultV2;
  evidenceGate?: ShortFormEvidenceGateResult;
}): ShortFormFinalSanityCheck {
  if (input.wordCount >= 25_000) {
    return {
      schema_version: 'short_form_final_sanity_check_v1',
      verdict: 'PASS',
      codes: ['SHORT_FORM_SANITY_PASS'],
      blocking: false,
      public_safe_reason: 'Long-form evaluation is handled by the long-form verification path.',
    };
  }

  const codes: string[] = [];
  const text = collectUserFacingText(input.evaluationResult);
  const criteria = Array.isArray(input.evaluationResult.criteria) ? input.evaluationResult.criteria : [];
  const scored = criteria.filter((criterion) => criterion.scorable === true && typeof criterion.score_0_10 === 'number');
  const scoredWithoutAnchors = scored.filter((criterion) => !criterionHasAnchor(criterion));
  const highConfidenceWithoutAnchors = scored.filter((criterion) => criterion.confidence_level === 'high' && !criterionHasAnchor(criterion));
  const insufficientCount = criteria.filter((criterion) => criterion.scorability_status === 'non_scorable' || criterion.score_0_10 === null).length;

  if (INTERNAL_PROCESS_PATTERNS.test(text)) codes.push('SHORT_FORM_INTERNAL_PROCESS_LEAK');
  if (WHOLE_MANUSCRIPT_PATTERNS.test(text)) codes.push('SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM');
  if (scoredWithoutAnchors.length > 0) codes.push('SHORT_FORM_MISSING_ANCHORS');
  if (highConfidenceWithoutAnchors.length > 0) codes.push('SHORT_FORM_FAKE_CERTAINTY');
  if (scored.length >= 10 && scored.every((criterion) => criterion.score_0_10 === 0)) codes.push('SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER');
  if (insufficientCount >= 7 && /\bmarket ready\b/i.test(text)) codes.push('SHORT_FORM_SCORE_SUMMARY_CONTRADICTION');
  if (/\b(WAVE|Golden Spine|long-form canon|Phase 5)\b/i.test(text)) codes.push('SHORT_FORM_LONGFORM_ARTIFACT_LEAK');

  // ── Copy-integrity backstop (A4 + global mid-sentence invariant) ──────────
  // The trivial cases are auto-repaired upstream by the shared helpers at the
  // normalizeArtifact pre-stage. This referee blocks anything that survived to
  // persist-time: prose ending mid-sentence (dangling connective/comma/colon/
  // open paren), a lowercase opening, or an accidental adjacent-duplicate word.
  const diagnosticSegments = collectDiagnosticSegments(input.evaluationResult);
  let sawMidSentence = false;
  let sawCopyDefect = false;
  for (const segment of diagnosticSegments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    if (endsWithDanglingConnective(trimmed)) sawMidSentence = true;
    // Lowercase opening (first alpha char is lowercase).
    if (capitalizeFirstAlpha(trimmed) !== trimmed) sawCopyDefect = true;
    // Accidental adjacent-duplicate word ("passage reflective passage").
    if (collapseAdjacentDuplicateWords(trimmed) !== trimmed) sawCopyDefect = true;
  }
  if (sawMidSentence) codes.push('SHORT_FORM_MIDSENTENCE_TERMINATION');
  if (sawCopyDefect) codes.push('SHORT_FORM_COPY_DEFECT');

  const blockingCodes = new Set([
    'SHORT_FORM_INTERNAL_PROCESS_LEAK',
    'SHORT_FORM_MISSING_ANCHORS',
    'SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER',
    'SHORT_FORM_SCORE_SUMMARY_CONTRADICTION',
    'SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM',
    'SHORT_FORM_LONGFORM_ARTIFACT_LEAK',
    'SHORT_FORM_MIDSENTENCE_TERMINATION',
    'SHORT_FORM_COPY_DEFECT',
  ]);
  const uniqueCodes = unique(codes);
  const blocking = uniqueCodes.some((code) => blockingCodes.has(code));

  if (uniqueCodes.length === 0) {
    return {
      schema_version: 'short_form_final_sanity_check_v1',
      verdict: 'PASS',
      codes: ['SHORT_FORM_SANITY_PASS'],
      blocking: false,
      public_safe_reason: 'Short-form report passed deterministic evidence and wording checks.',
    };
  }

  return {
    schema_version: 'short_form_final_sanity_check_v1',
    verdict: blocking ? 'BLOCK' : 'WARN',
    codes: uniqueCodes,
    blocking,
    public_safe_reason: blocking
      ? 'The report needs correction before release because some claims are not supported by the submitted text.'
      : 'The report is safe with evidence-scope warnings.',
    internal_reason: `Short-form sanity check found ${uniqueCodes.join(', ')}`,
  };
}
