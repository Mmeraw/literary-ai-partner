import { buildAnchoredMarkedPreview } from "@/lib/revision/finalReviewPresentation";

const source = [
  "The river moved below them in a long sheet of grey.",
  "Cliff tightened both hands on the wheel.",
  "The river moved below them in a long sheet of grey.",
].join("\n\n");

describe("buildAnchoredMarkedPreview", () => {
  it("positions a decision only when its exact source excerpt is unique", () => {
    const result = buildAnchoredMarkedPreview(source, [{
      id: "decision-1",
      decision: "accepted_a",
      selectedText: "Cliff locked both hands around the wheel.",
      customText: null,
      sourceExcerpt: "Cliff tightened both hands on the wheel.",
    }]);

    expect(result.anchoredDecisionCount).toBe(1);
    expect(result.unmatchedDecisionCount).toBe(0);
    expect(result.paragraphs[1]).toEqual({
      text: "Cliff locked both hands around the wheel.",
      decisionIds: ["decision-1"],
    });
    expect(result.paragraphs[0].decisionIds).toEqual([]);
  });

  it("keeps ambiguous duplicate excerpts changelog-only", () => {
    const result = buildAnchoredMarkedPreview(source, [{
      id: "decision-ambiguous",
      decision: "accepted_b",
      selectedText: "Below them, the river carried a grey sheet toward the bend.",
      customText: null,
      sourceExcerpt: "The river moved below them in a long sheet of grey.",
    }]);

    expect(result.anchoredDecisionCount).toBe(0);
    expect(result.unmatchedDecisionCount).toBe(1);
    expect(result.paragraphs.every((paragraph) => paragraph.decisionIds.length === 0)).toBe(true);
  });

  it("keeps missing snapshots and cross-paragraph excerpts changelog-only", () => {
    const result = buildAnchoredMarkedPreview(source, [
      {
        id: "decision-missing",
        decision: "custom",
        selectedText: null,
        customText: "A custom line.",
        sourceExcerpt: null,
      },
      {
        id: "decision-cross-paragraph",
        decision: "accepted_c",
        selectedText: "A combined replacement.",
        customText: null,
        sourceExcerpt: "wheel.\n\nThe river",
      },
    ]);

    expect(result.applicableDecisionCount).toBe(2);
    expect(result.anchoredDecisionCount).toBe(0);
    expect(result.unmatchedDecisionCount).toBe(2);
  });

  it("never treats kept, rejected, or deferred decisions as manuscript replacements", () => {
    const result = buildAnchoredMarkedPreview(source, [
      { id: "kept", decision: "keep_original", selectedText: null, customText: null, sourceExcerpt: "Cliff tightened both hands on the wheel." },
      { id: "rejected", decision: "reject", selectedText: null, customText: null, sourceExcerpt: "Cliff tightened both hands on the wheel." },
      { id: "deferred", decision: "deferred", selectedText: null, customText: null, sourceExcerpt: "Cliff tightened both hands on the wheel." },
    ]);

    expect(result.applicableDecisionCount).toBe(0);
    expect(result.unmatchedDecisionCount).toBe(0);
    expect(result.paragraphs.every((paragraph) => paragraph.decisionIds.length === 0)).toBe(true);
  });
});
