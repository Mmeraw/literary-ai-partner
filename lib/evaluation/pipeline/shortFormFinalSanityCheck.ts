import type { EvaluationCriterionV2, EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { ShortFormEvidenceGateResult } from './shortFormEvidenceGate';
import {
  collapseAdjacentDuplicateWords,
  endsMidSentence,
  capitalizeFirstAlpha,
} from '@/lib/text/authorFacingProse';

export type ShortFormViolation = {
  code: string;
  field: string;
  sample: string;
};

export type ShortFormFinalSanityCheck = {
  schema_version: 'short_form_final_sanity_check_v1';
  verdict: 'PASS' | 'WARN' | 'BLOCK';
  codes: string[];
  violations?: ShortFormViolation[];
  blocking: boolean;
  public_safe_reason?: string;
  internal_reason?: string;
};

// Matches only the internal pipeline labels that should never appear in user-facing text.
// "PHASE" alone is intentionally excluded — it is common editorial prose (e.g. "each phase
// of the narrative arc"). Only explicit pipeline identifiers are blocked.
const INTERNAL_PROCESS_PATTERNS = /\b(Pass\s*[1234]|Phase\s*3B|Phase\s*[012](?:[._a-z]|\s|$)|WAVE\s+internals|seed\s+names|job\s+pipeline|pipeline\s+internals)\b/i;
const WHOLE_MANUSCRIPT_PATTERNS = /\b(full[- ]novel|whole[- ]book|whole[- ]manuscript|entire manuscript|complete manuscript|ending payoff|whole-book arc|market ready)\b/i;

// Long-form-only pipeline labels. WAVE is deliberately case-sensitive so legitimate
// phrases like "millimeter wave" are not flagged.
const LONGFORM_LEAK_PATTERNS = [
  { code: 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK', pattern: /\bWAVE\b/, label: 'WAVE' },
  { code: 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK', pattern: /\bGolden Spine\b/i, label: 'Golden Spine' },
  { code: 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK', pattern: /\blong-form canon\b/i, label: 'long-form canon' },
  { code: 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK', pattern: /\bPhase\s*5\b/i, label: 'Phase 5' },
] as const;

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function criterionHasAnchor(criterion: EvaluationCriterionV2): boolean {
  return Array.isArray(criterion.evidence) && criterion.evidence.some((anchor) => anchor.snippet?.trim().length >= 12);
}

function* collectUserFacingFields(result: EvaluationResultV2): Generator<{ field: string; text: string }> {
  if (typeof result.overview?.verdict === 'string') {
    yield { field: 'overview.verdict', text: result.overview.verdict };
  }
  if (typeof result.overview?.one_paragraph_summary === 'string') {
    yield { field: 'overview.one_paragraph_summary', text: result.overview.one_paragraph_summary };
  }
  const summary = (result.overview as { summary?: unknown } | undefined)?.summary;
  if (typeof summary === 'string') {
    yield { field: 'overview.summary', text: summary };
  }
  if (Array.isArray(result.criteria)) {
    for (let i = 0; i < result.criteria.length; i++) {
      const rationale = result.criteria[i].rationale;
      if (typeof rationale === 'string') {
        yield { field: `criteria[${i}].rationale`, text: rationale };
      }
    }
  }
}

function collectUserFacingText(result: EvaluationResultV2): string {
  return [...collectUserFacingFields(result)].map(({ text }) => text).join('\n');
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
type DiagnosticSegment = {
  field: string;
  text: string;
};

function* collectDiagnosticSegments(result: EvaluationResultV2): Generator<DiagnosticSegment> {
  const criteria = Array.isArray(result.criteria) ? result.criteria : [];
  for (let i = 0; i < criteria.length; i++) {
    const criterion = criteria[i];
    if (typeof criterion.rationale === 'string') {
      yield { field: `criteria[${i}].rationale`, text: criterion.rationale };
    }
    const recs = Array.isArray(criterion.recommendations) ? criterion.recommendations : [];
    for (let j = 0; j < recs.length; j++) {
      for (const field of OPPORTUNITY_PROSE_FIELDS) {
        const value = (recs[j] as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.trim().length > 0) {
          yield { field: `criteria[${i}].recommendations[${j}].${field}`, text: value };
        }
      }
    }
  }
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
  const violations: ShortFormViolation[] = [];
  const text = collectUserFacingText(input.evaluationResult);
  const criteria = Array.isArray(input.evaluationResult.criteria) ? input.evaluationResult.criteria : [];
  const scored = criteria.filter((criterion) => criterion.scorable === true && typeof criterion.score_0_10 === 'number');
  const scoredWithoutAnchors = scored.filter((criterion) => !criterionHasAnchor(criterion));
  const highConfidenceWithoutAnchors = scored.filter((criterion) => criterion.confidence_level === 'high' && !criterionHasAnchor(criterion));
  const insufficientCount = criteria.filter((criterion) => criterion.scorability_status === 'non_scorable' || criterion.score_0_10 === null).length;

  function addViolation(code: string, field: string, sample: string) {
    if (!codes.includes(code)) codes.push(code);
    violations.push({ code, field, sample });
  }

  function findPatternMatches(text: string, pattern: RegExp): Array<{ matched: string; index: number }> {
    const matches: Array<{ matched: string; index: number }> = [];
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const re = new RegExp(pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ matched: m[0], index: m.index });
      if (m[0].length === 0) re.lastIndex++;
    }
    return matches;
  }

  for (const { field, text: fieldText } of collectUserFacingFields(input.evaluationResult)) {
    for (const match of findPatternMatches(fieldText, INTERNAL_PROCESS_PATTERNS)) {
      addViolation('SHORT_FORM_INTERNAL_PROCESS_LEAK', field, fieldText.slice(Math.max(0, match.index - 20), match.index + match.matched.length + 20));
    }
    for (const match of findPatternMatches(fieldText, WHOLE_MANUSCRIPT_PATTERNS)) {
      addViolation('SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM', field, fieldText.slice(Math.max(0, match.index - 20), match.index + match.matched.length + 20));
    }
    for (const { code, pattern } of LONGFORM_LEAK_PATTERNS) {
      for (const match of findPatternMatches(fieldText, pattern)) {
        addViolation(code, field, fieldText.slice(Math.max(0, match.index - 20), match.index + match.matched.length + 20));
      }
    }
  }

  if (scoredWithoutAnchors.length > 0) codes.push('SHORT_FORM_MISSING_ANCHORS');
  if (highConfidenceWithoutAnchors.length > 0) codes.push('SHORT_FORM_FAKE_CERTAINTY');
  if (scored.length >= 10 && scored.every((criterion) => criterion.score_0_10 === 0)) codes.push('SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER');
  if (insufficientCount >= 7 && /\bmarket ready\b/i.test(text)) codes.push('SHORT_FORM_SCORE_SUMMARY_CONTRADICTION');

  // ── Copy-integrity backstop (A4 + global mid-sentence invariant) ──────────
  // The trivial cases are auto-repaired upstream by the shared helpers at the
  // normalizeArtifact pre-stage. This referee blocks anything that survived to
  // persist-time: prose ending mid-sentence (missing terminal punctuation,
  // dangling connective/comma/colon/open paren), a lowercase opening, or an
  // accidental adjacent-duplicate word.
  for (const { field, text } of collectDiagnosticSegments(input.evaluationResult)) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const sample = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
    if (endsMidSentence(trimmed)) {
      addViolation('SHORT_FORM_MIDSENTENCE_TERMINATION', field, sample);
    }
    // Lowercase opening (first alpha char is lowercase).
    if (capitalizeFirstAlpha(trimmed) !== trimmed) {
      addViolation('SHORT_FORM_COPY_DEFECT', field, sample);
    }
    // Accidental adjacent-duplicate word ("passage reflective passage").
    if (collapseAdjacentDuplicateWords(trimmed) !== trimmed) {
      addViolation('SHORT_FORM_COPY_DEFECT', field, sample);
    }
  }

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
    violations,
    blocking,
    public_safe_reason: blocking
      ? 'The report needs correction before release because some claims are not supported by the submitted text.'
      : 'The report is safe with evidence-scope warnings.',
    internal_reason: `Short-form sanity check found ${uniqueCodes.join(', ')}`,
  };
}
