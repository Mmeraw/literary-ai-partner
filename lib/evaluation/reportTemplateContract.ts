type PitchInput = {
  premise?: string | null;
  summary?: string | null;
  title?: string | null;
  /** P1: dedicated one_sentence_pitch from Pass 3 overall (when available) */
  one_sentence_pitch?: string | null;
  /** P1: dedicated one_paragraph_pitch from Pass 3 overall (when available) */
  one_paragraph_pitch?: string | null;
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

  // P1: Use dedicated pitch fields from Pass 3 when available.
  // These are semantically distinct from one_paragraph_summary (diagnostic) and premise (factual setup).
  const dedicatedOneSentence = clean(input.one_sentence_pitch);
  const dedicatedOneParagraph = clean(input.one_paragraph_pitch);

  // Prefer dedicated fields; fall back to legacy derivation for backward compatibility.
  const oneParagraphPitch = dedicatedOneParagraph
    || ((premise && summary) ? summary : (premise || summary || `RevisionGrade evaluated ${title}.`));
  const oneSentencePitch = dedicatedOneSentence
    || firstSentence((premise && summary) ? summary : (premise || summary)) || `RevisionGrade evaluated ${title}.`;

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
