import { describe, expect, test } from '@jest/globals';

import type {
  AxisCriterionResult,
  CurrentPass2Criterion,
} from '@/lib/evaluation/pipeline/types';
import {
  normalizeProducerRecommendationDisposition,
  RecommendationDispositionContractError,
  requireCurrentRecommendationDisposition,
} from '@/lib/evaluation/policy/opportunityDiscoveryPolicy';

const recommendation: AxisCriterionResult['recommendations'][number] = {
  priority: 'high',
  action: 'Replace the abstract opening with the specific observed exchange.',
  expected_impact: 'Grounds the conflict in a concrete manuscript moment.',
  anchor_snippet: 'She reached for the door handle, her hand trembling.',
  issue_family: 'scene_structure',
  strategic_lever: 'scene_goal_clarity',
  revision_granularity: 'beat',
};

const criterionBase = {
  key: 'concept' as const,
  score_0_10: 6,
  rationale: 'The premise is legible, but the opening does not yet dramatize its conflict.',
  evidence: [{ snippet: 'She reached for the door handle, her hand trembling.' }],
};

const validProvided: CurrentPass2Criterion = {
  ...criterionBase,
  recommendations: [recommendation],
  recommendation_status: 'recommendation_provided',
};

const validEmpty: CurrentPass2Criterion = {
  ...criterionBase,
  recommendations: [],
  recommendation_status: 'insufficient_evidence',
  recommendation_status_rationale:
    'The available evidence does not support a safe manuscript-specific intervention.',
};

// Compile-time mistake-proofing: current writers cannot represent these states.
// @ts-expect-error A current-write criterion cannot omit its governed disposition.
const missingStatus: CurrentPass2Criterion = {
  ...criterionBase,
  recommendations: [],
};

// @ts-expect-error A governed empty disposition requires an explanatory rationale.
const missingRationale: CurrentPass2Criterion = {
  ...criterionBase,
  recommendations: [],
  recommendation_status: 'insufficient_evidence',
};

// @ts-expect-error A non-empty recommendation tuple requires recommendation_provided.
const contradictoryProvidedState: CurrentPass2Criterion = {
  ...criterionBase,
  recommendations: [recommendation],
  recommendation_status: 'insufficient_evidence',
  recommendation_status_rationale:
    'This rationale cannot authorize a recommendation under an empty disposition.',
};

// @ts-expect-error recommendation_provided requires at least one recommendation.
const contradictoryEmptyState: CurrentPass2Criterion = {
  ...criterionBase,
  recommendations: [],
  recommendation_status: 'recommendation_provided',
};

void [
  validProvided,
  validEmpty,
  missingStatus,
  missingRationale,
  contradictoryProvidedState,
  contradictoryEmptyState,
];

describe('current recommendation-disposition write boundary', () => {
  test('narrows a valid recommendation-bearing carrier', () => {
    const current = requireCurrentRecommendationDisposition(
      {
        recommendations: [{
          action: recommendation.action,
          expected_impact: recommendation.expected_impact,
        }],
        recommendation_status: 'recommendation_provided',
      },
      { score: 6, context: 'current_write_type_test:provided' },
    );

    expect(current.recommendation_status).toBe('recommendation_provided');
    expect(current.recommendations).toHaveLength(1);
  });

  test('narrows a valid governed-empty carrier', () => {
    const current = requireCurrentRecommendationDisposition(
      {
        recommendations: [],
        recommendation_status: 'insufficient_evidence',
        recommendation_status_rationale:
          'The available evidence does not support a safe manuscript-specific intervention.',
      },
      { score: 6, context: 'current_write_type_test:empty' },
    );

    expect(current.recommendation_status).toBe('insufficient_evidence');
    expect(current.recommendations).toEqual([]);
  });

  test.each([
    {
      name: 'omitted disposition',
      criterion: { recommendations: [] },
    },
    {
      name: 'empty recommendation_provided disposition',
      criterion: {
        recommendations: [],
        recommendation_status: 'recommendation_provided' as const,
      },
    },
    {
      name: 'meaningless recommendation payload',
      criterion: {
        recommendations: [{ action: '   ' }],
        recommendation_status: 'recommendation_provided' as const,
      },
    },
  ])('rejects $name at the sole runtime narrowing bridge', ({ criterion }) => {
    expect(() => requireCurrentRecommendationDisposition(
      criterion,
      { score: 6, context: 'current_write_type_test:invalid' },
    )).toThrow(RecommendationDispositionContractError);
  });
});

describe('producer recommendation-disposition normalization boundary', () => {
  test('derives recommendation_provided when status is absent and recommendations are meaningful', () => {
    const result = normalizeProducerRecommendationDisposition(
      [recommendation],
      undefined,
    );
    expect(result.kind).toBe('ok');
    expect(result.value).toBe('recommendation_provided');
  });

  test('preserves explicit recommendation_provided', () => {
    const result = normalizeProducerRecommendationDisposition(
      [recommendation],
      'recommendation_provided',
    );
    expect(result.kind).toBe('ok');
    expect(result.value).toBe('recommendation_provided');
  });

  test('preserves explicit empty-state disposition when no recommendations are meaningful', () => {
    const result = normalizeProducerRecommendationDisposition(
      [],
      'insufficient_evidence',
      'No manuscript-specific intervention is supported by the evidence.',
    );
    expect(result.kind).toBe('ok');
    expect(result.value).toBe('insufficient_evidence');
  });

  test('leaves disposition absent when there are no meaningful recommendations and no status', () => {
    const result = normalizeProducerRecommendationDisposition([], undefined);
    expect(result.kind).toBe('ok');
    expect(result.value).toBeUndefined();
  });

  test('rejects explicit empty-state disposition when meaningful recommendations exist', () => {
    const result = normalizeProducerRecommendationDisposition(
      [recommendation],
      'insufficient_evidence',
    );
    expect(result.kind).toBe('invalid');
  });

  test('rejects invalid explicit status', () => {
    const result = normalizeProducerRecommendationDisposition(
      [],
      'not_a_valid_status',
    );
    expect(result.kind).toBe('invalid');
  });

  test('is idempotent over already-normalized carriers', () => {
    const first = normalizeProducerRecommendationDisposition(
      [recommendation],
      undefined,
    );
    expect(first.kind).toBe('ok');
    const second = normalizeProducerRecommendationDisposition(
      [recommendation],
      first.value,
    );
    expect(second.kind).toBe('ok');
    expect(second.value).toBe(first.value);
  });

  test('does not synthesize recommendation text when status is missing', () => {
    const result = normalizeProducerRecommendationDisposition(
      [recommendation],
      undefined,
    );
    expect(result.kind).toBe('ok');
    expect(result.value).toBe('recommendation_provided');
  });
});
