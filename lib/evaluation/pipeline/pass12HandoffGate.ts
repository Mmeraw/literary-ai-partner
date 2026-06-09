/**
 * S06b_HANDOFF_GATE — Pass 1/2 Handoff Gate
 *
 * Deterministic prose-quality gate that validates Pass 1 and Pass 2 output
 * BEFORE it feeds into Pass 3 synthesis. Prevents garbage from propagating
 * downstream.
 *
 * Checks:
 *   1. Sentence completeness (subject + verb + terminal punctuation)
 *   2. Scaffold residue ([PLACEHOLDER], TODO:, <insert>, etc.)
 *   3. Broken modal phrases ("which More…", "can long stretches…")
 *   4. Generic workshop language without evidence anchor
 *   5. Missing evidence anchor (recommendations must reference manuscript)
 *   6. Orphaned conjunctions (starts/ends with dangling and/but/because/however)
 *   7. Dangling references ("this section", "the above" without nearby evidence anchor)
 *
 * Governance: Runtime Doctrine #11, #13; Volume III §III.PL5
 * Canon ref: docs/SIPOC_EVALUATION_PROCESS.md (S06b_HANDOFF_GATE)
 */

import type { SinglePassOutput, AxisCriterionResult } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

export type HandoffViolation = {
  code: HandoffFailureCode;
  criterion_key: string;
  field: "rationale" | "recommendation_action" | "recommendation_expected_impact" | "evidence";
  detail: string;
  /** Index within recommendations array (if applicable) */
  rec_index?: number;
};

export type HandoffFailureCode =
  | "HANDOFF_SCAFFOLD_RESIDUE"
  | "HANDOFF_INCOMPLETE_SENTENCE"
  | "HANDOFF_BROKEN_MODAL"
  | "HANDOFF_GENERIC_LANGUAGE"
  | "HANDOFF_MISSING_EVIDENCE_ANCHOR"
  | "HANDOFF_ORPHANED_CONJUNCTION"
  | "HANDOFF_DANGLING_REFERENCE";

export type HandoffGateResult = {
  ok: boolean;
  violations: HandoffViolation[];
  /** Total violation count across both passes */
  total_violations: number;
  /** Pass-level breakdown */
  pass1_violations: number;
  pass2_violations: number;
  /** Per-check summary counts */
  check_summary: Record<HandoffFailureCode, number>;
};

// ── Detection Patterns ───────────────────────────────────────────────────────

/** Scaffold residue patterns — leftover template/placeholder text */
const SCAFFOLD_PATTERNS: RegExp[] = [
  /\[PLACEHOLDER\]/i,
  /\[INSERT\b/i,
  /\[TODO\b/i,
  /\bTODO:/,
  /<insert\b/i,
  /<fill\b/i,
  /\[EVIDENCE\]/i,
  /\[QUOTE\]/i,
  /\[EXAMPLE\]/i,
  /\{\{[^}]*\}\}/,           // Mustache-style template tokens
  /\[YOUR [A-Z]+\]/i,        // [YOUR TEXT HERE] style
  /\[ADD [A-Z]+\]/i,         // [ADD EVIDENCE] style
];

/**
 * Broken modal phrase patterns — garbled LLM output where modal verbs
 * connect to wrong syntactic elements.
 */
const BROKEN_MODAL_PATTERNS: RegExp[] = [
  /\bwhich\s+More\b/,                           // "which More…"
  /\bcan\s+long\s+stretches\b/i,                // "can long stretches…"
  /\b(?:would|could|should|can|may)\s+(?:section|chapter|paragraph)\s+(?:can|long|more)\b/i,
  /\b(?:would|could|should)\s+(?:would|could|should)\b/i,  // doubled modals
  /\b(?:to|of|for)\s+(?:to|of|for)\s+(?:to|of|for)\b/i,   // tripled prepositions
  /\b\w+—which\b/,                              // broken em-dash modal
  /\bcharacter_voice—which\b/i,                 // specific known garble
];

/**
 * Generic workshop language — vague advice that could apply to any manuscript
 * without referencing specific evidence. Only flagged if no evidence anchor
 * is present in the same recommendation.
 */
const GENERIC_WORKSHOP_PATTERNS: RegExp[] = [
  /\bconsider\s+(?:adding|including|exploring|developing)\s+more\s+(?:detail|depth|nuance)\b/i,
  /\btry\s+to\s+(?:show|develop|add)\s+more\b/i,
  /\bthis\s+(?:section|chapter|passage)\s+(?:could|would|should)\s+benefit\s+from\s+more\b/i,
  /\bcould\s+be\s+(?:stronger|better|improved|more\s+effective)\b/i,
  /\bneeds?\s+(?:more\s+)?work\b/i,
  /\bcould\s+use\s+(?:some|more)\s+(?:development|attention|polish)\b/i,
];

/**
 * Orphaned conjunction patterns — text that starts or ends with a
 * conjunction/transition word suggesting it was ripped from surrounding context.
 */
const ORPHANED_CONJUNCTION_PATTERNS: RegExp[] = [
  /^\s*(?:And|But|Because|Which|However|Therefore|Moreover|Furthermore|Although|While|So that|Yet|Nevertheless)\s/,
  /\s(?:and|but|because|which|however|therefore|moreover|so that|yet)\s*[,;]?\s*$/,
];

/**
 * Dangling reference patterns — vague demonstratives or placeholder nouns
 * that reference something not present in the same text.
 */
const DANGLING_REFERENCE_PATTERNS: RegExp[] = [
  /\b(?:this|these|those)\s+(?:section|chapter|passage|issue|problem|aspect|element|area|point)s?\b/i,
  /\bthe\s+(?:above|below|aforementioned|following|previous)\b/i,
  /\b(?:as\s+(?:mentioned|noted|discussed|stated)\s+(?:above|below|earlier|previously))\b/i,
  /\b(?:it|this)\s+(?:should|could|would|needs? to)\s+be\s+(?:noted|mentioned|addressed)\b/i,
];

// ── Core Detection Functions ─────────────────────────────────────────────────

/**
 * Checks that a prose string contains at least one complete sentence
 * (has terminal punctuation and at least 4 words before it).
 * Very short strings (< 15 chars) are exempt (e.g. "N/A", "See above").
 */
function hasCompleteSentence(text: string): boolean {
  if (!text || text.trim().length < 15) return true; // too short to judge
  const trimmed = text.trim();
  // Must end with terminal punctuation (complete thought)
  if (!/[.!?]["')\]]*$/.test(trimmed)) return false;
  // Must have at least one sentence with 4+ words (subject + verb minimum)
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.some((s) => s.trim().split(/\s+/).length >= 4);
}

function hasScaffoldResidue(text: string): RegExpMatchArray | null {
  for (const pattern of SCAFFOLD_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function hasBrokenModal(text: string): RegExpMatchArray | null {
  for (const pattern of BROKEN_MODAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function hasGenericWorkshopLanguage(text: string): RegExpMatchArray | null {
  for (const pattern of GENERIC_WORKSHOP_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function hasOrphanedConjunction(text: string): RegExpMatchArray | null {
  if (!text || text.trim().length < 20) return null; // too short to judge
  for (const pattern of ORPHANED_CONJUNCTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function hasDanglingReference(text: string): RegExpMatchArray | null {
  for (const pattern of DANGLING_REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

// ── Main Gate Function ───────────────────────────────────────────────────────

/**
 * Validates Pass 1 and Pass 2 output for prose quality before handoff to Pass 3.
 *
 * Returns `ok: true` if output is safe for synthesis.
 * Returns `ok: false` with violations if problems are found.
 *
 * The gate does NOT mutate the input — it only reports violations.
 * The pipeline orchestrator decides whether to retry or fail closed.
 */
export function runPass12HandoffGate(
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
): HandoffGateResult {
  const violations: HandoffViolation[] = [];

  // Validate both passes
  const pass1Violations = validatePassOutput(pass1);
  const pass2Violations = validatePassOutput(pass2);

  violations.push(...pass1Violations, ...pass2Violations);

  // Build check summary
  const checkSummary: Record<HandoffFailureCode, number> = {
    HANDOFF_SCAFFOLD_RESIDUE: 0,
    HANDOFF_INCOMPLETE_SENTENCE: 0,
    HANDOFF_BROKEN_MODAL: 0,
    HANDOFF_GENERIC_LANGUAGE: 0,
    HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
    HANDOFF_ORPHANED_CONJUNCTION: 0,
    HANDOFF_DANGLING_REFERENCE: 0,
  };
  for (const v of violations) {
    checkSummary[v.code]++;
  }

  return {
    ok: violations.length === 0,
    violations,
    total_violations: violations.length,
    pass1_violations: pass1Violations.length,
    pass2_violations: pass2Violations.length,
    check_summary: checkSummary,
  };
}

// ── Per-Pass Validation ──────────────────────────────────────────────────────

function validatePassOutput(passOutput: SinglePassOutput): HandoffViolation[] {
  const violations: HandoffViolation[] = [];

  for (const criterion of passOutput.criteria) {
    // 1. Validate rationale
    violations.push(...validateRationale(criterion));

    // 2. Validate recommendations
    violations.push(...validateRecommendations(criterion));

    // 3. Validate evidence presence
    violations.push(...validateEvidence(criterion));
  }

  return violations;
}

function validateRationale(criterion: AxisCriterionResult): HandoffViolation[] {
  const violations: HandoffViolation[] = [];
  const text = criterion.rationale;

  if (!text || text.trim().length === 0) return violations;

  // Check scaffold residue
  const scaffold = hasScaffoldResidue(text);
  if (scaffold) {
    violations.push({
      code: "HANDOFF_SCAFFOLD_RESIDUE",
      criterion_key: criterion.key,
      field: "rationale",
      detail: `Scaffold residue found: "${scaffold[0]}"`,
    });
  }

  // Check sentence completeness
  if (!hasCompleteSentence(text)) {
    violations.push({
      code: "HANDOFF_INCOMPLETE_SENTENCE",
      criterion_key: criterion.key,
      field: "rationale",
      detail: "Rationale lacks complete sentence (no terminal punctuation with subject+verb)",
    });
  }

  // Check broken modals
  const brokenModal = hasBrokenModal(text);
  if (brokenModal) {
    violations.push({
      code: "HANDOFF_BROKEN_MODAL",
      criterion_key: criterion.key,
      field: "rationale",
      detail: `Broken modal phrase: "${brokenModal[0]}"`,
    });
  }

  // Check orphaned conjunctions
  const orphaned = hasOrphanedConjunction(text);
  if (orphaned) {
    violations.push({
      code: "HANDOFF_ORPHANED_CONJUNCTION",
      criterion_key: criterion.key,
      field: "rationale",
      detail: `Orphaned conjunction: "${orphaned[0].trim()}"`,
    });
  }

  // Check dangling references (only if no anchor_snippet to justify the reference)
  const dangling = hasDanglingReference(text);
  if (dangling) {
    violations.push({
      code: "HANDOFF_DANGLING_REFERENCE",
      criterion_key: criterion.key,
      field: "rationale",
      detail: `Dangling reference without evidence anchor: "${dangling[0]}"`,
    });
  }

  return violations;
}

function validateRecommendations(criterion: AxisCriterionResult): HandoffViolation[] {
  const violations: HandoffViolation[] = [];

  for (let i = 0; i < criterion.recommendations.length; i++) {
    const rec = criterion.recommendations[i];

    // Check action field
    if (rec.action) {
      const actionScaffold = hasScaffoldResidue(rec.action);
      if (actionScaffold) {
        violations.push({
          code: "HANDOFF_SCAFFOLD_RESIDUE",
          criterion_key: criterion.key,
          field: "recommendation_action",
          detail: `Scaffold residue in action: "${actionScaffold[0]}"`,
          rec_index: i,
        });
      }

      const actionModal = hasBrokenModal(rec.action);
      if (actionModal) {
        violations.push({
          code: "HANDOFF_BROKEN_MODAL",
          criterion_key: criterion.key,
          field: "recommendation_action",
          detail: `Broken modal in action: "${actionModal[0]}"`,
          rec_index: i,
        });
      }

      if (!hasCompleteSentence(rec.action)) {
        violations.push({
          code: "HANDOFF_INCOMPLETE_SENTENCE",
          criterion_key: criterion.key,
          field: "recommendation_action",
          detail: "Recommendation action lacks complete sentence",
          rec_index: i,
        });
      }

      // Orphaned conjunctions in actions
      const actionOrphaned = hasOrphanedConjunction(rec.action);
      if (actionOrphaned) {
        violations.push({
          code: "HANDOFF_ORPHANED_CONJUNCTION",
          criterion_key: criterion.key,
          field: "recommendation_action",
          detail: `Orphaned conjunction in action: "${actionOrphaned[0].trim()}"`,
          rec_index: i,
        });
      }

      // Dangling references in actions (only if no anchor_snippet)
      if (!rec.anchor_snippet || rec.anchor_snippet.trim().length === 0) {
        const actionDangling = hasDanglingReference(rec.action);
        if (actionDangling) {
          violations.push({
            code: "HANDOFF_DANGLING_REFERENCE",
            criterion_key: criterion.key,
            field: "recommendation_action",
            detail: `Dangling reference without evidence: "${actionDangling[0]}"`,
            rec_index: i,
          });
        }
      }

      // Generic workshop language — only if no anchor_snippet present
      const generic = hasGenericWorkshopLanguage(rec.action);
      if (generic && (!rec.anchor_snippet || rec.anchor_snippet.trim().length === 0)) {
        violations.push({
          code: "HANDOFF_GENERIC_LANGUAGE",
          criterion_key: criterion.key,
          field: "recommendation_action",
          detail: `Generic workshop language without evidence anchor: "${generic[0]}"`,
          rec_index: i,
        });
      }
    }

    // Check expected_impact field
    if (rec.expected_impact) {
      const impactScaffold = hasScaffoldResidue(rec.expected_impact);
      if (impactScaffold) {
        violations.push({
          code: "HANDOFF_SCAFFOLD_RESIDUE",
          criterion_key: criterion.key,
          field: "recommendation_expected_impact",
          detail: `Scaffold residue in expected_impact: "${impactScaffold[0]}"`,
          rec_index: i,
        });
      }

      const impactModal = hasBrokenModal(rec.expected_impact);
      if (impactModal) {
        violations.push({
          code: "HANDOFF_BROKEN_MODAL",
          criterion_key: criterion.key,
          field: "recommendation_expected_impact",
          detail: `Broken modal in expected_impact: "${impactModal[0]}"`,
          rec_index: i,
        });
      }
    }

    // Missing evidence anchor
    if (!rec.anchor_snippet || rec.anchor_snippet.trim().length === 0) {
      violations.push({
        code: "HANDOFF_MISSING_EVIDENCE_ANCHOR",
        criterion_key: criterion.key,
        field: "recommendation_action",
        detail: "Recommendation has no anchor_snippet (missing manuscript evidence reference)",
        rec_index: i,
      });
    }
  }

  return violations;
}

function validateEvidence(criterion: AxisCriterionResult): HandoffViolation[] {
  const violations: HandoffViolation[] = [];

  // A criterion with recommendations should have at least one evidence anchor
  if (criterion.recommendations.length > 0 && criterion.evidence.length === 0) {
    violations.push({
      code: "HANDOFF_MISSING_EVIDENCE_ANCHOR",
      criterion_key: criterion.key,
      field: "evidence",
      detail: "Criterion has recommendations but no evidence anchors",
    });
  }

  return violations;
}

// ── Threshold Policy ─────────────────────────────────────────────────────────

/**
 * Determines whether the handoff gate result should block the pipeline.
 *
 * Policy:
 * - Any scaffold residue or broken modal → BLOCK (these are always bugs)
 * - 3+ generic language violations → BLOCK (pattern of ungrounded advice)
 * - 5+ missing evidence anchors → BLOCK (systematic evidence gap)
 * - Incomplete sentences: warn but don't block unless > 50% of criteria affected
 *
 * Returns true if the pipeline should proceed, false if it should fail.
 */
export function shouldPassHandoffGate(result: HandoffGateResult): boolean {
  if (result.ok) return true;

  const { check_summary } = result;

  // Hard blocks — any occurrence is unacceptable
  if (check_summary.HANDOFF_SCAFFOLD_RESIDUE > 0) return false;
  if (check_summary.HANDOFF_BROKEN_MODAL > 0) return false;

  // Soft blocks — threshold-based
  if (check_summary.HANDOFF_GENERIC_LANGUAGE >= 3) return false;
  if (check_summary.HANDOFF_MISSING_EVIDENCE_ANCHOR >= 5) return false;
  if (check_summary.HANDOFF_ORPHANED_CONJUNCTION >= 3) return false;
  if (check_summary.HANDOFF_DANGLING_REFERENCE >= 5) return false;

  // Incomplete sentences: block if > 50% of total criteria are affected
  // (26 criteria total across both passes = 13 × 2)
  if (check_summary.HANDOFF_INCOMPLETE_SENTENCE > 13) return false;

  // Below thresholds — log warnings but allow pass-through
  return true;
}
