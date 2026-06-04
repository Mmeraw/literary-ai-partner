type PitchInput = {
  premise?: string | null;
  summary?: string | null;
  title?: string | null;
};

type CriterionWithRecommendations = {
  recommendations?: Array<{ priority?: string | null }> | null;
};

export type RevisionOpportunitySummary = {
  total: number;
  high: number;
  medium: number;
  low: number;
};

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function firstSentence(value: string): string {
  const trimmed = clean(value);
  if (!trimmed) return '';
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? trimmed).trim();
}

export function buildReportPitches(input: PitchInput): {
  oneParagraphPitch: string;
  oneSentencePitch: string;
} {
  const premise = clean(input.premise);
  const summary = clean(input.summary);
  const title = clean(input.title) || 'the submitted work';

  const oneParagraphPitch = premise || summary || `RevisionGrade evaluated ${title}.`;
  const oneSentencePitch = firstSentence(premise || summary) || `RevisionGrade evaluated ${title}.`;

  return { oneParagraphPitch, oneSentencePitch };
}

export function summarizeRevisionOpportunities(
  criteria: CriterionWithRecommendations[] | null | undefined,
): RevisionOpportunitySummary {
  const summary: RevisionOpportunitySummary = { total: 0, high: 0, medium: 0, low: 0 };

  for (const criterion of criteria ?? []) {
    for (const recommendation of criterion.recommendations ?? []) {
      summary.total += 1;
      if (recommendation.priority === 'high') summary.high += 1;
      else if (recommendation.priority === 'medium') summary.medium += 1;
      else summary.low += 1;
    }
  }

  return summary;
}

export function hasRevisionOpportunities(summary: RevisionOpportunitySummary): boolean {
  return summary.total > 0;
}
