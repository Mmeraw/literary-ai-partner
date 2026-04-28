import { classifyEvaluationIntegrityBanner } from "@/lib/evaluation/warningClassification";

describe("classifyEvaluationIntegrityBanner", () => {
  it("returns PROVENANCE for mock warning text", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: ["🔶 MOCK EVALUATION: This is generated test data"],
      },
    });

    expect(banner?.kind).toBe("PROVENANCE");
    expect(banner?.label).toBe("Evaluation Incomplete");
    expect(banner?.title).toBe("⚠️ EVALUATION INCOMPLETE");
    expect(banner?.message).toMatch(/evaluation could not be completed/i);
    expect(banner?.message).toMatch(/full assessment of your submission/i);
  });

  it("returns HOLD for artifact validation hold", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: ["[ArtifactValidation:HOLD] reason_codes=EVIDENCE-MISSING-1"],
        transparency: {
          artifact_validation_result: "HOLD",
        },
      },
    });

    expect(banner?.kind).toBe("HOLD");
    expect(banner?.label).toBe("Confidence Varies");
    expect(banner?.title).toBe("⚠️ CONFIDENCE VARIES ACROSS THIS REPORT");
    expect(banner?.message).toMatch(/completed successfully using LiteraryAI-Partner/i);
    expect(banner?.message).toMatch(/lower confidence/i);
    expect(banner?.message).toMatch(/confidence indicators beside each score/i);
  });

  it("returns FAIL for artifact validation fail", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: ["[ArtifactValidation:FAIL] reason_codes=CRIT-MISSING-ALL"],
        transparency: {
          artifact_validation_result: "FAIL",
        },
      },
    });

    expect(banner?.kind).toBe("FAIL");
    expect(banner?.label).toBe("Evaluation Needs Review");
    expect(banner?.title).toBe("🛠️ EVALUATION NEEDS REVIEW");
    expect(banner?.message).toMatch(/could not be fully validated/i);
    expect(banner?.message).toMatch(/available feedback with caution/i);
  });

  it("returns PASS when validation passes", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: [],
        transparency: {
          artifact_validation_result: "PASS",
        },
      },
    });

    expect(banner?.kind).toBe("PASS");
    expect(banner?.label).toBe("High Confidence");
    expect(banner?.title).toBe("✅ HIGH CONFIDENCE");
    expect(banner?.message).toMatch(/well-supported by evidence from your text/i);
  });

  it("downgrades PASS to HOLD when propagation integrity is mixed", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: [],
        transparency: {
          artifact_validation_result: "PASS",
          propagation_summary: {
            upstream_integrity: "mixed",
            authority_level: "constrained",
          },
        },
      },
    });

    expect(banner?.kind).toBe("HOLD");
    expect(banner?.label).toBe("Confidence Varies");
    expect(banner?.title).toBe("⚠️ CONFIDENCE VARIES ACROSS THIS REPORT");
  });

  it("returns constrained banner when propagation integrity is weak", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: [],
        transparency: {
          artifact_validation_result: "PASS",
          propagation_summary: {
            upstream_integrity: "weak",
            authority_level: "blocked",
          },
        },
      },
    });

    expect(banner?.kind).toBe("HOLD");
    expect(banner?.label).toBe("Confidence Constrained");
    expect(banner?.title).toBe("⚠️ CONFIDENCE IS CONSTRAINED");
  });

  it("returns null when no warnings and no gate signal", () => {
    const banner = classifyEvaluationIntegrityBanner({
      governance: {
        warnings: [],
      },
    });

    expect(banner).toBeNull();
  });

  it("does not expose internal enums or banned phrasing in user-facing copy", () => {
    const banners = [
      classifyEvaluationIntegrityBanner({
        governance: {
          warnings: [],
          transparency: {
            artifact_validation_result: "PASS",
          },
        },
      }),
      classifyEvaluationIntegrityBanner({
        governance: {
          warnings: ["[ArtifactValidation:HOLD] reason_codes=EVIDENCE-MISSING-1"],
          transparency: {
            artifact_validation_result: "HOLD",
          },
        },
      }),
      classifyEvaluationIntegrityBanner({
        governance: {
          warnings: ["[ArtifactValidation:FAIL] reason_codes=CRIT-MISSING-ALL"],
          transparency: {
            artifact_validation_result: "FAIL",
          },
        },
      }),
      classifyEvaluationIntegrityBanner({
        governance: {
          warnings: ["🔶 MOCK EVALUATION: This is generated test data"],
        },
      }),
    ].filter((banner): banner is NonNullable<typeof banner> => banner !== null);

    const bannedPhrases = [
      "fail",
      "hold",
      "provenance",
      "not real ai",
      "generic placeholders",
      "not sufficiently supported",
    ];

    for (const banner of banners) {
      const combined = `${banner.label} ${banner.title} ${banner.message}`.toLowerCase();
      for (const phrase of bannedPhrases) {
        expect(combined).not.toContain(phrase);
      }
    }
  });
});
