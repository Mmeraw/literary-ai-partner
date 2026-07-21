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
}

export type OpportunityCoverageIssue =
  | 'invalid_recommendation_status'
  | 'recommendation_status_cardinality_mismatch'
  | 'missing_governed_disposition'
  | 'missing_disposition_rationale';

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

  if (hasExplicitStatus && !statusValid) {
    issues.push('invalid_recommendation_status');
  }

  if (
    (hasRecommendations && statusContract !== null && !statusContract.recommendationsAllowed)
    || (!hasRecommendations && statusContract !== null && !statusContract.zeroRecommendationsAllowed)
  ) {
    issues.push('recommendation_status_cardinality_mismatch');
  }

  // Legacy producers may omit status when they emitted a real recommendation.
  // An explicit incompatible or unknown status is never treated as legacy.
  if (hasRecommendations) {
    return { covered: issues.length === 0, issues };
  }

  // Strong criteria may legitimately produce no recommendation. Explicit
  // malformed or incompatible metadata still fails closed when present.
  if (args.score !== null && args.score >= 8 && !hasExplicitStatus) {
    return { covered: true, issues };
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
    'Every retained opportunity must have exact evidence, evidence-to-symptom entailment, a cause distinct from the symptom, an aligned fix, a plausible reader effect, and a harm guardrail.',
    'Short Form must never receive WAVE or cross-WAVE opportunities.',
  ].join('\n');
}
