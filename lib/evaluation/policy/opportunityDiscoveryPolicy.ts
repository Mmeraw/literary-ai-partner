/**
 * Canonical Opportunity Discovery Policy (ODP v1.0)
 *
 * Human-readable authority:
 * docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md
 *
 * Opportunity counts are discovery ceilings and expected ranges, never quotas.
 * Producers, validators, WAVE systems, ledgers, diagnostics, and renderers must
 * consume this module instead of embedding independent score/count rules.
 */

import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';

export type EvaluationOpportunityMode = 'short_form' | 'long_form_multi_layer';

export type OpportunitySource =
  | 'editorial'
  | 'wave'
  | 'cross_wave'
  | 'story_engine'
  | 'market_readiness';

export type RecommendationStatus =
  | 'recommendation_provided'
  | 'no_recommendation_warranted'
  | 'genre_appropriate_no_revision_warranted'
  | 'criterion_not_applicable'
  | 'insufficient_evidence'
  | 'gate_suppressed_no_safe_recommendation';

export type GovernedEmptyRecommendationStatus = Exclude<
  RecommendationStatus,
  'recommendation_provided'
>;

/**
 * Compile-time contract for every newly produced recommendation carrier.
 *
 * Historical persisted readers intentionally keep their permissive shapes.
 * Current writers must cross `requireCurrentRecommendationDisposition`, which
 * is the sole runtime-to-current-write narrowing boundary.
 */
export type CurrentRecommendationDisposition<TRecommendation> =
  | {
      recommendations: [TRecommendation, ...TRecommendation[]];
      recommendation_status: 'recommendation_provided';
      recommendation_status_rationale?: string;
    }
  | {
      recommendations: [];
      recommendation_status: GovernedEmptyRecommendationStatus;
      recommendation_status_rationale: string;
    };

export type WithCurrentRecommendationDisposition<
  T extends {
    recommendations: unknown[];
    recommendation_status?: RecommendationStatus;
    recommendation_status_rationale?: string;
  },
> = T extends unknown
  ? Omit<
      T,
      'recommendations' | 'recommendation_status' | 'recommendation_status_rationale'
    > & CurrentRecommendationDisposition<T['recommendations'][number]>
  : never;

export type OpportunityScoreGuidance = {
  expectedMin: number;
  expectedMax: number;
  hardMinimum: number;
  note: string;
};

export type OpportunityProductPolicy = {
  maxTotal: number;
  sources: readonly OpportunitySource[];
};

export const OPPORTUNITY_DISCOVERY_POLICY_VERSION = 'odp-v1.0' as const;

export const OPPORTUNITY_DISCOVERY_POLICY = {
  authorityDocument: 'docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md',
  governingPrinciple: 'Revision opportunities are discoveries, not quotas.',
  products: {
    short_form: {
      maxTotal: 50,
      sources: ['editorial'],
    },
    long_form_multi_layer: {
      maxTotal: 100,
      sources: ['editorial', 'wave', 'cross_wave', 'story_engine', 'market_readiness'],
    },
  } satisfies Record<EvaluationOpportunityMode, OpportunityProductPolicy>,
  governedStatuses: [
    'recommendation_provided',
    'no_recommendation_warranted',
    'genre_appropriate_no_revision_warranted',
    'criterion_not_applicable',
    'insufficient_evidence',
    'gate_suppressed_no_safe_recommendation',
  ] as const satisfies readonly RecommendationStatus[],
} as const;

export const RECOMMENDATION_STATUS_CONTRACT: Record<
  RecommendationStatus,
  {
    recommendationsAllowed: boolean;
    zeroRecommendationsAllowed: boolean;
    rationaleRequired: boolean;
    invalidCombinationRecovery: 'pass3_once';
  }
> = {
  recommendation_provided: {
    recommendationsAllowed: true,
    zeroRecommendationsAllowed: false,
    rationaleRequired: false,
    invalidCombinationRecovery: 'pass3_once',
  },
  no_recommendation_warranted: {
    recommendationsAllowed: false,
    zeroRecommendationsAllowed: true,
    rationaleRequired: true,
    invalidCombinationRecovery: 'pass3_once',
  },
  genre_appropriate_no_revision_warranted: {
    recommendationsAllowed: false,
    zeroRecommendationsAllowed: true,
    rationaleRequired: true,
    invalidCombinationRecovery: 'pass3_once',
  },
  criterion_not_applicable: {
    recommendationsAllowed: false,
    zeroRecommendationsAllowed: true,
    rationaleRequired: true,
    invalidCombinationRecovery: 'pass3_once',
  },
  insufficient_evidence: {
    recommendationsAllowed: false,
    zeroRecommendationsAllowed: true,
    rationaleRequired: true,
    invalidCombinationRecovery: 'pass3_once',
  },
  gate_suppressed_no_safe_recommendation: {
    recommendationsAllowed: false,
    zeroRecommendationsAllowed: true,
    rationaleRequired: true,
    invalidCombinationRecovery: 'pass3_once',
  },
};

/** Prompt rendering generated from the same runtime vocabulary. */
export function buildRecommendationStatusPromptList(): string {
  return OPPORTUNITY_DISCOVERY_POLICY.governedStatuses
    .map((status) => `- ${status}`)
    .join('\n');
}

const SHORT_FORM_GUIDANCE: Record<number, OpportunityScoreGuidance> = {
  10: {
    expectedMin: 0,
    expectedMax: 1,
    hardMinimum: 0,
    note: 'Zero is normal. Emit one only when independently evidence-supported.',
  },
  9: {
    expectedMin: 0,
    expectedMax: 1,
    hardMinimum: 0,
    note: 'Zero is allowed. One genuine minor opportunity is sufficient.',
  },
  8: {
    expectedMin: 1,
    expectedMax: 2,
    hardMinimum: 0,
    note: 'Prefer at least one when evidence supports it; never invent a second.',
  },
  7: {
    expectedMin: 1,
    expectedMax: 3,
    hardMinimum: 0,
    note: 'One may be sufficient for very short text.',
  },
  6: {
    expectedMin: 2,
    expectedMax: 4,
    hardMinimum: 0,
    note: 'Search more deeply, but do not fabricate.',
  },
  5: {
    expectedMin: 3,
    expectedMax: 5,
    hardMinimum: 0,
    note: 'Weak execution should normally yield several findings, subject to evidence and length.',
  },
};

const LONG_FORM_GUIDANCE: Record<number, OpportunityScoreGuidance> = {
  10: {
    expectedMin: 0,
    expectedMax: 1,
    hardMinimum: 0,
    note: 'Zero is normal; mastery does not require advice.',
  },
  9: {
    expectedMin: 0,
    expectedMax: 2,
    hardMinimum: 0,
    note: 'One is sufficient; a second requires distinct evidence.',
  },
  8: {
    expectedMin: 1,
    expectedMax: 4,
    hardMinimum: 0,
    note: 'Find supported passage- or pattern-level opportunities.',
  },
  7: {
    expectedMin: 3,
    expectedMax: 5,
    hardMinimum: 0,
    note: 'A recurring weakness should normally yield several distinct findings.',
  },
  6: {
    expectedMin: 3,
    expectedMax: 6,
    hardMinimum: 0,
    note: 'Search across zones and WAVE outputs for distinct high-leverage findings.',
  },
  5: {
    expectedMin: 5,
    expectedMax: 8,
    hardMinimum: 0,
    note: 'Major weakness should normally materialize repeatedly, but remains evidence-dependent.',
  },
};

function normalizeScoreBucket(score: number): number {
  if (!Number.isFinite(score)) throw new Error(`Invalid criterion score: ${score}`);
  if (score < 0 || score > 10) throw new Error(`Criterion score must be between 0 and 10: ${score}`);
  const rounded = Math.round(score);
  return rounded <= 5 ? 5 : rounded;
}

export function getOpportunityScoreGuidance(
  mode: EvaluationOpportunityMode,
  score: number,
): OpportunityScoreGuidance {
  const bucket = normalizeScoreBucket(score);
  return mode === 'long_form_multi_layer'
    ? LONG_FORM_GUIDANCE[bucket]
    : SHORT_FORM_GUIDANCE[bucket];
}

/**
 * Short-form manuscript-body word-count ceiling per criterion.
 * This is never a minimum and excludes titles/metadata.
 */
export function getShortFormPerCriterionCeiling(manuscriptBodyWordCount: number): number {
  if (!Number.isFinite(manuscriptBodyWordCount) || manuscriptBodyWordCount < 0) {
    throw new Error(`Invalid manuscript-body word count: ${manuscriptBodyWordCount}`);
  }
  if (manuscriptBodyWordCount < 500) return 1;
  if (manuscriptBodyWordCount < 2_000) return 2;
  if (manuscriptBodyWordCount < 5_000) return 3;
  return 4;
}

export function getProductOpportunityCeiling(mode: EvaluationOpportunityMode): number {
  return OPPORTUNITY_DISCOVERY_POLICY.products[mode].maxTotal;
}

export function isOpportunitySourceAllowed(
  mode: EvaluationOpportunityMode,
  source: OpportunitySource,
): boolean {
  return (OPPORTUNITY_DISCOVERY_POLICY.products[mode].sources as readonly OpportunitySource[])
    .includes(source);
}

export function isGovernedRecommendationStatus(value: unknown): value is RecommendationStatus {
  return typeof value === 'string'
    && (OPPORTUNITY_DISCOVERY_POLICY.governedStatuses as readonly string[]).includes(value);
}

export type NormalizedRecommendationStatusInput =
  | { kind: 'absent' }
  | { kind: 'valid'; value: RecommendationStatus }
  | { kind: 'invalid'; value: unknown };

/**
 * Normalize recommendation-status tokens only at an untrusted producer
 * boundary. Persisted/canonical validators deliberately remain strict so
 * malformed stored authority cannot be repaired silently on read.
 */
export function normalizeRecommendationStatusInput(
  value: unknown,
): NormalizedRecommendationStatusInput {
  if (value === undefined || value === null) return { kind: 'absent' };

  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return { kind: 'absent' };
  if (isGovernedRecommendationStatus(normalized)) {
    return { kind: 'valid', value: normalized };
  }
  return { kind: 'invalid', value: normalized };
}

export type OpportunityRecommendationInput = {
  action?: unknown;
  specific_fix?: unknown;
  fix_direction?: unknown;
  anchor_snippet?: unknown;
  evidence_anchor?: unknown;
  symptom?: unknown;
  mechanism?: unknown;
  why?: unknown;
  reader_effect?: unknown;
  expected_impact?: unknown;
  mistake_proofing?: unknown;
};

const RECOMMENDATION_PLACEHOLDER_RE = /\b(?:n\/?a|none|not specified|tbd|todo|placeholder|example|lorem ipsum|\[location|\[operation|\[priority|\[severity|\[confidence)\b/i;
const GENERIC_RECOMMENDATION_RE = /\b(?:improve|strengthen|clarify|develop|enhance|expand|tighten|revise)\s+(?:the\s+)?(?:writing|story|manuscript|novel|chapter|section|piece)\b/i;

function meaningfulRecommendationText(value: unknown, minLength = 12): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < minLength || RECOMMENDATION_PLACEHOLDER_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Canonical structural recommendation predicate shared by every coverage gate.
 * This establishes only that an intervention and supporting diagnostic content
 * exist; grounding, executability, and queue admission remain separate gates.
 */
export function isMeaningfulOpportunityRecommendation(
  value: unknown,
): value is OpportunityRecommendationInput {
  if (!value || typeof value !== 'object') return false;
  const recommendation = value as OpportunityRecommendationInput;
  const action = meaningfulRecommendationText(recommendation.specific_fix)
    ?? meaningfulRecommendationText(recommendation.action);
  if (!action) return false;

  const supportingFields = [
    recommendation.anchor_snippet,
    recommendation.evidence_anchor,
    recommendation.symptom,
    recommendation.mechanism,
    recommendation.why,
    recommendation.reader_effect,
    recommendation.expected_impact,
    recommendation.mistake_proofing,
  ];
  const meaningfulSupportingFields = supportingFields
    .map((field) => meaningfulRecommendationText(field))
    .filter((field): field is string => Boolean(field));
  if (meaningfulSupportingFields.length === 0) return false;

  if (GENERIC_RECOMMENDATION_RE.test(action)) {
    const manuscriptSpecificSupport = meaningfulRecommendationText(recommendation.anchor_snippet, 20)
      ?? meaningfulRecommendationText(recommendation.evidence_anchor, 20)
      ?? meaningfulRecommendationText(recommendation.symptom, 20)
      ?? meaningfulRecommendationText(recommendation.why, 20)
      ?? meaningfulRecommendationText(recommendation.expected_impact, 20);
    return Boolean(manuscriptSpecificSupport);
  }

  return true;
}

/**
 * Stable identity for a discovered recommendation before Pass 3 is allowed to
 * consolidate or suppress it.  This is deliberately based on editorial
 * content, not array position: ordering is presentation behaviour and must
 * never decide lineage.
 *
 * The hash implementation remains local and deterministic so this policy can
 * be consumed by prompt-packet construction without importing a renderer or a
 * persistence adapter.  Exact duplicates receive a deterministic ordinal;
 * producers that need to distinguish otherwise identical discoveries must add
 * a durable producer UUID rather than relying on order.
 */

export type RecommendationSourceIdentityInput = OpportunityRecommendationInput & {
  criterion: string;
};

export type RecommendationSourceIdentity = {
  source_id: string;
  recommendation_id: string;
  criterion: string;
};

function normalizeIdentityText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function buildRecommendationSourceFingerprint(value: RecommendationSourceIdentityInput): string {
  const criterion = normalizeIdentityText(value.criterion) || 'general';
  return canonicalJsonSha256({
    criterion,
    action: normalizeIdentityText(value.action),
    symptom: normalizeIdentityText(value.symptom),
    evidence: normalizeIdentityText(value.anchor_snippet ?? value.evidence_anchor),
    fix: normalizeIdentityText(value.specific_fix ?? value.fix_direction),
    impact: normalizeIdentityText(value.reader_effect ?? value.expected_impact),
  }).slice(0, 20);
}

export function buildRecommendationSourceIdentities(
  values: readonly RecommendationSourceIdentityInput[],
): RecommendationSourceIdentity[] {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const criterion = normalizeIdentityText(value.criterion) || 'general';
    const fingerprint = buildRecommendationSourceFingerprint({ ...value, criterion });
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    return {
      source_id: `${criterion}:${fingerprint}:${occurrence}`,
      recommendation_id: `REC-${fingerprint}-${occurrence}`,
      criterion,
    };
  });
}

/**
 * Deterministic Pass 2 -> Pass 3 lineage reconciliation.
 *
 * The model may propose an outcome, but it never decides whether the
 * accounting is complete. This validator is the merge/persistence authority:
 * every input source must terminate exactly once as materialized,
 * consolidated, or governed-suppressed.
 */
export type RecommendationLineageOutcomeKind =
  | 'materialized'
  | 'consolidated'
  | 'suppressed';

export type RecommendationLineageOutcome = {
  source_id: string;
  outcome: RecommendationLineageOutcomeKind;
  /** Required for materialized/consolidated sources once canonicalized. */
  canonical_opportunity_id?: string;
  /** Required for a consolidation so the retained authority is named. */
  consolidated_into_source_id?: string;
  /** Required for suppression: a registered governing rule, never a silent drop. */
  governing_rule?: string;
  rationale?: string;
  evidence?: string;
};

export type RecommendationLineageReconciliation = {
  source_count: number;
  outcome_count: number;
  unique_source_count: number;
  materialized_count: number;
  consolidated_count: number;
  suppressed_count: number;
  coverage_ratio: number;
  missing_source_ids: string[];
  unknown_source_ids: string[];
  duplicate_source_ids: string[];
  invalid_outcomes: string[];
  complete: boolean;
};

export function reconcileRecommendationLineage(
  sourceIds: readonly string[],
  outcomes: readonly RecommendationLineageOutcome[],
): RecommendationLineageReconciliation {
  const normalizedSources = sourceIds.filter((sourceId): sourceId is string =>
    typeof sourceId === 'string' && sourceId.trim().length > 0,
  );
  const sourceSet = new Set(normalizedSources);
  const outcomesBySource = new Map<string, RecommendationLineageOutcome[]>();
  const unknownSourceIds = new Set<string>();
  const invalidOutcomes: string[] = [];

  for (const outcome of outcomes) {
    const sourceId = typeof outcome?.source_id === 'string' ? outcome.source_id.trim() : '';
    if (!sourceId || !sourceSet.has(sourceId)) {
      if (sourceId) unknownSourceIds.add(sourceId);
      else invalidOutcomes.push('outcome_missing_source_id');
      continue;
    }
    const current = outcomesBySource.get(sourceId) ?? [];
    current.push(outcome);
    outcomesBySource.set(sourceId, current);

    if (outcome.outcome === 'suppressed') {
      if (!outcome.governing_rule?.trim() || !outcome.rationale?.trim() || !outcome.evidence?.trim()) {
        invalidOutcomes.push(`suppression_missing_governance:${sourceId}`);
      }
    } else if (outcome.outcome === 'consolidated') {
      if (!outcome.consolidated_into_source_id?.trim()) {
        invalidOutcomes.push(`consolidation_missing_target:${sourceId}`);
      } else if (!sourceSet.has(outcome.consolidated_into_source_id.trim())) {
        invalidOutcomes.push(`consolidation_unknown_target:${sourceId}`);
      } else if (outcome.consolidated_into_source_id.trim() === sourceId) {
        invalidOutcomes.push(`consolidation_self_target:${sourceId}`);
      }
    } else if (outcome.outcome !== 'materialized') {
      invalidOutcomes.push(`unknown_outcome:${sourceId}`);
    }
  }

  const missingSourceIds = normalizedSources.filter((sourceId) => !outcomesBySource.has(sourceId));
  const duplicateSourceIds = [...outcomesBySource.entries()]
    .filter(([, values]) => values.length !== 1)
    .map(([sourceId]) => sourceId);
  const counted = outcomes.filter((outcome) => sourceSet.has(outcome.source_id));
  const materializedCount = counted.filter((outcome) => outcome.outcome === 'materialized').length;
  const consolidatedCount = counted.filter((outcome) => outcome.outcome === 'consolidated').length;
  const suppressedCount = counted.filter((outcome) => outcome.outcome === 'suppressed').length;
  const uniqueSourceCount = outcomesBySource.size;
  const coverageRatio = normalizedSources.length === 0 ? 1 : uniqueSourceCount / normalizedSources.length;

  return {
    source_count: normalizedSources.length,
    outcome_count: outcomes.length,
    unique_source_count: uniqueSourceCount,
    materialized_count: materializedCount,
    consolidated_count: consolidatedCount,
    suppressed_count: suppressedCount,
    coverage_ratio: coverageRatio,
    missing_source_ids: missingSourceIds,
    unknown_source_ids: [...unknownSourceIds].sort(),
    duplicate_source_ids: duplicateSourceIds.sort(),
    invalid_outcomes: invalidOutcomes.sort(),
    complete:
      coverageRatio === 1 &&
      missingSourceIds.length === 0 &&
      unknownSourceIds.size === 0 &&
      duplicateSourceIds.length === 0 &&
      invalidOutcomes.length === 0 &&
      outcomes.length === normalizedSources.length,
  };
}

export function countMeaningfulOpportunityRecommendations(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.filter(isMeaningfulOpportunityRecommendation).length;
}

/**
 * A low opportunity count is not itself a defect. This helper answers only
 * whether an empty criterion is governed. Semantic recommendation validation
 * remains the responsibility of grounding/integrity gates.
 */
export interface GovernedOpportunityCoverageInput {
  score: number | null;
  meaningfulOpportunityCount: number;
  recommendationStatus?: unknown;
  recommendationStatusRationale?: unknown;
  /** Canonical scorability when available. A numeric score implies scorable. */
  scorable?: boolean | null;
  /** Persisted criterion status (for example SCORABLE or NOT_APPLICABLE). */
  criterionStatus?: unknown;
}

export type OpportunityCoverageIssue =
  | 'invalid_recommendation_status'
  | 'recommendation_status_cardinality_mismatch'
  | 'missing_governed_disposition'
  | 'missing_disposition_rationale'
  | 'orphan_disposition_rationale'
  | 'criterion_applicability_mismatch';

export interface GovernedOpportunityCoverageAnalysis {
  covered: boolean;
  issues: OpportunityCoverageIssue[];
}

/**
 * Canonical semantic analysis for recommendation cardinality and disposition.
 *
 * Criterion confidence is deliberately excluded. It is diagnostic confidence,
 * not confidence that a safe intervention can be prescribed, and therefore
 * cannot grant or deny recommendation coverage or queue authority.
 */
export function analyzeGovernedOpportunityCoverage(
  args: GovernedOpportunityCoverageInput,
): GovernedOpportunityCoverageAnalysis {
  const issues: OpportunityCoverageIssue[] = [];
  const hasExplicitStatus = args.recommendationStatus !== undefined
    && args.recommendationStatus !== null
    && args.recommendationStatus !== '';
  const recommendationStatus = args.recommendationStatus;
  const statusValid = isGovernedRecommendationStatus(recommendationStatus);
  const hasRecommendations = args.meaningfulOpportunityCount > 0;
  const statusContract = statusValid
    ? RECOMMENDATION_STATUS_CONTRACT[recommendationStatus]
    : null;
  const hasRationale = typeof args.recommendationStatusRationale === 'string'
    && args.recommendationStatusRationale.trim().length > 0;
  const criterionStatus = typeof args.criterionStatus === 'string'
    ? args.criterionStatus.trim().toUpperCase()
    : null;
  const isScorable = args.scorable === true
    || (args.scorable !== false && args.score !== null);
  const isNotApplicable = args.scorable === false
    || criterionStatus === 'NOT_APPLICABLE';

  if (hasExplicitStatus && !statusValid) {
    issues.push('invalid_recommendation_status');
  }

  if (!hasExplicitStatus && hasRationale) {
    issues.push('orphan_disposition_rationale');
  }

  if (
    (recommendationStatus === 'criterion_not_applicable' && isScorable)
    || (isNotApplicable && hasRecommendations)
  ) {
    issues.push('criterion_applicability_mismatch');
  }

  if (
    (hasRecommendations && statusContract !== null && !statusContract.recommendationsAllowed)
    || (!hasRecommendations && statusContract !== null && !statusContract.zeroRecommendationsAllowed)
  ) {
    issues.push('recommendation_status_cardinality_mismatch');
  }

  if (hasRecommendations) {
    if (!hasExplicitStatus) {
      issues.push('missing_governed_disposition');
    }
    return { covered: issues.length === 0, issues };
  }

  if (!statusValid) {
    if (!hasExplicitStatus) issues.push('missing_governed_disposition');
    return { covered: false, issues };
  }

  const rationaleValid = typeof args.recommendationStatusRationale === 'string'
    && args.recommendationStatusRationale.trim().length >= 20;
  if (statusContract?.rationaleRequired && !rationaleValid) {
    issues.push('missing_disposition_rationale');
  }

  return { covered: issues.length === 0, issues };
}

export function hasGovernedOpportunityCoverage(args: GovernedOpportunityCoverageInput): boolean {
  return analyzeGovernedOpportunityCoverage(args).covered;
}

/**
 * The only bridge from a permissive producer/read carrier to the strict
 * current-write disposition type. The runtime analysis remains authoritative
 * for semantic content; the returned union prevents later current-write code
 * from omitting or contradicting status/rationale structurally.
 */
export function requireCurrentRecommendationDisposition<
  const T extends {
    recommendations: unknown[];
    recommendation_status?: RecommendationStatus;
    recommendation_status_rationale?: string;
  },
>(
  criterion: T,
  args: {
    score: number | null;
    scorable?: boolean | null;
    criterionStatus?: unknown;
    context: string;
  },
): WithCurrentRecommendationDisposition<T> {
  const meaningfulOpportunityCount = countMeaningfulOpportunityRecommendations(
    criterion.recommendations,
  );
  const analysis = analyzeGovernedOpportunityCoverage({
    score: args.score,
    meaningfulOpportunityCount,
    recommendationStatus: criterion.recommendation_status,
    recommendationStatusRationale: criterion.recommendation_status_rationale,
    scorable: args.scorable,
    criterionStatus: args.criterionStatus,
  });

  if (
    meaningfulOpportunityCount !== criterion.recommendations.length
    || !analysis.covered
  ) {
    throw new RecommendationDispositionContractError(
      'Current-write recommendation disposition is structurally invalid.',
      {
        context: args.context,
        meaningful_recommendation_count: meaningfulOpportunityCount,
        raw_recommendation_count: criterion.recommendations.length,
        issues: analysis.issues,
      },
    );
  }

  // The cast is intentionally centralized here. Callers receive a required,
  // discriminated write type only after the canonical runtime contract passes.
  return criterion as unknown as WithCurrentRecommendationDisposition<T>;
}

/**
 * Producer-boundary normalization for a recommendation disposition carrier.
 *
 * This is the earliest shared boundary at which a missing governed disposition
 * can be safely derived from the canonical predicate over recommendations.
 * It is intentionally permissive only for the absent-status case; explicit
 * contradictory statuses and fabricated recommendation text are still rejected.
 *
 * - meaningful recommendations present + no explicit status
 *   → derive recommendation_provided
 * - meaningful recommendations present + explicit recommendation_provided
 *   → preserve
 * - zero meaningful recommendations + explicit empty-state status
 *   → preserve (rationale gate enforced downstream)
 * - zero meaningful recommendations + no explicit status
 *   → leave absent (fail-closed at validation)
 * - any invalid explicit status
 *   → return invalid marker so the caller can fail
 */
export type NormalizedRecommendationDispositionResult =
  | { kind: 'ok'; value: RecommendationStatus | undefined; rationale?: string }
  | { kind: 'invalid'; value: unknown };

export function normalizeProducerRecommendationDisposition(
  recommendations: readonly unknown[],
  recommendationStatus: unknown,
  recommendationStatusRationale?: unknown,
): NormalizedRecommendationDispositionResult {
  const meaningfulCount = countMeaningfulOpportunityRecommendations(recommendations);
  const normalizedStatus = normalizeRecommendationStatusInput(recommendationStatus);
  const normalizedRationale =
    typeof recommendationStatusRationale === 'string' ? recommendationStatusRationale.trim() : undefined;

  if (normalizedStatus.kind === 'invalid') {
    return { kind: 'invalid', value: recommendationStatus };
  }

  if (meaningfulCount > 0) {
    if (normalizedStatus.kind === 'absent' || normalizedStatus.value === 'recommendation_provided') {
      return { kind: 'ok', value: 'recommendation_provided', rationale: normalizedRationale };
    }
    // Explicit non-provided status with meaningful recommendations is a contradiction.
    return { kind: 'invalid', value: recommendationStatus };
  }

  if (normalizedStatus.kind === 'valid') {
    return { kind: 'ok', value: normalizedStatus.value, rationale: normalizedRationale };
  }

  // No recommendations and no status: leave absent so downstream validation can fail closed.
  return { kind: 'ok', value: undefined, rationale: normalizedRationale };
}

export type RecommendationDispositionMutationCause =
  | 'pass3_parser_safety_filter'
  | 'expectation_profile_safety_filter'
  | 'diagnostic_spine_safety_filter'
  | 'recommendation_integrity_quarantine'
  | 'cross_criterion_consolidation'
  | 'pre_gate_deduplication'
  | 'criterion_observability_filter'
  | 'product_ceiling';

export class RecommendationDispositionContractError extends Error {
  public readonly failureCode = 'CRITERION_OPPORTUNITY_COVERAGE_INVALID' as const;
  public readonly code = 'CRITERION_OPPORTUNITY_COVERAGE_INVALID' as const;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'RecommendationDispositionContractError';
    this.details = details;
  }
}

type RecommendationDispositionCarrier = {
  key?: unknown;
  recommendations: unknown[];
  recommendation_status?: RecommendationStatus;
  recommendation_status_rationale?: string;
};

/**
 * Reconcile status metadata after a deterministic, governed mutation changes
 * recommendation cardinality. This is not an ingestion repair: callers must
 * supply the exact mutation cause and the authorized empty-state disposition.
 */
export function reconcileRecommendationDispositionAfterMutation<
  T extends RecommendationDispositionCarrier,
>(
  criterion: T,
  args: {
    previousMeaningfulCount: number;
    mutationCause: RecommendationDispositionMutationCause;
    emptyStatus: Extract<RecommendationStatus,
      'gate_suppressed_no_safe_recommendation' | 'no_recommendation_warranted'>;
    emptyRationale: string;
  },
): WithCurrentRecommendationDisposition<T> {
  const priorAnalysis = analyzeGovernedOpportunityCoverage({
    score: null,
    meaningfulOpportunityCount: args.previousMeaningfulCount,
    recommendationStatus: criterion.recommendation_status,
    recommendationStatusRationale: criterion.recommendation_status_rationale,
  });
  if (!priorAnalysis.covered) {
    throw new RecommendationDispositionContractError(
      'A recommendation mutation cannot repair an already-invalid source disposition.',
      {
        criterion: criterion.key ?? null,
        mutation_cause: args.mutationCause,
        issues: priorAnalysis.issues,
      },
    );
  }

  const meaningfulCount = countMeaningfulOpportunityRecommendations(criterion.recommendations);
  const rawCount = criterion.recommendations.length;

  if (rawCount > 0 && meaningfulCount === 0) {
    throw new RecommendationDispositionContractError(
      'A deterministic recommendation mutation retained records that do not satisfy the canonical recommendation predicate.',
      {
        criterion: criterion.key ?? null,
        mutation_cause: args.mutationCause,
        raw_recommendation_count: rawCount,
        meaningful_recommendation_count: meaningfulCount,
        issues: ['recommendation_status_cardinality_mismatch'],
      },
    );
  }

  if (meaningfulCount > 0) {
    return requireCurrentRecommendationDisposition({
      ...criterion,
      recommendation_status: 'recommendation_provided',
      recommendation_status_rationale: undefined,
    }, {
      score: null,
      context: `recommendation_mutation:${args.mutationCause}:non_empty`,
    });
  }

  if (args.previousMeaningfulCount > 0) {
    if (args.emptyRationale.trim().length < 20) {
      throw new RecommendationDispositionContractError(
        'A deterministic recommendation mutation did not provide a substantive empty-state rationale.',
        {
          criterion: criterion.key ?? null,
          mutation_cause: args.mutationCause,
          issues: ['missing_disposition_rationale'],
        },
      );
    }
    return requireCurrentRecommendationDisposition({
      ...criterion,
      recommendation_status: args.emptyStatus,
      recommendation_status_rationale: args.emptyRationale.trim(),
    }, {
      score: null,
      context: `recommendation_mutation:${args.mutationCause}:empty`,
    });
  }

  const analysis = analyzeGovernedOpportunityCoverage({
    score: null,
    meaningfulOpportunityCount: 0,
    recommendationStatus: criterion.recommendation_status,
    recommendationStatusRationale: criterion.recommendation_status_rationale,
  });
  if (!analysis.covered) {
    throw new RecommendationDispositionContractError(
      'A recommendation mutation received an already-contradictory disposition.',
      {
        criterion: criterion.key ?? null,
        mutation_cause: args.mutationCause,
        issues: analysis.issues,
      },
    );
  }
  return requireCurrentRecommendationDisposition(criterion, {
    score: null,
    context: `recommendation_mutation:${args.mutationCause}:unchanged_empty`,
  });
}

/**
 * Prompt-safe policy block. Producers should embed this instead of duplicating
 * score/count tables in LLM prompts.
 */
export function buildOpportunityDiscoveryPromptBlock(mode: EvaluationOpportunityMode): string {
  const product = OPPORTUNITY_DISCOVERY_POLICY.products[mode];
  const modeLabel = mode === 'short_form' ? 'SHORT FORM' : 'LONG-FORM MULTI-LAYER';
  const sourceList = product.sources.join(', ');

  return [
    '## CANONICAL OPPORTUNITY DISCOVERY POLICY (ODP v1.0 — BINDING)',
    'Revision opportunities are discoveries, not quotas.',
    `Mode: ${modeLabel}. Product ceiling: ${product.maxTotal} total opportunities.`,
    `Allowed sources: ${sourceList}.`,
    'The ceiling is never a target. Do not invent, split, duplicate, or backfill recommendations to approach it.',
    'A lower-than-expected count requires another evidence search, not deterministic filler.',
    'Scores 9–10 may correctly return zero recommendations with substantive governed status metadata.',
    'For weak criteria, provide at least one evidence-supported opportunity or a concrete insufficient-evidence/safety status rationale.',
    'Criterion confidence describes diagnostic support, not confidence that a safe intervention can be prescribed. Never use confidence alone to admit, suppress, or manufacture a recommendation.',
    'When recommendations are present, use recommendation_provided. When none are present, use a governed non-recommendation status with a concrete rationale; do not emit contradictory status/cardinality metadata.',
    'Allowed recommendation_status values (exact spellings):',
    buildRecommendationStatusPromptList(),
    'Every retained opportunity must have exact evidence, evidence-to-symptom entailment, a cause distinct from the symptom, an aligned fix, a plausible reader effect, and a harm guardrail.',
    'Short Form must never receive WAVE or cross-WAVE opportunities.',
  ].join('\n');
}
