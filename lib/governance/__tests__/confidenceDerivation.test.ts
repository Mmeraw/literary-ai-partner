import {
  deriveConfidence,
  type ConfidenceInputs,
  type ConfidenceReason,
} from "../confidenceDerivation";

function makeBaseInput(overrides: Partial<ConfidenceInputs> = {}): ConfidenceInputs {
  return {
    criterionCompletenessPassed: true,
    anchorIntegrityPassed: true,
    governancePassed: true,
    passConvergencePassed: true,
    hasMaterialPassDisagreement: false,
    usedFallbackPath: false,
    executionDegraded: false,
    invalidOutput: false,
    quarantinedOutput: false,
    evidenceCoverage: "strong",
    ...overrides,
  };
}

function expectReasonsToContainAll(actual: ConfidenceReason[], expected: ConfidenceReason[]) {
  for (const r of expected) {
    expect(actual).toContain(r);
  }
}

describe("U1 confidence derivation", () => {
  test("1) all clean inputs + strong evidence => high with empty reasons", () => {
    const result = deriveConfidence(makeBaseInput());
    expect(result.confidence).toBe("high");
    expect(result.reasons).toEqual([]);
  });

  test("2) evidenceCoverage=partial + clean otherwise => medium", () => {
    const result = deriveConfidence(makeBaseInput({ evidenceCoverage: "partial" }));
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toContain("evidence_coverage_partial");
  });

  test("3) executionDegraded=true + clean otherwise => medium", () => {
    const result = deriveConfidence(makeBaseInput({ executionDegraded: true }));
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toContain("execution_degraded");
  });

  test("4) usedFallbackPath=true + clean otherwise => medium", () => {
    const result = deriveConfidence(makeBaseInput({ usedFallbackPath: true }));
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toContain("used_fallback_path");
  });

  test("5) passConvergencePassed=false + clean otherwise => medium", () => {
    const result = deriveConfidence(makeBaseInput({ passConvergencePassed: false }));
    expect(result.confidence).toBe("medium");
    expect(result.reasons).toContain("pass_convergence_failed");
  });

  test("6) evidenceCoverage=thin + clean otherwise => low", () => {
    const result = deriveConfidence(makeBaseInput({ evidenceCoverage: "thin" }));
    expect(result.confidence).toBe("low");
    expect(result.reasons).toContain("evidence_coverage_thin");
  });

  test("7) invalidOutput=true + clean otherwise => low", () => {
    const result = deriveConfidence(makeBaseInput({ invalidOutput: true }));
    expect(result.confidence).toBe("low");
    expect(result.reasons).toContain("invalid_output");
  });

  test("8) hasMaterialPassDisagreement=true + clean otherwise => low", () => {
    const result = deriveConfidence(makeBaseInput({ hasMaterialPassDisagreement: true }));
    expect(result.confidence).toBe("low");
    expect(result.reasons).toContain("pass_disagreement_material");
  });

  test("9) quarantinedOutput=true => withheld", () => {
    const result = deriveConfidence(makeBaseInput({ quarantinedOutput: true }));
    expect(result.confidence).toBe("withheld");
    expect(result.reasons).toContain("quarantined_output");
  });

  test("10) criterionCompletenessPassed=false => withheld", () => {
    const result = deriveConfidence(makeBaseInput({ criterionCompletenessPassed: false }));
    expect(result.confidence).toBe("withheld");
    expect(result.reasons).toContain("criterion_completeness_failed");
  });

  test("11) anchorIntegrityPassed=false => withheld", () => {
    const result = deriveConfidence(makeBaseInput({ anchorIntegrityPassed: false }));
    expect(result.confidence).toBe("withheld");
    expect(result.reasons).toContain("anchor_integrity_failed");
  });

  test("12) governancePassed=false => withheld", () => {
    const result = deriveConfidence(makeBaseInput({ governancePassed: false }));
    expect(result.confidence).toBe("withheld");
    expect(result.reasons).toContain("governance_block");
  });

  test("13) precedence: governance failure + partial + fallback => withheld (not medium)", () => {
    const result = deriveConfidence(
      makeBaseInput({
        governancePassed: false,
        evidenceCoverage: "partial",
        usedFallbackPath: true,
      }),
    );

    expect(result.confidence).toBe("withheld");
    expectReasonsToContainAll(result.reasons, [
      "governance_block",
      "evidence_coverage_partial",
      "used_fallback_path",
    ]);
  });

  test("14) precedence: invalid + degraded => low (not medium)", () => {
    const result = deriveConfidence(
      makeBaseInput({
        invalidOutput: true,
        executionDegraded: true,
      }),
    );

    expect(result.confidence).toBe("low");
    expectReasonsToContainAll(result.reasons, ["invalid_output", "execution_degraded"]);
  });

  test("15) precedence: convergence_failed + disagreement_material => low (not medium)", () => {
    const result = deriveConfidence(
      makeBaseInput({
        passConvergencePassed: false,
        hasMaterialPassDisagreement: true,
      }),
    );

    expect(result.confidence).toBe("low");
    expectReasonsToContainAll(result.reasons, [
      "pass_convergence_failed",
      "pass_disagreement_material",
    ]);
  });

  test("16) reason accumulation: quarantined + thin + governance_block => withheld with all reasons", () => {
    const result = deriveConfidence(
      makeBaseInput({
        quarantinedOutput: true,
        evidenceCoverage: "thin",
        governancePassed: false,
      }),
    );

    expect(result.confidence).toBe("withheld");
    expectReasonsToContainAll(result.reasons, [
      "quarantined_output",
      "evidence_coverage_thin",
      "governance_block",
    ]);
  });

  test("17) deterministic purity: same input twice => structurally equal output", () => {
    const input = makeBaseInput({
      evidenceCoverage: "partial",
      executionDegraded: true,
      passConvergencePassed: false,
    });

    const resultA = deriveConfidence(input);
    const resultB = deriveConfidence(input);

    expect(resultA).toEqual(resultB);
  });
});
