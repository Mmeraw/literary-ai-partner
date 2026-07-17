/**
 * Candidate-text path recognition and quarantine helpers.
 *
 * Candidate text fields (candidate_text_a/b/c) are optional copy-paste prose.
 * They are no longer deterministically rebuilt from recommendation metadata;
 * instead, bounded targeted LLM regeneration is attempted first, and only
 * unresolved candidate fields are quarantined (removed) so the rest of the
 * evaluation can be certified and persisted.
 */

export type CandidateField = 'candidate_text_a' | 'candidate_text_b' | 'candidate_text_c';

export const CANDIDATE_FIELDS: CandidateField[] = ['candidate_text_a', 'candidate_text_b', 'candidate_text_c'];

const CANDIDATE_PATH_PATTERN = /^(?:.*\.)?recommendations(?:\.quick_wins|\.strategic_revisions)?\[(\d+)\]\.(candidate_text_[abc])$/u;

const CRITERIA_CANDIDATE_PATH_PATTERN = /^(?:.*\.)?criteria\[(\d+)\]\.recommendations\[(\d+)\]\.(candidate_text_[abc])$/u;

export function isCandidateTextViolationPath(path: string): boolean {
  return CANDIDATE_PATH_PATTERN.test(path) || CRITERIA_CANDIDATE_PATH_PATTERN.test(path);
}
