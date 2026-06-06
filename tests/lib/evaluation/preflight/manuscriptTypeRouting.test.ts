import { routeNarrativeEvaluationPreflight } from "@/lib/evaluation/preflight/manuscriptTypeRouting";

describe("routeNarrativeEvaluationPreflight", () => {
  test("blocks business-letter style submissions", () => {
    const decision = routeNarrativeEvaluationPreflight(
      "Dear Andrew, I am writing to share coaching notes for your draft. Best regards, Mentor.",
    );

    expect(decision.allowed).toBe(false);
    expect(decision.detectedType).toBe("business_letter");
  });

  test("allows narrative fiction scene excerpts", () => {
    const decision = routeNarrativeEvaluationPreflight(
      "He walked into the room and said, \"Do not move.\" She stared at the broken window and felt the air go cold.",
    );

    expect(decision.allowed).toBe(true);
    expect(decision.detectedType).toBe("narrative_fiction");
  });
});
