/**
 * chunking.toc.test.ts
 *
 * Regression tests for issue #382 — chunker over-segmentation on Table-of-Contents
 * (TOC) regions that emit chapter-pattern lines packed close together.
 *
 * Three layered defenses are exercised here:
 *   1. TOC region detection — dense chapter-pattern run with short interlines is
 *      excluded from boundaries.
 *   2. Chapter-line strictness — a chapter line followed only by another
 *      chapter line (no substantive prose) is not a boundary.
 *   3. Min-segment-merge invariant + tail rebalance — no chunk shorter than
 *      `minChars` except when the entire manuscript is shorter than minChars.
 *
 * A negative regression test (Pandoc-style fixture) confirms the fix does not
 * break the existing working ingestion path.
 */

import * as fs from "fs";
import * as path from "path";
import { chunkManuscript } from "@/lib/manuscripts/chunking";

const FIXTURE_TOC_PROD = path.resolve(
  __dirname,
  "../../fixtures/chunking/toc_production_format.md",
);

function summarizeSizes(chunks: { char_start: number; char_end: number }[]) {
  const sizes = chunks.map((c) => c.char_end - c.char_start).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  return {
    count: sizes.length,
    min: sizes[0] ?? 0,
    median: median ?? 0,
    max: sizes[sizes.length - 1] ?? 0,
    underMinChars: sizes.filter((s) => s < 3000).length,
    under200: sizes.filter((s) => s < 200).length,
  };
}

describe("chunkManuscript — TOC awareness (issue #382)", () => {
  it("production-format TOC fixture: no over-segmentation", async () => {
    expect(fs.existsSync(FIXTURE_TOC_PROD)).toBe(true);
    const text = fs.readFileSync(FIXTURE_TOC_PROD, "utf8");
    const chunks = await chunkManuscript(text);
    const s = summarizeSizes(chunks);

    // Fixture is ~324k chars, ~55k words, 37 TOC entries + 37 real chapters.
    // Pre-fix produced 76 chunks with 37 of them at 34 chars apiece.
    // Post-fix should be roughly one chunk per chapter, each ~minChars-maxChars.
    expect(s.count).toBeGreaterThanOrEqual(20);
    expect(s.count).toBeLessThanOrEqual(80);
    expect(s.min).toBeGreaterThanOrEqual(3000); // min-segment-merge invariant
    expect(s.median).toBeGreaterThanOrEqual(3000);
    expect(s.under200).toBe(0);
    expect(s.underMinChars).toBe(0);
  });

  it("min-segment-merge invariant: never emits sub-minChars chunks (synthetic dense TOC)", async () => {
    // Synthetic small fixture: TOC of 6 packed chapter lines, then real
    // chapters with substantive prose.
    const toc =
      "Table of Contents\n\n" +
      "Chapter 1 – Alpha\t1\n" +
      "Chapter 2 – Beta\t10\n" +
      "Chapter 3 – Gamma\t20\n" +
      "Chapter 4 – Delta\t30\n" +
      "Chapter 5 – Epsilon\t40\n" +
      "Chapter 6 – Zeta\t50\n\n";
    const prose = "The river is patient. It waits, then takes. ".repeat(200);
    const body = [1, 2, 3, 4, 5, 6]
      .map((i) => `\nChapter ${i} – Real Heading ${i}\n\n${prose}\n\n`)
      .join("");
    const text = toc + body;

    const chunks = await chunkManuscript(text);
    const s = summarizeSizes(chunks);

    expect(s.under200).toBe(0);
    expect(s.underMinChars).toBe(0);
    // Should NOT have one chunk per TOC entry (was 6+ pre-fix).
    expect(s.count).toBeLessThan(20);
  });

  it("chapter strictness: a chapter line followed only by another chapter line is not a boundary", async () => {
    // Two chapter-pattern lines in a row, then prose. Without strictness,
    // both become boundaries, creating a tiny segment between them.
    const text =
      "Front matter line 1.\n\n" +
      "Chapter 1 – Alpha\n" +
      "Chapter 2 – Beta\n\n" +
      ("Substantive prose text here. ".repeat(500)) +
      "\n\n" +
      "Chapter 3 – Gamma\n\n" +
      ("More substantive prose. ".repeat(500));

    const chunks = await chunkManuscript(text);
    const labels = chunks.map((c) => c.label ?? "");
    // The first chapter line ("Chapter 1 – Alpha") has no prose immediately
    // following it — only another chapter line — so it must NOT survive as
    // a boundary. The Chapter 2 and Chapter 3 lines DO have prose following.
    const ch1Boundary = labels.some((l) => l.startsWith("Chapter 1"));
    const ch2Boundary = labels.some((l) => l.startsWith("Chapter 2"));
    const ch3Boundary = labels.some((l) => l.startsWith("Chapter 3"));
    expect(ch1Boundary).toBe(false);
    expect(ch2Boundary).toBe(true);
    expect(ch3Boundary).toBe(true);
  });

  it("TOC detection: dense chapter-pattern run is excluded from boundaries", async () => {
    // 6 chapter-pattern lines packed within a 6-line span, then a single
    // real chapter heading far below with prose.
    const tocBlock =
      "Chapter 1 – Alpha\t1\n" +
      "Chapter 2 – Beta\t2\n" +
      "Chapter 3 – Gamma\t3\n" +
      "Chapter 4 – Delta\t4\n" +
      "Chapter 5 – Epsilon\t5\n" +
      "Chapter 6 – Zeta\t6\n";
    const realChapter = "\nChapter 1 – Alpha\n\n" + ("Some prose here. ".repeat(800));
    const text = "Front matter.\n\n" + tocBlock + "\n\n" + realChapter;

    const chunks = await chunkManuscript(text);
    // Exactly 1 boundary survives (the real chapter heading) plus Start/End,
    // so we expect a small number of chunks. If TOC entries had survived as
    // boundaries, we'd see ≥6 chunks each only ~20-30 chars long.
    const s = summarizeSizes(chunks);
    expect(s.count).toBeLessThanOrEqual(3);
    expect(s.under200).toBe(0);
  });

  it("non-TOC manuscript: simple structure produces expected chunk shape (negative regression)", async () => {
    // Verify the fix does not break a simple, well-formed manuscript with
    // proper chapter headings and prose — the pre-existing happy path.
    const text = [1, 2, 3, 4, 5]
      .map((i) => `# Chapter ${i} -- Title\n\n${"Some narrative prose. ".repeat(800)}\n\n`)
      .join("");

    const chunks = await chunkManuscript(text);
    const s = summarizeSizes(chunks);
    const chapterLabels = chunks
      .map((c) => c.label ?? "")
      .filter((l) => /^# Chapter \d+/.test(l));

    // We should detect each of the 5 chapter headings as a boundary.
    const distinctChapters = new Set(chapterLabels);
    expect(distinctChapters.size).toBe(5);
    expect(s.under200).toBe(0);
    expect(s.underMinChars).toBeLessThanOrEqual(1); // tail of last chapter may be < minChars
  });

  it("very short manuscript: emits a single chunk even when below minChars", async () => {
    // Tiny manuscripts must still produce at least one chunk. The min-segment
    // invariant explicitly carves out this case: when the whole manuscript is
    // shorter than minChars, we emit one short chunk rather than zero.
    const text = "A small bit of prose. ".repeat(20); // ~440 chars
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].char_start).toBe(0);
    expect(chunks[0].char_end).toBe(text.length);
  });

  it("empty content: returns no chunks (does not throw)", async () => {
    const chunks = await chunkManuscript("");
    expect(chunks).toEqual([]);
  });

  it("idempotency: identical input yields identical output (deterministic content_hash)", async () => {
    const text = ("# Chapter 1 -- Title\n\nSome prose. " + "Wave words here. ".repeat(400));
    const a = await chunkManuscript(text);
    const b = await chunkManuscript(text);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].content_hash).toBe(b[i].content_hash);
      expect(a[i].char_start).toBe(b[i].char_start);
      expect(a[i].char_end).toBe(b[i].char_end);
      expect(a[i].chunk_index).toBe(b[i].chunk_index);
    }
  });

  it("contract preserved: chunks form a coverage of the input with proper overlap", async () => {
    const text = [1, 2, 3, 4]
      .map((i) => `# Chapter ${i} -- Title\n\n${"Lorem ipsum dolor sit amet. ".repeat(500)}\n\n`)
      .join("");
    const chunks = await chunkManuscript(text);

    // First chunk has no overlap.
    expect(chunks[0].overlap_chars).toBe(0);
    // No chunk has negative size or violates char_start ≤ char_end.
    for (const c of chunks) {
      expect(c.char_end).toBeGreaterThan(c.char_start);
      expect(c.overlap_chars).toBeGreaterThanOrEqual(0);
      expect(c.content.length).toBe(c.char_end - (c.char_start - c.overlap_chars));
    }
    // Chunks are strictly ordered and contiguous (each starts where the prior ended).
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].char_start).toBe(chunks[i - 1].char_end);
    }
    // Last chunk reaches end of text.
    expect(chunks[chunks.length - 1].char_end).toBe(text.length);
  });
});
