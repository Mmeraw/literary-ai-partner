import { CRITERIA_KEYS, getCriterionDisplayLabel, type CriterionKey } from '@/schemas/criteria-keys';
import { buildTopRecommendations } from '@/lib/evaluation/reportRecommendations';
import {
  buildCanonicalOpportunityLedger,
  formatOpportunityForTopRecommendation,
  opportunityToActionItem,
  opportunityToCriterionRecommendation,
} from '@/lib/evaluation/canonicalOpportunityLedger';
import { buildReportPitches, type RevisionOpportunitySummary } from '@/lib/evaluation/reportTemplateContract';
import { getCriterionRationalePresentation, getCriterionSupportLabel, type RenderableCriterion } from '@/lib/evaluation/reportCriterionDisplay';
import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';
import { detectRawFallbackSentinel } from '@/lib/text/authorFacingProse';
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

/** Format words that are not valid genre names — mirrors templateCompletenessGate.FORMAT_WORDS. */
const FORMAT_WORDS = new Set([
  'book', 'chapter', 'excerpt', 'fiction', 'manuscript', 'novel', 'novella',
  'nonfiction', 'poem', 'screenplay', 'short fiction', 'short story', 'story',
]);

/** Return the genre string only if it is not a bare format word. */
function sanitizeGenre(value: string | undefined | null, fallback: string): string {
  if (!value || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
  if (FORMAT_WORDS.has(normalized)) return fallback;
  return value.trim();
}

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
  potential_damage?: string[];
  collapsed_from_criteria?: string[];
};

export type ShortFormCriterion = {
  key: string;
  score_0_10: number | null;
  confidence_level?: 'high' | 'moderate' | 'low';
  rationale?: string;
  fit_summary?: string;
  gap_summary?: string;
  recommendations?: ShortFormCriterionRecommendation[];
  status?: 'NOT_APPLICABLE' | 'NO_SIGNAL' | 'INSUFFICIENT_SIGNAL' | 'SCORABLE';
  scorable?: boolean;
  scorability_status?: 'scorable' | 'scorable_low_confidence' | 'non_scorable';
  recommendation_status?:
    | 'recommendation_provided'
    | 'no_recommendation_warranted'
    | 'genre_appropriate_no_revision_warranted'
    | 'criterion_not_applicable'
    | 'insufficient_evidence'
    | 'gate_suppressed_no_safe_recommendation';
  recommendation_status_rationale?: string;
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
    target_audience?: string;
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

type CanonicalRenderedOpportunity = ReturnType<typeof buildCanonicalOpportunityLedger>['rendered_opportunities'][number];

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
  fitSummary?: string;
  growthSummary?: string;
  recommendationStatus?: string;
  recommendationStatusRationale?: string;
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

function normalizeRecommendationPriority(value: unknown): ShortFormCriterionRecommendation['priority'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : undefined;
}

function normalizeRecommendationAnchorType(value: unknown): ShortFormCriterionRecommendation['anchor_type'] {
  return value === 'verbatim_quote' || value === 'paraphrased_observation' || value === 'editorial_diagnosis'
    ? value
    : undefined;
}

function normalizeCriterionRecommendation(rec: ShortFormCriterionRecommendation): ShortFormCriterionRecommendation {
  return {
    ...rec,
    priority: normalizeRecommendationPriority(rec.priority),
    anchor_type: normalizeRecommendationAnchorType(rec.anchor_type),
  };
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

function opportunityToShortFormCriterionRecommendation(
  item: CanonicalRenderedOpportunity,
): ShortFormCriterionRecommendation {
  const recommendation = opportunityToCriterionRecommendation(item);

  return {
    opportunity_id: recommendation.opportunity_id,
    priority: item.severity,
    action: recommendation.action,
    expected_impact: recommendation.expected_impact,
    anchor_snippet: recommendation.anchor_snippet,
    anchor_type: 'verbatim_quote',
    symptom: recommendation.symptom,
    mechanism: recommendation.mechanism,
    specific_fix: recommendation.specific_fix,
    reader_effect: recommendation.reader_effect,
    mistake_proofing: recommendation.mistake_proofing,
    potential_damage: recommendation.potential_damage,
    collapsed_from_criteria: recommendation.collapsed_from_criteria,
  };
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
    // one_paragraph_summary is intentionally NOT passed here. It feeds the Executive Summary
    // section exclusively (see executiveSummarySource below). Passing it into the pitch
    // builder caused the One-Paragraph Pitch and Executive Summary to render identical text.
    title: input.displayTitle,
    one_sentence_pitch: (result.overview as Record<string, unknown> | undefined)?.one_sentence_pitch as string | undefined,
    one_paragraph_pitch: (result.overview as Record<string, unknown> | undefined)?.one_paragraph_pitch as string | undefined,
  });
  const canonicalOpportunityLedger = buildCanonicalOpportunityLedger(result);
  const renderedOpportunities = canonicalOpportunityLedger.rendered_opportunities;
  // Derive opportunity summary from the canonical ledger — not raw criteria.
  // This ensures revisionOpportunitySummary.total matches actual surfaced opportunities.
  const opportunitySummary: RevisionOpportunitySummary = {
    total: renderedOpportunities.length,
    high: renderedOpportunities.filter((item) => item.severity === 'high').length,
    medium: renderedOpportunities.filter((item) => item.severity === 'medium').length,
    low: renderedOpportunities.filter((item) => item.severity === 'low').length,
  };
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
  const genreExpectationLabel = genreExpectationContract?.genreExpectationLabels.length
    ? genreExpectationContract.genreExpectationLabels.join(' + ')
    : genreExpectationContract?.diagnosedGenre;
  const rawGenreValue = clean(result.enrichment?.diagnosed_genre ?? result.metrics?.manuscript?.genre, 'Not specified');
  const displayGenre = isFallbackGenre(rawGenreValue)
    ? rawGenreValue
    : isFormatOnlyGenre(rawGenreValue) && genreExpectationLabel
    ? genreExpectationLabel
    : sanitizeGenre(rawGenreValue, 'Not specified');
  const genreIsFallback = isFallbackGenre(displayGenre);

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
      .map((item) => normalizeCriterionRecommendation(opportunityToShortFormCriterionRecommendation(item)));

    return {
      key: criterion.key,
      label: getCriterionDisplayLabel(criterion.key as CriterionKey),
      scoreLabel: scoreOutOfTen(criterion.score_0_10),
      confidenceLabel: confidenceLabel(criterion),
      supportLabel: getCriterionSupportLabel(renderable),
      rationaleLabel: rationalePresentation?.label,
      rationaleText: detailText,
      fitSummary: criterion.fit_summary ? mistakeProofText(criterion.fit_summary) : undefined,
      growthSummary: criterion.gap_summary ? mistakeProofText(criterion.gap_summary) : undefined,
      recommendationStatus: criterion.recommendation_status,
      recommendationStatusRationale: criterion.recommendation_status_rationale
        ? mistakeProofText(criterion.recommendation_status_rationale)
        : undefined,
      // Only canonical ledger-sourced recommendations cross the UED boundary.
      // No fallback to raw criterion.recommendations — if the ledger rejected
      // them, they are not valid surfaced opportunities.
      recommendations: canonicalRecommendations,
    };
  });

  const readingGrade = toFiniteNumber(result.enrichment?.reading_grade_level);
  const dialogue = toFiniteNumber(result.enrichment?.dialogue_percentage);

  const contentWarningsRaw = Array.isArray(result.enrichment?.trigger_warnings)
    ? result.enrichment?.trigger_warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const executiveSummary =
    typeof result.overview?.one_paragraph_summary === 'string' && result.overview.one_paragraph_summary.trim().length > 0
      ? mistakeProofText(result.overview.one_paragraph_summary)
      : '';

  // ── Score-10 suppression: near-perfect manuscripts don't need a shopping list ──
  const scorableCriteria = orderedCriteria.filter(c => typeof c.score_0_10 === 'number');
  const allCriteriaExcellent = scorableCriteria.length > 0 && scorableCriteria.every(c => (c.score_0_10 ?? 0) >= 9);
  const isPerfectScore = (typeof overallScore === 'number' && overallScore >= 95) || allCriteriaExcellent;

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
          ? (() => {
              const d = Math.floor(dialogue);
              const n = 100 - d; // always sums to 100
              return `${d}% dialogue / ${n}% narrative`;
            })()
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
    // A2: never expose the raw fallback sentinel — suppress to empty at this
    // author-facing boundary rather than print the "not generated" marker.
    oneParagraphPitch: detectRawFallbackSentinel(pitches.oneParagraphPitch) ? '' : mistakeProofText(pitches.oneParagraphPitch),
    oneSentencePitch: detectRawFallbackSentinel(pitches.oneSentencePitch) ? '' : mistakeProofText(pitches.oneSentencePitch),
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
    topStrengths: (result.overview?.top_3_strengths ?? [])
      .map((item) => mistakeProofText(item))
      .filter(Boolean),
    topRisks: isPerfectScore
      ? []
      : (result.overview?.top_3_risks ?? [])
          .map((item) => mistakeProofText(item))
          .filter(Boolean),
    topRecommendations: isPerfectScore
      ? []
      : (canonicalTopRecommendations.length > 0 ? canonicalTopRecommendations : topRecommendations)
          .map((item) => mistakeProofText(item))
          .filter(Boolean),
    canonicalOpportunityLedger,
    criteriaScoreGrid,
    criterionDetails,
    actionItems: isPerfectScore
      ? { quickWins: [], strategicRevisions: [] }
      : {
          quickWins: renderedOpportunities
            .filter((item) => item.is_action_item_candidate && item.severity === 'high')
            .slice(0, 3)
            .map(opportunityToActionItem),
          strategicRevisions: renderedOpportunities
            .filter((item) => item.is_action_item_candidate && item.severity !== 'high')
            .slice(0, 4)
            .map(opportunityToActionItem),
        },
    confidenceExplanation:
      input.confidenceExplanation ??
      'Confidence reflects how strongly each diagnosis is supported by direct textual evidence in the submitted material. High confidence indicates strong evidence; moderate confidence indicates meaningful but potentially ambiguous evidence; low confidence indicates limited or conflicting evidence and should be treated as a prompt for review.',
    disclaimer: input.disclaimer ?? DEFAULT_DISCLAIMER,
  };
}
