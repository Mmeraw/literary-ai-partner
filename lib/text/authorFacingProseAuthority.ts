import {
  inspectString,
  isAuthorTextPath,
  isExcludedPath,
  type AuthorFacingIntegrityViolation,
} from './authorFacingIntegrity';

export type { AuthorFacingIntegrityViolation };

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
    name: 'canonical recommendation prose - sentence',
    pattern: /(?:^|\.)criteria\[\d+\]\.recommendations\[\d+\]\.(?:action|symptom|cause|fix_direction|expected_impact|why)$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'canonical recommendation prose - phrase',
    pattern: /(?:^|\.)criteria\[\d+\]\.recommendations\[\d+\]\.(?:mechanism|specific_fix|reader_effect|mistake_proofing|rationale)$/u,
    kind: 'phrase',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'canonical',
  },
  {
    name: 'criterion technical-defect author-facing reason',
    pattern: /(?:^|\.)criteria\[\d+\]\.technical_defects\[\d+\]\.author_facing_reason$/u,
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
    name: 'derived quick-win and strategic-revision prose - sentence',
    pattern: /(?:^|\.)recommendations\.(?:quick_wins|strategic_revisions)\[\d+\]\.(?:action|why|candidate_text_[abc])$/u,
    kind: 'sentence',
    required: true,
    repairPolicy: 'regenerate',
    ownership: 'derived',
  },
  {
    name: 'derived quick-win and strategic-revision prose - phrase',
    pattern: /(?:^|\.)recommendations\.(?:quick_wins|strategic_revisions)\[\d+\]\.(?:mechanism|reader_effect)$/u,
    kind: 'phrase',
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

export function findMatchingAuthorFacingContracts(
  fieldPath: string,
): AuthorFacingPathContract[] {
  return AUTHOR_FACING_PATH_CONTRACTS.filter(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(fieldPath);
  });
}

export function resolveAuthorFacingFieldContract(
  fieldPath: string,
): AuthorFacingPathContract | null {
  return findMatchingAuthorFacingContracts(fieldPath)[0] ?? null;
}

export interface InspectAuthorFacingProseInput {
  text: string;
  fieldPath: string;
  fieldKind?: AuthorFacingFieldKind;
}

function fieldKindRequiresTerminalPunctuation(
  kind?: AuthorFacingFieldKind,
): boolean {
  if (!kind) return false;
  return ['sentence', 'paragraph', 'sentence_array', 'candidate'].includes(kind);
}

/**
 * Single public entry point for inspecting one author-facing prose field.
 *
 * Uses the central integrity primitives while allowing the registry contract
 * (fieldKind) to override path-derived heuristics. This keeps the registry
 * as the source of truth for whether a field must end with terminal punctuation.
 */
export function inspectAuthorFacingProse({
  text,
  fieldPath,
  fieldKind,
}: InspectAuthorFacingProseInput): AuthorFacingIntegrityViolation[] {
  const contract = resolveAuthorFacingFieldContract(fieldPath);

  if (!fieldKind && contract === null) {
    throw new UnregisteredAuthorFacingPathError([fieldPath]);
  }

  const effectiveKind = fieldKind ?? contract!.kind;

  return inspectString(fieldPath, text, {
    forceCompleteSentence: fieldKindRequiresTerminalPunctuation(effectiveKind),
  });
}

export interface RegisteredArtifactInspection {
  violations: AuthorFacingIntegrityViolation[];
  unregisteredPaths: string[];
}

/**
 * Inspect a complete projected artifact and surface any prose paths not covered
 * by the path-pattern registry. Unknown paths are explicit migration failures,
 * not silently inferred from leaf names.
 *
 * The walker delegates each string to `inspectAuthorFacingProse` with the
 * registry contract's `fieldKind`, so the registry (not the legacy leaf-key
 * heuristic) decides whether a field must end with terminal punctuation.
 */
export function inspectRegisteredAuthorFacingArtifact(
  artifact: unknown,
  rootPath = 'evaluation_result_v2',
): RegisteredArtifactInspection {
  const violations: AuthorFacingIntegrityViolation[] = [];
  const unregisteredPaths: string[] = [];
  const seen = new WeakSet<object>();

  function visit(value: unknown, path: string): void {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      if (!value.trim()) return;
      if (isExcludedPath(path)) return;

      const contract = resolveAuthorFacingFieldContract(path);
      if (contract === null) {
        if (isAuthorTextPath(path)) {
          unregisteredPaths.push(path);
        }
        return;
      }

      if (contract.kind === 'excluded' || contract.ownership === 'excluded') {
        return;
      }

      const fieldViolations = inspectAuthorFacingProse({
        text: value,
        fieldPath: path,
        fieldKind: contract.kind,
      });

      violations.push(...fieldViolations);
      return;
    }

    if (typeof value !== 'object') return;
    if (seen.has(value as object)) return;
    seen.add(value as object);

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visit(child, `${path}.${key}`);
    }
  }

  visit(artifact, rootPath);

  return {
    violations,
    unregisteredPaths: [...new Set(unregisteredPaths)],
  };
}

/**
 * Thrown when an artifact inspection projection contains an author-facing path
 * that is not covered by the central registry. Unknown paths are architecture
 * defects, not silently-inferred prose fields.
 */
export class UnregisteredAuthorFacingPathError extends Error {
  constructor(readonly paths: readonly string[]) {
    super(
      `Unregistered author-facing path(s) encountered during artifact inspection: ${paths.join(', ')}. ` +
        'Add a contract to AUTHOR_FACING_PATH_CONTRACTS before certifying this field.',
    );
    this.name = 'UnregisteredAuthorFacingPathError';
  }
}
