import type { EvaluationCriterionV2, EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { ShortFormEvidenceGateResult } from './shortFormEvidenceGate';

export type ShortFormFinalSanityCheck = {
  schema_version: 'short_form_final_sanity_check_v1';
  verdict: 'PASS' | 'WARN' | 'BLOCK';
  codes: string[];
  blocking: boolean;
  public_safe_reason?: string;
  internal_reason?: string;
};

const INTERNAL_PROCESS_PATTERNS = /\b(PHASE|Pass\s*[1234]|Phase\s*3B|WAVE internals|seed names|job pipeline|pipeline internals)\b/i;
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

  const blockingCodes = new Set([
    'SHORT_FORM_INTERNAL_PROCESS_LEAK',
    'SHORT_FORM_MISSING_ANCHORS',
    'SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER',
    'SHORT_FORM_SCORE_SUMMARY_CONTRADICTION',
    'SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM',
    'SHORT_FORM_LONGFORM_ARTIFACT_LEAK',
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
