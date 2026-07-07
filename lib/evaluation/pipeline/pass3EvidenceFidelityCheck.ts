/**
 * Pass 3 Evidence Fidelity Check (U2-004 G2)
 *
 * Advisory-only diagnostic — records PASS3_EVIDENCE_DEPTH_REGRESSION when
 * Pass 3 synthesized evidence is weaker than Pass 2 evidence for a criterion.
 * Does NOT fail jobs. Does NOT modify any output.
 *
 * Insertion point: post-Pass-3 synthesis, pre-Quality Gate.
 *
 * Design contract:
 *   - No changes to buildComparisonPacket
 *   - No changes to ComparisonPacketCriterion
 *   - No changes to the Pass 3 LLM prompt
 *   - No independence boundary crossed
 *   - Advisory data only; feeds monitoring, not enforcement
 *
 * Metric design (extended per Mike Meraw review 2026-07-07):
 *   Count alone is a weak proxy. Pass 3 may produce fewer-but-stronger
 *   evidence snippets, or more-but-vaguer ones. This check therefore
 *   tracks:
 *     1. Evidence count delta (baseline signal)
 *     2. Concept coverage: Pass 2 semantic tokens not covered by Pass 3
 *        ("missing concepts") and Pass 3 tokens with no Pass 2 anchor
 *        ("new unsupported concepts") — both via deterministic n-gram
 *        overlap, matching the pass2IndependenceGuard pattern.
 *     3. Grounded snippet counts (scaffolded — populated after G4 lands;
 *        null until evidenceGroundingGate extends to criteria evidence)
 *
 * Rationale (U2-004 G1 Verdict C — 2026-07-07):
 *   Pass 2 evidence[] has never been included in the comparison packet sent
 *   to Pass 3. Whether this was intentional independence design or an
 *   omission is undocumented. This check collects live data so the decision
 *   can be made from evidence rather than inference. If regression fires
 *   consistently, revisit whether pass2_evidence should be added to the
 *   packet. If it does not fire, fidelity is intact with no prompt change
 *   required.
 */

import type { CriterionKey } from "@/schemas/criteria-keys";
import type { SinglePassOutput, SynthesisOutput, EvidenceAnchor } from "./types";
import type { CriteriaEvidenceGroundingReport } from "./evidenceGroundingGate";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * N-gram size for concept overlap detection.
 * Matches the independence guard's n-gram size for consistency.
 */
const CONCEPT_NGRAM_SIZE = 4;

/**
 * Minimum token length to include in concept n-gram vocabulary.
 * Filters stop words and function words.
 */
const MIN_TOKEN_LENGTH = 4;

// ── N-gram helpers ───────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

function collectConceptNgrams(text: string, n: number): Set<string> {
  const tokens = tokenize(text);
  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.add(tokens.slice(i, i + n).join(" "));
  }
  return ngrams;
}

function snippetsToText(evidence: EvidenceAnchor[]): string {
  return evidence
    .map((e) => String(e.snippet ?? "").trim())
    .filter((s) => s.length > 0)
    .join(" ");
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ConceptCoverageResult = {
  /**
   * Pass 2 concept n-grams that do not appear anywhere in Pass 3 evidence.
   * These represent semantic content from Pass 2 that was silently dropped.
   * A non-empty set here is a genuine provenance break — Pass 3 may have
   * synthesized evidence that ignores what Pass 2 found.
   */
  missing_pass2_concepts: string[];

  /**
   * Pass 3 concept n-grams that have no overlap with any Pass 2 evidence.
   * These represent new content Pass 3 introduced without a Pass 2 anchor.
   * May be legitimate synthesis — or may be fabrication. A high count
   * combined with low pass3_grounded_count (once G4 lands) indicates risk.
   */
  new_unsupported_concepts: string[];

  /**
   * Total Pass 2 concept n-gram vocabulary size (denominator for missing %).
   */
  pass2_concept_ngram_count: number;

  /**
   * Total Pass 3 concept n-gram vocabulary size (denominator for new %).
   */
  pass3_concept_ngram_count: number;
};

export type EvidenceFidelityEntry = {
  criterion_key: CriterionKey;

  // ── Count dimension ──────────────────────────────────────────────────────
  pass2_evidence_count: number;
  pass3_evidence_count: number;
  /** Positive = Pass 3 dropped anchors; negative = Pass 3 added anchors */
  count_delta: number;

  // ── Concept dimension ────────────────────────────────────────────────────
  concept_coverage: ConceptCoverageResult;

  // ── Grounding dimension (scaffolded — populated after G4 lands) ──────────
  /**
   * Number of Pass 2 evidence snippets grounded in the manuscript.
   * null until G4 (criteria evidence grounding gate) is implemented.
   */
  pass2_grounded_count: number | null;
  /**
   * Number of Pass 3 evidence snippets grounded in the manuscript.
   * null until G4 (criteria evidence grounding gate) is implemented.
   */
  pass3_grounded_count: number | null;
};

export type Pass3EvidenceFidelityResult = {
  /**
   * True when every criterion has no missing Pass 2 concepts AND
   * count_delta <= 0 (Pass 3 evidence >= Pass 2 evidence).
   * False as soon as any criterion shows either signal.
   */
  fidelity_intact: boolean;

  /** Per-criterion fidelity entries (all criteria, not just regressions). */
  criteria: EvidenceFidelityEntry[];

  /** Criteria where count_delta > 0 (Pass 3 count below Pass 2). */
  count_regression_criteria: CriterionKey[];

  /** Criteria with any missing Pass 2 concepts. */
  concept_regression_criteria: CriterionKey[];

  /** Sum of positive count_delta values across all criteria. */
  total_count_delta: number;

  /** Total missing Pass 2 concept n-grams across all criteria. */
  total_missing_concepts: number;

  /** Total new unsupported Pass 3 concept n-grams across all criteria. */
  total_new_concepts: number;
};

// ── Core check ───────────────────────────────────────────────────────────────

function analyzeConceptCoverage(
  pass2Evidence: EvidenceAnchor[],
  pass3Evidence: EvidenceAnchor[],
): ConceptCoverageResult {
  const pass2Text = snippetsToText(pass2Evidence);
  const pass3Text = snippetsToText(pass3Evidence);

  const pass2Ngrams = collectConceptNgrams(pass2Text, CONCEPT_NGRAM_SIZE);
  const pass3Ngrams = collectConceptNgrams(pass3Text, CONCEPT_NGRAM_SIZE);

  // Pass 2 n-grams absent from Pass 3 — lost concepts
  const missingPass2Concepts = [...pass2Ngrams].filter((ng) => !pass3Ngrams.has(ng));

  // Pass 3 n-grams absent from Pass 2 — new unsupported concepts
  const newUnsupportedConcepts = [...pass3Ngrams].filter((ng) => !pass2Ngrams.has(ng));

  return {
    missing_pass2_concepts: missingPass2Concepts,
    new_unsupported_concepts: newUnsupportedConcepts,
    pass2_concept_ngram_count: pass2Ngrams.size,
    pass3_concept_ngram_count: pass3Ngrams.size,
  };
}

/**
 * Compare Pass 2 evidence fidelity against Pass 3 synthesis per criterion.
 *
 * Returns an advisory result. Callers MUST NOT use this to block pipeline
 * execution. Emit as console.warn and let monitoring surface recurring patterns.
 *
 * @param pass2 - Pass 2 output
 * @param pass3 - Pass 3 synthesis output
 * @param pass3CriteriaGrounding - Optional G4 grounding report for Pass 3
 *   criteria evidence. When provided, populates pass3_grounded_count.
 *   pass2_grounded_count remains null (Pass 2 criteria evidence is not
 *   validated against manuscript — it is not in the synthesis output).
 */
export function checkPass3EvidenceFidelity(
  pass2: SinglePassOutput,
  pass3: SynthesisOutput,
  pass3CriteriaGrounding?: CriteriaEvidenceGroundingReport,
): Pass3EvidenceFidelityResult {
  const pass2ByKey = new Map(
    pass2.criteria.map((c) => [c.key as CriterionKey, c]),
  );

  // Build per-criterion grounded snippet count from G4 report (when available).
  // Counts are keyed by criterion_key from the ungrounded list + total.
  // We derive grounded_count per criterion by subtracting ungrounded from total.
  const pass3GroundedByKey = new Map<CriterionKey, number>();
  const pass3TotalByKey = new Map<CriterionKey, number>();
  if (pass3CriteriaGrounding && !pass3CriteriaGrounding.grounding_skipped) {
    // Tally total snippets per criterion from pass3 output (not from grounding report)
    for (const c of pass3.criteria) {
      pass3TotalByKey.set(c.key as CriterionKey, c.evidence?.length ?? 0);
    }
    // Tally ungrounded per criterion
    const ungroundedByKey = new Map<CriterionKey, number>();
    for (const u of pass3CriteriaGrounding.ungrounded) {
      const key = u.criterion_key as CriterionKey;
      ungroundedByKey.set(key, (ungroundedByKey.get(key) ?? 0) + 1);
    }
    // grounded = total - ungrounded
    for (const [key, total] of pass3TotalByKey.entries()) {
      const ungrounded = ungroundedByKey.get(key) ?? 0;
      pass3GroundedByKey.set(key, Math.max(0, total - ungrounded));
    }
  }

  const criteria: EvidenceFidelityEntry[] = [];
  const countRegressionCriteria: CriterionKey[] = [];
  const conceptRegressionCriteria: CriterionKey[] = [];
  let totalCountDelta = 0;
  let totalMissingConcepts = 0;
  let totalNewConcepts = 0;

  for (const p3Criterion of pass3.criteria) {
    const key = p3Criterion.key as CriterionKey;
    const p2Criterion = pass2ByKey.get(key);
    const pass2Evidence: EvidenceAnchor[] = p2Criterion?.evidence ?? [];
    const pass3Evidence: EvidenceAnchor[] = p3Criterion.evidence ?? [];

    const pass2Count = pass2Evidence.length;
    const pass3Count = pass3Evidence.length;
    const countDelta = pass2Count - pass3Count; // positive = regression

    const conceptCoverage = analyzeConceptCoverage(pass2Evidence, pass3Evidence);

    // pass3_grounded_count: populated when G4 grounding report is provided.
    // pass2_grounded_count: always null — Pass 2 criteria evidence is not in
    // the synthesis output and is not validated against the manuscript.
    const pass3GroundedCount = pass3GroundedByKey.size > 0
      ? (pass3GroundedByKey.get(key) ?? null)
      : null;

    const entry: EvidenceFidelityEntry = {
      criterion_key: key,
      pass2_evidence_count: pass2Count,
      pass3_evidence_count: pass3Count,
      count_delta: countDelta,
      concept_coverage: conceptCoverage,
      pass2_grounded_count: null,
      pass3_grounded_count: pass3GroundedCount,
    };

    criteria.push(entry);

    if (countDelta > 0) {
      countRegressionCriteria.push(key);
      totalCountDelta += countDelta;
    }

    if (conceptCoverage.missing_pass2_concepts.length > 0) {
      conceptRegressionCriteria.push(key);
      totalMissingConcepts += conceptCoverage.missing_pass2_concepts.length;
    }

    totalNewConcepts += conceptCoverage.new_unsupported_concepts.length;
  }

  const fidelityIntact =
    countRegressionCriteria.length === 0 && conceptRegressionCriteria.length === 0;

  return {
    fidelity_intact: fidelityIntact,
    criteria,
    count_regression_criteria: countRegressionCriteria,
    concept_regression_criteria: conceptRegressionCriteria,
    total_count_delta: totalCountDelta,
    total_missing_concepts: totalMissingConcepts,
    total_new_concepts: totalNewConcepts,
  };
}
