/**
 * Internal/non-renderable field registry.
 *
 * These contracts are intentionally structural and exact: a field is excluded
 * from author-facing prose inspection only when its complete path matches an
 * enumerated internal metadata contract. Do not add substring-based bypasses
 * at individual integrity call sites.
 */

export interface InternalNonRenderableFieldPathContract {
  name: string;
  pattern: RegExp;
  examplePaths: readonly string[];
}

export const INTERNAL_NON_RENDERABLE_FIELD_PATH_CONTRACTS: readonly InternalNonRenderableFieldPathContract[] = [
  {
    name: 'Pass 2 recommendation provenance IDs',
    // Matches the canonical recommendation lineage array and each scalar entry
    // beneath it, under either a synthesis envelope or an EvaluationResultV2
    // projection. It deliberately does not match arbitrary recommendation
    // fields or other source-ID-shaped paths.
    pattern:
      /(?:^|\.)criteria\[\d+\]\.recommendations\[\d+\]\.source_recommendation_ids(?:\[\d+\])?$/u,
    examplePaths: [
      'evaluation_result_v2.criteria[7].recommendations[0].source_recommendation_ids',
      'evaluation_result_v2.criteria[7].recommendations[0].source_recommendation_ids[0]',
      '$.criteria[7].recommendations[0].source_recommendation_ids[0]',
    ],
  },
];

export function isInternalNonRenderableFieldPath(path: string): boolean {
  return INTERNAL_NON_RENDERABLE_FIELD_PATH_CONTRACTS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(path);
  });
}
