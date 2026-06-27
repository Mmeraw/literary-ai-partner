import { buildShortFormEvaluationDocument, type ShortFormResultLike } from '@/lib/evaluation/shortFormReportDocument';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
import { getReportHeaderContract } from '@/lib/evaluation/reportHeaderPolicy';
import { deriveShelfConfidence, type CanonicalConfidenceLabel } from '@/lib/evaluation/confidenceFieldPolicy';
import { getEvaluationTemplateContractMetadata } from '@/lib/evaluation/contracts/evaluationContractRegistry';

export type CanonicalEvaluationMode =
  | 'short_form_evaluation'
  | 'long_form_evaluation'
  | 'long_form_multi_layer_evaluation';

export const EVALUATION_TEMPLATE_CONTRACTS: Record<CanonicalEvaluationMode, {
  templateName: string;
  reportType: string;
  templatePath: string;
}> = getEvaluationTemplateContractMetadata() as Record<CanonicalEvaluationMode, {
  templateName: string;
  reportType: string;
  templatePath: string;
}>;

export type UnifiedEvaluationDocument = Omit<ReturnType<typeof buildShortFormEvaluationDocument>, 'templateMode' | 'titleBlock'> & {
  templateMode: CanonicalEvaluationMode;
  titleBlock: ReturnType<typeof buildShortFormEvaluationDocument>['titleBlock'] & {
    targetAudience: string;
    shelf: string | null;
    shelfConfidenceLabel: CanonicalConfidenceLabel | null;
  };
  modeSpecific: {
    manuscriptScaleContinuityFindings: string[];
    revisionPriorityPlan: Array<{
      priority: number;
      title: string;
      location: string;
      operation: string;
      recommendation: string;
      rationale: string;
    }>;
    storyLedgerArchitectureMap: string[];
    reviewGateReadinessSurface: string[];
    governedLedgerAddenda: string[];
    crossLayerSynthesis: string[];
    layerAwareRevisionSequencing: string[];
    continuityCoverageProof: string[];
    readinessReleasabilityPosture: string;
  };
};

function deriveTargetAudience(input: {
  explicit?: string;
  genre?: string;
  score?: number | null;
}): string {
  const explicit = (input.explicit ?? '').trim();
  if (explicit.length > 0) return explicit;

  const genre = (input.genre ?? '').toLowerCase();
  if (genre.includes('young adult') || genre.includes('ya')) return 'Young Adult readers';
  if (genre.includes('middle grade')) return 'Middle Grade readers';
  if (genre.includes('thriller')) return 'Adult thriller readers';
  if (genre.includes('romance')) return 'Adult romance readers';
  if (genre.includes('fantasy')) return 'Adult fantasy readers';
  if (genre.includes('science fiction') || genre.includes('sci-fi')) return 'Adult speculative fiction readers';
  if (genre.includes('memoir')) return 'Adult memoir readers';
  if (genre.includes('nonfiction')) return 'General nonfiction readers';

  if (typeof input.score === 'number' && input.score >= 90) {
    return 'General commercial fiction readership';
  }

  return 'General readership';
}

function unique(values: Array<string | undefined | null>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const v = (value ?? '').trim();
    if (v.length > 0) set.add(v);
  }
  return [...set];
}

function ensureNonEmpty(values: string[], fallback: string[]): string[] {
  if (values.length > 0) return values;
  return fallback;
}

function isUnavailableHeaderValue(value: string | null | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized.length === 0 || normalized === 'not available' || normalized === 'not specified' || normalized === 'unknown';
}

function titleCaseHeaderValue(value: string): string {
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

export function buildUnifiedEvaluationDocument(input: {
  mode: CanonicalEvaluationMode;
  result: ShortFormResultLike & {
    metrics?: {
      manuscript?: {
        title?: string;
        word_count?: number;
        genre?: string;
        target_audience?: string;
      };
    };
  };
  displayTitle: string;
  dream: LongformDreamDocument | null;
}): UnifiedEvaluationDocument {
  const base = buildShortFormEvaluationDocument({
    result: input.result,
    displayTitle: input.displayTitle,
    reportType: EVALUATION_TEMPLATE_CONTRACTS[input.mode].reportType,
  });

  const overallScore = input.result.overview?.overall_score_0_100 ?? null;
  const genreExpectation = base.titleBlock.genreExpectationContract;
  const genreExpectationShelf = genreExpectation?.genreExpectationLabels.length
    ? genreExpectation.genreExpectationLabels.join(' + ')
    : genreExpectation?.diagnosedGenre;
  const shelf =
    input.mode === 'short_form_evaluation'
      ? null
      : typeof input.dream?.market_shelf?.best_shelf === 'string' && input.dream.market_shelf.best_shelf.trim().length > 0
      ? input.dream.market_shelf.best_shelf.trim()
      : typeof genreExpectationShelf === 'string' && genreExpectationShelf.trim().length > 0
      ? titleCaseHeaderValue(genreExpectationShelf.trim())
      : 'Not available';
  const shelfConfidenceLabel = input.mode === 'short_form_evaluation'
    ? null
    : deriveShelfConfidence({
        wordCount: input.result.metrics?.manuscript?.word_count,
        hasShelf: !isUnavailableHeaderValue(shelf),
      });
  const targetAudience = deriveTargetAudience({
    explicit: input.result.metrics?.manuscript?.target_audience,
    genre: input.result.metrics?.manuscript?.genre,
    score: typeof overallScore === 'number' ? overallScore : null,
  });

  const revisionPriorityPlan = (base.topRecommendations.length > 0 ? base.topRecommendations : ['Refine the highest-impact structural risks first.'])
    .slice(0, 5)
    .map((recommendation, index) => ({
      priority: index + 1,
      title: recommendation,
      location: 'Manuscript-wide',
      operation: index === 0 ? 'Edit' : 'Refine',
      recommendation,
      rationale: 'Prioritized from highest-impact diagnostic findings.',
    }));

  const dream = input.dream;
  const continuityCoverageProof = unique([
    ...(dream?.arc_map?.map((entry) => `${entry.act_name}: ${entry.primary_function}`) ?? []),
    ...(dream?.layer_analyses?.map((entry) => `${entry.layer_name}: ${entry.needed_revision}`) ?? []),
    ...(dream?.cross_layer_integration?.map((entry) => `${entry.motif}: ${entry.revision_note}`) ?? []),
  ]);

  const manuscriptScaleContinuityFindings = continuityCoverageProof.length > 0
    ? continuityCoverageProof.slice(0, 8)
    : unique([
        ...base.topRisks,
        ...base.criterionDetails
          .filter((detail) => detail.scoreLabel !== 'Not scorable')
          .slice(0, 3)
          .map((detail) => `${detail.label}: ${detail.rationaleText}`),
      ]).slice(0, 8);

  const storyLedgerArchitectureMap = unique([
    ...(dream?.structural_stack?.map((layer) => `${layer.layer_name}: ${layer.function} (${layer.status})`) ?? []),
    ...(dream?.arc_map?.map((act) => `${act.act_name} (${act.chapter_range})`) ?? []),
  ]);

  const reviewGateReadinessSurface = unique([
    ...(dream?.acceptance_checks?.required_detection ?? []),
    ...(dream?.acceptance_checks?.failure_conditions ?? []),
  ]);

  const governedLedgerAddenda = unique([
    ...(dream?.symbolic_audit?.doctrine_strengths ?? []),
    ...(dream?.symbolic_audit?.doctrine_risks ?? []),
    ...(dream?.releasability?.map((entry) => `${entry.dimension}: ${entry.current_status} [${entry.verdict}]`) ?? []),
  ]);

  const crossLayerSynthesis = unique([
    ...(dream?.cross_layer_integration?.map((item) => `${item.motif}: ${item.description}`) ?? []),
    ...(dream?.layer_analyses?.map((item) => `${item.layer_name}: ${item.status}`) ?? []),
  ]);

  const layerAwareRevisionSequencing = revisionPriorityPlan.map(
    (item) => `Priority ${item.priority}: ${item.title} — ${item.operation} (${item.location})`,
  );

  const readinessReleasabilityPosture =
    dream?.releasability?.length
      ? dream.releasability.map((item) => `${item.dimension}: ${item.verdict}`).join('; ')
      : `${base.titleBlock.marketReadiness}. Prioritize high-impact revisions before submission.`;

  const safeManuscriptScaleContinuityFindings = ensureNonEmpty(manuscriptScaleContinuityFindings, [
    'Continuity findings are provisionally grounded in the current canonical evaluation surfaces.',
  ]);
  const safeStoryLedgerArchitectureMap = ensureNonEmpty(storyLedgerArchitectureMap, [
    'Story/layer architecture evidence is not yet available in this artifact set.',
  ]);
  const safeReviewGateReadinessSurface = ensureNonEmpty(reviewGateReadinessSurface, [
    'Review-gate readiness surface not available; treat releasability as pending verification.',
  ]);
  const safeGovernedLedgerAddenda = ensureNonEmpty(governedLedgerAddenda, [
    'No governed ledger addenda were attached to this run.',
  ]);
  const safeCrossLayerSynthesis = ensureNonEmpty(crossLayerSynthesis, [
    'Cross-layer synthesis was not provided; use criterion-level findings as current authority.',
  ]);
  const safeLayerAwareRevisionSequencing = ensureNonEmpty(layerAwareRevisionSequencing, [
    'Sequence revisions by highest impact risk first, then recalibrate supporting architecture.',
  ]);
  const safeContinuityCoverageProof = ensureNonEmpty(continuityCoverageProof, [
    'Continuity coverage proof unavailable; certify only evidence-backed findings present in canonical output.',
  ]);

  return {
    ...base,
    templateMode: input.mode,
    titleBlock: {
      ...base.titleBlock,
      targetAudience,
      shelf,
      shelfConfidenceLabel,
      headerContract: getReportHeaderContract(input.mode),
    },
    modeSpecific: {
      manuscriptScaleContinuityFindings: safeManuscriptScaleContinuityFindings,
      revisionPriorityPlan,
      storyLedgerArchitectureMap: safeStoryLedgerArchitectureMap,
      reviewGateReadinessSurface: safeReviewGateReadinessSurface,
      governedLedgerAddenda: safeGovernedLedgerAddenda,
      crossLayerSynthesis: safeCrossLayerSynthesis,
      layerAwareRevisionSequencing: safeLayerAwareRevisionSequencing,
      continuityCoverageProof: safeContinuityCoverageProof,
      readinessReleasabilityPosture,
    },
  };
}
