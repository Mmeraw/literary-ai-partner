import { detectModeFromManuscript } from "@/lib/evaluation/modeDetection";

describe("mode-detection-transgressive", () => {
  test("register breaks and intentional fragmentation propose TRANSGRESSIVE + MAXIMUM", () => {
    const manuscript = [
      "Fuck decorum. Blood on the sink, gore under the grin.",
      "Fragments -- broken cadence -- deliberate rupture...",
      "The voice keeps the grotesque edge on purpose.",
    ].join("\n");

    const detected = detectModeFromManuscript(manuscript);

    expect(detected.proposedEvaluationMode).toBe("TRANSGRESSIVE");
    expect(detected.proposedVoicePreservationMode).toBe("MAXIMUM");
    expect(detected.evidence.length).toBeGreaterThan(0);
  });
});
