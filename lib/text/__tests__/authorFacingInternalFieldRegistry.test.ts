import {
  INTERNAL_NON_RENDERABLE_FIELD_PATH_CONTRACTS,
  isInternalNonRenderableFieldPath,
} from '../authorFacingInternalFieldRegistry';
import {
  assertAuthorFacingIntegrity,
  inspectAuthorFacingIntegrity,
  isExcludedPath,
} from '../authorFacingIntegrity';
import { isExcludedAuthorFacingPath } from '@/lib/evaluation/pipeline/authorFacingFieldRegistry';
import { normalizeArtifact } from '@/lib/evaluation/pipeline/normalizeArtifact';
import { inspectRegisteredAuthorFacingArtifact } from '../authorFacingProseAuthority';

describe('internal non-renderable field registry', () => {
  it('keeps the field registry and integrity walker aligned for every contract example', () => {
    for (const contract of INTERNAL_NON_RENDERABLE_FIELD_PATH_CONTRACTS) {
      for (const path of contract.examplePaths) {
        expect(isInternalNonRenderableFieldPath(path)).toBe(true);
        expect(isExcludedAuthorFacingPath(path)).toBe(true);
        expect(isExcludedPath(path)).toBe(true);
      }
    }
  });

  it('classifies the production provenance path as internal metadata and retains it through canonical normalization', () => {
    const sourceId = 'marketability:pass2-fingerprint:0';
    const productionPath =
      'evaluation_result_v2.criteria[7].recommendations[0].source_recommendation_ids[0]';
    const synthesis = {
      overall: {},
      criteria: [
        {
          recommendations: [
            {
              action: 'Strengthen the market-facing hook before the midpoint.',
              source_recommendation_ids: [sourceId],
            },
          ],
        },
      ],
    };

    expect(isInternalNonRenderableFieldPath(productionPath)).toBe(true);
    expect(
      inspectAuthorFacingIntegrity(synthesis, { rootPath: 'evaluation_result_v2' }),
    ).toEqual([]);
    expect(() => assertAuthorFacingIntegrity(synthesis)).not.toThrow();
    expect(() => normalizeArtifact(synthesis as never, [], [])).not.toThrow();
    expect(synthesis.criteria[0].recommendations[0].source_recommendation_ids).toEqual([
      sourceId,
    ]);
  });

  it('continues to reject internal process language in a real author-facing field', () => {
    const violations = inspectAuthorFacingIntegrity(
      {
        criteria: [
          {
            recommendations: [
              {
                action: 'A distinct market hook was not generated.',
                source_recommendation_ids: ['marketability:pass2-fingerprint:0'],
              },
            ],
          },
        ],
      },
      { rootPath: 'evaluation_result_v2' },
    );

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'evaluation_result_v2.criteria[0].recommendations[0].action',
          code: 'AUTHOR_TEXT_FALLBACK_SENTINEL',
        }),
      ]),
    );
  });

  it('does not silently exempt an unregistered recommendation prose field', () => {
    const unknownPath =
      'evaluation_result_v2.criteria[0].recommendations[0].internal_process_summary';
    const artifact = {
      criteria: [
        {
          recommendations: [
            {
              source_recommendation_ids: ['marketability:pass2-fingerprint:0'],
              internal_process_summary: 'A distinct market hook was not generated.',
            },
          ],
        },
      ],
    };

    expect(isInternalNonRenderableFieldPath(unknownPath)).toBe(false);
    expect(isExcludedAuthorFacingPath(unknownPath)).toBe(false);
    expect(isExcludedPath(unknownPath)).toBe(false);
    expect(inspectRegisteredAuthorFacingArtifact(artifact).unregisteredPaths).toEqual([
      unknownPath,
    ]);
  });
  it('does not exempt paths that are merely similar to canonical provenance', () => {
    const nearMisses = [
      'evaluation_result_v2.criteria[3].source_recommendation_ids',
      'evaluation_result_v2.recommendations[1].source_recommendation_ids_extra',
      'evaluation_result_v2.criteria[3].recommendations[1].unexpected.source_recommendation_ids',
    ];

    for (const path of nearMisses) {
      expect(isInternalNonRenderableFieldPath(path)).toBe(false);
      expect(isExcludedAuthorFacingPath(path)).toBe(false);
      expect(isExcludedPath(path)).toBe(false);
    }
  });
});
