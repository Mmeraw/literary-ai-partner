/**
 * Regression: emitted chunk content must respect adaptive bracket maxChars.
 *
 * Production failure that motivated this test (5/15/2026):
 *   Chunker post-condition violated: chunk 23 has char_count=32100 which
 *   exceeds adaptive bracket maxChars=30000 (bracket=mid).
 *
 * Root cause: the planner capped `cut <= cfg.maxChars`, but the emitter
 * prepends `overlap` chars from the previous chunk:
 *
 *   content = text.slice(baseStart - overlap, baseEnd)
 *
 * So for non-first chunks, content.length = cut + overlap. With mid bracket
 * maxChars=30000 and overlapChars=2100, capped chunks emitted 32100 chars,
 * tripping the post-condition before pipeline dispatch.
 *
 * Fix: plan cuts overlap-aware so emitted content.length always respects
 * cfg.maxChars. See lib/manuscripts/chunking.ts.
 *
 * Out of scope (separate PRs): Pass 4, Perplexity, evidence packet,
 * post-condition wording.
 */

import {
  chunkManuscript,
  selectChunkerConfig,
  selectChunkerBracket,
} from "@/lib/manuscripts/chunking";

/**
 * Build a long, boundary-free synthetic manuscript of approximately
 * `targetChars` characters. No chapter markers — forces a single segment
 * so the planner produces back-to-back maxChars-capped chunks (the
 * worst-case path that exposed the bug in production).
 */
function buildBoundaryFreeText(targetChars: number): string {
  // Plausible-looking prose with no scene breaks, blank-line gaps, or
  // chapter markers. The chunker's boundary detection sees only `{ index: 0,
  // label: "Start" }` and `{ index: end, label: "End" }`, exercising the
  // single-segment cut planner.
  const sentence =
    "The narrator drifted between two currents of thought while afternoon " +
    "light settled over the city rooftops in patterns she had begun to " +
    "recognize from memory though the shape of each evening remained " +
    "always slightly different from the last and she wondered whether " +
    "this small drift carried any meaning at all. ";
  const reps = Math.ceil(targetChars / sentence.length);
  return sentence.repeat(reps).slice(0, targetChars);
}

describe("emitted chunk size respects adaptive maxChars (regression)", () => {
  test("MID bracket: capped non-first chunks emit <= 30000 chars (not 32100)", async () => {
    // Single boundary-free segment forces back-to-back maxChars-capped chunks.
    // Pre-fix production behavior: chunks 1+ emitted 32100 chars
    //   (= maxChars 30000 + overlapChars 2100).
    // Post-fix expectation: emitted content.length <= cfg.maxChars for ALL
    // chunks, including those carrying overlap.
    const cfg = selectChunkerConfig(120_000); // mid bracket
    expect(cfg.maxChars).toBe(30_000);
    expect(cfg.overlapChars).toBe(2_100);

    // ~850k chars ≈ 142k words → mid bracket; many back-to-back capped chunks.
    const text = buildBoundaryFreeText(850_000);
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThan(20);

    // Strict emitted-content invariant — the contract the production
    // post-condition enforces.
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(cfg.maxChars);
    }

    // Overlap is still present on non-first chunks (we did NOT solve this
    // by removing overlap). The first chunk has no overlap by design.
    expect(chunks[0].overlap_chars).toBe(0);
    expect(chunks[1].overlap_chars).toBe(cfg.overlapChars);

    // The capped chunks compensate for overlap in their BASE span:
    //   base = char_end - char_start
    //   emitted = base + overlap
    //   emitted == maxChars  =>  base == maxChars - overlapChars == 27900
    // We assert there is at least one such capped chunk.
    const capped = chunks.find(
      (c) =>
        c.overlap_chars === cfg.overlapChars &&
        c.content.length === cfg.maxChars,
    );
    expect(capped).toBeDefined();
    expect(capped!.char_end - capped!.char_start).toBe(
      cfg.maxChars - cfg.overlapChars,
    );
  }, 180_000);

  test("SMALL bracket: capped non-first chunks emit <= 24000 chars", async () => {
    const cfg = selectChunkerConfig(40_000); // small bracket
    expect(cfg.maxChars).toBe(24_000);
    expect(cfg.overlapChars).toBe(1_800);

    const text = buildBoundaryFreeText(200_000);
    const chunks = await chunkManuscript(text);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(cfg.maxChars);
    }
  }, 120_000);

  test("LARGE bracket: capped non-first chunks emit <= 42000 chars", async () => {
    const cfg = selectChunkerConfig(200_000); // large bracket
    expect(cfg.maxChars).toBe(42_000);
    expect(cfg.overlapChars).toBe(3_000);

    const text = buildBoundaryFreeText(1_500_000);
    const chunks = await chunkManuscript(text);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(cfg.maxChars);
    }
  }, 180_000);

  test("first chunk has no overlap and may use full maxChars", async () => {
    // The first chunk in a manuscript has overlap_chars = 0, so its emitted
    // content can equal cfg.maxChars exactly.
    const text = buildBoundaryFreeText(100_000);
    const chunks = await chunkManuscript(text);
    expect(chunks[0].overlap_chars).toBe(0);
    expect(chunks[0].content.length).toBeLessThanOrEqual(
      selectChunkerConfig(20_000).maxChars,
    );
  }, 60_000);

  test("short manuscript (single chunk) is unchanged", async () => {
    // Chapter-length input that fits in one chunk: no overlap, no cap,
    // behavior identical to pre-fix. Asserts the fix is overlap-aware
    // and does not penalize short inputs.
    const text = buildBoundaryFreeText(15_000);
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].overlap_chars).toBe(0);
    expect(chunks[0].content.length).toBe(15_000);
  }, 60_000);

  test("bracket selector unchanged: 142k words → mid", () => {
    // Sanity: the regression manuscript size lands in the same bracket the
    // production failure observed (mid).
    expect(selectChunkerBracket(142_000)).toBe("mid");
  });
});
