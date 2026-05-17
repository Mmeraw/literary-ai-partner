import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";
import { applyTruthfulLongformCriteriaFallback } from "@/lib/evaluation/pipeline/runPass3bLongform";

function makeCriterion(key: CriterionKey, score: number): SynthesizedCriterion {
  return {
    key,
    craft_score: score,
    editorial_score: score,
    final_score_0_10: score,
    score_delta: 0,
    final_rationale: `Final rationale for ${key}`,
    pressure_points: [`pressure ${key}`],
    decision_points: [`decision ${key}`],
    consequence_status: "landed",
    evidence: [{ snippet: `evidence ${key}` }],
    recommendations: [
      {
        priority: "medium",
        action: `Revise ${key}`,
        expected_impact: `Improve ${key}`,
        anchor_snippet: `anchor ${key}`,
        source_pass: 3,
        issue_family: "narrative_drive",
        strategic_lever: "causal_chain_integrity",
        revision_granularity: "scene",
        mechanism: "mechanism",
        specific_fix: "specific_fix",
        reader_effect: "reader_effect",
      },
    ],
    confidence_level: "moderate",
  };
}

describe("applyTruthfulLongformCriteriaFallback", () => {
  it("autofills missing criterion_analyses from Pass 3 criteria deterministically", () => {
    const criteria = [
      makeCriterion(CRITERIA_KEYS[0], 8),
      makeCriterion(CRITERIA_KEYS[1], 6),
    ];

    const raw = {
      criterion_analyses: [
        {
          key: CRITERIA_KEYS[0],
          score: 3,
          confidence: "Low",
          fit_evidence: ["already present"],
          gap_evidence: ["existing gap"],
          revision_queue: ["existing revision"],
        },
      ],
    } as Record<string, unknown>;

    const result = applyTruthfulLongformCriteriaFallback(raw, criteria);
    const analyses = result.patched.criterion_analyses as Array<Record<string, unknown>>;

    expect(analyses).toHaveLength(2);
    expect(analyses[0].key).toBe(CRITERIA_KEYS[0]);
    expect(analyses[0].score).toBe(8); // ledger-aligned with Pass 3
    expect(analyses[1].key).toBe(CRITERIA_KEYS[1]);
    expect(analyses[1].score).toBe(6);
    expect(Array.isArray(analyses[1].fit_evidence)).toBe(true);

    expect(result.report.autofilled_keys).toContain(CRITERIA_KEYS[1]);
  });

  it("repairs malformed existing entries without overwriting valid arrays", () => {
    const criteria = [makeCriterion(CRITERIA_KEYS[0], 7)];

    const raw = {
      criterion_analyses: [
        {
          key: CRITERIA_KEYS[0],
          score: 1,
          confidence: "unknown",
          fit_evidence: ["kept"],
          gap_evidence: [],
          revision_queue: [],
        },
      ],
    } as Record<string, unknown>;

    const result = applyTruthfulLongformCriteriaFallback(raw, criteria);
    const entry = (result.patched.criterion_analyses as Array<Record<string, unknown>>)[0];

    expect(entry.score).toBe(7);
    expect(entry.confidence).toBe("Moderate");
    expect(entry.fit_evidence).toEqual(["kept"]);
    expect((entry.gap_evidence as string[]).length).toBeGreaterThan(0);
    expect((entry.revision_queue as string[]).length).toBeGreaterThan(0);
    expect(result.report.repaired_keys).toContain(CRITERIA_KEYS[0]);
  });
});
