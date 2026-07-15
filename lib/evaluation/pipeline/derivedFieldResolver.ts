/**
 * Derived author-facing field resolver.
 *
 * `EvaluationResultV2` contains derived `quick_wins` / `strategic_revisions`
 * action items that are built from `SynthesisOutput.criteria[*].recommendations[*]`.
 * Integrity violations may be reported on the derived projection paths, but those
 * paths do not exist in `SynthesisOutput` and therefore cannot be mutated directly.
 *
 * This module resolves every inspectable author-facing path to its canonical,
 * writable source. It also provides a parity check that proves every derived
 * action item maps back to exactly one canonical recommendation.
 */

import type { EnrichedActionItem } from '@/lib/evaluation/actionItemQualityGate';
import {
  isCanonicalAuthorFacingField,
  isDerivedAuthorFacingField,
  isExcludedAuthorFacingPath,
} from '@/lib/evaluation/pipeline/authorFacingFieldRegistry';
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';

export type SynthesisWritableAuthorField = {
  kind: 'synthesis';
  inspectionPath: string;
  canonicalPath: string;
};

export type DerivedRecommendationWritableAuthorField = {
  kind: 'derived-recommendation';
  inspectionPath: string;
  sourceCriterionIndex: number;
  sourceRecommendationIndex: number;
  sourceField: string;
  canonicalPath: string;
};

export type WritableAuthorField =
  | SynthesisWritableAuthorField
  | DerivedRecommendationWritableAuthorField;

export class UnownedAuthorFacingFieldError extends Error {
  readonly code = 'UNOWNED_AUTHOR_FACING_FIELD';
  constructor(readonly paths: string[]) {
    super(
      `unknown path(s): ${paths.join(', ')}. ` +
        'Add the field to authorFacingFieldRegistry.ts or the derived-field resolver.',
    );
    this.name = 'UnownedAuthorFacingFieldError';
  }
}

export class DerivedRecommendationParityError extends Error {
  readonly code = 'DERIVED_RECOMMENDATION_PARITY_FAILED';
  constructor(readonly messageText: string) {
    super(messageText);
    this.name = 'DerivedRecommendationParityError';
  }
}

/**
 * Top-level ownership map for all inspectable author-facing surfaces.
 */
export const AUTHOR_FIELD_OWNERSHIP = {
  overview: 'synthesis.overall',
  criteria: 'synthesis.criteria',
  'recommendations.quick_wins': 'derived-from-criteria-recommendations',
  'recommendations.strategic_revisions': 'derived-from-criteria-recommendations',
} as const;

const DERIVED_ARRAY_FIELDS = new Set(['quick_wins', 'strategic_revisions']);

function parsePath(
  path: string,
  rootPath: string,
): { topLevel: keyof typeof AUTHOR_FIELD_OWNERSHIP; rest: string } | undefined {
  const normalizedRoot = `${rootPath}.`;
  if (!path.startsWith(normalizedRoot)) return undefined;
  const tail = path.slice(normalizedRoot.length);

  // Longest-prefix match for top-level keys (handles both `overview` and
  // `recommendations.quick_wins` / `recommendations.strategic_revisions`).
  const keys = Object.keys(AUTHOR_FIELD_OWNERSHIP).sort((a, b) => b.length - a.length) as Array<
    keyof typeof AUTHOR_FIELD_OWNERSHIP
  >;
  for (const topLevel of keys) {
    if (tail === topLevel || tail.startsWith(`${topLevel}.`) || tail.startsWith(`${topLevel}[`)) {
      return { topLevel, rest: tail.slice(topLevel.length) };
    }
  }
  return undefined;
}

function leafKey(path: string): string {
  return path.replace(/\[\d+\]/gu, '').split('.').pop() ?? '';
}

/**
 * Build a resolver that maps any `EvaluationResultV2`-style inspection path to
 * the canonical writable source path in `SynthesisOutput`.
 *
 * `quickWins` and `strategicRevisions` must be the internal (non-public) items
 * returned by `buildEnrichedActionItems` so their `_source` provenance is intact.
 */
export function buildWritableAuthorFieldResolver(
  quickWins: EnrichedActionItem[],
  strategicRevisions: EnrichedActionItem[],
  rootPath = 'evaluation_result_v2',
): (path: string) => WritableAuthorField | undefined {
  return (path: string): WritableAuthorField | undefined => {
    if (isExcludedAuthorFacingPath(path)) return undefined;

    const parsed = parsePath(path, rootPath);
    if (!parsed) return undefined;

    const { topLevel, rest } = parsed;

    if (topLevel === 'overview' || topLevel === 'criteria') {
      const leaf = leafKey(rest);
      // Only author-facing prose fields are writable. Excluded paths and
      // numeric/status fields are not.
      if (!isCanonicalAuthorFacingField(leaf) && !isDerivedAuthorFacingField(leaf)) {
        return undefined;
      }
      return {
        kind: 'synthesis',
        inspectionPath: path,
        canonicalPath: `${rootPath}.${topLevel}${rest}`,
      };
    }

    // Derived recommendations: evaluation_result_v2.recommendations.{quick_wins|strategic_revisions}[i].<field>
    const match = rest.match(/^\[(\d+)\]\.(?<field>.+)$/u);
    if (!match) return undefined;
    const index = parseInt(match[1]!, 10);
    const field = match.groups?.field ?? leafKey(rest);
    if (!isDerivedAuthorFacingField(field)) return undefined;

    const arrayName = topLevel.replace(/^recommendations\./u, '');
    const array = arrayName === 'quick_wins' ? quickWins : strategicRevisions;
    const item = array[index];
    if (!item) return undefined;

    const source = item._source;
    if (!source) return undefined;

    const sourceField = field === 'why' ? source.why_field : field;
    if (!isCanonicalAuthorFacingField(sourceField)) return undefined;

    const canonicalPath = `evaluation_result_v2.criteria[${source.criterion_index}].recommendations[${source.recommendation_index}].${sourceField}`;
    return {
      kind: 'derived-recommendation',
      inspectionPath: path,
      sourceCriterionIndex: source.criterion_index,
      sourceRecommendationIndex: source.recommendation_index,
      sourceField,
      canonicalPath,
    };
  };
}

/**
 * Prove that every derived action item in `quickWins` / `strategicRevisions`
 * maps to an existing canonical recommendation, and that the derived fields
 * that share a name with canonical fields actually match the source values
 * (after normalization has run on both sides).
 */
export function assertDerivedRecommendationParity(
  synthesis: SynthesisOutput,
  quickWins: EnrichedActionItem[],
  strategicRevisions: EnrichedActionItem[],
): void {
  const errors: string[] = [];

  const check = (arrayName: 'quick_wins' | 'strategic_revisions', items: EnrichedActionItem[]) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const source = item._source;
      if (!source) {
        errors.push(`${arrayName}[${i}] is missing _source provenance`);
        continue;
      }

      const criterion = synthesis.criteria[source.criterion_index];
      if (!criterion) {
        errors.push(
          `${arrayName}[${i}] _source points to missing criterion[${source.criterion_index}]`,
        );
        continue;
      }

      const recommendation = criterion.recommendations?.[source.recommendation_index];
      if (!recommendation) {
        errors.push(
          `${arrayName}[${i}] _source points to missing criterion[${source.criterion_index}].recommendations[${source.recommendation_index}]`,
        );
        continue;
      }

      // For fields that are copied verbatim from the source recommendation,
      // the public derived value must equal the source value (modulo whitespace).
      const verbatimFields = ['action', 'mechanism', 'reader_effect', 'candidate_text_a'] as const;
      for (const field of verbatimFields) {
        const derived = (item as Record<string, unknown>)[field];
        const canonical = (recommendation as Record<string, unknown>)[field];
        if (typeof derived !== 'string' || typeof canonical !== 'string') continue;
        if (derived.trim() !== canonical.trim()) {
          errors.push(
            `${arrayName}[${i}].${field} does not match canonical source ` +
              `criteria[${source.criterion_index}].recommendations[${source.recommendation_index}].${field}`,
          );
        }
      }

      // `why` is selected from a specific canonical field; it must be the value
      // currently stored at that field.
      const whyCanonicalValue = (recommendation as Record<string, unknown>)[source.why_field];
      if (typeof item.why === 'string' && typeof whyCanonicalValue === 'string') {
        if (item.why.trim() !== whyCanonicalValue.trim()) {
          errors.push(
            `${arrayName}[${i}].why does not match its _source.why_field ` +
              `criteria[${source.criterion_index}].recommendations[${source.recommendation_index}].${source.why_field}`,
          );
        }
      }
    }
  };

  check('quick_wins', quickWins);
  check('strategic_revisions', strategicRevisions);

  if (errors.length > 0) {
    throw new DerivedRecommendationParityError(errors.join('; '));
  }
}
