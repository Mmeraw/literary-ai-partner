import {
  inspectAuthorFacingIntegrity,
  type AuthorFacingIntegrityViolation,
} from './authorFacingIntegrity';

export type AuthorFacingFieldKind =
  | 'sentence'
  | 'paragraph'
  | 'candidate'
  | 'sentence_array'
  | 'phrase'
  | 'excluded';

export type AuthorFacingRepairPolicy =
  | 'regenerate'
  | 'candidate_regenerate_or_quarantine'
  | 'normalize_only'
  | 'none';

export interface AuthorFacingFieldContract {
  kind: AuthorFacingFieldKind;
  required: boolean;
  repairPolicy: AuthorFacingRepairPolicy;
  ownership: 'canonical' | 'derived' | 'excluded';
}

export interface AuthorFacingPathContract extends AuthorFacingFieldContract {
  pattern: RegExp;
  name: string;
}

/**
 * Path-pattern registry for author-facing prose contracts.
 *
 * This is intentionally additive and parity-preserving: the first migration
 * stage centralizes field ownership and inspection entry points while the
 * existing integrity primitives remain the implementation authority.
 */
export const AUTHOR_FACING_PATH_CONTRACTS: readonly AuthorFacingPathContract[] = [
  {
    name: 'overview paragraph summary',
    pattern: /(?:^|\.)overview\.one_paragraph_summary$/u,
    kind: 'paragraph',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'overview one-sentence pitch',
    pattern: /(?:^|\.)overview\.one_sentence_pitch$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'overview paragraph pitch',
    pattern: /(?:^|\.)overview\.one_paragraph_pitch$/u,
    kind: 'paragraph',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'overview strengths and risks',
    pattern: /(?:^|\.)overview\.top_3_(?:strengths|risks)\[\d+\]$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'criterion rationale and summaries',
    pattern: /(?:^|\.)criteria\[\d+\]\.(?:rationale|final_rationale|fit_summary|gap_summary|delta_explanation|deferred_consequence_risk)$/u,
    kind: 'paragraph',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'criterion pressure and decision points',
    pattern: /(?:^|\.)criteria\[\d+\]\.(?:pressure_points|decision_points)\[\d+\]$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'canonical recommendation prose',
    pattern: /(?:^|\.)criteria\[\d+\]\.recommendations\[\d+\]\.(?:action|why|symptom|cause|mechanism|fix_direction|specific_fix|reader_effect|expected_impact|mistake_proofing)$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'candidate recommendation prose',
    pattern: /(?:^|\.)criteria\[\d+\]\.recommendations\[\d+\]\.candidate_text_[abc]$/u,
    kind: 'candidate',
    required: false,
    repairPolicy: 'candidate_regenerate_or_quarantine',
    ownership: 'canonical',
  },
  {
    name: 'derived quick-win and strategic-revision prose',
    pattern: /(?:^|\.)recommendations\.(?:quick_wins|strategic_revisions)\[\d+\]\.(?:action|why|mechanism|reader_effect|candidate_text_[abc])$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'derived',
  },
  {
    name: 'source quotations and evidence',
    pattern: /(?:^|\.)(?:evidence\[\d+\]\.snippet|anchor_snippet|original_passage|manuscript_excerpt)$/u,
    kind: 'excluded',
    required: false,
    repairPolicy: 'none',
    ownership: 'excluded',
  },
] as const;

export function resolveAuthorFacingFieldContract(
  fieldPath: string,
): AuthorFacingPathContract | null {
  return AUTHOR_FACING_PATH_CONTRACTS.find(({ pattern }) => pattern.test(fieldPath)) ?? null;
}

export interface InspectAuthorFacingProseInput {
  text: string;
  fieldPath: string;
  fieldKind?: AuthorFacingFieldKind;
}

/**
 * Single public entry point for inspecting one author-facing prose field.
 *
 * Stage 1 delegates to the proven recursive integrity inspector so existing
 * violation codes and behavior remain stable while callers migrate to one API.
 */
export function inspectAuthorFacingProse({
  text,
  fieldPath,
}: InspectAuthorFacingProseInput): AuthorFacingIntegrityViolation[] {
  const leaf = fieldPath.split('.').pop() ?? 'value';
  const parent = fieldPath.slice(0, Math.max(0, fieldPath.length - leaf.length - 1));
  return inspectAuthorFacingIntegrity(
    { [leaf]: text },
    { rootPath: parent || '$' },
  );
}

export interface RegisteredArtifactInspection {
  violations: AuthorFacingIntegrityViolation[];
  unregisteredPaths: string[];
}

/**
 * Inspect a complete projected artifact and surface any prose paths not covered
 * by the path-pattern registry. Unknown paths are explicit migration failures,
 * not silently inferred from leaf names.
 */
export function inspectRegisteredAuthorFacingArtifact(
  artifact: unknown,
  rootPath = 'evaluation_result_v2',
): RegisteredArtifactInspection {
  const violations = inspectAuthorFacingIntegrity(artifact, { rootPath });
  const unregisteredPaths = [
    ...new Set(
      violations
        .map(({ path }) => path)
        .filter((path) => resolveAuthorFacingFieldContract(path) === null),
    ),
  ];
  return { violations, unregisteredPaths };
}
