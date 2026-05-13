import { computeRetroactiveModeChangeImpact } from "@/lib/evaluation/modeGate";

describe("mode-change-retroactive", () => {
  test("switching to TESTIMONY disables previously trustpath-eligible targets", () => {
    const impact = computeRetroactiveModeChangeImpact({
      opportunities: [
        { id: "op-1", trustpathEligible: true },
        { id: "op-2", trustpathEligible: false },
        { id: "op-3", trustpathEligible: true },
      ],
      nextConfirmedMode: {
        evaluationMode: "TESTIMONY",
        voicePreservationMode: "MAXIMUM",
      },
    });

    expect(impact.disabledCount).toBe(2);
    expect(impact.disabledOpportunityIds).toEqual(["op-1", "op-3"]);
  });
});
