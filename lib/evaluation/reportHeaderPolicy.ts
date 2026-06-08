import type { GenreExpectationMetadata } from '@/lib/evaluation/genreExpectationProfiles';

export type CanonicalReportMode =
  | 'short_form_evaluation'
  | 'long_form_evaluation'
  | 'long_form_multi_layer_evaluation';

export type ReportHeaderMetricId =
  | 'report_type'
  | 'manuscript_title'
  | 'genre'
  | 'genre_expectation_contract'
  | 'target_audience'
  | 'shelf'
  | 'submitted_word_count'
  | 'estimated_pages'
  | 'reading_grade_level'
  | 'dialogue_narrative_ratio'
  | 'date_generated'
  | 'overall_score'
  | 'market_readiness'
  | 'manuscript_scale_continuity'
  | 'story_ledger_architecture'
  | 'review_gate_readiness'
  | 'cross_layer_synthesis';

export type HeaderMetricRequirement = {
  id: ReportHeaderMetricId;
  label: string;
  requirement: string;
  source: 'artifact' | 'derived_policy' | 'longform_dream' | 'genre_expectation_policy';
};

export type ReportHeaderContract = {
  mode: CanonicalReportMode;
  label: string;
  requirements: HeaderMetricRequirement[];
};

export type GenreExpectationHeader = {
  diagnosedGenre: string;
  shelfTargetAudience: string;
  dominantCraftEngine: GenreExpectationMetadata['dominant_craft_engine'];
  expectationProfiles: GenreExpectationMetadata['expectation_profiles'];
  expectationProfileLabels: string[];
  genreExpectationIds: string[];
  genreExpectationLabels: string[];
  contractSummary: string;
};

const BASE_REQUIREMENTS: HeaderMetricRequirement[] = [
  {
    id: 'report_type',
    label: 'Report Type',
    requirement: 'Display the canonical evaluation mode resolved by routing policy.',
    source: 'derived_policy',
  },
  {
    id: 'manuscript_title',
    label: 'Manuscript Title',
    requirement: 'Display the sanitized author-facing title; never expose internal test suffixes.',
    source: 'artifact',
  },
  {
    id: 'genre',
    label: 'Genre',
    requirement: 'Prefer diagnosed publishing genre over intake format words; include field-specific confidence.',
    source: 'artifact',
  },
  {
    id: 'genre_expectation_contract',
    label: 'Genre Expectations',
    requirement: 'Display the author-facing reader expectations used to assess genre fit; never expose internal profile identifiers.',
    source: 'genre_expectation_policy',
  },
  {
    id: 'target_audience',
    label: 'Target Audience',
    requirement: 'Display explicit target audience when available; otherwise mark policy-derived audience as tentative.',
    source: 'derived_policy',
  },
  {
    id: 'submitted_word_count',
    label: 'Submitted Word Count',
    requirement: 'Display persisted submitted word count; do not infer manuscript scale from report mode alone.',
    source: 'artifact',
  },
  {
    id: 'estimated_pages',
    label: 'Estimated Manuscript Pages',
    requirement: 'Derive from submitted word count at 250 words/page.',
    source: 'derived_policy',
  },
  {
    id: 'reading_grade_level',
    label: 'Reading Grade Level',
    requirement: 'Display only when enrichment produced a numeric Flesch-Kincaid value.',
    source: 'artifact',
  },
  {
    id: 'dialogue_narrative_ratio',
    label: 'Dialogue/Narrative Ratio',
    requirement: 'Display only when enrichment produced dialogue/narrative percentages.',
    source: 'artifact',
  },
  {
    id: 'date_generated',
    label: 'Date Generated',
    requirement: 'Display canonical artifact generation date.',
    source: 'artifact',
  },
  {
    id: 'overall_score',
    label: 'Overall Score',
    requirement: 'Display artifact score with field-specific confidence policy.',
    source: 'artifact',
  },
  {
    id: 'market_readiness',
    label: 'Market Readiness',
    requirement: 'Display readiness label derived from the overall score/verdict with field-specific confidence policy.',
    source: 'derived_policy',
  },
];

const LONGFORM_REQUIREMENTS: HeaderMetricRequirement[] = [
  {
    id: 'shelf',
    label: 'Shelf',
    requirement: 'Display DREAM market shelf when a long-form document is available; otherwise use Not available; include field-specific Shelf Confidence.',
    source: 'longform_dream',
  },
  {
    id: 'manuscript_scale_continuity',
    label: 'Manuscript-Scale Continuity',
    requirement: 'Long-form headers must signal that manuscript-scale continuity findings are supported by long-form evidence.',
    source: 'longform_dream',
  },
];

const MULTI_LAYER_REQUIREMENTS: HeaderMetricRequirement[] = [
  {
    id: 'story_ledger_architecture',
    label: 'Story Ledger Architecture',
    requirement: 'Multi-layer headers must identify availability of story/layer architecture evidence.',
    source: 'longform_dream',
  },
  {
    id: 'review_gate_readiness',
    label: 'Review Gate Readiness',
    requirement: 'Multi-layer headers must preserve review-gate readiness as a distinct evidence surface.',
    source: 'longform_dream',
  },
  {
    id: 'cross_layer_synthesis',
    label: 'Cross-Layer Synthesis',
    requirement: 'Multi-layer headers must distinguish cross-layer synthesis from ordinary long-form continuity.',
    source: 'longform_dream',
  },
];

export function getReportHeaderContract(mode: CanonicalReportMode): ReportHeaderContract {
  const requirements = [
    ...BASE_REQUIREMENTS,
    ...(mode === 'long_form_evaluation' || mode === 'long_form_multi_layer_evaluation' ? LONGFORM_REQUIREMENTS : []),
    ...(mode === 'long_form_multi_layer_evaluation' ? MULTI_LAYER_REQUIREMENTS : []),
  ];

  return {
    mode,
    label:
      mode === 'short_form_evaluation'
        ? 'Short-Form Evaluation Header Contract'
        : mode === 'long_form_evaluation'
          ? 'Long-Form Evaluation Header Contract'
          : 'Long-Form Multi-Layer Evaluation Header Contract',
    requirements,
  };
}

export function buildGenreExpectationHeader(
  metadata: GenreExpectationMetadata | null | undefined,
): GenreExpectationHeader | null {
  if (!metadata) return null;

  const label = metadata.genre_expectation_labels.length > 0
    ? metadata.genre_expectation_labels.join(' + ')
    : metadata.diagnosed_genre;
  const dominantCraftEngineLabel = humanizeExpectationLabel(metadata.dominant_craft_engine);
  const expectationProfileLabels = metadata.expectation_profiles.map(humanizeExpectationLabel);

  return {
    diagnosedGenre: metadata.diagnosed_genre,
    shelfTargetAudience: metadata.shelf_target_audience,
    dominantCraftEngine: metadata.dominant_craft_engine,
    expectationProfiles: metadata.expectation_profiles,
    expectationProfileLabels,
    genreExpectationIds: metadata.genre_expectation_ids,
    genreExpectationLabels: metadata.genre_expectation_labels,
    contractSummary: `${label} · ${dominantCraftEngineLabel} focus`,
  };
}

function humanizeExpectationLabel(value: string): string {
  const cleaned = value
    .replace(/_forward$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Reader expectations';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
