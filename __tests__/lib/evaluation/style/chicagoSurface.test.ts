const { normalizeChicagoSurfaceText } = require("../../../../lib/evaluation/style/chicagoSurface");

describe("normalizeChicagoSurfaceText", () => {
  test("normalizes dashed clauses to deterministic em-dash style", () => {
    expect(normalizeChicagoSurfaceText("Sentence one -- sentence two")).toBe("Sentence one—sentence two");
    expect(normalizeChicagoSurfaceText("Sentence one — sentence two")).toBe("Sentence one—sentence two");
  });

  test("normalizes smart quotes and contraction apostrophes", () => {
    const input = 'In the anchored moment "It\'s okay," I whispered.';
    const output = normalizeChicagoSurfaceText(input);

    expect(output).toContain("“It’s okay,”");
    expect(output).not.toContain("\"It's okay,\"");
  });

  test("handles optional values safely", () => {
    expect(normalizeChicagoSurfaceText(undefined)).toBe("");
    expect(normalizeChicagoSurfaceText(null)).toBe("");
    expect(normalizeChicagoSurfaceText("   ")).toBe("");
  });
});
