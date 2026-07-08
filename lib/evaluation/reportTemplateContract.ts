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
  // summary intentionally excluded from fallback chain (see below)
  void input.summary;
  const title = clean(input.title) || 'the submitted work';

  // P1: Use dedicated pitch fields from Pass 3 when available.
  // These are semantically distinct from one_paragraph_summary (diagnostic) and premise (factual setup).
  let dedicatedOneSentence = clean(input.one_sentence_pitch);
  let dedicatedOneParagraph = clean(input.one_paragraph_pitch);

  // DEDUPLICATION GUARD: If the LLM returned one_sentence_pitch and one_paragraph_pitch
  // that are character-for-character identical to each other or to premise, treat them
  // as a generation failure and fall through to the premise-based fallback.
  // This catches the failure mode where Pass 3 emits the same text in all three pitch fields.
  function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const normPremise = normalize(premise);
  const normParagraph = normalize(dedicatedOneParagraph);
  const normSentence = normalize(dedicatedOneSentence);

  // If paragraph pitch === premise (or is empty), treat as generation failure
  if (normParagraph.length > 0 && normParagraph === normPremise) {
    dedicatedOneParagraph = '';
  }
  // If sentence pitch === premise first-sentence (or === paragraph pitch, or is empty), treat as generation failure
  const normPremiseFirstSentence = normalize(firstSentence(premise));
  if (
    normSentence.length > 0 &&
    (normSentence === normPremiseFirstSentence || normSentence === normParagraph || normSentence === normPremise)
  ) {
    dedicatedOneSentence = '';
  }

  // Pitch fallback chain: dedicated field (if distinct) → premise → generic placeholder.
  // one_paragraph_summary (the executive summary / diagnostic judgment) is intentionally
  // excluded from this fallback chain. It answers "why this score / what to fix" —
  // reusing it as pitch copy collapses two semantically distinct sections into the
  // same text. If neither a dedicated pitch field nor a premise is available, emit
  // a neutral placeholder rather than surfacing diagnostic language as marketing copy.
  const oneParagraphPitch = dedicatedOneParagraph
    || premise
    || `A distinct story synopsis was not generated for ${title}.`;
  let oneSentencePitch = dedicatedOneSentence
    || firstSentence(premise)
    || `A distinct market hook was not generated for ${title}.`;

  // Final guard: if sentence pitch and paragraph pitch are still identical after all
  // fallbacks (e.g. premise was a single sentence), make the duplication explicit.
  if (normalize(oneSentencePitch) === normalize(oneParagraphPitch)) {
    oneSentencePitch = `A distinct market hook was not generated for ${title}.`;
  }

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
