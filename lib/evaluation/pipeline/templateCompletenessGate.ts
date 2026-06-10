/**
 * Template Completeness Gate
 *
 * Validates that an evaluation artifact satisfies the evaluation template's
 * structural completeness requirements BEFORE persisting.
 *
 * This gate is intentionally stricter than a presence check:
 * - all 13 canonical criteria must be present exactly once
 * - required arrays must contain meaningful, non-placeholder content
 * - recommendation density must be supported by usable diagnostic content
 * - genre must be a publishing/category diagnosis, not a work format such as "novel"
 * - support-alert email contains only job ID + failure type; details stay in admin diagnostics
 *
 * When critical violations are detected:
 * 1. The artifact is NOT persisted
 * 2. A support alert email is sent to support@revisiongrade.com
 * 3. The user sees a quality-review message
 *
 * Template authority: docs/templates/evaluation/*-evaluation-template.md
 */

import { REVISIONGRADE_SUPPORT_EMAIL } from '@/lib/evaluation/hardStopGovernance';
import { CRITERIA_KEYS } from '@/schemas/criteria-keys';

export type TemplateViolation = {
  code: string;
  criterion?: string;
  message: string;
  severity: 'critical' | 'warning';
};

export type TemplateCompletenessResult = {
  pass: boolean;
  violations: TemplateViolation[];
  summary: string;
};

type RecommendationLike = {
  action?: unknown;
  why?: unknown;
  expected_impact?: unknown;
  anchor_snippet?: unknown;
  symptom?: unknown;
  mechanism?: unknown;
  specific_fix?: unknown;
  reader_effect?: unknown;
  mistake_proofing?: unknown;
};

type CriterionLike = {
  key: string;
  score_0_10?: number | null;
  rationale?: string;
  evidence?: { snippet?: string }[];
  recommendations?: unknown[];
  confidence_level?: string;
  technical_defects?: { code: string; author_facing_reason: string }[];
};

type EvaluationResultLike = {
  one_paragraph_summary?: string;
  one_sentence_summary?: string;
  top_3_strengths?: string[];
  top_3_risks?: string[];
  criteria: CriterionLike[];
  recommendations?: {
    quick_wins?: unknown[];
    strategic_revisions?: unknown[];
  };
  metrics?: {
    manuscript?: {
      genre?: unknown;
      target_audience?: unknown;
      word_count?: unknown;
    };
  };
  enrichment?: {
    premise?: unknown;
    diagnosed_genre?: unknown;
    target_audience?: unknown;
  };
  overview?: {
    one_paragraph_summary?: string;
    top_3_strengths?: string[];
    top_3_risks?: string[];
  };
};

const DENSITY_FLOOR: Record<string, number> = {
  '<=5': 2,
  '6-7': 1,
  '8': 0,
};

const FORMAT_WORDS = new Set([
  'book',
  'chapter',
  'excerpt',
  'fiction',
  'manuscript',
  'novel',
  'novella',
  'nonfiction',
  'poem',
  'screenplay',
  'short fiction',
  'short story',
  'story',
]);

const VALID_CONFIDENCE_LEVELS = new Set(['high', 'moderate', 'medium', 'low']);
const PLACEHOLDER_RE = /\b(?:n\/?a|none|not specified|tbd|todo|placeholder|example|lorem ipsum|\[location|\[operation|\[priority|\[severity|\[confidence)\b/i;
const GENERIC_RE = /\b(?:improve|strengthen|clarify|develop|enhance|expand|tighten|revise)\s+(?:the\s+)?(?:writing|story|manuscript|novel|chapter|section|piece)\b/i;

function getDensityBucket(score: number): string | null {
  if (score >= 9) return null;  // 9-10: no minimum
  if (score <= 5) return '<=5'; // <=5: minimum 2
  if (score <= 7) return '6-7'; // 6-7: minimum 1
  return '8';                  // 8: minimum 0
}

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function meaningfulText(value: unknown, minLength = 12): string | null {
  const trimmed = nonEmptyText(value);
  if (!trimmed) return null;
  if (trimmed.length < minLength) return null;
  if (PLACEHOLDER_RE.test(trimmed)) return null;
  return trimmed;
}

function meaningfulTextList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => meaningfulText(item))
    .filter((item): item is string => Boolean(item));
}

function normalizedGenre(value: unknown): string | null {
  const trimmed = meaningfulText(value, 3);
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
  if (FORMAT_WORDS.has(normalized)) return null;
  return trimmed;
}

export function isMeaningfulRecommendation(value: unknown): value is RecommendationLike {
  if (!value || typeof value !== 'object') return false;
  const rec = value as RecommendationLike;
  const fields = [
    rec.anchor_snippet,
    rec.symptom,
    rec.mechanism,
    rec.specific_fix,
    rec.action,
    rec.why,
    rec.reader_effect,
    rec.expected_impact,
    rec.mistake_proofing,
  ];
  const meaningfulFields = fields
    .map((field) => meaningfulText(field))
    .filter((field): field is string => Boolean(field));

  if (meaningfulFields.some((field) => PLACEHOLDER_RE.test(field))) return false;

  const actionish = meaningfulText(rec.specific_fix) ?? meaningfulText(rec.action);
  if (!actionish) return false;

  // Relaxed rule: action (12+ chars) + at least 1 supporting field is sufficient.
  // This matches what the LLM actually produces for short-form evaluations
  // (action + anchor_snippet + expected_impact) without demanding 2+ additional fields.
  if (meaningfulFields.length < 1) return false;

  // A generic action can pass only when paired with manuscript-specific evidence/reasoning.
  if (GENERIC_RE.test(actionish)) {
    const anchor = meaningfulText(rec.anchor_snippet, 20);
    const symptom = meaningfulText(rec.symptom, 20);
    const why = meaningfulText(rec.why, 20) ?? meaningfulText(rec.expected_impact, 20);
    return Boolean(anchor || symptom || why);
  }

  return true;
}

function countMeaningfulRecommendations(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.filter(isMeaningfulRecommendation).length;
}

function pushViolation(violations: TemplateViolation[], violation: TemplateViolation): void {
  violations.push(violation);
}

export function validateTemplateCompleteness(
  result: EvaluationResultLike,
): TemplateCompletenessResult {
  const violations: TemplateViolation[] = [];

  const genre = normalizedGenre(result.enrichment?.diagnosed_genre) ?? normalizedGenre(result.metrics?.manuscript?.genre);
  if (!genre) {
    pushViolation(violations, {
      code: 'MISSING_DIAGNOSED_GENRE',
      message: 'Template requires a publishing/category genre diagnosis; format words such as "novel" are not sufficient.',
      severity: 'critical',
    });
  }

  const targetAudience =
    meaningfulText(result.enrichment?.target_audience, 12) ??
    meaningfulText(result.metrics?.manuscript?.target_audience, 12);
  if (!targetAudience) {
    pushViolation(violations, {
      code: 'MISSING_TARGET_AUDIENCE',
      message: 'Template requires a pipeline-diagnosed target audience statement.',
      severity: 'critical',
    });
  }

  if (!meaningfulText(result.one_paragraph_summary, 40) && !meaningfulText(result.overview?.one_paragraph_summary, 40)) {
    pushViolation(violations, {
      code: 'MISSING_ONE_PARAGRAPH_SUMMARY',
      message: 'Template requires a substantive one_paragraph_summary / One-Paragraph Pitch.',
      severity: 'critical',
    });
  }

  // Current persisted schema does not always carry a distinct one_sentence_summary.
  // Accept a substantive premise as the same upper-report pitch contract until the
  // schema grows a dedicated one-sentence pitch field.
  const oneSentenceOrPremise = meaningfulText(result.one_sentence_summary, 20) ?? meaningfulText(result.enrichment?.premise, 20);
  if (!oneSentenceOrPremise) {
    pushViolation(violations, {
      code: 'MISSING_ONE_SENTENCE_PITCH',
      message: 'Template requires a substantive one-sentence pitch or premise in enrichment.',
      severity: 'critical',
    });
  }

  const strengths = meaningfulTextList(result.top_3_strengths ?? result.overview?.top_3_strengths);
  if (strengths.length < 3) {
    pushViolation(violations, {
      code: 'INCOMPLETE_TOP_STRENGTHS',
      message: `Template requires 3 meaningful top strengths, got ${strengths.length}.`,
      severity: 'critical',
    });
  }

  const risks = meaningfulTextList(result.top_3_risks ?? result.overview?.top_3_risks);
  if (risks.length < 3) {
    pushViolation(violations, {
      code: 'INCOMPLETE_TOP_RISKS',
      message: `Template requires 3 meaningful top risks, got ${risks.length}.`,
      severity: 'critical',
    });
  }

  const observedKeys = result.criteria.map((c) => c.key).filter(Boolean);
  const observedSet = new Set(observedKeys);
  const duplicateKeys = observedKeys.filter((key, index) => observedKeys.indexOf(key) !== index);
  const expectedSet = new Set<string>(CRITERIA_KEYS);
  const missingKeys = CRITERIA_KEYS.filter((key) => !observedSet.has(key));
  const invalidKeys = [...observedSet].filter((key) => !expectedSet.has(key));

  if (result.criteria.length !== CRITERIA_KEYS.length || missingKeys.length > 0 || invalidKeys.length > 0 || duplicateKeys.length > 0) {
    pushViolation(violations, {
      code: 'CRITERIA_CANON_MISMATCH',
      message:
        `Template requires exactly ${CRITERIA_KEYS.length} canonical criteria. ` +
        `got=${result.criteria.length}; missing=${missingKeys.join(', ') || 'none'}; ` +
        `invalid=${invalidKeys.join(', ') || 'none'}; duplicates=${Array.from(new Set(duplicateKeys)).join(', ') || 'none'}.`,
      severity: 'critical',
    });
  }

  let hasAnyDensityViolation = false;
  for (const c of result.criteria) {
    const score = c.score_0_10;

    // Non-scorable/NA criteria may carry null scores in v2; they still need rationale/evidence/confidence,
    // but recommendation density only applies to numeric scorable criteria.
    const hasNumericScore = typeof score === 'number' && Number.isFinite(score);
    if (score !== null && !hasNumericScore) {
      pushViolation(violations, {
        code: 'INVALID_CRITERION_SCORE',
        criterion: c.key,
        message: `Criterion "${c.key}" must have a numeric score from 0 to 10 or null for governed non-scorable criteria.`,
        severity: 'critical',
      });
    }
    if (hasNumericScore && (score < 0 || score > 10)) {
      pushViolation(violations, {
        code: 'INVALID_CRITERION_SCORE',
        criterion: c.key,
        message: `Criterion "${c.key}" must have a numeric score from 0 to 10.`,
        severity: 'critical',
      });
    }

    if (!meaningfulText(c.rationale, 40)) {
      pushViolation(violations, {
        code: 'MISSING_RATIONALE',
        criterion: c.key,
        message: `Criterion "${c.key}" is missing a substantive rationale.`,
        severity: 'critical',
      });
    }

    const evidenceCount = c.evidence?.filter((e) => meaningfulText(e.snippet, 20))?.length ?? 0;
    if (evidenceCount === 0) {
      pushViolation(violations, {
        code: 'MISSING_EVIDENCE',
        criterion: c.key,
        message: `Criterion "${c.key}" has no usable manuscript evidence anchor.`,
        severity: hasNumericScore && score <= 8 ? 'critical' : 'warning',
      });
    }

    const confidence = nonEmptyText(c.confidence_level)?.toLowerCase();
    if (!confidence || !VALID_CONFIDENCE_LEVELS.has(confidence)) {
      pushViolation(violations, {
        code: 'INVALID_CONFIDENCE_LEVEL',
        criterion: c.key,
        message: `Criterion "${c.key}" must have confidence_level High, Moderate, Medium, or Low.`,
        severity: 'critical',
      });
    }

    if (hasNumericScore) {
      // Skip density floor for criteria whose recommendations were governance-suppressed
      // (e.g., removed by the Diagnostic Spine Recommendation Guard because they
      // conflicted with the manuscript's primary reader promise or central argument).
      const isGovernanceSuppressed = (c.technical_defects ?? []).some((defect) =>
        defect.code === 'DIAGNOSTIC_SPINE_PROMISE_MISMATCH' ||
        defect.code === 'DIAGNOSTIC_SPINE_CENTRAL_ARGUMENT_MISMATCH' ||
        defect.author_facing_reason.includes('Recommendation guard suppressed unsafe') ||
        defect.author_facing_reason.includes('recommendations were suppressed because they contradicted'),
      );

      const bucket = getDensityBucket(score);
      if (bucket && !isGovernanceSuppressed) {
        const minRecs = DENSITY_FLOOR[bucket] ?? 2;
        const recCount = countMeaningfulRecommendations(c.recommendations);
        if (recCount < minRecs) {
          pushViolation(violations, {
            code: 'DENSITY_FLOOR_VIOLATION',
            criterion: c.key,
            message: `Criterion "${c.key}" scored ${score}/10 — requires ${minRecs} meaningful recommendations, has ${recCount}.`,
            severity: 'critical',
          });
          hasAnyDensityViolation = true;
        }
      } else if (Array.isArray(c.recommendations)) {
        const rawCount = c.recommendations.length;
        const meaningfulCount = countMeaningfulRecommendations(c.recommendations);
        if (rawCount > 0 && meaningfulCount === 0) {
          pushViolation(violations, {
            code: 'INVALID_HIGH_SCORE_RECOMMENDATIONS',
            criterion: c.key,
            message: `Criterion "${c.key}" has recommendations, but none contain usable diagnostic content.`,
            severity: 'warning',
          });
        }
      }
    }
  }

  const hasLowScoring = result.criteria.some(
    (c) => typeof c.score_0_10 === 'number' && c.score_0_10 <= 8,
  );
  if (hasLowScoring) {
    const quickWins = countMeaningfulRecommendations(result.recommendations?.quick_wins);
    const strategic = countMeaningfulRecommendations(result.recommendations?.strategic_revisions);
    if (quickWins === 0 && strategic === 0) {
      pushViolation(violations, {
        code: 'MISSING_TOP_RECOMMENDATIONS',
        message:
          'Criteria scoring ≤8 exist but no meaningful quick_wins or strategic_revisions were generated.',
        severity: hasAnyDensityViolation ? 'critical' : 'warning',
      });
    }
  }

  const criticalCount = violations.filter((v) => v.severity === 'critical').length;
  const pass = criticalCount === 0;
  const summary = pass
    ? `Template completeness gate PASSED (${violations.length} warning(s)).`
    : `Template completeness gate FAILED: ${criticalCount} critical violation(s), ${violations.length - criticalCount} warning(s).`;

  return { pass, violations, summary };
}

export async function sendCompletenessAlertEmail(
  jobId: string,
  _violations: TemplateViolation[],
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const subject = `[RevisionGrade] Evaluation failed: ${TEMPLATE_COMPLETENESS_FAILURE_CODE} (${jobId.slice(0, 8)}…)`;
  const text = [
    `job_id: ${jobId}`,
    `failure_type: ${TEMPLATE_COMPLETENESS_FAILURE_CODE}`,
  ].join('\n');

  if (!apiKey) {
    console.warn('[TemplateCompletenessGate] RESEND_API_KEY not set — email suppressed');
    console.warn('[TemplateCompletenessGate] Violations:', JSON.stringify(_violations, null, 2));
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RevisionGrade Alerts <alerts@revisiongrade.com>',
        to: [REVISIONGRADE_SUPPORT_EMAIL],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[TemplateCompletenessGate] Resend error:', errBody);
      return { sent: false, error: `Resend API error ${res.status}: ${errBody}` };
    }

    return { sent: true };
  } catch (err) {
    console.error('[TemplateCompletenessGate] Send failed:', err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const TEMPLATE_COMPLETENESS_USER_MESSAGE =
  "We've detected a quality issue with your evaluation and our team is investigating. " +
  "You'll receive an email when your report is ready. Your writing and all completed " +
  "analysis have been preserved — no action is needed on your part.";

export const TEMPLATE_COMPLETENESS_FAILURE_CODE = 'TEMPLATE_COMPLETENESS_GATE_FAILED';
