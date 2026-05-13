import { detectModeFromManuscript } from "@/lib/evaluation/modeDetection";

describe("mode-detection-standard", () => {
  test("clean commercial prose proposes STANDARD + BALANCED", () => {
    const manuscript = [
      "Chapter One opens with a clear inciting incident.",
      "The character goal is explicit, and scene transitions are clean.",
      "The manuscript maintains consistent register and pacing.",
    ].join(" ");

    const detected = detectModeFromManuscript(manuscript);

    expect(detected.proposedEvaluationMode).toBe("STANDARD");
    expect(detected.proposedVoicePreservationMode).toBe("BALANCED");
    expect(detected.evidence.length).toBeGreaterThan(0);
  });
});
