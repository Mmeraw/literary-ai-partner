export type DownloadParityViolation = {
  code: string;
  message: string;
};

export type DownloadParityResult = {
  pass: boolean;
  violations: DownloadParityViolation[];
};

type ReportLike = Record<string, unknown> & {
  overview?: Record<string, unknown> | null;
  criteria?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function countNonEmptyText(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.filter(nonEmptyText).length;
}

function getOverview(result: ReportLike): Record<string, unknown> {
  return isRecord(result.overview) ? result.overview : {};
}

/**
 * Validates that a persisted evaluation result has the minimum author-facing
 * content required to generate downloads from the canonical report template.
 *
 * The canonical V1/V2 result shape stores score, summary, strengths, and risks
 * under `overview`. Legacy top-level fields are accepted only as fallbacks so
 * older stored artifacts do not fail unnecessarily.
 */
export function validateDownloadParity(result: ReportLike): DownloadParityResult {
  const violations: DownloadParityViolation[] = [];
  const overview = getOverview(result);

  const criteria = Array.isArray(result.criteria) ? result.criteria : [];
  if (criteria.length === 0) {
    violations.push({ code: 'NO_CRITERIA', message: 'Evaluation has no criteria data.' });
  }

  const hasOverall =
    isFiniteNumber(overview.overall_score_0_100) ||
    isFiniteNumber(overview.score) ||
    isFiniteNumber(result.score) ||
    isFiniteNumber(result.authority_composite) ||
    result.overall != null;
  if (!hasOverall) {
    violations.push({ code: 'NO_OVERALL_SCORE', message: 'No overall score found.' });
  }

  const summary = overview.one_paragraph_summary ?? result.one_paragraph_summary;
  if (!nonEmptyText(summary)) {
    violations.push({ code: 'NO_SUMMARY', message: 'Missing one_paragraph_summary.' });
  }

  const strengths = overview.top_3_strengths ?? result.top_3_strengths;
  if (countNonEmptyText(strengths) === 0) {
    violations.push({ code: 'NO_TOP_STRENGTHS', message: 'No top strengths present.' });
  }

  const risks = overview.top_3_risks ?? result.top_3_risks;
  if (countNonEmptyText(risks) === 0) {
    violations.push({ code: 'NO_TOP_RISKS', message: 'No top risks present.' });
  }

  for (const c of criteria) {
    if (!isRecord(c)) continue;
    const key = c.key ?? c.criterion ?? 'unknown';
    const score = c.score_0_10 ?? c.score;
    if (!isFiniteNumber(score)) {
      violations.push({ code: 'CRITERION_NO_SCORE', message: `Criterion "${String(key)}" has no score.` });
    }
    if (!nonEmptyText(c.rationale)) {
      violations.push({ code: 'CRITERION_NO_RATIONALE', message: `Criterion "${String(key)}" has no rationale.` });
    }
  }

  return { pass: violations.length === 0, violations };
}
