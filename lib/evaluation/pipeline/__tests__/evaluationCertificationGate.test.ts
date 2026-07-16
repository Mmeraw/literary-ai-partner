/**
 * Unit tests — Artifact Certification Authority (ECG)
 *
 * Tests prove:
 *   1. CERTIFICATION_REGISTRY: all 7 domains present, each entry has required
 *      provenance fields (code, domain, severity, authority, section, tags).
 *   2. normalizeArtifact(): only cosmetic changes — scores and text meaning
 *      are never altered.
 *   3. ECG does not mutate its input (deep-equal before/after).
 *   4. ECG_MODE=WARN_ONLY: fatal violations logged but status === CERTIFIED,
 *      summary contains violation codes.
 *   5. ECG_MODE=ENFORCE: FATAL violations → CERTIFICATION_FAILED.
 *   6. ECG_MODE=OFF: gate skipped, status === SKIPPED, no checks run.
 *   7. Score mismatch is diagnostic only — exec summary text is never
 *      patched, never repaired, never silently corrected.
 *   8. All invariant codes are covered by at least one test.
 *
 * Coverage table:
 * ┌──────────────────────────────────────────────┬─────────────────────────────────────────┬────────────────────────────────────┐
 * │ Domain        │ Code                          │ Test group                              │
 * ├───────────────┼───────────────────────────────┼─────────────────────────────────────────┤
 * │ AUTHORITY     │ ECG_AUTH_SCORE_MISMATCH        │ score authority                         │
 * │ AUTHORITY     │ ECG_AUTH_EXEC_SUMMARY_SCORE_*  │ score authority / score mismatch        │
 * │ AUTHORITY     │ ECG_AUTH_CRITERION_SCORE_RANGE │ score authority                         │
 * │ IDENTITY      │ ECG_IDENT_PITCH_DUPLICATION    │ identity separation                     │
 * │ IDENTITY      │ ECG_IDENT_PITCH_SUMMARY_OVERLAP│ identity separation                     │
 * │ IDENTITY      │ ECG_IDENT_PITCH_PREMISE_OVERLAP│ identity separation                     │
 * │ SUMMARY       │ ECG_EXEC_MISSING               │ executive summary contract              │
 * │ SUMMARY       │ ECG_EXEC_PITCH_LANGUAGE        │ executive summary contract              │
 * │ SUMMARY       │ ECG_EXEC_NO_EVAL_LANGUAGE      │ executive summary contract              │
 * │ SUMMARY       │ ECG_EXEC_SCORE_ABSENT          │ executive summary contract              │
 * │ TEXT          │ ECG_TEXT_TRUNCATED_WORD        │ text integrity                          │
 * │ TEXT          │ ECG_TEXT_PLACEHOLDER           │ text integrity                          │
 * │ RECOMMEND     │ ECG_REC_TOO_SHORT              │ recommendation integrity                │
 * │ RECOMMEND     │ ECG_REC_PLACEHOLDER            │ recommendation integrity                │
 * │ RECOMMEND     │ ECG_REC_LOWERCASE_START        │ recommendation integrity (advisory)     │
 * │ RECOMMEND     │ ECG_REC_MISSING_TERMINAL_PUNCT │ recommendation integrity (advisory)     │
 * │ COMPLETENESS  │ ECG_ART_MISSING_EXEC_SUMMARY   │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_SENTENCE_PITCH │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_PARAGRAPH_PITCH│ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_PREMISE        │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_STRENGTHS      │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_RISKS          │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_RATIONALE      │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_CONFIDENCE     │ artifact completeness                   │
 * │ COMPLETENESS  │ ECG_ART_MISSING_RECOMMENDATIONS│ artifact completeness                   │
 * │ RENDERER      │ ECG_RENDERER_VERDICT_UNKNOWN   │ renderer contracts                      │
 * │ RENDERER      │ ECG_RENDERER_GENRE_MISSING     │ renderer contracts (advisory)           │
 * │ RENDERER      │ ECG_RENDERER_AUDIENCE_MISSING  │ renderer contracts (advisory)           │
 * │ RENDERER      │ ECG_RENDERER_SCORE_LABEL_MISMATCH│ renderer contracts                   │
 * └───────────────┴───────────────────────────────┴─────────────────────────────────────────┘
 */

import { describe, it, expect } from "@jest/globals";
import {
  runEvaluationCertificationGate,
  buildECGInput,
  trimAtWordBoundary,
  CERTIFICATION_REGISTRY,
  getCertificationCoverage,
  getRegistryEntry,
  getRegistryByDomain,
  type ECGInput,
  type InvariantDomain,
} from "@/lib/evaluation/pipeline/evaluationCertificationGate";
import {
  normalizeArtifact,
  ArtifactTextContractError,
} from "@/lib/evaluation/pipeline/normalizeArtifact";
import { AuthorFacingIntegrityError } from "@/lib/text/authorFacingIntegrity";

// ─────────────────────────────────────────────────────────────────────────────
// ECG_MODE isolation helper
// Controls process.env.ECG_MODE per-test without cross-contamination.
// ─────────────────────────────────────────────────────────────────────────────

function withECGMode(mode: string, fn: () => void) {
  const original = process.env.ECG_MODE;
  process.env.ECG_MODE = mode;
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env.ECG_MODE;
    } else {
      process.env.ECG_MODE = original;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

const CANONICAL_SCORE = 74;

const CLEAN_EXEC_SUMMARY =
  "The manuscript earns a 74/100 on the strength of its Concept & Premise and Character Depth, " +
  "with high marks for the Calvin–Monty dynamic. The author should preserve the sardonic Tonal " +
  "Authority and textured Antwerp worldbuilding. The principal blocker is Pacing & Structural " +
  "Balance, where overlong exposition interrupts momentum. Tightening the mid-chapter expository " +
  "passages should be the first revision priority.";

const CLEAN_SENTENCE_PITCH =
  "A sardonic Antwerp diamond dealer's retirement evening becomes a reckoning with cobalt, " +
  "blood money, and a lifelong friendship.";

const CLEAN_PARAGRAPH_PITCH =
  "Calvin, a burned-out diamond trader, joins his old friend Monty in Antwerp's SkyNooz penthouse " +
  "for a farewell evening that turns into an ultimatum: join a high-stakes cobalt operation in " +
  "the Democratic Republic of Congo, or watch a twenty-five-year friendship dissolve.";

const CLEAN_PREMISE =
  "A burned-out Antwerp diamond trader facing the collapse of his industry lures his cautious " +
  "Canadian friend into a lavish SkyNooz penthouse evening where a risky cobalt job forces them " +
  "to confront how much they will risk for money, status, and friendship.";

function makeCleanInput(overrides: Partial<ECGInput> = {}): ECGInput {
  return {
    canonicalScore: CANONICAL_SCORE,
    overview: {
      overall_score_0_100: CANONICAL_SCORE,
      verdict: "not_market_ready",
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
            "Compress the most repetitive sentences in the mid-chapter diamond and vanity exposition " +
            "so the narrative reaches the GeoCam offer a page sooner without sacrificing the core ideas.",
        },
      ],
      strategic_revisions: [
        {
          action:
            "Introduce one or two small physical beats in the penthouse scene that use the windows " +
            "or Macallan bottle to echo Monty's emotional state whenever the conversation about " +
            "the Democratic Republic of Congo reaches a new turning point.",
        },
      ],
    },
    criteria: [
      {
        key: "concept",
        final_score_0_10: 8,
        final_rationale:
          "The concept linking diamond industry collapse to cobalt mining and personal ethics is fresh.",
      },
      {
        key: "narrativeDrive",
        final_score_0_10: 7,
        final_rationale:
          "Momentum flows through the escalating penthouse conversation but stalls during exposition.",
      },
    ],
    governance: {
      confidence: 0.82,
      confidence_label: "High Confidence",
    },
    ...overrides,
  };
}

/** Deep clone to detect any mutation of input by the gate. */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CERTIFICATION_REGISTRY structural contracts
// ─────────────────────────────────────────────────────────────────────────────

describe("CERTIFICATION_REGISTRY", () => {
  const REQUIRED_DOMAINS: InvariantDomain[] = [
    "AUTHORITY", "IDENTITY", "SUMMARY", "TEXT", "RECOMMEND", "COMPLETENESS", "RENDERER",
  ];

  it("contains at least 29 invariants", () => {
    expect(CERTIFICATION_REGISTRY.length).toBeGreaterThanOrEqual(29);
  });

  it("covers all 7 required domains", () => {
    const domains = new Set(CERTIFICATION_REGISTRY.map(e => e.domain));
    for (const d of REQUIRED_DOMAINS) {
      expect(domains.has(d)).toBe(true);
    }
  });

  it("every entry has all required provenance fields", () => {
    for (const entry of CERTIFICATION_REGISTRY) {
      expect(entry.code).toBeTruthy();
      expect(entry.domain).toBeTruthy();
      expect(entry.severity).toMatch(/^(FATAL|ADVISORY)$/);
      expect(entry.description).toBeTruthy();
      expect(entry.authority).toBeTruthy(); // provenance
      expect(entry.section).toBeTruthy();
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(entry.tags.length).toBeGreaterThan(0);
    }
  });

  it("all codes are unique", () => {
    const codes = CERTIFICATION_REGISTRY.map(e => e.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("all AUTHORITY domain entries have a weighted score authority", () => {
    const authEntries = getRegistryByDomain("AUTHORITY");
    expect(authEntries.length).toBeGreaterThanOrEqual(3);
    for (const entry of authEntries) {
      expect(entry.authority).toMatch(/computeWeightedScore|Pass 1|Pass 2/i);
    }
  });

  it("score mismatch invariants reference the canonical score authority", () => {
    const scoreMismatch = getRegistryEntry("ECG_AUTH_SCORE_MISMATCH");
    expect(scoreMismatch).toBeDefined();
    expect(scoreMismatch!.authority).toContain("computeWeightedScore");
    expect(scoreMismatch!.severity).toBe("FATAL");

    const execMismatch = getRegistryEntry("ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
    expect(execMismatch).toBeDefined();
    expect(execMismatch!.authority).toContain("computeWeightedScore");
    expect(execMismatch!.severity).toBe("FATAL");
  });

  it("getCertificationCoverage() returns non-zero counts for all 7 domains", () => {
    const coverage = getCertificationCoverage();
    for (const domain of REQUIRED_DOMAINS) {
      expect(coverage[domain].total).toBeGreaterThan(0);
    }
  });

  it("COMPLETENESS domain has at least 9 entries covering all required fields", () => {
    const completeness = getRegistryByDomain("COMPLETENESS");
    expect(completeness.length).toBeGreaterThanOrEqual(9);
  });

  it("RENDERER domain declares market_readiness_calculator as authority for verdict", () => {
    const verdictEntry = getRegistryEntry("ECG_RENDERER_VERDICT_UNKNOWN");
    expect(verdictEntry).toBeDefined();
    expect(verdictEntry!.authority).toContain("market_readiness_calculator");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. normalizeArtifact() — cosmetic only, never semantic
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeArtifact()", () => {
  function makeSynthesis(overrides: {
    one_paragraph_summary?: string;
    one_sentence_pitch?: string;
    one_paragraph_pitch?: string;
  } = {}) {
    return {
      overall: {
        one_paragraph_summary: overrides.one_paragraph_summary ?? CLEAN_EXEC_SUMMARY,
        one_sentence_pitch: overrides.one_sentence_pitch ?? CLEAN_SENTENCE_PITCH,
        one_paragraph_pitch: overrides.one_paragraph_pitch ?? CLEAN_PARAGRAPH_PITCH,
      },
      criteria: [
        {
          recommendations: [{ action: "add more tension at the climax." }],
        },
      ],
    };
  }

  it("capitalizes a lowercase recommendation action", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "compress the mid-chapter exposition for better pacing." }];
    const strategicRevisions: Array<{ action?: string }> = [];
    normalizeArtifact(synthesis, quickWins, strategicRevisions);
    expect(quickWins[0].action).toMatch(/^Compress/);
  });

  it("repairs a complete recommendation action that lacks terminal punctuation", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress the mid-chapter exposition for better pacing" }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe("Compress the mid-chapter exposition for better pacing.");
  });

  it("collapses multiple whitespace in a recommendation action", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress  the   exposition." }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe("Compress the exposition.");
  });

  it("rejects one_paragraph_summary with no complete sentence within the 1000-char cap", () => {
    // A single 1100-char token has no sentence boundary, so the sentence-boundary
    // trimmer would fall back to a word-boundary ellipsis. The strict Pass 3
    // wrapper must reject that fallback and fail with a typed contract error
    // instead of emitting an incomplete sentence.
    const longSummary = "The manuscript earns a 74/100 " + "a".repeat(1100);
    const synthesis = makeSynthesis({ one_paragraph_summary: longSummary });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
  });

  it("does NOT alter the score, summary meaning, or pitch text (clean inputs)", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "Compress the mid-chapter exposition for better pacing." }];
    const summaryBefore = synthesis.overall.one_paragraph_summary;
    const pitchBefore = synthesis.overall.one_sentence_pitch;
    normalizeArtifact(synthesis, quickWins, []);
    // Summary and pitch unchanged (already clean)
    expect(synthesis.overall.one_paragraph_summary).toBe(summaryBefore);
    expect(synthesis.overall.one_sentence_pitch).toBe(pitchBefore);
    // Rec action unchanged (already clean — capitalize is already done, punct present)
    expect(quickWins[0].action).toBe("Compress the mid-chapter exposition for better pacing.");
  });

  it("never injects or replaces score values", () => {
    // If summary says 80/100, normalizeArtifact must leave it untouched.
    // The ECG (not normalization) will flag it as a FATAL violation.
    const summaryWithWrongScore =
      "The manuscript earns a solid 80/100 on the strength of its Concept & Premise. " +
      "The principal blocker is Pacing & Structural Balance.";
    const synthesis = makeSynthesis({ one_paragraph_summary: summaryWithWrongScore });
    normalizeArtifact(synthesis, [], []);
    // Score must be exactly as-is — normalization must NOT touch it
    expect(synthesis.overall.one_paragraph_summary).toContain("80/100");
    expect(synthesis.overall.one_paragraph_summary).not.toContain("74/100");
  });

  it("never modifies summary text that is already within 750 chars", () => {
    const synthesis = makeSynthesis();
    const before = synthesis.overall.one_paragraph_summary;
    expect(before.length).toBeLessThan(750);
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(before);
  });

  it("rejects an incomplete recommendation action and does not fabricate terminal punctuation", () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: "compress the exposition because" }]; // dangling connective
    expect(() => normalizeArtifact(synthesis, quickWins, [])).toThrow(AuthorFacingIntegrityError);
    expect(quickWins[0].action).toBe("Compress the exposition because");
  });

  it("does not sentence-trim a summary that is within the technical ceiling", () => {
    const sentence = "The manuscript earns a strong score on its craft. ";
    const longSummary = sentence.repeat(40).trimEnd(); // well under the 10,000-char technical ceiling
    const synthesis = makeSynthesis({ one_paragraph_summary: longSummary });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(longSummary);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ECG does not mutate its input
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — input immutability", () => {
  it("does not mutate a clean input in WARN_ONLY mode", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      const snapshot = deepClone(input);
      runEvaluationCertificationGate(input);
      expect(input).toEqual(snapshot);
    });
  });

  it("does not mutate a clean input in ENFORCE mode", () => {
    withECGMode("ENFORCE", () => {
      const input = makeCleanInput();
      const snapshot = deepClone(input);
      runEvaluationCertificationGate(input);
      expect(input).toEqual(snapshot);
    });
  });

  it("does not mutate input that has fatal violations", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.overall_score_0_100 = 80; // FATAL
      const snapshot = deepClone(input);
      runEvaluationCertificationGate(input);
      // overview.overall_score_0_100 must remain 80 — ECG does not correct it
      expect(input.overview.overall_score_0_100).toBe(80);
      expect(input).toEqual(snapshot);
    });
  });

  it("does not mutate exec summary even when it contains a wrong score", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      const wrongSummary =
        "This manuscript earns a solid 80/100 on the strength of its Concept & Premise. " +
        "The principal blocker is Pacing & Structural Balance. " +
        "Tightening the mid-chapter exposition is the first revision priority.";
      input.overview.one_paragraph_summary = wrongSummary;
      runEvaluationCertificationGate(input);
      // Summary must be exactly unchanged — no score injection
      expect(input.overview.one_paragraph_summary).toBe(wrongSummary);
      expect(input.overview.one_paragraph_summary).toContain("80/100");
      expect(input.overview.one_paragraph_summary).not.toContain("74/100");
    });
  });

  it("does not mutate recommendation actions", () => {
    withECGMode("WARN_ONLY", () => {
      const lowercaseAction =
        "add one concrete resolution beat that closes the dangling thread for Narrative Closure.";
      const input = makeCleanInput();
      input.recommendations!.quick_wins = [{ action: lowercaseAction }];
      runEvaluationCertificationGate(input);
      // Must not capitalize — that is normalizeArtifact()'s job, not ECG's
      expect(input.recommendations!.quick_wins![0].action).toBe(lowercaseAction);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ECG_MODE=WARN_ONLY
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG_MODE=WARN_ONLY", () => {
  it("returns CERTIFIED even when fatal violations are present", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.overall_score_0_100 = 80; // FATAL
      const result = runEvaluationCertificationGate(input);
      expect(result.status).toBe("CERTIFIED");
      expect(result.mode).toBe("WARN_ONLY");
    });
  });

  it("populates fatal[] with all FATAL violations found", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.overall_score_0_100 = 80; // ECG_AUTH_SCORE_MISMATCH
      const result = runEvaluationCertificationGate(input);
      expect(result.fatal.length).toBeGreaterThan(0);
      expect(result.fatal.map(v => v.code)).toContain("ECG_AUTH_SCORE_MISMATCH");
    });
  });

  it("summary string contains WARN_ONLY and violation codes", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.overall_score_0_100 = 80;
      const result = runEvaluationCertificationGate(input);
      expect(result.summary).toContain("WARN_ONLY");
      expect(result.summary).toContain("ECG_AUTH_SCORE_MISMATCH");
    });
  });

  it("returns CERTIFIED with zero violations on a clean artifact", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      const result = runEvaluationCertificationGate(input);
      expect(result.status).toBe("CERTIFIED");
      expect(result.fatal).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ECG_MODE=ENFORCE
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG_MODE=ENFORCE", () => {
  it("returns CERTIFICATION_FAILED when fatal violations are present", () => {
    withECGMode("ENFORCE", () => {
      const input = makeCleanInput();
      input.overview.overall_score_0_100 = 80; // FATAL
      const result = runEvaluationCertificationGate(input);
      expect(result.status).toBe("CERTIFICATION_FAILED");
      expect(result.mode).toBe("ENFORCE");
    });
  });

  it("returns CERTIFIED when no fatal violations exist (clean artifact)", () => {
    withECGMode("ENFORCE", () => {
      const input = makeCleanInput();
      const result = runEvaluationCertificationGate(input);
      expect(result.status).toBe("CERTIFIED");
      expect(result.fatal).toHaveLength(0);
    });
  });

  it("summary names the failing codes", () => {
    withECGMode("ENFORCE", () => {
      const input = makeCleanInput();
      input.overview.overall_score_0_100 = 80;
      const result = runEvaluationCertificationGate(input);
      expect(result.summary).toContain("ECG_AUTH_SCORE_MISMATCH");
      expect(result.summary).toContain("CERTIFICATION_FAILED");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ECG_MODE=OFF
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG_MODE=OFF", () => {
  it("returns SKIPPED immediately without running any checks", () => {
    withECGMode("OFF", () => {
      const input = makeCleanInput();
      // Deliberately corrupt the input
      input.overview.overall_score_0_100 = 0;
      input.overview.one_paragraph_summary = "";
      input.recommendations = { quick_wins: [], strategic_revisions: [] };
      const result = runEvaluationCertificationGate(input);
      expect(result.status).toBe("SKIPPED");
      expect(result.violations).toHaveLength(0);
      expect(result.fatal).toHaveLength(0);
    });
  });

  it("mode field reflects OFF", () => {
    withECGMode("OFF", () => {
      const input = makeCleanInput();
      const result = runEvaluationCertificationGate(input);
      expect(result.mode).toBe("OFF");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Score mismatch: diagnostic only, never repaired
// ─────────────────────────────────────────────────────────────────────────────

describe("Score mismatch — diagnostic only, never repaired", () => {
  const WRONG_SUMMARY =
    "This manuscript earns a solid 80/100 on the strength of its Concept & Core Premise and " +
    "Character Depth, with especially high marks for the Calvin–Monty dynamic. " +
    "The principal blocker is Pacing & Structural Balance. " +
    "Tightening the mid-chapter exposition is the first revision priority.";

  it("FATAL in WARN_ONLY mode when exec summary says 80 but canonical score is 74", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.one_paragraph_summary = WRONG_SUMMARY;
      const result = runEvaluationCertificationGate(input);
      expect(result.fatal.map(v => v.code)).toContain("ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
      // But in WARN_ONLY, still CERTIFIED
      expect(result.status).toBe("CERTIFIED");
    });
  });

  it("FATAL in ENFORCE mode when exec summary says 80 but canonical score is 74", () => {
    withECGMode("ENFORCE", () => {
      const input = makeCleanInput();
      input.overview.one_paragraph_summary = WRONG_SUMMARY;
      const result = runEvaluationCertificationGate(input);
      expect(result.fatal.map(v => v.code)).toContain("ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
      expect(result.status).toBe("CERTIFICATION_FAILED");
    });
  });

  it("exec summary text is UNCHANGED after gate runs — no 80→74 replacement", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.one_paragraph_summary = WRONG_SUMMARY;
      runEvaluationCertificationGate(input);
      // Text must be exactly as-is — ECG never patches content
      expect(input.overview.one_paragraph_summary).toBe(WRONG_SUMMARY);
      expect(input.overview.one_paragraph_summary).toContain("80/100");
      expect(input.overview.one_paragraph_summary).not.toContain("74/100");
    });
  });

  it("passes when exec summary contains the canonical score correctly", () => {
    withECGMode("ENFORCE", () => {
      const input = makeCleanInput(); // summary already has "74/100"
      const result = runEvaluationCertificationGate(input);
      const scoreCodes = result.fatal.map(v => v.code).filter(c => c.includes("SCORE"));
      expect(scoreCodes).toHaveLength(0);
    });
  });

  it("violation message names both the wrong score and the canonical score", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.one_paragraph_summary = WRONG_SUMMARY;
      const result = runEvaluationCertificationGate(input);
      const v = result.fatal.find(v => v.code === "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
      expect(v).toBeDefined();
      expect(v!.message).toContain("80");
      expect(v!.message).toContain("74");
    });
  });

  it("violation has the correct provenance authority (computeWeightedScore)", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      input.overview.one_paragraph_summary = WRONG_SUMMARY;
      const result = runEvaluationCertificationGate(input);
      const v = result.fatal.find(v => v.code === "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
      expect(v!.authority).toContain("computeWeightedScore");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Individual invariant coverage — all 29 codes triggered
// ─────────────────────────────────────────────────────────────────────────────

describe("ECG — individual invariant coverage", () => {
  function runWarn(input: ECGInput) {
    process.env.ECG_MODE = "WARN_ONLY";
    const result = runEvaluationCertificationGate(input);
    return result;
  }

  it("ECG_AUTH_SCORE_MISMATCH", () => {
    const input = makeCleanInput();
    input.overview.overall_score_0_100 = 80;
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_AUTH_SCORE_MISMATCH");
  });

  it("ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "A solid 80/100 score reflects strong Concept & Premise. Revision should focus on pacing and narrative drive.";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
  });

  it("ECG_AUTH_CRITERION_SCORE_RANGE", () => {
    const input = makeCleanInput();
    input.criteria = [{ key: "concept", final_score_0_10: 11, final_rationale: "Strong." }];
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_AUTH_CRITERION_SCORE_RANGE");
  });

  it("ECG_IDENT_PITCH_DUPLICATION", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = CLEAN_PARAGRAPH_PITCH; // same as paragraph pitch
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_IDENT_PITCH_DUPLICATION");
  });

  it("ECG_IDENT_PITCH_SUMMARY_OVERLAP", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = CLEAN_EXEC_SUMMARY; // overlaps summary
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_IDENT_PITCH_SUMMARY_OVERLAP");
  });

  it("ECG_IDENT_PITCH_PREMISE_OVERLAP", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_pitch = CLEAN_PREMISE; // same as premise
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_IDENT_PITCH_PREMISE_OVERLAP");
  });

  it("ECG_EXEC_MISSING", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary = "";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_EXEC_MISSING");
  });

  it("ECG_EXEC_PITCH_LANGUAGE", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "This manuscript is a must-read page-turner that will grab readers from the first page. " +
      "The narrative craft is exceptional and the character voice is distinctive throughout.";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_EXEC_PITCH_LANGUAGE");
  });

  it("ECG_EXEC_NO_EVAL_LANGUAGE", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "Calvin and Monty spend an evening in Antwerp discussing the diamond trade. " +
      "Their friendship feels authentic. The Antwerp setting is atmospheric and detailed. " +
      "The ending leaves something to be desired but overall the writing is pleasant.";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_EXEC_NO_EVAL_LANGUAGE");
  });

  it("ECG_EXEC_SCORE_ABSENT (advisory — does not block)", () => {
    withECGMode("WARN_ONLY", () => {
      const input = makeCleanInput();
      // Remove score reference from summary
      input.overview.one_paragraph_summary =
        "The manuscript scores well on its Concept & Premise and Character Depth, " +
        "with high marks for the Calvin–Monty dynamic. The author should preserve the " +
        "sardonic tonal authority. The principal blocker is Pacing & Structural Balance. " +
        "Tightening the mid-chapter exposition should be the first revision priority.";
      const result = runEvaluationCertificationGate(input);
      const v = result.advisory.find(v => v.code === "ECG_EXEC_SCORE_ABSENT");
      expect(v).toBeDefined();
      // Advisory — never fatal
      expect(result.fatal.map(v => v.code)).not.toContain("ECG_EXEC_SCORE_ABSENT");
    });
  });

  it("ECG_TEXT_TRUNCATED_WORD", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary =
      "The manuscript earns a 74/100 on the strength of its Concept & Premise. " +
      "The principal blocker is Pacing & Structural Balance, where overlong exposition occasiona";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_TEXT_TRUNCATED_WORD");
  });

  it("ECG_TEXT_PLACEHOLDER", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = "[insert one-sentence pitch here]";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_TEXT_PLACEHOLDER");
  });

  it("ECG_REC_TOO_SHORT", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [{ action: "Fix pacing." }];
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_REC_TOO_SHORT");
  });

  it("ECG_REC_PLACEHOLDER", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [
      { action: "[insert actionable recommendation about pacing and exposition here for criterion]" },
    ];
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_REC_PLACEHOLDER");
  });

  it("ECG_REC_LOWERCASE_START (advisory)", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [
      {
        action:
          "add one concrete resolution beat that closes the dangling thread and signals " +
          "consequence to the reader, reducing the feeling of unresolved narrative tension.",
      },
    ];
    const { advisory } = runWarn(input);
    expect(advisory.map(v => v.code)).toContain("ECG_REC_LOWERCASE_START");
  });

  it("ECG_REC_MISSING_TERMINAL_PUNCT (advisory)", () => {
    const input = makeCleanInput();
    input.recommendations!.quick_wins = [
      {
        action:
          "Compress the most repetitive sentences in the mid-chapter diamond and vanity exposition " +
          "so the narrative reaches the GeoCam offer a page sooner without sacrificing the core ideas",
      },
    ];
    const { advisory } = runWarn(input);
    expect(advisory.map(v => v.code)).toContain("ECG_REC_MISSING_TERMINAL_PUNCT");
  });

  it("ECG_ART_MISSING_EXEC_SUMMARY", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_summary = "";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_EXEC_SUMMARY");
  });

  it("ECG_ART_MISSING_SENTENCE_PITCH", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch = "";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_SENTENCE_PITCH");
  });

  it("ECG_ART_MISSING_PARAGRAPH_PITCH", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_pitch = "";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_PARAGRAPH_PITCH");
  });

  it("ECG_ART_MISSING_PREMISE", () => {
    const input = makeCleanInput();
    input.enrichment!.premise = "";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_PREMISE");
  });

  it("ECG_ART_MISSING_STRENGTHS", () => {
    const input = makeCleanInput();
    input.overview.top_3_strengths = [];
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_STRENGTHS");
  });

  it("ECG_ART_MISSING_RISKS", () => {
    const input = makeCleanInput();
    input.overview.top_3_risks = [];
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_RISKS");
  });

  it("ECG_ART_MISSING_RATIONALE", () => {
    const input = makeCleanInput();
    input.criteria = [{ key: "concept", final_score_0_10: 8, final_rationale: "" }];
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_RATIONALE");
  });

  it("ECG_ART_MISSING_CONFIDENCE", () => {
    const input = makeCleanInput();
    input.governance = { confidence: undefined, confidence_label: "High Confidence" };
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_CONFIDENCE");
  });

  it("ECG_ART_MISSING_RECOMMENDATIONS", () => {
    const input = makeCleanInput();
    input.recommendations = { quick_wins: [], strategic_revisions: [] };
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_ART_MISSING_RECOMMENDATIONS");
  });

  it("ECG_RENDERER_VERDICT_UNKNOWN", () => {
    const input = makeCleanInput();
    input.overview.verdict = "unknown_verdict_string";
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_RENDERER_VERDICT_UNKNOWN");
  });

  it("ECG_RENDERER_GENRE_MISSING (advisory)", () => {
    const input = makeCleanInput();
    input.enrichment!.diagnosed_genre = "";
    const { advisory } = runWarn(input);
    expect(advisory.map(v => v.code)).toContain("ECG_RENDERER_GENRE_MISSING");
  });

  it("ECG_RENDERER_AUDIENCE_MISSING (advisory)", () => {
    const input = makeCleanInput();
    input.enrichment!.target_audience = "";
    const { advisory } = runWarn(input);
    expect(advisory.map(v => v.code)).toContain("ECG_RENDERER_AUDIENCE_MISSING");
  });

  it("ECG_RENDERER_SCORE_LABEL_MISMATCH", () => {
    const input = makeCleanInput();
    input.governance = { confidence: 0.82, confidence_label: "" };
    const { violations } = runWarn(input);
    expect(violations.map(v => v.code)).toContain("ECG_RENDERER_SCORE_LABEL_MISMATCH");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy-Polish defect fixtures (A1, A2, mid-sentence invariant)
// Exact source strings from the Copy-Polish brief drive these.
// ─────────────────────────────────────────────────────────────────────────────

describe("Copy-Polish defect fixtures", () => {
  function runWarn(input: ECGInput) {
    process.env.ECG_MODE = "WARN_ONLY";
    return runEvaluationCertificationGate(input);
  }

  // A1 — prose "64/100" vs canonical 68. The floor policy is LAW: "always round
  // DOWN — never inflate." A prose score BELOW canonical is still a mismatch the
  // author must not see, but it is NOT inflation and must never be reconciled up.
  it("A1: flags a 64-vs-68 divergence without inflating", () => {
    const input = makeCleanInput({
      canonicalScore: 68,
      overview: {
        ...makeCleanInput().overview,
        overall_score_0_100: 68,
        one_paragraph_summary:
          "This excerpt earns a 64/100 on the strength of its premise and Character Depth. " +
          "The principal blocker is Pacing & Structural Balance, where overlong exposition " +
          "interrupts narrative momentum before the mid-chapter reveal.",
      },
    });
    const result = runWarn(input);
    const v = result.fatal.find(v => v.code === "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
    expect(v).toBeDefined();
    // Names both the prose score and the canonical score.
    expect(v!.message).toContain("64");
    expect(v!.message).toContain("68");
    // Floor policy honored: a below-canonical prose score is NOT inflation.
    // The gate must not describe it as EXCEEDING canonical and must direct a
    // downward reconciliation only.
    expect(v!.message).not.toMatch(/EXCEEDS/);
    expect(v!.message.toLowerCase()).toContain("never inflate");
  });

  // A1 inverse — an ABOVE-canonical prose score is inflation and must be named.
  it("A1: flags inflation when prose EXCEEDS canonical", () => {
    const input = makeCleanInput({
      canonicalScore: 68,
      overview: {
        ...makeCleanInput().overview,
        overall_score_0_100: 68,
        one_paragraph_summary:
          "This excerpt earns a 72/100 on the strength of its premise and Character Depth. " +
          "The principal blocker is Pacing & Structural Balance, where overlong exposition " +
          "interrupts narrative momentum before the mid-chapter reveal.",
      },
    });
    const result = runWarn(input);
    const v = result.fatal.find(v => v.code === "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH");
    expect(v).toBeDefined();
    expect(v!.message).toMatch(/EXCEEDS/);
  });

  // Global invariant: no author-facing full-sentence prose may end mid-sentence.
  it("mid-sentence: flags a pitch ending on a dangling connective", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch =
      "A sardonic Antwerp diamond dealer confronts a reckoning with blood money because";
    const result = runWarn(input);
    expect(result.fatal.map(v => v.code)).toContain("ECG_TEXT_MIDSENTENCE_TERMINATION");
  });

  it("mid-sentence: flags a premise ending on a comma", () => {
    const input = makeCleanInput();
    input.enrichment!.premise =
      "A burned-out Antwerp diamond trader lures his cautious Canadian friend into a lavish evening,";
    const result = runWarn(input);
    expect(result.fatal.map(v => v.code)).toContain("ECG_TEXT_MIDSENTENCE_TERMINATION");
  });

  it("mid-sentence: a complete pitch does NOT trigger the invariant", () => {
    const input = makeCleanInput(); // clean pitches end with a period
    const result = runWarn(input);
    expect(result.fatal.map(v => v.code)).not.toContain("ECG_TEXT_MIDSENTENCE_TERMINATION");
  });

  // A2 — a raw fallback sentinel pitch must be treated as ABSENT, never certified
  // as satisfied, so it can be regenerated/suppressed rather than leaked.
  it("A2: treats a raw market-hook fallback sentinel as a missing pitch", () => {
    const input = makeCleanInput();
    input.overview.one_sentence_pitch =
      "A distinct market hook was not generated for Criminality.";
    const result = runWarn(input);
    expect(result.violations.map(v => v.code)).toContain("ECG_ART_MISSING_SENTENCE_PITCH");
  });

  it("A2: treats a raw story-synopsis fallback sentinel as a missing paragraph pitch", () => {
    const input = makeCleanInput();
    input.overview.one_paragraph_pitch =
      "A distinct story synopsis was not generated.";
    const result = runWarn(input);
    expect(result.violations.map(v => v.code)).toContain("ECG_ART_MISSING_PARAGRAPH_PITCH");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trimAtWordBoundary (shared utility)
// ─────────────────────────────────────────────────────────────────────────────

describe("trimAtWordBoundary()", () => {
  it("returns original when under limit", () => {
    expect(trimAtWordBoundary("Short text.", 100)).toBe("Short text.");
  });

  it("trims at a word boundary and appends ellipsis", () => {
    const text = "The manuscript earns a solid score on the strength of its Concept and Character Depth.";
    const trimmed = trimAtWordBoundary(text, 50);
    expect(trimmed.endsWith("…")).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(50);
    // No mid-word cut: the final token before the ellipsis must be a COMPLETE
    // word from the source. (A correct word-boundary trim legitimately ends on
    // a letter, so we assert token completeness, not "no trailing letter".)
    const body = trimmed.slice(0, -1).trimEnd();
    const lastToken = body.split(/\s+/).pop() ?? "";
    const sourceTokens = new Set(text.split(/\s+/));
    expect(sourceTokens.has(lastToken)).toBe(true);
  });

  it("never produces a mid-word cut on a realistic 750-char boundary", () => {
    const text = "a".repeat(200) + " The manuscript earns" + " extraword".repeat(60);
    const trimmed = trimAtWordBoundary(text, 750);
    expect(trimmed.length).toBeLessThanOrEqual(750);
    // The last real char before ellipsis should be a space-trimmed word end, not mid-alpha
    const body = trimmed.slice(0, -1).trimEnd();
    // Must not end on a vowel-only fragment like "occasiona"
    expect(body).not.toMatch(/[aeiou]{2,}$/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildECGInput
// ─────────────────────────────────────────────────────────────────────────────

describe("buildECGInput()", () => {
  it("sets canonicalScore correctly", () => {
    const input = buildECGInput({ overview: { overall_score_0_100: 74 } }, 74);
    expect(input.canonicalScore).toBe(74);
  });

  it("handles missing optional fields gracefully", () => {
    const input = buildECGInput({}, 74);
    expect(input.canonicalScore).toBe(74);
    expect(input.overview).toEqual({});
    expect(input.enrichment).toBeNull();
    expect(input.criteria).toBeNull();
  });
});
