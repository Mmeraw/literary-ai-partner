/**
 * Pass 3 Evidence Fidelity Check (U2-004 G2)
 *
 * Advisory-only diagnostic — emits PASS3_EVIDENCE_DEPTH_REGRESSION when
 * Pass 3 synthesized evidence count falls below Pass 2 evidence count for
 * a criterion. Does NOT fail jobs. Does NOT modify any output.
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
import type { SinglePassOutput, SynthesisOutput } from "./types";

export type EvidenceDepthRegressionEntry = {
  criterion_key: CriterionKey;
  pass2_evidence_count: number;
  pass3_evidence_count: number;
  delta: number;
};

export type Pass3EvidenceFidelityResult = {
  /** True when every criterion's Pass 3 evidence count >= Pass 2 evidence count */
  fidelity_intact: boolean;
  regressions: EvidenceDepthRegressionEntry[];
  /** Count of criteria where Pass 3 evidence equals or exceeds Pass 2 */
  stable_count: number;
  /** Count of criteria where Pass 3 evidence is below Pass 2 */
  regression_count: number;
  /** Sum of lost evidence anchors across all regressed criteria */
  total_evidence_delta: number;
};

/**
 * Compare Pass 2 evidence depth against Pass 3 evidence depth per criterion.
 *
 * Returns an advisory result. Callers must not use this to block pipeline
 * execution — emit as a warning and let monitoring surface recurring patterns.
 */
export function checkPass3EvidenceFidelity(
  pass2: SinglePassOutput,
  pass3: SynthesisOutput,
): Pass3EvidenceFidelityResult {
  const pass2ByKey = new Map(
    pass2.criteria.map((c) => [c.key as CriterionKey, c.evidence?.length ?? 0]),
  );

  const regressions: EvidenceDepthRegressionEntry[] = [];
  let stableCount = 0;

  for (const p3Criterion of pass3.criteria) {
    const key = p3Criterion.key as CriterionKey;
    const pass2Count = pass2ByKey.get(key) ?? 0;
    const pass3Count = p3Criterion.evidence?.length ?? 0;

    if (pass3Count < pass2Count) {
      regressions.push({
        criterion_key: key,
        pass2_evidence_count: pass2Count,
        pass3_evidence_count: pass3Count,
        delta: pass2Count - pass3Count,
      });
    } else {
      stableCount++;
    }
  }

  const totalEvidenceDelta = regressions.reduce((sum, r) => sum + r.delta, 0);

  return {
    fidelity_intact: regressions.length === 0,
    regressions,
    stable_count: stableCount,
    regression_count: regressions.length,
    total_evidence_delta: totalEvidenceDelta,
  };
}
