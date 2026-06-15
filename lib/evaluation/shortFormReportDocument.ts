import { CRITERIA_KEYS, getCriterionDisplayLabel, type CriterionKey } from '@/schemas/criteria-keys';
import { buildTopRecommendations } from '@/lib/evaluation/reportRecommendations';
import {
  buildCanonicalOpportunityLedger,
  formatOpportunityForTopRecommendation,
  opportunityToActionItem,
  opportunityToCriterionRecommendation,
} from '@/lib/evaluation/canonicalOpportunityLedger';
import { buildReportPitches, summarizeRevisionOpportunities, type RevisionOpportunitySummary } from '@/lib/evaluation/reportTemplateContract';
import { getCriterionRationalePresentation, getCriterionSupportLabel, type RenderableCriterion } from '@/lib/evaluation/reportCriterionDisplay';
import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';
import {
  formatCriterionConfidenceLabel,
  deriveGenreConfidence,
  deriveMarketReadinessConfidence,
  deriveOverallScoreConfidence,
  getAudienceConfidence,
  type CanonicalConfidenceLabel,
} from '@/lib/evaluation/confidenceFieldPolicy';
import type { GenreExpectationMetadata } from '@/lib/evaluation/genreExpectationProfiles';
import {
  buildGenreExpectationHeader,
  getReportHeaderContract,
  type GenreExpectationHeader,
  type ReportHeaderContract,
} from '@/lib/evaluation/reportHeaderPolicy';
import { formatScoreFractionForDisplay } from '@/lib/ui/score-formatting';

export type ShortFormCriterionRecommendation = {
  opportunity_id?: string;
  priority?: 'high' | 'medium' | 'low';
  action?: string;
  expected_impact?: string;
  anchor_snippet?: string;
  anchor_type?: 'verbatim_quote' | 'paraphrased_observation' | 'editorial_diagnosis';
  symptom?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  mistake_proofing?: string;
  collapsed_from_criteria?: string[];
};

export type ShortFormCriterion = {
  key: string;
  score_0_10: number | null;
  confidence_level?: 'high' | 'moderate' | 'low';
  rationale?: string;
  recommendations?: ShortFormCriterionRecommendation[];
  status?: 'NOT_APPLICABLE' | 'NO_SIGNAL' | 'INSUFFICIENT_SIGNAL' | 'SCORABLE';
  scorable?: boolean;
  scorability_status?: 'scorable' | 'scorable_low_confidence' | 'non_scorable';
  confidence_score_0_100?: number;
  confidence_reasons?: string[];
  insufficient_signal_reason?: {
    looked_for?: string[];
    not_found?: string[];
  };
};

export type ShortFormResultLike = {
  generated_at?: string;
  overview: {
    overall_score_0_100?: number;
    verdict?: string;
    one_paragraph_summary?: string;
    top_3_strengths?: string[];
    top_3_risks?: string[];
  };
  metrics?: {
    manuscript?: {
      title?: string;
      word_count?: number;
      genre?: string;
      target_audience?: string;
    };
  };
  enrichment?: {
    premise?: string;
    trigger_warnings?: string[];
    reading_grade_level?: number;
    dialogue_percentage?: number;
    narrative_percentage?: number;
    diagnosed_genre?: string;
  };
  governance?: {
    transparency?: {
      genre_expectation_context?: GenreExpectationMetadata;
    };
  };
  criteria: ShortFormCriterion[];
  recommendations?: {
    quick_wins?: Array<{ action?: string; why?: string; effort?: string; impact?: string }>;
    strategic_revisions?: Array<{ action?: string; why?: string; effort?: string; impact?: string }>;
  };
};

export type ShortFormTemplateSectionId =
  | 'title_block'
  | 'one_paragraph_pitch'
  | 'one_sentence_pitch'
  | 'premise'
  | 'content_warnings'
  | 'revision_opportunity_summary'
  | 'executive_summary'
  | 'top_strengths'
  | 'top_risks'
  | 'top_recommendations'
  | 'criteria_score_grid'
  | 'criterion_rationales_and_opportunities'
  | 'confidence_explanation'
  | 'author_disclaimer';

export type ShortFormCriterionGridRow = {
  key: string;
  label: string;
  scoreLabel: string;
  confidenceLabel: string;
};

export type ShortFormCriterionDetail = {
  key: string;
  label: string;
  scoreLabel: string;
  confidenceLabel: string;
  supportLabel: string | null;
  rationaleLabel?: string;
  rationaleText: string;
  recommendations: ShortFormCriterionRecommendation[];
};

export type ShortFormEvaluationDocument = {
  templateMode: 'short_form_evaluation';
  sectionOrder: readonly ShortFormTemplateSectionId[];
  title: string;
  titleBlock: {
    reportType: string;
    overallScoreLabel: string;
    marketReadiness: string;
    genre: string;
    targetAudience: string;
    submittedWordCount: string;
    estimatedPages: string;
    readingGradeLevel: string;
    dialogueNarrativeRatio: string;
    dateGenerated: string;
    /** Derived from word count via confidenceFieldPolicy — null when unavailable. */
    genreConfidenceLabel: CanonicalConfidenceLabel | null;
    marketReadinessConfidenceLabel: CanonicalConfidenceLabel | null;
    overallScoreConfidenceLabel: CanonicalConfidenceLabel | null;
    /** Always present — policy is warning_required for target audience. */
    audienceConfidenceLabel: CanonicalConfidenceLabel;
    audienceTentative: boolean;
    /** Canonical header requirements for the current report mode. */
    headerContract: ReportHeaderContract;
    /** Dedicated genre contract resolved from canon-backed expectation metadata. */
    genreExpectationContract: GenreExpectationHeader | null;
  };
  oneParagraphPitch: string;
  oneSentencePitch: string;
  premise: string | null;
  contentWarnings: string[];
  revisionOpportunitySummary: RevisionOpportunitySummary;
  executiveSummary: string;
  topStrengths: string[];
  topRisks: string[];
  topRecommendations: string[];
  canonicalOpportunityLedger?: ReturnType<typeof buildCanonicalOpportunityLedger>;
  criteriaScoreGrid: ShortFormCriterionGridRow[];
  criterionDetails: ShortFormCriterionDetail[];
  actionItems: {
    quickWins: Array<{
      action: string;
      why?: string;
      effort?: string;
      impact?: string;
      /** Verbatim manuscript passage (evidence / "Original Passage") */
      anchor_snippet?: string;
      /** Location in manuscript */
      manuscript_coordinates?: string;
      /** Craft mechanism or narrative device */
      mechanism?: string;
      /** Reader emotion/reaction altered */
      reader_effect?: string;
      /** Proposed replacement prose ("Suggested Revision") */
      candidate_text_a?: string;
      /** Source criterion key */
      criterion_key?: string;
      /** Canonical opportunity ID reused across report surfaces. */
      opportunity_id?: string;
    }>;
    strategicRevisions: Array<{
      action: string;
      why?: string;
      effort?: string;
      impact?: string;
      /** Verbatim manuscript passage (evidence / "Original Passage") */
      anchor_snippet?: string;
      /** Location in manuscript */
      manuscript_coordinates?: string;
      /** Craft mechanism or narrative device */
      mechanism?: string;
      /** Reader emotion/reaction altered */
      reader_effect?: string;
      /** Proposed replacement prose ("Suggested Revision") */
      candidate_text_a?: string;
      /** Source criterion key */
      criterion_key?: string;
      /** Canonical opportunity ID reused across report surfaces. */
      opportunity_id?: string;
    }>;
  };
  confidenceExplanation: string;
  disclaimer: string;
};

const SECTION_ORDER: readonly ShortFormTemplateSectionId[] = [
  'title_block',
  'one_paragraph_pitch',
  'one_sentence_pitch',
  'premise',
  'content_warnings',
  'revision_opportunity_summary',
  'executive_summary',
  'top_strengths',
  'top_risks',
  'top_recommendations',
  'criteria_score_grid',
  'criterion_rationales_and_opportunities',
  'confidence_explanation',
  'author_disclaimer',
] as const;

const DEFAULT_DISCLAIMER =
  'Generated by RevisionGrade™. Author retains ownership of manuscript content. This report is an editorial diagnostic and does not guarantee publication, representation, or commercial outcome.';

function clean(value: unknown, fallback = 'Not available'): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : fallback;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDate(value?: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function scoreOutOfTen(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not scorable';
  return `${Math.floor(value)}/10`;
}

function confidenceLabel(criterion: ShortFormCriterion): string {
  // Delegates entirely to canonical policy — no local confidence rules.
  return formatCriterionConfidenceLabel(criterion.confidence_level, criterion.confidence_score_0_100) ?? 'Not certified';
}

function deriveVerdict(overallScore: number | null, fallbackVerdict?: string): string {
  if (typeof overallScore === 'number' && Number.isFinite(overallScore)) {
    if (overallScore >= 90) return 'Market Ready';
    if (overallScore >= 80) return 'Near Market Ready';
    return 'Not Market Ready';
  }

  const fallback = (fallbackVerdict ?? '').trim();
  return fallback.length > 0 ? fallback : 'Not Market Ready';
}

const FALLBACK_AUDIENCE_VALUES = new Set([
  'adult readers',
  'not available',
  'not specified',
  'unknown',
  '',
]);

function isFallbackAudience(value: string): boolean {
  return FALLBACK_AUDIENCE_VALUES.has(value.trim().toLowerCase());
}

const FALLBACK_GENRE_VALUES = new Set([
  'not specified',
  'not available',
  'unknown',
  '',
]);

const FORMAT_ONLY_GENRE_VALUES = new Set([
  'novel',
  'short story',
  'story',
  'chapter',
  'excerpt',
  'manuscript',
  'fiction',
]);

function isFallbackGenre(value: string): boolean {
  return FALLBACK_GENRE_VALUES.has(value.trim().toLowerCase());
}

function isFormatOnlyGenre(value: string): boolean {
  return FORMAT_ONLY_GENRE_VALUES.has(value.trim().toLowerCase());
}

function titleCaseGenre(value: string): string {
  return value
    .split(/(\s+|\/|\+)/)
    .map((part) => {
      if (/^\s+$|^\/|^\+$/.test(part)) return part;
      const trimmed = part.trim();
      if (!trimmed) return part;
      if (/^[A-Z]{2,}$/.test(trimmed)) return trimmed;
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    })
    .join('')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bOr\b/g, 'or')
    .replace(/\bThe\b/g, 'the')
    .replace(/\bOf\b/g, 'of');
}

function estimatePages(wordCount: number | null | undefined): string {
  if (typeof wordCount !== 'number' || !Number.isFinite(wordCount) || wordCount <= 0) return 'Not available';
  return `${Math.max(1, Math.ceil(wordCount / 250)).toLocaleString()} at 250 words/page`;
}

function ensureOrderedCriteria(criteria: ShortFormCriterion[]): ShortFormCriterion[] {
  const byKey = new Map<string, ShortFormCriterion>();
  for (const criterion of criteria) {
    if (typeof criterion?.key === 'string' && criterion.key.length > 0) {
      byKey.set(criterion.key, criterion);
    }
  }

  return CRITERIA_KEYS.map((key) =>
    byKey.get(key) ?? {
      key,
      score_0_10: null,
      status: 'INSUFFICIENT_SIGNAL',
      scorable: false,
      scorability_status: 'non_scorable',
      confidence_level: 'low',
      confidence_score_0_100: 0,
      confidence_reasons: ['No score was returned for this criterion in the canonical artifact.'],
      rationale: 'No score was produced for this criterion in this run.',
      recommendations: [],
    },
  );
}

function ensureNonEmptyList(values: string[], fallback: string[]): string[] {
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  if (cleaned.length > 0) return cleaned;
  return fallback.map((value) => value.trim()).filter((value) => value.length > 0);
}

function topLevelActionItems(
  values: Array<{ action?: string; why?: string; effort?: string; impact?: string }> | undefined,
): Array<{ action: string; why?: string; effort?: string; impact?: string }> {
  if (!Array.isArray(values)) return [];
  return values.flatMap((item) => {
    const action = clean(item.action, '').trim();
    if (!action) return [];
    return [{
      action: mistakeProofText(action),
      ...(item.why ? { why: mistakeProofText(item.why) } : {}),
      ...(item.effort ? { effort: mistakeProofText(item.effort) } : {}),
      ...(item.impact ? { impact: mistakeProofText(item.impact) } : {}),
    }];
  });
}

export function buildShortFormEvaluationDocument(input: {
  result: ShortFormResultLike;
  displayTitle: string;
  reportType?: string;
  confidenceExplanation?: string;
  disclaimer?: string;
}): ShortFormEvaluationDocument {
  const result = input.result;
  const orderedCriteria = ensureOrderedCriteria(Array.isArray(result.criteria) ? result.criteria : []);
  const overallScore = toFiniteNumber(result.overview?.overall_score_0_100);
  const pitches = buildReportPitches({
    premise: result.enrichment?.premise,
    summary: result.overview?.one_paragraph_summary,
    title: input.displayTitle,
    one_sentence_pitch: (result.overview as Record<string, unknown> | undefined)?.one_sentence_pitch as string | undefined,
    one_paragraph_pitch: (result.overview as Record<string, unknown> | undefined)?.one_paragraph_pitch as string | undefined,
  });
  const opportunitySummary = summarizeRevisionOpportunities(orderedCriteria);
  const canonicalOpportunityLedger = buildCanonicalOpportunityLedger(result);
  const renderedOpportunities = canonicalOpportunityLedger.rendered_opportunities;
  const topRecommendations = buildTopRecommendations(result as never, 5);
  const canonicalTopRecommendations = renderedOpportunities
    .filter((item) => item.issue_type !== 'mechanics_typo')
    .slice(0, 5)
    .map(formatOpportunityForTopRecommendation);

  const rawWordCount = typeof result.metrics?.manuscript?.word_count === 'number'
    ? result.metrics.manuscript.word_count
    : null;
  const scorableCount = orderedCriteria.filter(c => c.scorability_status !== 'non_scorable').length;
  const genreConf = deriveGenreConfidence(rawWordCount);
  const marketConf = deriveMarketReadinessConfidence(scorableCount, orderedCriteria.length);
  const overallConf = deriveOverallScoreConfidence(scorableCount, orderedCriteria.length, null);
  const audienceConf = getAudienceConfidence(rawWordCount);
  const headerContract = getReportHeaderContract('short_form_evaluation');
  const genreExpectationContract = buildGenreExpectationHeader(
    result.governance?.transparency?.genre_expectation_context,
  );
  const rawGenre = clean(result.enrichment?.diagnosed_genre ?? result.metrics?.manuscript?.genre, 'Not specified');
  const genreExpectationLabel = genreExpectationContract?.genreExpectationLabels.length
    ? genreExpectationContract.genreExpectationLabels.join(' + ')
    : genreExpectationContract?.diagnosedGenre;
  const displayGenre = isFallbackGenre(rawGenre)
    ? rawGenre
    : isFormatOnlyGenre(rawGenre) && genreExpectationLabel
    ? genreExpectationLabel
    : isFormatOnlyGenre(rawGenre)
      ? 'Fiction'
      : rawGenre;
  const genreIsFallback = isFallbackGenre(rawGenre) || (isFormatOnlyGenre(rawGenre) && !genreExpectationLabel);

  const criteriaScoreGrid: ShortFormCriterionGridRow[] = orderedCriteria.map((criterion) => {
    return {
      key: criterion.key,
      label: getCriterionDisplayLabel(criterion.key as CriterionKey),
      scoreLabel: scoreOutOfTen(criterion.score_0_10),
      confidenceLabel: confidenceLabel(criterion),
    };
  });

  const criterionDetails: ShortFormCriterionDetail[] = orderedCriteria.map((criterion) => {
    const renderable = criterion as RenderableCriterion;
    const rationalePresentation = getCriterionRationalePresentation(renderable, criterion.rationale);
    const detailText = rationalePresentation?.text
      ? mistakeProofText(rationalePresentation.text)
      : 'No rationale available for this criterion in this run.';
    const canonicalRecommendations = renderedOpportunities
      .filter((item) => item.primary_criterion === criterion.key || item.related_criteria.includes(criterion.key))
      .slice(0, 3)
      .map(opportunityToCriterionRecommendation);

    return {
      key: criterion.key,
      label: getCriterionDisplayLabel(criterion.key as CriterionKey),
      scoreLabel: scoreOutOfTen(criterion.score_0_10),
      confidenceLabel: confidenceLabel(criterion),
      supportLabel: getCriterionSupportLabel(renderable),
      rationaleLabel: rationalePresentation?.label,
      rationaleText: detailText,
      recommendations: canonicalRecommendations.length > 0
        ? canonicalRecommendations
        : Array.isArray(criterion.recommendations)
          ? criterion.recommendations.slice(0, 1)
          : [],
    };
  });

  const readingGrade = toFiniteNumber(result.enrichment?.reading_grade_level);
  const dialogue = toFiniteNumber(result.enrichment?.dialogue_percentage);
  const narrative = toFiniteNumber(result.enrichment?.narrative_percentage);
  const computedNarrative = typeof dialogue === 'number' ? Math.max(0, 100 - dialogue) : null;

  const contentWarningsRaw = Array.isArray(result.enrichment?.trigger_warnings)
    ? result.enrichment?.trigger_warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const fallbackExecutiveSummary =
    'This evaluation identifies actionable strengths and risks with prioritized revision guidance to improve manuscript readiness.';
  const executiveSummarySource =
    typeof result.overview?.one_paragraph_summary === 'string' && result.overview.one_paragraph_summary.trim().length > 0
      ? result.overview.one_paragraph_summary
      : fallbackExecutiveSummary;
  const executiveSummary = mistakeProofText(executiveSummarySource);

  const fallbackStrengths = orderedCriteria
    .filter((criterion) => typeof criterion.score_0_10 === 'number')
    .sort((a, b) => (b.score_0_10 ?? -1) - (a.score_0_10 ?? -1))
    .slice(0, 3)
    .map((criterion) => `${getCriterionDisplayLabel(criterion.key as CriterionKey)} demonstrates a clear relative strength in the evaluated sample.`);

  if (fallbackStrengths.length === 0) {
    fallbackStrengths.push('Core manuscript potential is visible in the available evidence sample.');
  }

  const fallbackRisks = orderedCriteria
    .filter((criterion) => typeof criterion.score_0_10 === 'number')
    .sort((a, b) => (a.score_0_10 ?? 11) - (b.score_0_10 ?? 11))
    .slice(0, 3)
    .map((criterion) => `${getCriterionDisplayLabel(criterion.key as CriterionKey)} remains a revision risk requiring focused improvement.`);

  if (fallbackRisks.length === 0) {
    fallbackRisks.push('Insufficient scored evidence requires targeted revision review before submission decisions.');
  }

  const fallbackTopRecommendations = [
    'Prioritize the lowest-scoring criteria with the highest reader-impact revisions first.',
  ];

  return {
    templateMode: 'short_form_evaluation',
    sectionOrder: SECTION_ORDER,
    title: clean(input.displayTitle, 'Untitled Manuscript'),
    titleBlock: {
      reportType: input.reportType ?? 'Short-Form Evaluation',
      overallScoreLabel: formatScoreFractionForDisplay(overallScore, 100),
      marketReadiness: deriveVerdict(overallScore, result.overview?.verdict),
      genre: isFallbackGenre(displayGenre) ? displayGenre : titleCaseGenre(displayGenre),
      targetAudience: clean(result.metrics?.manuscript?.target_audience, 'Adult Readers'),
      submittedWordCount:
        typeof result.metrics?.manuscript?.word_count === 'number'
          ? result.metrics.manuscript.word_count.toLocaleString()
          : 'Not available',
      estimatedPages: estimatePages(result.metrics?.manuscript?.word_count),
      readingGradeLevel: typeof readingGrade === 'number' ? `${Math.floor(readingGrade)} (Flesch-Kincaid)` : 'Not available',
      dialogueNarrativeRatio:
        typeof dialogue === 'number'
          ? `${Math.floor(dialogue)}% dialogue / ${Math.floor(typeof narrative === 'number' ? narrative : computedNarrative ?? 0)}% narrative`
          : 'Not available',
      dateGenerated: formatDate(result.generated_at),
      // Suppress confidence badge when genre is a fallback ("Not specified") — absence is not uncertainty.
      genreConfidenceLabel: genreIsFallback ? null : genreConf,
      marketReadinessConfidenceLabel: marketConf,
      overallScoreConfidenceLabel: overallConf,
      audienceConfidenceLabel: audienceConf.label,
      // Only mark tentative when audience was actually inferred from manuscript.
      // Fallback/default values ("Adult Readers", "Not available") are absence, not uncertainty.
      audienceTentative: audienceConf.tentative && !isFallbackAudience(clean(result.metrics?.manuscript?.target_audience, 'Adult Readers')),
      headerContract,
      genreExpectationContract,
    },
    oneParagraphPitch: mistakeProofText(pitches.oneParagraphPitch),
    oneSentencePitch: mistakeProofText(pitches.oneSentencePitch),
    premise:
      typeof result.enrichment?.premise === 'string' && result.enrichment.premise.trim().length > 0
        ? mistakeProofText(result.enrichment.premise)
        : null,
    contentWarnings:
      contentWarningsRaw.length > 0
        ? contentWarningsRaw.map((warning) => mistakeProofText(warning))
        : ['No content warnings identified.'],
    revisionOpportunitySummary: opportunitySummary,
    executiveSummary,
    topStrengths: ensureNonEmptyList(
      (result.overview?.top_3_strengths ?? []).map((item) => mistakeProofText(item)).filter(Boolean),
      fallbackStrengths,
    ),
    topRisks: ensureNonEmptyList(
      (result.overview?.top_3_risks ?? []).map((item) => mistakeProofText(item)).filter(Boolean),
      fallbackRisks,
    ),
    topRecommendations: ensureNonEmptyList(
      (canonicalTopRecommendations.length > 0 ? canonicalTopRecommendations : topRecommendations)
        .map((item) => mistakeProofText(item))
        .filter(Boolean),
      fallbackTopRecommendations,
    ),
    canonicalOpportunityLedger,
    criteriaScoreGrid,
    criterionDetails,
    actionItems: {
      quickWins: [
        ...renderedOpportunities
          .filter((item) => item.is_action_item_candidate && item.severity === 'high')
          .slice(0, 3)
          .map(opportunityToActionItem),
        ...topLevelActionItems(result.recommendations?.quick_wins),
      ],
      strategicRevisions: [
        ...renderedOpportunities
          .filter((item) => item.is_action_item_candidate && item.severity !== 'high')
          .slice(0, 4)
          .map(opportunityToActionItem),
        ...topLevelActionItems(result.recommendations?.strategic_revisions),
      ],
    },
    confidenceExplanation:
      input.confidenceExplanation ??
      'Confidence reflects how strongly each diagnosis is supported by direct textual evidence in the submitted material. High confidence indicates strong evidence; moderate confidence indicates meaningful but potentially ambiguous evidence; low confidence indicates limited or conflicting evidence and should be treated as a prompt for review.',
    disclaimer: input.disclaimer ?? DEFAULT_DISCLAIMER,
  };
}
