/**
 * Regression tests: confidence badges must never appear on absent/fallback data.
 *
 * Proves these strings never render in report output:
 *   - "Tentative:Not available"
 *   - "Tentative: Not available"
 *   - "Not specified Low Confidence"
 *   - "Not available Low Confidence"
 *
 * And proves the positive case still works:
 *   - "Tentative:" shown only when audience is real inferred data.
 */
import {
  buildShortFormEvaluationDocument,
  type ShortFormResultLike,
} from "@/lib/evaluation/shortFormReportDocument";

// ── Helpers ──────────────────────────────────────────────────────────────────

function minimalResult(overrides: Partial<ShortFormResultLike> = {}): ShortFormResultLike {
  return {
    generated_at: "2026-06-09T12:00:00Z",
    overview: { overall_score_0_100: 55, verdict: "Not Market Ready" },
    criteria: [],
    ...overrides,
  };
}

// ── Negative cases: forbidden strings must never appear ──────────────────────

describe("confidence badge regression — absent/fallback data", () => {
  test("no 'Tentative:' prefix when audience is null/absent", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: { manuscript: { word_count: 2000, genre: "Fiction", target_audience: undefined } },
      }),
      displayTitle: "Test Manuscript",
    });

    expect(doc.titleBlock.audienceTentative).toBe(false);
    expect(doc.titleBlock.targetAudience).not.toContain("Tentative");
  });

  test("no 'Tentative:' prefix when audience resolves to 'Adult Readers' fallback", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: { manuscript: { word_count: 2000, genre: "Mystery" } },
      }),
      displayTitle: "Test Manuscript",
    });

    // "Adult Readers" is the clean() fallback — should suppress tentative
    expect(doc.titleBlock.audienceTentative).toBe(false);
  });

  test("no 'Tentative: Not available' ever produced", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: { manuscript: { word_count: 500, target_audience: "Not available" } },
      }),
      displayTitle: "Test Manuscript",
    });

    expect(doc.titleBlock.audienceTentative).toBe(false);
    // Ensure the rendered combination never occurs
    const rendered = `${doc.titleBlock.audienceTentative ? "Tentative: " : ""}${doc.titleBlock.targetAudience}`;
    expect(rendered).not.toContain("Tentative:");
    expect(rendered).not.toContain("Tentative:Not available");
    expect(rendered).not.toContain("Tentative: Not available");
  });

  test("no genre confidence badge when genre is 'Not specified'", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: { manuscript: { word_count: 3000, genre: "Not specified" } },
      }),
      displayTitle: "Test Manuscript",
    });

    expect(doc.titleBlock.genreConfidenceLabel).toBeNull();
    expect(doc.titleBlock.genre).toBe("Not specified");
  });

  test("no genre confidence badge when genre is empty/null", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: { manuscript: { word_count: 10000, genre: undefined } },
      }),
      displayTitle: "Test Manuscript",
    });

    expect(doc.titleBlock.genreConfidenceLabel).toBeNull();
  });

  test("no genre confidence badge when genre is 'Not available'", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: { manuscript: { word_count: 5000, genre: "Not available" } },
      }),
      displayTitle: "Test Manuscript",
    });

    expect(doc.titleBlock.genreConfidenceLabel).toBeNull();
  });

  test("rendered report text never contains forbidden combinations", () => {
    // Simulate the download route rendering for multiple fallback cases
    const fallbackCases = [
      { genre: undefined, target_audience: undefined, word_count: 2000 },
      { genre: "Not specified", target_audience: "Not available", word_count: 500 },
      { genre: "", target_audience: "", word_count: 1000 },
    ];

    for (const metrics of fallbackCases) {
      const doc = buildShortFormEvaluationDocument({
        result: minimalResult({ metrics: { manuscript: metrics } }),
        displayTitle: "Test",
      });

      // Simulate TXT rendering (line 1048 of download route)
      const audiencePrefix = doc.titleBlock.audienceTentative ? "Tentative: " : "";
      const audienceLine = `Target Audience: ${audiencePrefix}${doc.titleBlock.targetAudience} (${doc.titleBlock.audienceConfidenceLabel})`;

      expect(audienceLine).not.toContain("Tentative:Not available");
      expect(audienceLine).not.toContain("Tentative: Not available");
      expect(audienceLine).not.toContain("Tentative: Adult Readers");

      // Genre line
      const genreConf = doc.titleBlock.genreConfidenceLabel ? ` (${doc.titleBlock.genreConfidenceLabel})` : "";
      const genreLine = `Genre: ${doc.titleBlock.genre}${genreConf}`;

      expect(genreLine).not.toContain("Not specified Low Confidence");
      expect(genreLine).not.toContain("Not specified (Low Confidence)");
      expect(genreLine).not.toContain("Not available Low Confidence");
      expect(genreLine).not.toContain("Not available (Low Confidence)");
    }
  });
});

// ── Positive cases: badges appear on real inferred data ──────────────────────

describe("confidence badge regression — real inferred data", () => {
  test("'Tentative:' shown when audience is real inferred value at low word count", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: {
          manuscript: {
            word_count: 2000,
            genre: "Upmarket Suspense",
            target_audience: "Adult literary readers aged 25-45",
          },
        },
      }),
      displayTitle: "Test Manuscript",
    });

    // Real audience + low word count → tentative is true
    expect(doc.titleBlock.audienceTentative).toBe(true);
    expect(doc.titleBlock.targetAudience).toBe("Adult literary readers aged 25-45");

    const rendered = `${doc.titleBlock.audienceTentative ? "Tentative: " : ""}${doc.titleBlock.targetAudience}`;
    expect(rendered).toBe("Tentative: Adult literary readers aged 25-45");
  });

  test("no 'Tentative:' when word count is high enough (>5000)", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: {
          manuscript: {
            word_count: 6000,
            genre: "Thriller",
            target_audience: "Adult readers of commercial thrillers",
          },
        },
      }),
      displayTitle: "Test Manuscript",
    });

    // High word count → not tentative regardless of audience value
    expect(doc.titleBlock.audienceTentative).toBe(false);
  });

  test("genre confidence badge shown when genre is real inferred value", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: {
          manuscript: {
            word_count: 5000,
            genre: "Literary Fiction",
            target_audience: "Adult readers",
          },
        },
      }),
      displayTitle: "Test Manuscript",
    });

    // Real genre + sufficient word count → badge appears
    expect(doc.titleBlock.genreConfidenceLabel).not.toBeNull();
    expect(doc.titleBlock.genre).toBe("Literary Fiction");
  });

  test("genre confidence badge shown with Low Confidence at smaller word counts", () => {
    const doc = buildShortFormEvaluationDocument({
      result: minimalResult({
        metrics: {
          manuscript: {
            word_count: 2000,
            genre: "Romance",
          },
        },
      }),
      displayTitle: "Test Manuscript",
    });

    // Real genre at low word count → Low Confidence badge present
    expect(doc.titleBlock.genreConfidenceLabel).toBe("Low Confidence");
    expect(doc.titleBlock.genre).toBe("Romance");
  });
});

// ── Progress copy regression ─────────────────────────────────────────────────

describe("progress copy regression", () => {
  test("no reference to 'thirteen evaluation criteria' in poller display", async () => {
    // Read the source file and ensure the old copy is gone
    const fs = await import("fs");
    const pollerSource = fs.readFileSync(
      require.resolve("@/components/evaluation-poller-display"),
      "utf8",
    );

    expect(pollerSource).not.toContain("thirteen evaluation criteria");
    expect(pollerSource).toContain("RevisionGrade is analyzing the manuscript");
  });
});
