/**
 * Tests for Pass 3 Evidence Fidelity Check (U2-004 G2)
 *
 * Validates that PASS3_EVIDENCE_DEPTH_REGRESSION fires correctly when
 * Pass 3 evidence count is below Pass 2 evidence count per criterion,
 * and that the check is advisory-only (fidelity_intact reflects truth
 * without blocking or modifying pipeline output).
 */

import {
  checkPass3EvidenceFidelity,
  type Pass3EvidenceFidelityResult,
} from "@/lib/evaluation/pipeline/pass3EvidenceFidelityCheck";
import type { SinglePassOutput, SynthesisOutput } from "@/lib/evaluation/pipeline/types";

// ── Minimal fixture helpers ──────────────────────────────────────────────────

function makeAnchor(snippet: string) {
  return { snippet };
}

function makePass2Criterion(key: string, evidenceCount: number) {
  return {
    key,
    score_0_10: 6,
    rationale: "pass2 rationale",
    evidence: Array.from({ length: evidenceCount }, (_, i) =>
      makeAnchor(`pass2 evidence snippet ${i + 1} for ${key}`),
    ),
    recommendations: [],
  };
}

function makePass3Criterion(key: string, evidenceCount: number) {
  return {
    key,
    craft_score: 6,
    editorial_score: 6,
    final_score_0_10: 6,
    score_delta: 0,
    final_rationale: "pass3 rationale",
    pressure_points: [],
    decision_points: [],
    consequence_status: "landed" as const,
    evidence: Array.from({ length: evidenceCount }, (_, i) =>
      makeAnchor(`pass3 evidence snippet ${i + 1} for ${key}`),
    ),
    recommendations: [],
  };
}

function makePass2(criteriaEvidenceCounts: Record<string, number>): SinglePassOutput {
  return {
    criteria: Object.entries(criteriaEvidenceCounts).map(([key, count]) =>
      makePass2Criterion(key, count),
    ),
    model: "gpt-4.1",
    prompt_version: "pass2-v1",
    overall: {
      overall_score_0_100: 60,
      verdict: "revise" as const,
      one_paragraph_summary: "summary",
      top_3_strengths: [],
      top_3_risks: [],
      submission_readiness: "nearly_ready" as const,
    },
  } as unknown as SinglePassOutput;
}

function makePass3(criteriaEvidenceCounts: Record<string, number>): SynthesisOutput {
  return {
    criteria: Object.entries(criteriaEvidenceCounts).map(([key, count]) =>
      makePass3Criterion(key, count),
    ),
    overall: {
      overall_score_0_100: 60,
      verdict: "revise" as const,
      one_paragraph_summary: "summary",
      top_3_strengths: [],
      top_3_risks: [],
      submission_readiness: "nearly_ready" as const,
    },
    metadata: {
      pass1_model: "gpt-4.1",
      pass2_model: "gpt-4.1",
      pass3_model: "gpt-4.1",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  } as unknown as SynthesisOutput;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("checkPass3EvidenceFidelity", () => {
  it("returns fidelity_intact=true when Pass 3 evidence >= Pass 2 evidence for all criteria", () => {
    const pass2 = makePass2({ pacing: 2, characterization: 3, proseControl: 1 });
    const pass3 = makePass3({ pacing: 2, characterization: 3, proseControl: 2 });

    const result: Pass3EvidenceFidelityResult = checkPass3EvidenceFidelity(pass2, pass3);

    expect(result.fidelity_intact).toBe(true);
    expect(result.regressions).toHaveLength(0);
    expect(result.regression_count).toBe(0);
    expect(result.stable_count).toBe(3);
    expect(result.total_evidence_delta).toBe(0);
  });

  it("fires PASS3_EVIDENCE_DEPTH_REGRESSION when Pass 3 drops evidence below Pass 2", () => {
    const pass2 = makePass2({ pacing: 3, characterization: 2 });
    const pass3 = makePass3({ pacing: 1, characterization: 2 });

    const result = checkPass3EvidenceFidelity(pass2, pass3);

    expect(result.fidelity_intact).toBe(false);
    expect(result.regression_count).toBe(1);
    expect(result.stable_count).toBe(1);
    expect(result.regressions[0].criterion_key).toBe("pacing");
    expect(result.regressions[0].pass2_evidence_count).toBe(3);
    expect(result.regressions[0].pass3_evidence_count).toBe(1);
    expect(result.regressions[0].delta).toBe(2);
    expect(result.total_evidence_delta).toBe(2);
  });

  it("fires on multiple regressed criteria and accumulates total_evidence_delta", () => {
    const pass2 = makePass2({ pacing: 3, characterization: 4, proseControl: 2 });
    const pass3 = makePass3({ pacing: 1, characterization: 2, proseControl: 2 });

    const result = checkPass3EvidenceFidelity(pass2, pass3);

    expect(result.fidelity_intact).toBe(false);
    expect(result.regression_count).toBe(2);
    expect(result.stable_count).toBe(1);
    expect(result.total_evidence_delta).toBe(4); // (3-1) + (4-2)

    const keys = result.regressions.map((r) => r.criterion_key);
    expect(keys).toContain("pacing");
    expect(keys).toContain("characterization");
  });

  it("treats Pass 3 evidence count of zero as regression when Pass 2 had evidence", () => {
    const pass2 = makePass2({ dialogue: 2 });
    const pass3 = makePass3({ dialogue: 0 });

    const result = checkPass3EvidenceFidelity(pass2, pass3);

    expect(result.fidelity_intact).toBe(false);
    expect(result.regressions[0].pass3_evidence_count).toBe(0);
    expect(result.regressions[0].delta).toBe(2);
  });

  it("does not regress when both Pass 2 and Pass 3 have zero evidence for a criterion", () => {
    const pass2 = makePass2({ theme: 0 });
    const pass3 = makePass3({ theme: 0 });

    const result = checkPass3EvidenceFidelity(pass2, pass3);

    expect(result.fidelity_intact).toBe(true);
    expect(result.regression_count).toBe(0);
  });

  it("handles criteria present in Pass 3 but absent from Pass 2 (no regression)", () => {
    // Pass 2 missing a criterion — treat as 0 evidence from Pass 2
    const pass2 = makePass2({ pacing: 2 }); // no 'theme'
    const pass3 = makePass3({ pacing: 2, theme: 1 });

    const result = checkPass3EvidenceFidelity(pass2, pass3);

    // theme: pass2 count = 0 (missing key), pass3 count = 1 → not a regression
    expect(result.fidelity_intact).toBe(true);
    expect(result.regression_count).toBe(0);
  });
});
