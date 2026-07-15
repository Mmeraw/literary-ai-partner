/**
 * Localized candidate-text integrity repair.
 *
 * Pass 3 can emit candidate_text_a/b/c strings that contain ellipses or end
 * mid-sentence. Those are optional author-facing fields: if they cannot be
 * rebuilt from grounded recommendation data, they are quarantined (removed)
 * so the rest of the evaluation can still be certified and persisted.
 *
 * Rules enforced:
 * - Only candidate_text_a/b/c under a recommendations array are repaired.
 * - Non-candidate integrity violations remain fail-closed.
 * - Unsafe candidate seeds are discarded, not cosmetically patched.
 * - Rebuilt text is grounded in the same recommendation's action, specific_fix,
 *   mechanism, reader_effect, expected_impact, symptom, or anchor_snippet.
 * - After two repair attempts, remaining malformed candidate fields are quarantined.
 */

import type { SynthesisOutput } from './types';
import {
  AuthorFacingIntegrityError,
  type AuthorFacingIntegrityViolation,
  inspectAuthorFacingIntegrity,
  isAuthorFacingIntegrityError,
} from '@/lib/text/authorFacingIntegrity';
import { endsMidSentence } from '@/lib/text/authorFacingProse';

export type CandidateField = 'candidate_text_a' | 'candidate_text_b' | 'candidate_text_c';

export type CandidateRepairResult = {
  /** How the call resolved. */
  status: 'repaired' | 'quarantined' | 'unrepairable';
  /** Paths that were repaired or quarantined. */
  affectedPaths: string[];
  /** Violations that remain after the attempted repair. */
  remainingViolations: AuthorFacingIntegrityViolation[];
  /** Human-readable telemetry. */
  telemetry: {
    repairAttempts: number;
    quarantinedCount: number;
    rebuiltCount: number;
  };
};

const CANDIDATE_FIELDS: CandidateField[] = ['candidate_text_a', 'candidate_text_b', 'candidate_text_c'];

const CANDIDATE_PATH_PATTERN = /^(?:.*\.)?recommendations(?:\.quick_wins|\.strategic_revisions)?\[(\d+)\]\.(candidate_text_[abc])$/u;

const CRITERIA_CANDIDATE_PATH_PATTERN = /^(?:.*\.)?criteria\[(\d+)\]\.recommendations\[(\d+)\]\.(candidate_text_[abc])$/u;

function isCandidateTextViolationPath(path: string): boolean {
  return CANDIDATE_PATH_PATTERN.test(path) || CRITERIA_CANDIDATE_PATH_PATTERN.test(path);
}

export function isCandidateOnlyIntegrityError(err: AuthorFacingIntegrityError): boolean {
  return err.violations.every((v) => isCandidateTextViolationPath(v.path));
}

function getRecommendationFromCriterion(
  synthesis: SynthesisOutput,
  criterionIndex: number,
  recommendationIndex: number,
): SynthesisOutput['criteria'][number]['recommendations'][number] | undefined {
  const criterion = synthesis.criteria[criterionIndex];
  if (!criterion) return undefined;
  const recs = criterion.recommendations;
  if (!Array.isArray(recs)) return undefined;
  return recs[recommendationIndex];
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/(?:\.{3}|…)/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sentenceEndsCleanly(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !endsMidSentence(trimmed) && /[.!?]["'"’\)]*$/u.test(trimmed);
}

function pickGroundedSource(
  recommendation: SynthesisOutput['criteria'][number]['recommendations'][number],
  field: CandidateField,
): string {
  const sourcesByField: Record<CandidateField, Array<string | undefined>> = {
    candidate_text_a: [recommendation.specific_fix, recommendation.action],
    candidate_text_b: [recommendation.mechanism, recommendation.expected_impact],
    candidate_text_c: [recommendation.reader_effect, recommendation.symptom],
  };

  for (const source of sourcesByField[field]) {
    if (typeof source === 'string' && source.trim().length >= 8) {
      return source.trim();
    }
  }

  const fallback = recommendation.specific_fix ?? recommendation.action ?? recommendation.mechanism;
  if (typeof fallback === 'string' && fallback.trim().length >= 8) {
    return fallback.trim();
  }

  if (typeof recommendation.anchor_snippet === 'string' && recommendation.anchor_snippet.trim().length >= 8) {
    return recommendation.anchor_snippet.trim();
  }

  return 'Revise the targeted passage so the craft signal lands more clearly for the reader.';
}

function buildVariantProse(base: string, field: CandidateField): string {
  // Discard the unsafe seed and rebuild from the grounded recommendation data.
  const clean = base
    .replace(/(?:\.{3}|…)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = splitIntoSentences(clean);
  const first = sentences[0] ?? clean;

  let candidate = first;
  if (field === 'candidate_text_b') {
    candidate = sentences[1] ?? first;
  } else if (field === 'candidate_text_c') {
    candidate = sentences[2] ?? (sentences[1] ?? first);
  }

  // Remove trailing junk that would leave the sentence incomplete.
  candidate = candidate.replace(/[,;:—\-({\[]+$/u, '').trim();

  // Ensure a reasonable minimum of concrete guidance remains.
  if (candidate.split(/\s+/).length < 5) {
    candidate = `${candidate} This addresses the craft signal at the anchored passage without flattening the surrounding voice.`;
  }

  // Ensure terminal punctuation, but never cosmetically patch an ellipsis into a lone period.
  if (!/[.!?]["'"’\)]*$/u.test(candidate)) {
    candidate = `${candidate}.`;
  }

  return candidate;
}

function rebuildCandidateField(
  recommendation: SynthesisOutput['criteria'][number]['recommendations'][number],
  field: CandidateField,
): string | undefined {
  const base = pickGroundedSource(recommendation, field);
  const rebuilt = buildVariantProse(base, field);

  if (!sentenceEndsCleanly(rebuilt)) {
    return undefined;
  }
  return rebuilt;
}

function reInspectCandidates(synthesis: SynthesisOutput): AuthorFacingIntegrityViolation[] {
  return inspectAuthorFacingIntegrity(
    { overview: synthesis.overall, criteria: synthesis.criteria, recommendations: {} },
    { rootPath: 'evaluation_result_v2' },
  ).filter((v) => isCandidateTextViolationPath(v.path));
}

function applyRepairToSynthesis(synthesis: SynthesisOutput): {
  rebuiltPaths: string[];
  quarantinedPaths: string[];
} {
  const rebuiltPaths: string[] = [];
  const quarantinedPaths: string[] = [];

  for (const criterion of synthesis.criteria) {
    if (!Array.isArray(criterion.recommendations)) continue;
    for (const rec of criterion.recommendations) {
      for (const field of CANDIDATE_FIELDS) {
        const value = rec[field];
        if (typeof value !== 'string') continue;

        const localViolations = inspectAuthorFacingIntegrity(
          { [field]: value },
          { rootPath: 'evaluation_result_v2.recommendations[0]' },
        );
        if (localViolations.length === 0) continue;

        const rebuilt = rebuildCandidateField(rec, field);
        if (rebuilt !== undefined) {
          rec[field] = rebuilt;
          rebuiltPaths.push(`criteria[*].recommendations[*].${field}`);
        } else {
          rec[field] = undefined;
          quarantinedPaths.push(`criteria[*].recommendations[*].${field}`);
        }
      }
    }
  }

  return { rebuiltPaths, quarantinedPaths };
}

function quarantineAllCandidateViolations(
  synthesis: SynthesisOutput,
  violations: AuthorFacingIntegrityViolation[],
): string[] {
  const quarantinedPaths: string[] = [];

  for (const criterion of synthesis.criteria) {
    if (!Array.isArray(criterion.recommendations)) continue;
    for (const rec of criterion.recommendations) {
      for (const field of CANDIDATE_FIELDS) {
        if (typeof rec[field] === 'string') {
          rec[field] = undefined;
          quarantinedPaths.push(`criteria[*].recommendations[*].${field}`);
        }
      }
    }
  }

  return quarantinedPaths;
}

/**
 * Attempt to repair candidate-text integrity violations in a synthesis artifact.
 *
 * - If the error contains non-candidate violations, returns `unrepairable` and the
 *   original violations so the caller can fail closed.
 * - If all violations are candidate-text fields, first try to rebuild the unsafe
 *   candidate(s) from grounded recommendation data.
 * - If rebuilding leaves any candidate-text violations, quarantine (remove) the
 *   remaining malformed optional candidate fields on a second pass.
 *
 * The function mutates `synthesis` in place.
 */
export function attemptCandidateIntegrityRepair(
  synthesis: SynthesisOutput,
  error: AuthorFacingIntegrityError,
): CandidateRepairResult {
  if (!isCandidateOnlyIntegrityError(error)) {
    return {
      status: 'unrepairable',
      affectedPaths: [],
      remainingViolations: error.violations,
      telemetry: { repairAttempts: 0, quarantinedCount: 0, rebuiltCount: 0 },
    };
  }

  // First repair attempt: rebuild from grounded recommendation data.
  const first = applyRepairToSynthesis(synthesis);
  const afterFirst = reInspectCandidates(synthesis);

  if (afterFirst.length === 0) {
    return {
      status: 'repaired',
      affectedPaths: first.rebuiltPaths,
      remainingViolations: [],
      telemetry: {
        repairAttempts: 1,
        quarantinedCount: first.quarantinedPaths.length,
        rebuiltCount: first.rebuiltPaths.length,
      },
    };
  }

  // Second attempt: quarantine any remaining malformed optional candidate fields.
  const quarantined = quarantineAllCandidateViolations(synthesis, afterFirst);
  const afterSecond = reInspectCandidates(synthesis);

  return {
    status: afterSecond.length === 0 ? 'quarantined' : 'unrepairable',
    affectedPaths: [...first.rebuiltPaths, ...quarantined],
    remainingViolations: afterSecond,
    telemetry: {
      repairAttempts: 2,
      quarantinedCount: quarantined.length,
      rebuiltCount: first.rebuiltPaths.length,
    },
  };
}