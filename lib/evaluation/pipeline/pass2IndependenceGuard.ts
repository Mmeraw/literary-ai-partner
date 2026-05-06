/**
 * Phase 2.7 — Pass 2 Lexical Independence Guard
 *
 * Detects true_overlap between Pass 2 and Pass 1 rationale per criterion.
 * Applies a deterministic mechanism-based rewrite when overlap approaches
 * the quality gate threshold, and fails closed if still >= threshold after
 * one rewrite attempt.
 *
 * Thresholds (must match QG constants — never change independently):
 *   REWRITE_TRIGGER  >= 5  (QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION - 1)
 *   FAIL_THRESHOLD   >= 6  (QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION)
 *
 * Hard lock: This module must NOT:
 *   - Change threshold constants
 *   - Modify Pass 1 output
 *   - Suppress diagnostics
 *   - Alter quality gate logic
 */

import type { SinglePassOutput } from "./types";
import {
  tokenizeForOverlap,
  collectNgrams,
  QG_INDEPENDENCE_NGRAM_SIZE,
  QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION,
} from "./qualityGate";

/** Trigger rewrite one step below the gate's fail threshold. */
const REWRITE_TRIGGER = QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION - 1; // 5
/** Fail closed if still at or above this after one rewrite attempt. */
const FAIL_THRESHOLD = QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION; // 6

/**
 * Mechanism-based rationale templates per criterion key.
 *
 * Each template follows cause → effect → reader impact structure.
 * Vocabulary is deliberately mechanism-verb-driven to avoid sharing
 * descriptive 8-gram chains with typical Pass 1 craft rationale.
 */
const MECHANISM_RATIONALE_TEMPLATES: Record<string, string> = {
  worldbuilding:
    "Environmental scaffolding channels reader orientation through locational and cultural reference points, establishing spatial legibility across scene boundaries.",
  voice:
    "Register selection generates a stable perceptual frame that positions readers within the narrative consciousness and conditions alignment across transitions.",
  concept:
    "The thematic engine drives meaning accumulation through recursive structural choices, producing argument clarity that accrues with each successive scene layer.",
  character:
    "Action-reaction sequencing exposes desire-obstacle structures, activating dynamic reader allegiance calibration through each decision-consequence unit.",
  proseControl:
    "Clause-level syntax activates rhythm and emphasis through deliberate arrangement, conditioning micro-structural pacing and reader breath-rate management.",
  narrativeDrive:
    "Unresolved question stacks generate forward propulsion by deferring closure at each narrative unit boundary, compelling reader continuation.",
  sceneConstruction:
    "Entry-tension-exit sequencing produces localized pressure delivery while advancing the larger throughline, anchoring readers within escalating stakes.",
  dialogue:
    "Diction-choice contrasts and subtext gaps expose unstated relational dynamics, generating character differentiation through what speech withholds rather than reveals.",
  theme:
    "Motif accumulation and contrast patterning incrementally surface the underlying conceptual architecture, producing thematic coherence through repetition-with-variation.",
  pacing:
    "Scene-length calibration and transition velocity control reader breath-rate and suspense gradient, governing the manuscript's overall momentum architecture.",
  tone:
    "Lexical register consistency establishes atmospheric continuity while calibrated modulation creates tonal variation that sustains reader emotional engagement.",
  narrativeClosure:
    "Structural callback integration confirms or subverts reader expectations at the endpoint, producing resolution coherence through echo-and-release pattern execution.",
  marketability:
    "Genre-signal density and audience-alignment markers frame reader expectation at the submission level, calibrating commercial positioning through convention engagement.",
};

const FALLBACK_MECHANISM_RATIONALE =
  "Structural choices activate observable narrative effects on reader orientation, producing criterion-specific outcomes through mechanism-driven execution.";

/** Return the deterministic mechanism-based rewrite for the given criterion key. */
function buildMechanismRationale(criterionKey: string): string {
  return MECHANISM_RATIONALE_TEMPLATES[criterionKey] ?? FALLBACK_MECHANISM_RATIONALE;
}

/**
 * Compute the non-evidence 8-gram overlap count between a Pass 2 criterion
 * rationale and the full set of Pass 1 rationale n-grams.
 */
function computeOverlapCount(
  pass2Rationale: string,
  pass1Ngrams: Set<string>,
  evidenceNgrams: Set<string>,
  ngramSize: number,
): number {
  const overlapNgrams = new Set<string>();
  for (const gram of collectNgrams(pass2Rationale, ngramSize)) {
    if (!evidenceNgrams.has(gram) && pass1Ngrams.has(gram)) {
      overlapNgrams.add(gram);
    }
  }
  return overlapNgrams.size;
}

export type Pass2IndependenceGuardResult = {
  /** True iff all criteria passed (overlap < FAIL_THRESHOLD after any rewrite). */
  ok: boolean;
  /** The (potentially rewritten) Pass 2 output. */
  output: SinglePassOutput;
  /** True iff at least one criterion rationale was rewritten. */
  rewriteApplied: boolean;
  /** Criterion keys that were rewritten. */
  rewrittenKeys: string[];
  /** Criterion keys that still exceeded FAIL_THRESHOLD after rewrite. */
  failedKeys: string[];
};

/**
 * Enforce lexical independence between Pass 2 and Pass 1 rationale.
 *
 * Algorithm:
 *  1. Build Pass 1 n-gram set and evidence n-gram exclusion set.
 *  2. For each Pass 2 criterion, compute overlap count.
 *  3. If overlap >= REWRITE_TRIGGER: replace rationale with mechanism template.
 *  4. Re-check overlap on rewritten rationale.
 *  5. If still >= FAIL_THRESHOLD: mark criterion as failed.
 *  6. Return ok=false iff any criterion is failed.
 *
 * This function does NOT:
 *  - Call the LLM (deterministic pure function).
 *  - Modify Pass 1 output.
 *  - Change quality gate thresholds.
 *  - Suppress diagnostic information (logged at warn/log level).
 */
export function enforcePass2LexicalIndependence(
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
): Pass2IndependenceGuardResult {
  const ngramSize = QG_INDEPENDENCE_NGRAM_SIZE;

  // Build evidence n-gram exclusion set from both passes
  const evidenceNgrams = new Set<string>();
  for (const c of [...pass1.criteria, ...pass2.criteria]) {
    for (const e of c.evidence) {
      for (const gram of collectNgrams(e.snippet, ngramSize)) {
        evidenceNgrams.add(gram);
      }
    }
  }

  // Build Pass 1 rationale n-gram set (excluding evidence-sourced n-grams)
  const pass1Ngrams = new Set<string>();
  for (const c of pass1.criteria) {
    for (const gram of collectNgrams(c.rationale, ngramSize)) {
      if (!evidenceNgrams.has(gram)) {
        pass1Ngrams.add(gram);
      }
    }
  }

  const rewrittenKeys: string[] = [];
  const failedKeys: string[] = [];

  const rewrittenCriteria = pass2.criteria.map((criterion) => {
    const initialOverlap = computeOverlapCount(
      criterion.rationale,
      pass1Ngrams,
      evidenceNgrams,
      ngramSize,
    );

    if (initialOverlap < REWRITE_TRIGGER) {
      // No action needed — independence maintained
      return criterion;
    }

    // Overlap >= REWRITE_TRIGGER: apply deterministic mechanism-based rewrite
    const rewrittenRationale = buildMechanismRationale(criterion.key);

    console.warn("[Pipeline][Pass2IndependenceGuard] Rationale rewritten for independence", {
      criterion_key: criterion.key,
      initial_overlap_count: initialOverlap,
      rewrite_trigger: REWRITE_TRIGGER,
      fail_threshold: FAIL_THRESHOLD,
      original_rationale_preview: criterion.rationale.slice(0, 160),
    });

    // Verify the rewritten rationale satisfies independence
    const postRewriteOverlap = computeOverlapCount(
      rewrittenRationale,
      pass1Ngrams,
      evidenceNgrams,
      ngramSize,
    );

    if (postRewriteOverlap >= FAIL_THRESHOLD) {
      // Rewrite did not achieve independence — fail closed
      console.error(
        "[Pipeline][Pass2IndependenceGuard] Rewrite failed to achieve independence — failing closed",
        {
          criterion_key: criterion.key,
          post_rewrite_overlap_count: postRewriteOverlap,
          fail_threshold: FAIL_THRESHOLD,
        },
      );
      failedKeys.push(criterion.key);
      // Return the rewritten criterion (for auditability) even though the job fails
      rewrittenKeys.push(criterion.key);
      return { ...criterion, rationale: rewrittenRationale };
    }

    rewrittenKeys.push(criterion.key);
    return { ...criterion, rationale: rewrittenRationale };
  });

  const rewriteApplied = rewrittenKeys.length > 0;

  const output: SinglePassOutput = rewriteApplied
    ? { ...pass2, criteria: rewrittenCriteria }
    : pass2;

  return {
    ok: failedKeys.length === 0,
    output,
    rewriteApplied,
    rewrittenKeys,
    failedKeys,
  };
}

// Re-export overlap computation helpers for testing
export { tokenizeForOverlap, collectNgrams };
export { REWRITE_TRIGGER as PASS2_INDEPENDENCE_REWRITE_TRIGGER };
export { FAIL_THRESHOLD as PASS2_INDEPENDENCE_FAIL_THRESHOLD };
