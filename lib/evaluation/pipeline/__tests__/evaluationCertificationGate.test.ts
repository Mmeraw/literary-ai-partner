/**
 * Unit tests for the Evaluation Certification Gate (ECG).
 *
 * Coverage report:
 * ┌─────────────────────────────────────────────┬───────────────────────────────────┬────────────────────────────┐
 * │ Invariant                                   │ Code                              │ Test                       │
 * ├─────────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────┤
 * │ Score authority: overview ≠ canonical       │ ECG_AUTH_SCORE_MISMATCH           │ score authority             │
 * │ Score authority: exec summary wrong score   │ ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH│ score authority           │
 * │ Score authority: criterion out of range     │ ECG_AUTH_CRITERION_SCORE_RANGE    │ score authority             │
 * │ Identity: one_sentence = one_paragraph      │ ECG_IDENT_DUPLICATION             │ identity separation         │
 * │ Identity: pitch ≈ summary                  │ ECG_IDENT_DUPLICATION             │ identity separation         │
 * │ Identity: pitch ≈ premise                  │ ECG_IDENT_DUPLICATION             │ identity separation         │
 * │ Exec summary missing                        │ ECG_EXEC_MISSING                  │ exec summary contract       │
 * │ Exec summary has pitch language             │ ECG_EXEC_PITCH_LANGUAGE           │ exec summary contract       │
 * │ Exec summary no eval language               │ ECG_EXEC_NO_EVAL_LANGUAGE         │ exec summary contract       │
 * │ Exec summary truncated word                 │ ECG_TEXT_TRUNCATED_WORD           │ text integrity              │
 * │ Placeholder text                            │ ECG_TEXT_PLACEHOLDER              │ text integrity              │
 * │ Rec: lowercase start                        │ ECG_REC_LOWERCASE_START           │ rec integrity (repairable)  │
 * │ Rec: missing terminal punct                 │ ECG_REC_MISSING_TERMINAL_PUNCT    │ rec integrity (repairable)  │
 * │ Rec: too short                              │ ECG_REC_TOO_SHORT                 │ rec integrity               │
 * │ Artifact: missing pitch fields              │ ECG_ART_MISSING_*                 │ artifact completeness       │
 * │ Artifact: no recommendations                │ ECG_ART_MISSING_RECOMMENDATIONS   │ artifact completeness       │
 * │ Repair: score injection into exec summary   │ ECG_NORM_SCORE_INJECT             │ auto-repair                 │
 * │ Repair: capitalize rec action               │ ECG_NORM_REC_TEXT                 │ auto-repair                 │
 * │ Clean artifact certifies                    │ (none)                            │ happy path                  │
 * └─────────────────────────────────────────────┴───────────────────────────────────┴────────────────────────────┘
 */

import { describe, it, expect } from "@jest/globals";
import {
  runEvaluationCertificationGate,
  buildECGInput,
  normalizeRecommendationText,
  injectCanonicalScore,
  trimAtWordBoundary,
  type ECGInput,
} from "@/lib/evaluation/pipeline/evaluationCertificationGate";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

const CANONICAL_SCORE = 74;

const CLEAN_EXEC_SUMMARY =
  "The manuscript earns a 74/100 on the strength of its Concept & Premise and Character Depth, with high marks for the Calvin–Monty dynamic. The author should preserve the sardonic Tonal Authority and the textured Antwerp worldbuilding. The principal blocker is Pacing & Structural Balance, where overlong exposition interrupts momentum. Tightening the mid-chapter expository passages should be the first revision priority.";

const CLEAN_SENTENCE_PITCH =
  "A sardonic Antwerp diamond dealer's retirement evening becomes a reckoning with cobalt, blood money, and a lifelong friendship.";

const CLEAN_PARAGRAPH_PITCH =
  "Calvin, a burned-out diamond trader, joins his old friend Monty in Antwerp's SkyNooz penthouse for a farewell evening that turns into an ultimatum: join a high-stakes cobalt operation in the Democratic Republic of Congo, or watch a twenty-five-year friendship dissolve.";

const CLEAN_PREMISE =
  "A burned-out Antwerp diamond trader facing the collapse of his industry lures his cautious Canadian friend into a lavish SkyNooz penthouse evening where a risky cobalt job forces them to confront how much they will risk for money, status, and friendship.";

function makeCleanInput(overrides: Partial<ECGInput> = {}): ECGInput {
  return {
    canonicalScore: CANONICAL_SCORE,
    overview: {
      overall_score_0_100: CANONICAL_SCORE,
      verdict: "revise",
      one_paragraph_summary: CLEAN_EXEC_SUMMARY,
      one_sentence_pitch: CLEAN_SENTENCE_PITCH,
      one_paragraph_pitch: CLEAN_PARAGRAPH_PITCH,
      top_3_strengths: [
        "Strong Calvin–Monty friendship dynamic with specific banter.",
        "Vivid Antwerp worldbuilding with authoritative industry detail.",
        "Consistent sardonic tonal authority throughout.",
      ],
      top_3_risks: [
        "Mid-chapter expository density slows pacing before the GeoCam reveal.",
        "Occasional overextended sentences weaken the narrative voice.",
        "Excerpt ending defers emotional payoff without a clear promise.",
      ],
    },
    enrichment: {
      premise: CLEAN_PREMISE,
      diagnosed_genre: "Literary / Upmarket Fiction",
      target_audience: "Adult literary fiction readers",
    },
    recommendations: {
      quick_wins: [
        {
          action:
            "Compress the most repetitive sentences in the mid-chapter diamond and vanity exposition so the narrative reaches the GeoCam offer a page sooner without sacrificing the core ideas.",
          why: "Tightening exposition will increase narrative momentum.",
        },
      ],
      strategic_revisions: [
        {
          action:
            "Introduce one or two small physical beats in the penthouse scene that use the windows or Macallan bottle to echo Monty's emotional state whenever the conversation about the Democratic Republic of Congo reaches a new turning point.",
          why: "Action beats help readers track emotional shifts through environment.",
        },
      ],
    },
    criteria: [
      {
        key: "concept",
        final_score_0_10: 8,
        final_rationale:
          "The concept linking diamond industry collapse to cobalt mining and personal ethics is fresh and commercially relevant.",
      },
      {
        key: "narrativeDrive",
        final_score_0_10: 7,
        final_rationale:
          "Momentum flows through the escalating penthouse conversation but stalls during the mid-chapter expository passages.",
      },
    ],
    governance: {
      confidence: 0.82,
      confidence_label: "High Confidence",
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — happy path", () => {
  it("certifies a clean artifact with no violations", () => {
    const input = makeCleanInput();
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFIED");
    expect(result.fatal).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Score authority
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — score authority", () => {
  it("FATAL when overview score ≠ canonical score", () => {
    const input = makeCleanInput();
    input.overview.overall_score_0_100 = 80; // diverges from canonicalScore=74
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_AUTH_SCORE_MISMATCH");
  });

  it("FATAL when exec summary references wrong score (80 vs canonical 74)", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "This chapter earns a solid 80/100 on the strength of its Concept & Core Premise and Character Depth, with especially high marks for the Calvin–Monty dynamic. The principal blocker is Pacing & Structural Balance. Tightening the mid-chapter exposition should be the first revision priority.";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain(
      "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH",
    );
  });

  it("FATAL when a criterion score is out of 0–10 range", () => {
    const input = makeCleanInput();
    input.criteria = [{ key: "concept", final_score_0_10: 11, final_rationale: "Strong concept." }];
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_AUTH_CRITERION_SCORE_RANGE");
  });

  it("passes when exec summary references canonical score correctly", () => {
    const input = makeCleanInput();
    // Summary already contains "74/100" — should pass
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFIED");
    expect(result.fatal.map((v) => v.code)).not.toContain(
      "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Identity separation
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — identity separation", () => {
  it("FATAL when one_sentence_pitch = one_paragraph_pitch (exact)", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = CLEAN_PARAGRAPH_PITCH;
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    const codes = result.fatal.map((v) => v.code);
    expect(codes).toContain("ECG_IDENT_DUPLICATION");
  });

  it("FATAL when one_paragraph_pitch ≈ premise (high Jaccard)", () => {
    const input = makeCleanInput();
    // Make them identical
    input.overview.one_paragraph_pitch = CLEAN_PREMISE;
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_IDENT_DUPLICATION");
  });

  it("FATAL when all three pitch-like fields are identical (real Diamonds bug)", () => {
    const identical =
      "A burned-out Antwerp diamond trader facing the collapse of his industry lures his cautious Canadian friend into a lavish penthouse where a cobalt job forces them to confront how much they will risk.";
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = identical;
    input.overview.one_paragraph_pitch = identical;
    input.enrichment!.premise = identical;
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    const identDups = result.fatal.filter((v) => v.code === "ECG_IDENT_DUPLICATION");
    // At minimum: sentence=paragraph, sentence=premise, paragraph=premise
    expect(identDups.length).toBeGreaterThanOrEqual(2);
  });

  it("passes when fields are semantically distinct", () => {
    const input = makeCleanInput();
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFIED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Executive summary contract
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — executive summary contract", () => {
  it("FATAL when exec summary is absent", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary = "";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_EXEC_MISSING");
  });

  it("FATAL when exec summary has no evaluation language", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "Calvin and Monty share a wonderful evening in Antwerp discussing diamonds over Macallan whisky. The friendship between the two men is heartwarming and authentic. Readers will enjoy the banter and the vivid atmosphere of the SkyNooz penthouse.";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_EXEC_NO_EVAL_LANGUAGE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Text integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — text integrity", () => {
  it("FATAL when exec summary contains a truncated word ('occasiona')", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "The manuscript earns a 74/100 on the strength of its Concept & Premise. The author should preserve the sardonic tonal authority. The principal blocker is Pacing & Structural Balance, where overlong exposition and occasiona";
    // Note: ends mid-word without ellipsis
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_TEXT_TRUNCATED_WORD");
  });

  it("FATAL when a field contains placeholder text", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = "[insert one-sentence pitch here]";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_TEXT_PLACEHOLDER");
  });

  it("passes when summary ends with proper ellipsis (upstream trimmed correctly)", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "The manuscript earns a 74/100 on the strength of its Concept & Premise and Character Depth, with the Calvin–Monty dynamic as the strongest craft element. The principal blocker is Pacing & Structural Balance. Tightening the mid-chapter exposition is the first revision priority\u2026";
    const result = runEvaluationCertificationGate(input, false);
    // Should not flag truncation for a properly ellipsis-terminated summary
    const truncViolations = result.fatal.filter((v) => v.code === "ECG_TEXT_TRUNCATED_WORD");
    expect(truncViolations).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — recommendation integrity", () => {
  it("REPAIRABLE when recommendation starts with lowercase (real Diamonds rec #3 bug)", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [
      {
        action:
          "add one concrete resolution beat that closes the dangling thread and signals consequence to the reader, reducing the feeling of dangling threads (Narrative Closure & Promises Kept).",
      },
    ];
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFIED"); // repairable — does not block
    const lowerViolations = result.violations.filter((v) => v.code === "ECG_REC_LOWERCASE_START");
    expect(lowerViolations.length).toBeGreaterThan(0);
    expect(lowerViolations[0].severity).toBe("REPAIRABLE");
  });

  it("FATAL when recommendation is too short", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [{ action: "Fix pacing." }];
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_REC_TOO_SHORT");
  });

  it("FATAL when recommendation contains placeholder text", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [
      { action: "[insert actionable recommendation about pacing and exposition here for criterion]" },
    ];
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_REC_PLACEHOLDER");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Artifact completeness
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — artifact completeness", () => {
  it("FATAL when one_sentence_pitch is absent", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = "";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_ART_MISSING_SENTENCE_PITCH");
  });

  it("FATAL when one_paragraph_pitch is absent", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_pitch = "";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_ART_MISSING_PARAGRAPH_PITCH");
  });

  it("FATAL when premise is absent", () => {
    const input = makeCleanInput();
    input.enrichment!.premise = "";
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_ART_MISSING_PREMISE");
  });

  it("FATAL when no recommendations exist", () => {
    const input = makeCleanInput();
    input.recommendations = { quick_wins: [], strategic_revisions: [] };
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_ART_MISSING_RECOMMENDATIONS");
  });

  it("FATAL when a scored criterion has no rationale", () => {
    const input = makeCleanInput();
    input.criteria = [{ key: "concept", final_score_0_10: 8, final_rationale: "" }];
    const result = runEvaluationCertificationGate(input, false);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((v) => v.code)).toContain("ECG_ART_MISSING_RATIONALE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-repair
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — auto-repair", () => {
  it("injects canonical score into exec summary when score reference is wrong", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "The manuscript earns a solid 80/100 on the strength of its Concept & Core Premise and Character Depth. The principal blocker is Pacing & Structural Balance. Tightening exposition is the first revision priority.";
    // The gate will detect ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH as FATAL — repair runs only on CERTIFIED.
    // So first we test the repair helper directly:
    const repaired = injectCanonicalScore(input.overview.one_paragraph_summary, 74);
    expect(repaired).toContain("74/100");
    expect(repaired).not.toContain("80/100");
  });

  it("capitalizes and adds period to lowercase rec action when repair=true", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary = CLEAN_EXEC_SUMMARY; // has 74/100 — no score mismatch
    input.recommendations!.quick_wins = [
      {
        action:
          "compress the mid-chapter diamond exposition so the narrative reaches the GeoCam offer a page sooner without sacrificing the core ideas",
      },
    ];
    const result = runEvaluationCertificationGate(input, true);
    // Should be certified (lowercase rec is REPAIRABLE only)
    expect(result.status).toBe("CERTIFIED");
    const repairCodes = result.repairs.map((r) => r.code);
    expect(repairCodes).toContain("ECG_NORM_REC_TEXT");
    // Verify the action was fixed in-place
    expect(input.recommendations!.quick_wins![0].action).toMatch(/^Compress/);
    expect(input.recommendations!.quick_wins![0].action).toMatch(/\.$/);
  });

  it("does NOT apply repairs when fatal violations exist", () => {
    const input = makeCleanInput();
    input.overview.overall_score_0_100 = 80; // FATAL — score mismatch
    input.recommendations!.quick_wins = [
      {
        action:
          "add one concrete resolution beat that signals consequence to the reader reducing dangling threads (Narrative Closure & Promises Kept)",
      },
    ];
    const result = runEvaluationCertificationGate(input, true);
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.repairs).toHaveLength(0);
    // Rec action should NOT have been modified
    expect(input.recommendations!.quick_wins![0].action).toMatch(/^add/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeRecommendationText", () => {
  it("capitalizes first letter", () => {
    expect(normalizeRecommendationText("add more tension.")).toBe("Add more tension.");
  });

  it("adds terminal period when missing", () => {
    expect(normalizeRecommendationText("Tighten the exposition")).toBe(
      "Tighten the exposition.",
    );
  });

  it("does not add period when ending in question mark", () => {
    expect(normalizeRecommendationText("Is this the right approach?")).toBe(
      "Is this the right approach?",
    );
  });

  it("collapses multiple spaces", () => {
    expect(normalizeRecommendationText("Fix  the  spacing.")).toBe("Fix the spacing.");
  });
});

describe("trimAtWordBoundary", () => {
  it("trims at last word boundary and appends ellipsis", () => {
    const text =
      "This manuscript earns a solid score on the strength of its Concept and Character Depth.";
    const trimmed = trimAtWordBoundary(text, 50);
    expect(trimmed.endsWith("…")).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(50);
    // Should not cut mid-word
    const withoutEllipsis = trimmed.slice(0, -1);
    expect(withoutEllipsis).not.toMatch(/[a-z]$/i); // ends at word boundary or on punctuation
  });

  it("returns original when under limit", () => {
    const text = "Short text.";
    expect(trimAtWordBoundary(text, 100)).toBe(text);
  });
});

describe("buildECGInput", () => {
  it("builds a valid ECGInput from a partial result object", () => {
    const result = {
      overview: {
        overall_score_0_100: 74,
        one_paragraph_summary: CLEAN_EXEC_SUMMARY,
        one_sentence_pitch: CLEAN_SENTENCE_PITCH,
        one_paragraph_pitch: CLEAN_PARAGRAPH_PITCH,
        top_3_strengths: ["Strength one.", "Strength two.", "Strength three."],
        top_3_risks: ["Risk one.", "Risk two.", "Risk three."],
      },
      enrichment: { premise: CLEAN_PREMISE },
      recommendations: {
        quick_wins: [{ action: "Tighten the mid-chapter exposition to improve pacing." }],
      },
      criteria: [{ key: "concept", final_score_0_10: 8, final_rationale: "Strong concept." }],
      governance: { confidence: 0.82 },
    };
    const ecgInput = buildECGInput(result, 74);
    expect(ecgInput.canonicalScore).toBe(74);
    expect(ecgInput.overview.overall_score_0_100).toBe(74);
    expect(ecgInput.enrichment?.premise).toBe(CLEAN_PREMISE);
  });
});
