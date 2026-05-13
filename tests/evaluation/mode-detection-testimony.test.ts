import { detectModeFromManuscript } from "@/lib/evaluation/modeDetection";

describe("mode-detection-testimony", () => {
  test("survivor disclosure markers propose TESTIMONY + MAXIMUM", () => {
    const manuscript = [
      "I remember the night in fragments.",
      "I survived, but the panic never fully left.",
      "This testimony is the first time I have written it down.",
    ].join(" ");

    const detected = detectModeFromManuscript(manuscript);

    expect(detected.proposedEvaluationMode).toBe("TESTIMONY");
    expect(detected.proposedVoicePreservationMode).toBe("MAXIMUM");
    expect(detected.evidence.length).toBeGreaterThan(0);
  });
});
