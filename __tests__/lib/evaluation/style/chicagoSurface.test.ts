const {
  normalizeChicagoSurfaceText,
  normalizeCriticText,
  preserveEvidenceText,
  renderMixedText,
} = require("../../../../lib/evaluation/style/chicagoSurface");

describe("Chicago surface normalization provenance policy", () => {
  test("normalizes dashed clauses to deterministic em-dash style", () => {
    expect(normalizeCriticText("Sentence one -- sentence two")).toBe("Sentence one—sentence two");
    expect(normalizeCriticText("Sentence one — sentence two")).toBe("Sentence one—sentence two");
  });

  test("preserves evidence snippet byte-for-byte unchanged", () => {
    const evidence = '"You think anyone\'s gonna believe it?" -- he asked.';
    const output = preserveEvidenceText(evidence);

    expect(output).toBe(evidence);
  });

  test("normalizes critic prose even when critic-authored quoted term appears", () => {
    const output = normalizeCriticText('The term "market hook" -- in this rationale -- is clear.');
    expect(output).toBe('The term "market hook"—in this rationale—is clear.');
  });

  test("renders mixed provenance by segment type (critic vs evidence)", () => {
    const output = renderMixedText([
      { type: "critic", text: "Evidence suggests it's working -- " },
      { type: "evidence", text: '"you ain\'t seen nothing yet"' },
      { type: "critic", text: " -- but pacing still stalls." },
    ]);

    expect(output).toBe('Evidence suggests it’s working—"you ain\'t seen nothing yet"—but pacing still stalls.');
    expect(output).toContain('"you ain\'t seen nothing yet"');
  });

  test("normalizes critic prose apostrophes", () => {
    const output = normalizeCriticText("It's a strong report rationale.");
    expect(output).toBe("It’s a strong report rationale.");
  });

  test("handles optional values safely", () => {
    expect(normalizeCriticText(undefined)).toBe("");
    expect(normalizeCriticText(null)).toBe("");
    expect(normalizeCriticText("   ")).toBe("");
    expect(preserveEvidenceText(undefined)).toBe("");
  });

  test("legacy alias maps to critic normalizer", () => {
    expect(normalizeChicagoSurfaceText("It's fine -- really.")).toBe("It’s fine—really.");
  });
});
