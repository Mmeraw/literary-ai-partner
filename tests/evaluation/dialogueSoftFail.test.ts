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

describe("borderline anchor soft-fail completeness (all criteria)", () => {
  it("dialogue 1 anchor does not block completeness", () => {
    const c = makeScorable("dialogue", 1);
    expect(isCriterionComplete(c)).toBe(true);
  });

  it("sceneConstruction 1 anchor does not block completeness", () => {
    const c = makeScorable("sceneConstruction", 1);
    expect(isCriterionComplete(c)).toBe(true);
  });

  it("voice 1 anchor does not block completeness", () => {
    const c = makeScorable("voice", 1);
    expect(isCriterionComplete(c)).toBe(true);
  });

  it("voice 0 anchors still blocks", () => {
    const c = makeScorable("voice", 0);
    expect(isCriterionComplete(c)).toBe(false);
  });

  it("worldbuilding 0 anchors does not block (min=1, 0 >= 0)", () => {
    const c = makeScorable("worldbuilding", 0);
    expect(isCriterionComplete(c)).toBe(true);
  });

  it("dialogue passes when >=2 anchors", () => {
    const c = makeScorable("dialogue", 2);
    expect(isCriterionComplete(c)).toBe(true);
  });
});
