/**
 * duplicateChapterDetector.test.ts
 *
 * Tests for issue #542 — detect and flag duplicate chapter content before chunking.
 */

import {
  detectDuplicateChapters,
  SectionBlock,
} from "@/lib/manuscripts/duplicateChapterDetector";

function makeSection(index: number, title: string, content: string, charOffset = 0): SectionBlock {
  return { index, title, charOffset, content };
}

describe("detectDuplicateChapters", () => {
  it("returns empty for no sections", () => {
    const result = detectDuplicateChapters([]);
    expect(result.duplicates).toHaveLength(0);
    expect(result.skipIndices.size).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns empty for a single section", () => {
    const result = detectDuplicateChapters([
      makeSection(0, "Chapter 1", "Some unique content for this chapter."),
    ]);
    expect(result.duplicates).toHaveLength(0);
  });

  it("detects exact duplicate chapters", () => {
    const prose = "The morning sun crept over the rooftops as Maria prepared for another day at the factory. ".repeat(50);
    const sections: SectionBlock[] = [
      makeSection(0, "Chapter 1 – Dawn", prose, 0),
      makeSection(1, "Chapter 2 – Midday", "Unique content for chapter two. ".repeat(50), 5000),
      makeSection(2, "Chapter 3 – Canvas Morning", prose, 10000), // Exact dupe of ch 1
    ];

    const result = detectDuplicateChapters(sections);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].type).toBe("exact");
    expect(result.duplicates[0].similarity).toBe(1.0);
    expect(result.duplicates[0].sectionA.index).toBe(0);
    expect(result.duplicates[0].sectionB.index).toBe(2);
    expect(result.skipIndices.has(2)).toBe(true);
    expect(result.skipIndices.has(0)).toBe(false);
    expect(result.warnings[0].code).toBe("DUPLICATE_CHAPTER_CONTENT");
    expect(result.warnings[0].message).toContain("Chapter 3");
    expect(result.warnings[0].message).toContain("duplicate of Chapter 1");
  });

  it("detects near-duplicate chapters (≥95% Jaccard)", () => {
    // Generate non-repetitive text with many unique 6-grams by using sequential numbering.
    const longBase = Array.from({ length: 600 }, (_, i) =>
      `sentence number ${i} describes event ${i * 7} at location ${i % 50}`,
    ).join(" ");
    // Near-dupe: change only 2 words out of ~4200 — well under 5% shingle difference.
    const words = longBase.split(" ");
    const modified = [...words];
    modified[100] = "MODIFIED";
    modified[500] = "ALTERED";
    const nearDupe = modified.join(" ");

    const sections: SectionBlock[] = [
      makeSection(0, "Chapter 4", longBase, 0),
      makeSection(1, "Chapter 5", "Completely different content about something else entirely. ".repeat(100), 50000),
      makeSection(2, "Chapter 16", nearDupe, 100000),
    ];

    const result = detectDuplicateChapters(sections);
    // Should detect the near-duplicate pair.
    const nearDupes = result.duplicates.filter((d) => d.type === "near_duplicate");
    expect(nearDupes.length).toBeGreaterThanOrEqual(1);
    expect(nearDupes[0].similarity).toBeGreaterThanOrEqual(0.95);
    expect(nearDupes[0].sectionA.index).toBe(0);
    expect(nearDupes[0].sectionB.index).toBe(2);
    // Near-dupes are NOT skipped, only flagged.
    expect(result.skipIndices.has(2)).toBe(false);
    const nearWarn = result.warnings.find((w) => w.code === "NEAR_DUPLICATE_CHAPTER_CONTENT");
    expect(nearWarn).toBeDefined();
  });

  it("does not flag dissimilar chapters", () => {
    const sections: SectionBlock[] = [
      makeSection(0, "Chapter 1", "Alpha content about the mountain expedition. ".repeat(100), 0),
      makeSection(1, "Chapter 2", "Beta content describing the underwater cave exploration. ".repeat(100), 5000),
      makeSection(2, "Chapter 3", "Gamma narrative covering the desert crossing at midnight. ".repeat(100), 10000),
    ];

    const result = detectDuplicateChapters(sections);
    expect(result.duplicates).toHaveLength(0);
    expect(result.skipIndices.size).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles whitespace normalization for fingerprinting", () => {
    const base = "The detective looked at the evidence scattered across the desk. ".repeat(50);
    // Add extra whitespace between words — same words, different spacing.
    const withExtraSpaces = base.replace(/ /g, "   ");

    const sections: SectionBlock[] = [
      makeSection(0, "Ch 1", base, 0),
      makeSection(1, "Ch 2", withExtraSpaces, 5000),
    ];

    const result = detectDuplicateChapters(sections);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].type).toBe("exact");
  });

  it("skips near-dupe check for very short sections", () => {
    // Sections under 500 chars should not trigger near-dupe detection.
    const shortContent = "Brief intro.";
    const sections: SectionBlock[] = [
      makeSection(0, "Preface", shortContent, 0),
      makeSection(1, "Dedication", shortContent, 100),
    ];

    const result = detectDuplicateChapters(sections);
    // Still catches exact match via fingerprint.
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].type).toBe("exact");
  });

  it("performance: handles 40 chapters within CI budget", () => {
    // Budget is 500ms — generous enough to absorb CI runner load variance
    // while still catching a genuine O(n²) regression (which would take ~5-10s).
    // Local baseline: ~55ms. CI worst-case observed: ~106ms.
    const PERFORMANCE_BUDGET_MS = 500;
    const sections = Array.from({ length: 40 }, (_, i) =>
      makeSection(i, `Chapter ${i + 1}`, `Unique narrative content for chapter ${i + 1}. `.repeat(500), i * 10000),
    );

    const start = performance.now();
    const result = detectDuplicateChapters(sections);
    const elapsed = performance.now() - start;

    expect(result.duplicates).toHaveLength(0);
    expect(elapsed).toBeLessThan(PERFORMANCE_BUDGET_MS);
  });
});
