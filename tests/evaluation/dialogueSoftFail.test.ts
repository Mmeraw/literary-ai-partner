import { describe, it, expect } from "@jest/globals";
import { normalizeCriterion, isCriterionComplete } from "@/lib/evaluation/signal/criterionObservability";

function makeScorable(key: any, evidenceCount: number) {
  return normalizeCriterion({
    key,
    score_0_10: 5,
    rationale: "test rationale",
    evidence: Array.from({ length: evidenceCount }).map((_, i) => ({ snippet: `e${i}` })),
  });
}

describe("dialogue soft-fail completeness", () => {
  it("dialogue 1 anchor does not block completeness", () => {
    const c = makeScorable("dialogue", 1);
    expect(isCriterionComplete(c)).toBe(true);
  });

  it("voice 0 anchors still blocks", () => {
    const c = makeScorable("voice", 0);
    expect(isCriterionComplete(c)).toBe(false);
  });

  it("dialogue passes when >=2 anchors", () => {
    const c = makeScorable("dialogue", 2);
    expect(isCriterionComplete(c)).toBe(true);
  });
});
