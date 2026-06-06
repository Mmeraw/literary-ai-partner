/**
 * Template Completeness Gate
 *
 * Validates that an evaluation artifact satisfies the short-form evaluation
 * template's structural completeness requirements BEFORE persisting.
 *
 * When violations are detected:
 * 1. The artifact is NOT persisted
 * 2. A support alert email is sent to support@revisiongrade.com
 * 3. The user sees "We've detected a quality issue — investigating"
 *
 * Template authority: docs/templates/evaluation/short-form-evaluation-template.md
 *
 * Density floors (lines 169-178):
 *   Score ≤5/10:  5-10 recommendations per criterion
 *   Score 6-7/10: 4-8 recommendations per criterion
 *   Score 8/10:   2-5 recommendations per criterion
 *   Score 9-10/10: 0 (fit statement only)
 */

import { REVISIONGRADE_SUPPORT_EMAIL } from '@/lib/evaluation/hardStopGovernance';

// ── Types ────────────────────────────────────────────────────────────────────

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

type CriterionLike = {
  key: string;
  score_0_10?: number;
  rationale?: string;
  evidence?: { snippet?: string }[];
  recommendations?: unknown[];
  confidence_level?: string;
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
};

// ── Density floor ────────────────────────────────────────────────────────────

const DENSITY_FLOOR: Record<string, number> = {
  '<=5': 5,
  '6-7': 4,
  '8': 2,
};

function getDensityBucket(score: number): string | null {
  if (score >= 9) return null; // no recs required
  if (score <= 5) return '<=5';
  if (score <= 7) return '6-7';
  return '8';
}

// ── Gate ──────────────────────────────────────────────────────────────────────

export function validateTemplateCompleteness(
  result: EvaluationResultLike,
): TemplateCompletenessResult {
  const violations: TemplateViolation[] = [];

  // 1. One-paragraph summary
  if (!result.one_paragraph_summary?.trim()) {
    violations.push({
      code: 'MISSING_ONE_PARAGRAPH_SUMMARY',
      message: 'Template requires one_paragraph_summary (One-Paragraph Pitch).',
      severity: 'critical',
    });
  }

  // 2. One-sentence summary
  if (!result.one_sentence_summary?.trim()) {
    violations.push({
      code: 'MISSING_ONE_SENTENCE_SUMMARY',
      message: 'Template requires one_sentence_summary (One-Sentence Pitch).',
      severity: 'warning',
    });
  }

  // 3. Top 3 strengths
  const strengths = result.top_3_strengths?.filter((s) => s?.trim()) ?? [];
  if (strengths.length === 0) {
    violations.push({
      code: 'MISSING_TOP_STRENGTHS',
      message: 'Template requires at least 1 top strength.',
      severity: 'critical',
    });
  }

  // 4. Top 3 risks
  const risks = result.top_3_risks?.filter((r) => r?.trim()) ?? [];
  if (risks.length === 0) {
    violations.push({
      code: 'MISSING_TOP_RISKS',
      message: 'Template requires at least 1 top risk.',
      severity: 'critical',
    });
  }

  // 5. Criteria completeness — 13 criteria expected
  if (result.criteria.length < 13) {
    violations.push({
      code: 'INCOMPLETE_CRITERIA',
      message: `Template requires 13 criteria, got ${result.criteria.length}.`,
      severity: 'critical',
    });
  }

  // 6. Per-criterion checks
  let hasAnyDensityViolation = false;
  for (const c of result.criteria) {
    const score = c.score_0_10;
    if (typeof score !== 'number') continue;

    // Rationale required for all criteria
    if (!c.rationale?.trim()) {
      violations.push({
        code: 'MISSING_RATIONALE',
        criterion: c.key,
        message: `Criterion "${c.key}" is missing rationale.`,
        severity: 'critical',
      });
    }

    // Evidence required for all criteria
    const evidenceCount = c.evidence?.filter((e) => e.snippet?.trim())?.length ?? 0;
    if (evidenceCount === 0) {
      violations.push({
        code: 'MISSING_EVIDENCE',
        criterion: c.key,
        message: `Criterion "${c.key}" has no evidence anchors.`,
        severity: 'warning',
      });
    }

    // Recommendation density floor
    const bucket = getDensityBucket(score);
    if (bucket) {
      const minRecs = DENSITY_FLOOR[bucket] ?? 2;
      const recCount = c.recommendations?.length ?? 0;
      if (recCount < minRecs) {
        violations.push({
          code: 'DENSITY_FLOOR_VIOLATION',
          criterion: c.key,
          message: `Criterion "${c.key}" scored ${score}/10 — requires ${minRecs} recommendations, has ${recCount}.`,
          severity: 'critical',
        });
        hasAnyDensityViolation = true;
      }
    }

    // Confidence level required
    if (!c.confidence_level?.trim()) {
      violations.push({
        code: 'MISSING_CONFIDENCE_LEVEL',
        criterion: c.key,
        message: `Criterion "${c.key}" is missing confidence_level.`,
        severity: 'warning',
      });
    }
  }

  // 7. Cross-cutting recommendations (quick_wins / strategic_revisions)
  const hasLowScoring = result.criteria.some(
    (c) => typeof c.score_0_10 === 'number' && c.score_0_10 <= 8,
  );
  if (hasLowScoring) {
    const quickWins = result.recommendations?.quick_wins?.length ?? 0;
    const strategic = result.recommendations?.strategic_revisions?.length ?? 0;
    if (quickWins === 0 && strategic === 0) {
      violations.push({
        code: 'MISSING_TOP_RECOMMENDATIONS',
        message:
          'Criteria scoring ≤8 exist but no quick_wins or strategic_revisions were generated.',
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

// ── Support alert email ──────────────────────────────────────────────────────

export async function sendCompletenessAlertEmail(
  jobId: string,
  violations: TemplateViolation[],
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  const criticalViolations = violations.filter((v) => v.severity === 'critical');
  const warningViolations = violations.filter((v) => v.severity === 'warning');

  const subject = `[Template Completeness] Job ${jobId.slice(0, 8)}… — ${criticalViolations.length} critical violation(s)`;

  const violationRows = violations
    .map(
      (v) =>
        `<tr>
          <td style="padding:4px 8px;border:1px solid #ddd;font-weight:${v.severity === 'critical' ? 'bold' : 'normal'};color:${v.severity === 'critical' ? '#dc2626' : '#d97706'}">
            ${v.severity.toUpperCase()}
          </td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-family:monospace;font-size:12px">${v.code}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${v.criterion ?? '—'}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${v.message}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#1a1a1a;padding:20px">
    <h2 style="color:#dc2626">Template Completeness Gate Failed</h2>
    <p><strong>Job ID:</strong> <code>${jobId}</code></p>
    <p><strong>Critical:</strong> ${criticalViolations.length} · <strong>Warnings:</strong> ${warningViolations.length}</p>
    <p>The evaluation artifact does not meet the short-form evaluation template's structural requirements. The artifact has NOT been persisted — the user sees a "quality issue detected" message.</p>
    <table style="border-collapse:collapse;margin-top:12px;font-size:13px">
      <thead><tr>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Severity</th>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Code</th>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Criterion</th>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Message</th>
      </tr></thead>
      <tbody>${violationRows}</tbody>
    </table>
    <p style="margin-top:16px;font-size:12px;color:#666">Once resolved, re-run the evaluation or use the admin retry endpoint to re-process this job.</p>
  </body></html>`;

  if (!apiKey) {
    console.warn('[TemplateCompletenessGate] RESEND_API_KEY not set — email suppressed');
    console.warn('[TemplateCompletenessGate] Violations:', JSON.stringify(violations, null, 2));
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
        html,
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

// ── User-facing message ──────────────────────────────────────────────────────

export const TEMPLATE_COMPLETENESS_USER_MESSAGE =
  "We've detected a quality issue with your evaluation and our team is investigating. " +
  "You'll receive an email when your report is ready. Your manuscript and all completed " +
  "analysis have been preserved — no action is needed on your part.";

export const TEMPLATE_COMPLETENESS_FAILURE_CODE = 'TEMPLATE_COMPLETENESS_GATE_FAILED';
