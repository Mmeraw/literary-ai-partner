/**
 * Author-facing field registry.
 *
 * Centralizes the contract for which fields in SynthesisOutput and
 * EvaluationResultV1/V2 contain author-facing prose. The integrity pipeline
 * normalizes/regenerates canonical fields, derives quick_wins / strategic_revisions,
 * and explicitly excludes evidence/quotations/IDs/scores/telemetry from any
 * deterministic rewriting.
 *
 * Adding a new author-facing surface without registering it here will cause
 * the registry-invariant test to fail.
 */

/**
 * Canonical fields that live directly on SynthesisOutput and are normalized and
 * repaired by normalizeArtifact / regenerateRequiredProse.
 */
export const CANONICAL_AUTHOR_FACING_FIELDS = new Set([
  // overview
  'one_paragraph_summary',
  'one_sentence_pitch',
  'one_paragraph_pitch',
  'top_3_strengths',
  'top_3_risks',
  // criterion body
  'rationale',
  'final_rationale',
  'fit_summary',
  'gap_summary',
  'delta_explanation',
  'deferred_consequence_risk',
  'pressure_points',
  'decision_points',
  // recommendation / action item prose
  'action',
  'why',
  'symptom',
  'cause',
  'mechanism',
  'fix_direction',
  'specific_fix',
  'reader_effect',
  'expected_impact',
  'mistake_proofing',
  'candidate_text_a',
  'candidate_text_b',
  'candidate_text_c',
  // technical defect surface
  'author_facing_reason',
]);

/**
 * Fields that appear only inside derived quick_wins / strategic_revisions
 * action items. They are not stored on SynthesisOutput; their source values are
 * tracked by `ActionItemSource` (`_source` on internal enriched items) and
 * repaired by regenerating the canonical source field.
 */
export const DERIVED_AUTHOR_FACING_FIELDS = new Set([
  'action',
  'why',
  'mechanism',
  'reader_effect',
  'candidate_text_a',
  'candidate_text_b',
  'candidate_text_c',
]);

/**
 * Path fragments that identify manuscript evidence, internal telemetry, status
 * codes, scores, IDs, or other non-prose surfaces. These must never be rewritten
 * by normalization or regeneration.
 */
export const EXCLUDED_AUTHOR_FACING_PATH_FRAGMENTS = new Set([
  '.evidence.',
  '.snippet',
  '.anchor_snippet',
  '.original_passage',
  '.manuscript_excerpt',
  '.ids.',
  '.engine.',
  '.metrics.processing.',
  '.artifacts.',
  '.generated_at',
  '.created_at',
  '.schema_version',
  '.artifact_id',
  '.job_id',
  '.user_id',
  '.manuscript_id',
  '.project_id',
  '.evaluation_run_id',
  '.source_hash',
  '.prompt_version',
  '.policy_family',
  '.repro_anchor',
  '.manuscript_coordinates',
  '.criterion_key',
  '.key',
  '.status',
  '.verdict',
  '.effort',
  '.impact',
  '.priority',
  '.confidence_label',
  '.confidence_reasons',
]);

export function isCanonicalAuthorFacingField(key: string): boolean {
  return CANONICAL_AUTHOR_FACING_FIELDS.has(key);
}

export function isDerivedAuthorFacingField(key: string): boolean {
  return DERIVED_AUTHOR_FACING_FIELDS.has(key);
}

export function isExcludedAuthorFacingPath(path: string): boolean {
  for (const fragment of EXCLUDED_AUTHOR_FACING_PATH_FRAGMENTS) {
    if (path.includes(fragment)) return true;
  }
  return false;
}

function leafKey(path: string): string {
  return path.replace(/\[\d+\]/gu, '').split('.').pop() ?? path;
}

/**
 * True when an integrity violation path is accounted for by the registry:
 * canonical, derived, excluded, or (for legacy reasons) candidate.
 */
export function isKnownAuthorFacingPath(path: string): boolean {
  if (isExcludedAuthorFacingPath(path)) return true;
  const leaf = leafKey(path);
  if (isCanonicalAuthorFacingField(leaf)) return true;
  if (isDerivedAuthorFacingField(leaf)) return true;
  return false;
}
