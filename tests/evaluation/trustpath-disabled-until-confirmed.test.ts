import { validateConfirmedModeGate } from "@/lib/evaluation/modeGate";

describe("trustpath-disabled-until-confirmed", () => {
  test("fail-closed when confirmedMode == null", () => {
    const gate = validateConfirmedModeGate(null);
    expect(gate.ok).toBe(false);
    if (gate.ok === false) {
      expect(gate.code).toBe("MODE_NOT_CONFIRMED");
    }
  });

  test("passes only when confirmed mode exists", () => {
    const gate = validateConfirmedModeGate({
      evaluationMode: "STANDARD",
      voicePreservationMode: "BALANCED",
    });

    expect(gate.ok).toBe(true);
  });
});
