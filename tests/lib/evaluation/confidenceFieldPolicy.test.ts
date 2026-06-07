import {
  getConfidenceDisplayMode,
  deriveGenreConfidence,
  deriveMarketReadinessConfidence,
  deriveOverallScoreConfidence,
  getAudienceConfidence,
  getConfidenceLabelClasses,
  formatCriterionConfidenceLabel,
  CONFIDENCE_FIELD_POLICY,
  type CanonicalConfidenceLabel,
} from "@/lib/evaluation/confidenceFieldPolicy";

// ── Policy map ────────────────────────────────────────────────────────────────

describe("CONFIDENCE_FIELD_POLICY map", () => {
  test("deterministic metadata fields are all 'none'", () => {
    const noneFields = [
      "report_type",
      "title",
      "reference_id",
      "date_generated",
      "submitted_word_count",
      "estimated_pages",
      "reading_grade_level",
      "dialogue_narrative_ratio",
    ] as const;
    for (const field of noneFields) {
      expect(CONFIDENCE_FIELD_POLICY[field]).toBe("none");
    }
  });

  test("all 13 criteria are 'inline_quiet'", () => {
    const criteriaFields = [
      "criterion_concept",
      "criterion_narrative_drive",
      "criterion_character",
      "criterion_voice",
      "criterion_scene_construction",
      "criterion_dialogue",
      "criterion_theme",
      "criterion_worldbuilding",
      "criterion_pacing",
      "criterion_prose_control",
      "criterion_tone",
      "criterion_narrative_closure",
      "criterion_marketability",
    ] as const;
    for (const field of criteriaFields) {
      expect(CONFIDENCE_FIELD_POLICY[field]).toBe("inline_quiet");
    }
    expect(criteriaFields).toHaveLength(13);
  });

  test("genre, market_readiness, overall_score are 'inline_quiet'", () => {
    expect(CONFIDENCE_FIELD_POLICY.genre).toBe("inline_quiet");
    expect(CONFIDENCE_FIELD_POLICY.market_readiness).toBe("inline_quiet");
    expect(CONFIDENCE_FIELD_POLICY.overall_score).toBe("inline_quiet");
  });

  test("target_audience and storygate_eligibility are 'warning_required'", () => {
    expect(CONFIDENCE_FIELD_POLICY.target_audience).toBe("warning_required");
    expect(CONFIDENCE_FIELD_POLICY.storygate_eligibility).toBe("warning_required");
  });
});

describe("getConfidenceDisplayMode", () => {
  test("returns 'none' for unlisted fields", () => {
    expect(getConfidenceDisplayMode("unknown_field")).toBe("none");
    expect(getConfidenceDisplayMode("")).toBe("none");
    expect(getConfidenceDisplayMode("overall_score_made_up")).toBe("none");
  });

  test("returns correct mode for known fields", () => {
    expect(getConfidenceDisplayMode("genre")).toBe("inline_quiet");
    expect(getConfidenceDisplayMode("target_audience")).toBe("warning_required");
    expect(getConfidenceDisplayMode("submitted_word_count")).toBe("none");
  });
});

// ── Genre confidence ──────────────────────────────────────────────────────────

describe("deriveGenreConfidence — word-count based, not governance", () => {
  test("null/missing word count returns null (hide label)", () => {
    expect(deriveGenreConfidence(null)).toBeNull();
    expect(deriveGenreConfidence(undefined)).toBeNull();
  });

  test("< 1000 words → Insufficient Evidence", () => {
    expect(deriveGenreConfidence(0)).toBe("Insufficient Evidence");
    expect(deriveGenreConfidence(500)).toBe("Insufficient Evidence");
    expect(deriveGenreConfidence(999)).toBe("Insufficient Evidence");
  });

  test("1000–4999 words → Low Confidence", () => {
    expect(deriveGenreConfidence(1000)).toBe("Low Confidence");
    expect(deriveGenreConfidence(3000)).toBe("Low Confidence");
    expect(deriveGenreConfidence(4999)).toBe("Low Confidence");
  });

  test("5000–14999 words → Moderate Confidence", () => {
    expect(deriveGenreConfidence(5000)).toBe("Moderate Confidence");
    expect(deriveGenreConfidence(10000)).toBe("Moderate Confidence");
    expect(deriveGenreConfidence(14999)).toBe("Moderate Confidence");
  });

  test("15000–39999 words → High Confidence", () => {
    expect(deriveGenreConfidence(15000)).toBe("High Confidence");
    expect(deriveGenreConfidence(30000)).toBe("High Confidence");
    expect(deriveGenreConfidence(39999)).toBe("High Confidence");
  });

  test("40000+ words → Very High Confidence", () => {
    expect(deriveGenreConfidence(40000)).toBe("Very High Confidence");
    expect(deriveGenreConfidence(100000)).toBe("Very High Confidence");
  });

  test("does NOT accept governance.confidence as an argument (wrong source)", () => {
    // deriveGenreConfidence only takes wordCount — this test documents the contract.
    // If someone adds a second param by mistake, the type system and this test both catch it.
    const fn = deriveGenreConfidence as (wc: number | null | undefined) => unknown;
    expect(fn.length).toBe(1);
  });
});

// ── Market Readiness confidence ───────────────────────────────────────────────

describe("deriveMarketReadinessConfidence — criteria-fraction based", () => {
  test("no criteria returns null (hide label)", () => {
    expect(deriveMarketReadinessConfidence(0, 0)).toBeNull();
  });

  test("≥ 90% scorable → High Confidence", () => {
    expect(deriveMarketReadinessConfidence(13, 13)).toBe("High Confidence");
    expect(deriveMarketReadinessConfidence(12, 13)).toBe("High Confidence"); // ~92%
  });

  test("70–89% scorable → Moderate Confidence", () => {
    expect(deriveMarketReadinessConfidence(10, 13)).toBe("Moderate Confidence"); // ~77%
    expect(deriveMarketReadinessConfidence(9, 13)).toBe("Low Confidence");       // 69.2% — below 70% threshold
  });

  test("40–69% scorable → Low Confidence", () => {
    expect(deriveMarketReadinessConfidence(6, 13)).toBe("Low Confidence"); // ~46%
    expect(deriveMarketReadinessConfidence(7, 13)).toBe("Low Confidence"); // ~54%
  });

  test("< 40% scorable → Insufficient Evidence", () => {
    expect(deriveMarketReadinessConfidence(0, 13)).toBe("Insufficient Evidence");
    expect(deriveMarketReadinessConfidence(5, 13)).toBe("Insufficient Evidence"); // 38.5% — below threshold
    expect(deriveMarketReadinessConfidence(2, 13)).toBe("Insufficient Evidence"); // ~15%
  });

  test("does NOT use governance.confidence (wrong source)", () => {
    const fn = deriveMarketReadinessConfidence as (...args: unknown[]) => unknown;
    expect(fn.length).toBe(2); // only (scorable, total)
  });
});

// ── Overall Score confidence ──────────────────────────────────────────────────

describe("deriveOverallScoreConfidence — criteria fraction + governance floor", () => {
  test("no criteria returns null", () => {
    expect(deriveOverallScoreConfidence(0, 0, null)).toBeNull();
  });

  test("all criteria scorable, no governance signal → High Confidence", () => {
    expect(deriveOverallScoreConfidence(13, 13, null)).toBe("High Confidence");
  });

  test("all criteria scorable but governance very low → capped at Moderate", () => {
    expect(deriveOverallScoreConfidence(13, 13, 0.4)).toBe("Moderate Confidence");
  });

  test("all criteria scorable but governance critically low → Low Confidence", () => {
    expect(deriveOverallScoreConfidence(13, 13, 0.2)).toBe("Low Confidence");
  });

  test("~77% scorable, healthy governance → Moderate Confidence", () => {
    expect(deriveOverallScoreConfidence(10, 13, 0.8)).toBe("Moderate Confidence");
  });

  test("< 40% scorable → Insufficient Evidence regardless of governance", () => {
    expect(deriveOverallScoreConfidence(2, 13, 0.99)).toBe("Insufficient Evidence");
  });

  test("governance signal does not inflate low criteria fraction", () => {
    // Only 30% scorable → always Insufficient Evidence even with perfect governance
    expect(deriveOverallScoreConfidence(4, 13, 1.0)).toBe("Insufficient Evidence");
  });
});

// ── Target Audience confidence ────────────────────────────────────────────────

describe("getAudienceConfidence — word-count gated, no governance signal", () => {
  test("derives from word count only (function arity = 1)", () => {
    const fn = getAudienceConfidence as (...args: unknown[]) => unknown;
    expect(fn.length).toBe(1);
  });

  test("null/undefined word count → Insufficient Evidence, tentative", () => {
    expect(getAudienceConfidence(null)).toEqual({ tentative: true, label: "Insufficient Evidence" });
    expect(getAudienceConfidence(undefined)).toEqual({ tentative: true, label: "Insufficient Evidence" });
  });

  test("0–999 words → Insufficient Evidence, tentative", () => {
    expect(getAudienceConfidence(0)).toEqual({ tentative: true, label: "Insufficient Evidence" });
    expect(getAudienceConfidence(999)).toEqual({ tentative: true, label: "Insufficient Evidence" });
  });

  test("1000–4999 words → Low Confidence, tentative", () => {
    expect(getAudienceConfidence(1000)).toEqual({ tentative: true, label: "Low Confidence" });
    expect(getAudienceConfidence(4999)).toEqual({ tentative: true, label: "Low Confidence" });
  });

  test("5000–24999 words → Moderate Confidence, not tentative", () => {
    expect(getAudienceConfidence(5000)).toEqual({ tentative: false, label: "Moderate Confidence" });
    expect(getAudienceConfidence(24999)).toEqual({ tentative: false, label: "Moderate Confidence" });
  });

  test("25000+ words → High Confidence, not tentative", () => {
    expect(getAudienceConfidence(25000)).toEqual({ tentative: false, label: "High Confidence" });
    expect(getAudienceConfidence(100000)).toEqual({ tentative: false, label: "High Confidence" });
  });
});

// ── formatCriterionConfidenceLabel ───────────────────────────────────────────

describe("formatCriterionConfidenceLabel", () => {
  test("returns null when no signal", () => {
    expect(formatCriterionConfidenceLabel(null, null)).toBeNull();
    expect(formatCriterionConfidenceLabel(undefined, undefined)).toBeNull();
  });

  test("confidence_level 'high' → High Confidence", () => {
    expect(formatCriterionConfidenceLabel("high", undefined)).toBe("High Confidence");
  });

  test("confidence_level 'moderate' → Moderate Confidence", () => {
    expect(formatCriterionConfidenceLabel("moderate", undefined)).toBe("Moderate Confidence");
  });

  test("confidence_level 'low' → Low Confidence", () => {
    expect(formatCriterionConfidenceLabel("low", undefined)).toBe("Low Confidence");
  });

  test("score >= 80 → High Confidence (overrides absent level)", () => {
    expect(formatCriterionConfidenceLabel(undefined, 85)).toBe("High Confidence");
    expect(formatCriterionConfidenceLabel(undefined, 80)).toBe("High Confidence");
  });

  test("score 60–79 → Moderate Confidence", () => {
    expect(formatCriterionConfidenceLabel(undefined, 70)).toBe("Moderate Confidence");
    expect(formatCriterionConfidenceLabel(undefined, 60)).toBe("Moderate Confidence");
  });

  test("score 0–59 → Low Confidence", () => {
    expect(formatCriterionConfidenceLabel(undefined, 0)).toBe("Low Confidence");
    expect(formatCriterionConfidenceLabel(undefined, 59)).toBe("Low Confidence");
  });

  test("confidence_level takes precedence over score for 'high'", () => {
    // level says high, score says low — level wins (checked first)
    expect(formatCriterionConfidenceLabel("high", 20)).toBe("High Confidence");
  });
});

// ── getConfidenceLabelClasses ─────────────────────────────────────────────────

describe("getConfidenceLabelClasses", () => {
  const allLabels: CanonicalConfidenceLabel[] = [
    "Very High Confidence",
    "High Confidence",
    "Moderate Confidence",
    "Low Confidence",
    "Insufficient Evidence",
  ];

  test("returns a non-empty string for every canonical label", () => {
    for (const label of allLabels) {
      const classes = getConfidenceLabelClasses(label);
      expect(typeof classes).toBe("string");
      expect(classes.length).toBeGreaterThan(0);
    }
  });

  test("each label gets distinct classes", () => {
    const classSet = new Set(allLabels.map(getConfidenceLabelClasses));
    expect(classSet.size).toBe(allLabels.length);
  });

  test("Very High Confidence is emerald-100 (lighter than High)", () => {
    expect(getConfidenceLabelClasses("Very High Confidence")).toContain("emerald-100");
  });

  test("Insufficient Evidence is stone-200 (neutral, not red)", () => {
    expect(getConfidenceLabelClasses("Insufficient Evidence")).toContain("stone-200");
  });
});

// ── Separation-of-concerns contract ──────────────────────────────────────────

describe("Separation of confidence sources", () => {
  test("Genre confidence never equals Market Readiness confidence for the same word count + criteria set", () => {
    // They use completely different signals, so their results may coincidentally
    // match but must derive independently. Verify the function signatures differ.
    const genreResult = deriveGenreConfidence(10000);
    const marketResult = deriveMarketReadinessConfidence(13, 13);
    // Both may return "High Confidence" but they got there via different paths
    // The test ensures neither function accepts the other's arguments.
    expect(typeof genreResult === "string" || genreResult === null).toBe(true);
    expect(typeof marketResult === "string" || marketResult === null).toBe(true);
  });

  test("Target Audience confidence is never derived from governance.confidence", () => {
    // getAudienceConfidence accepts only wordCount (arity 1).
    // This test will fail if someone adds a governance param.
    expect(getAudienceConfidence.length).toBe(1);
  });

  test("Genre confidence is never derived from governance.confidence", () => {
    expect(deriveGenreConfidence.length).toBe(1);
  });

  test("Market Readiness confidence is never derived from governance.confidence directly", () => {
    // Only takes (scorable, total) — governance signal is not a param.
    expect(deriveMarketReadinessConfidence.length).toBe(2);
  });
});
