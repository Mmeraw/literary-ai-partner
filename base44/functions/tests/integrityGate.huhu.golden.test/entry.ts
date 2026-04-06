import { runIntegrityGateV1, CriteriaPlanItem, LlmResult } from "./integrityGate.v1";

function makeMicroCriteriaPlan(): CriteriaPlanItem[] {
  // Example: 6 scored, 7 not assessed (total 13)
  // Adjust to your actual S1 micro canon list.
  const scored = [
    "The Hook",
    "Voice & Narrative Style",
    "Characters & Introductions",
    "Conflict & Tension",
    "Thematic Resonance",
    "Line-Level Polish",
  ].map((key) => ({ key, status: "SCORED" as const }));

  const na = [
    { key: "Dialogue & Subtext", reason: "Not assessed for micro samples without dialogue." },
    { key: "Pacing & Structural Flow", reason: "Not assessed for S1 micro policy." },
    { key: "Worldbuilding & Immersion", reason: "Not assessed for S1 micro policy." },
    { key: "Stakes & Emotional Investment", reason: "Not assessed for S1 micro policy." },
    { key: "Marketability & Genre Fit", reason: "Not assessed for S1 micro policy." },
    { key: "Would Agent Keep Reading", reason: "Not assessed for S1 micro policy." },
    { key: "Ending / Closure", reason: "Not assessed for S1 micro policy." },
  ].map((x) => ({ ...x, status: "NOT_ASSESSED" as const }));

  return [...scored, ...na];
}

function makeHuhuLlmResult(scoredKeys: string[]): LlmResult {
  return {
    criteria: [
      ...scoredKeys.map((key) => ({ key, score: 8, strengths: ["ok"], weaknesses: [] })),
      // Ensure NA criteria do NOT carry numeric scores
      { key: "Dialogue & Subtext", score: null, notes: "Not assessed." },
    ],
    // optional: craftScore can be present or omitted; if present, it must not imply 13 denominator
    craftScore: 8,
  };
}

describe("Golden: Huhu micro integrity", () => {
  it("passes: scored_count equals expected_scored and NA list is present", () => {
    const plan = makeMicroCriteriaPlan();
    const scoredKeys = plan.filter(p => p.status === "SCORED").map(p => p.key);

    const llm = makeHuhuLlmResult(scoredKeys);

    const gate = runIntegrityGateV1({
      criteriaPlan: plan,
      llmResult: llm,
      meta: { workTypeUi: "Flash Fiction / Micro", sampleClass: "S1", requestId: "HUHU_GOLDEN" },
    });

    expect(gate.pass).toBe(true);
    expect(gate.expected_scored).toBe(scoredKeys.length);
    expect(gate.scored_count).toBe(scoredKeys.length);
    expect(gate.na_criteria.length).toBe(plan.filter(p => p.status === "NOT_ASSESSED").length);
    expect(gate.craft_score_denominator).toBe(scoredKeys.length);
  });

  it("fails closed if any NOT_ASSESSED criterion has a numeric score", () => {
    const plan = makeMicroCriteriaPlan();
    const scoredKeys = plan.filter(p => p.status === "SCORED").map(p => p.key);

    const llm: LlmResult = {
      criteria: [
        ...scoredKeys.map((key) => ({ key, score: 8 })),
        { key: "Dialogue & Subtext", score: 7 }, // contamination
      ],
      craftScore: 8,
    };

    const gate = runIntegrityGateV1({ criteriaPlan: plan, llmResult: llm });

    expect(gate.pass).toBe(false);
    expect(gate.failures.some(f => f.code === "NA_CRITERIA_CONTAMINATION")).toBe(true);
  });

  it("fails closed if scored_count mismatches expected_scored", () => {
    const plan = makeMicroCriteriaPlan();
    const scoredKeys = plan.filter(p => p.status === "SCORED").map(p => p.key);

    const llm: LlmResult = {
      criteria: scoredKeys.slice(0, scoredKeys.length - 1).map((key) => ({ key, score: 8 })), // one missing
      craftScore: 8,
    };

    const gate = runIntegrityGateV1({ criteriaPlan: plan, llmResult: llm });

    expect(gate.pass).toBe(false);
    expect(gate.failures.some(f => f.code === "SCORED_COUNT_MISMATCH")).toBe(true);
    expect(gate.failures.some(f => f.code === "MISSING_REQUIRED_SCORES")).toBe(true);
  });
});