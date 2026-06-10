import { CRITERIA_KEYS, getCriterionDisplayLabel, type CriterionKey } from '@/schemas/criteria-keys';
import { buildTopRecommendations } from '@/lib/evaluation/reportRecommendations';
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
  priority?: 'high' | 'medium' | 'low';
  action?: string;
  expected_impact?: string;
  anchor_snippet?: string;
  symptom?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  mistake_proofing?: string;
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
  criteriaScoreGrid: ShortFormCriterionGridRow[];
  criterionDetails: ShortFormCriterionDetail[];
  actionItems: {
    quickWins: Array<{ action: string; why?: string; effort?: string; impact?: string }>;
    strategicRevisions: Array<{ action: string; why?: string; effort?: string; impact?: string }>;
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

function isFallbackGenre(value: string): boolean {
  return FALLBACK_GENRE_VALUES.has(value.trim().toLowerCase());
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
  });
  const opportunitySummary = summarizeRevisionOpportunities(orderedCriteria);
  const topRecommendations = buildTopRecommendations(result as never, 5);

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

    return {
      key: criterion.key,
      label: getCriterionDisplayLabel(criterion.key as CriterionKey),
      scoreLabel: scoreOutOfTen(criterion.score_0_10),
      confidenceLabel: confidenceLabel(criterion),
      supportLabel: getCriterionSupportLabel(renderable),
      rationaleLabel: rationalePresentation?.label,
      rationaleText: detailText,
      recommendations: Array.isArray(criterion.recommendations) ? criterion.recommendations.slice(0, 3) : [],
    };
  });

  const readingGrade = toFiniteNumber(result.enrichment?.reading_grade_level);
  const dialogue = toFiniteNumber(result.enrichment?.dialogue_percentage);
  const narrative = toFiniteNumber(result.enrichment?.narrative_percentage);
  const computedNarrative = typeof dialogue === 'number' ? Math.max(0, 100 - dialogue) : null;

  const contentWarningsRaw = Array.isArray(result.enrichment?.trigger_warnings)
    ? result.enrichment?.trigger_warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    templateMode: 'short_form_evaluation',
    sectionOrder: SECTION_ORDER,
    title: clean(input.displayTitle, 'Untitled Manuscript'),
    titleBlock: {
      reportType: input.reportType ?? 'Short-Form Evaluation',
      overallScoreLabel: formatScoreFractionForDisplay(overallScore, 100),
      marketReadiness: deriveVerdict(overallScore, result.overview?.verdict),
      genre: clean(result.metrics?.manuscript?.genre, 'Not specified'),
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
      genreConfidenceLabel: isFallbackGenre(clean(result.metrics?.manuscript?.genre, 'Not specified')) ? null : genreConf,
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
    executiveSummary: mistakeProofText(result.overview?.one_paragraph_summary ?? 'No summary available.'),
    topStrengths: (result.overview?.top_3_strengths ?? []).map((item) => mistakeProofText(item)).filter(Boolean),
    topRisks: (result.overview?.top_3_risks ?? []).map((item) => mistakeProofText(item)).filter(Boolean),
    topRecommendations: topRecommendations.map((item) => mistakeProofText(item)).filter(Boolean),
    criteriaScoreGrid,
    criterionDetails,
    actionItems: {
      quickWins: (Array.isArray(result.recommendations?.quick_wins)
        ? result.recommendations!.quick_wins
        : []
      ).filter((item): item is { action: string; why?: string; effort?: string; impact?: string } => typeof item?.action === 'string' && item.action.trim().length > 0),
      strategicRevisions: (Array.isArray(result.recommendations?.strategic_revisions)
        ? result.recommendations!.strategic_revisions
        : []
      ).filter((item): item is { action: string; why?: string; effort?: string; impact?: string } => typeof item?.action === 'string' && item.action.trim().length > 0),
    },
    confidenceExplanation:
      input.confidenceExplanation ??
      'Confidence reflects how strongly each diagnosis is supported by direct textual evidence in the submitted material. High confidence indicates strong evidence; moderate confidence indicates meaningful but potentially ambiguous evidence; low confidence indicates limited or conflicting evidence and should be treated as a prompt for review.',
    disclaimer: input.disclaimer ?? DEFAULT_DISCLAIMER,
  };
}
