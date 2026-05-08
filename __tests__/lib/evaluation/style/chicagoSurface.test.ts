const { normalizeChicagoSurfaceText } = require("../../../../lib/evaluation/style/chicagoSurface");

describe("normalizeChicagoSurfaceText", () => {
  test("normalizes dashed clauses to deterministic em-dash style", () => {
    expect(normalizeChicagoSurfaceText("Sentence one -- sentence two")).toBe("Sentence one—sentence two");
    expect(normalizeChicagoSurfaceText("Sentence one — sentence two")).toBe("Sentence one—sentence two");
  });

  test("preserves quoted manuscript snippet byte-for-byte while normalizing surrounding prose", () => {
    const input = 'The manuscript evidence "You think anyone\'s gonna believe it?" supports this claim -- but pacing lags.';
    const output = normalizeChicagoSurfaceText(input);

    expect(output).toContain('"You think anyone\'s gonna believe it?"');
    expect(output).toBe('The manuscript evidence "You think anyone\'s gonna believe it?" supports this claim—but pacing lags.');
  });

  test("normalizes critic prose apostrophes outside quoted evidence", () => {
    const output = normalizeChicagoSurfaceText("It's a strong report rationale.");
    expect(output).toBe("It’s a strong report rationale.");
  });

  test("handles optional values safely", () => {
    expect(normalizeChicagoSurfaceText(undefined)).toBe("");
    expect(normalizeChicagoSurfaceText(null)).toBe("");
    expect(normalizeChicagoSurfaceText("   ")).toBe("");
  });
});
