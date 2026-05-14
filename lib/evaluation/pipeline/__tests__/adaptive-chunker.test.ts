/**
 * Adaptive chunker size-bracket fixtures.
 *
 * Proves the adaptive selector emits chunk counts in the 25–48 sweet spot
 * across all supported manuscript sizes, and that overlap stays at ~10%.
 *
 * The directive specifies expected chunk-count ranges per bracket. These are
 * authority ranges, not exact counts — the chunker's chapter-aligned cuts can
 * vary by a chunk or two depending on where chapter boundaries fall.
 */

import {
  chunkManuscript,
  selectChunkerConfig,
  selectChunkerBracket,
  HARD_MANUSCRIPT_CEILING_WORDS,
} from "@/lib/manuscripts/chunking";

/**
 * Synthetic-text generator. Emits paragraphs of plausible prose to fill the
 * target word count. When chapter markers are requested, emits "CHAPTER N"
 * headings on their own line every `wordsPerChapter` words.
 */
function generateManuscriptText(opts: {
  targetWords: number;
  chapterEveryWords?: number;
}): string {
  const { targetWords, chapterEveryWords } = opts;
  // A vocabulary that produces diverse-looking sentences. Word boundaries
  // matter only for word counting; content is irrelevant to the chunker.
  const vocab = [
    "the", "narrator", "drifted", "between", "two", "currents", "of", "thought",
    "while", "afternoon", "light", "settled", "over", "the", "city", "rooftops",
    "in", "patterns", "she", "had", "begun", "to", "recognize", "from", "memory",
    "though", "the", "shape", "of", "each", "evening", "remained", "always",
    "slightly", "different", "from", "the", "last", "and", "she", "wondered",
    "whether", "this", "small", "drift", "carried", "any", "meaning", "at", "all",
  ];

  const parts: string[] = [];
  let wordsEmitted = 0;
  let chapterCounter = 1;
  if (chapterEveryWords) {
    parts.push(`Chapter ${chapterCounter}`);
    parts.push("");
    chapterCounter += 1;
  }

  let vocabIdx = 0;
  let sentenceWordsLeft = 12 + (wordsEmitted % 8);
  let sentenceParts: string[] = [];
  while (wordsEmitted < targetWords) {
    sentenceParts.push(vocab[vocabIdx % vocab.length]);
    vocabIdx += 1;
    wordsEmitted += 1;
    sentenceWordsLeft -= 1;

    if (sentenceWordsLeft <= 0) {
      const sentence = sentenceParts.join(" ") + ".";
      parts.push(sentence);
      sentenceParts = [];
      sentenceWordsLeft = 8 + (vocabIdx % 12);
      // Paragraph break every few sentences.
      if (vocabIdx % 60 === 0) parts.push("");
    }

    if (
      chapterEveryWords &&
      wordsEmitted < targetWords &&
      wordsEmitted % chapterEveryWords === 0
    ) {
      if (sentenceParts.length > 0) {
        parts.push(sentenceParts.join(" ") + ".");
        sentenceParts = [];
      }
      parts.push("");
      parts.push(`Chapter ${chapterCounter}`);
      parts.push("");
      chapterCounter += 1;
    }
  }
  if (sentenceParts.length > 0) {
    parts.push(sentenceParts.join(" ") + ".");
  }
  return parts.join("\n");
}

function countWordsLocal(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return (trimmed.match(/\b\w+\b/g) || []).length;
}

describe("selectChunkerConfig (adaptive size brackets)", () => {
  test("returns SMALL bracket up to 60k words", () => {
    expect(selectChunkerBracket(0)).toBe("small");
    expect(selectChunkerBracket(2_500)).toBe("small");
    expect(selectChunkerBracket(60_000)).toBe("small");
    const cfg = selectChunkerConfig(60_000);
    expect(cfg.targetChars).toBe(18_000);
    expect(cfg.maxChars).toBe(24_000);
  });

  test("returns MID bracket for 60k < words ≤ 150k", () => {
    expect(selectChunkerBracket(60_001)).toBe("mid");
    expect(selectChunkerBracket(113_000)).toBe("mid");
    expect(selectChunkerBracket(150_000)).toBe("mid");
    const cfg = selectChunkerConfig(113_000);
    expect(cfg.targetChars).toBe(21_000);
    expect(cfg.maxChars).toBe(30_000);
  });

  test("returns LARGE bracket above 150k words", () => {
    expect(selectChunkerBracket(150_001)).toBe("large");
    expect(selectChunkerBracket(250_000)).toBe("large");
    expect(selectChunkerBracket(HARD_MANUSCRIPT_CEILING_WORDS)).toBe("large");
    const cfg = selectChunkerConfig(250_000);
    expect(cfg.targetChars).toBe(30_000);
    expect(cfg.maxChars).toBe(42_000);
  });

  test("hard ceiling constant is 300,000 words", () => {
    expect(HARD_MANUSCRIPT_CEILING_WORDS).toBe(300_000);
  });
});

describe("adaptive chunker — size bracket fixtures", () => {
  // Each fixture asserts a chunk-count range that proves the adaptive sizer
  // keeps chunk counts inside the 25–48 sweet spot (or below it for short
  // manuscripts).

  test("sub-threshold short story (2,500 words) — chunker still works on direct call", async () => {
    // Note: the structural chunking threshold (3k words) is enforced at the
    // processor/pipeline level. Direct chunker calls always produce ≥ 1 chunk.
    const text = generateManuscriptText({ targetWords: 2_500 });
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(countWordsLocal(text)).toBeGreaterThanOrEqual(2_400);
    expect(countWordsLocal(text)).toBeLessThanOrEqual(2_600);
  }, 30_000);

  test("boundary 3k novella (3,000 words) — at least 1 chunk", async () => {
    const text = generateManuscriptText({ targetWords: 3_000, chapterEveryWords: 1_500 });
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  test("12k six-chapter novella — SMALL bracket, modest chunk count", async () => {
    const text = generateManuscriptText({ targetWords: 12_000, chapterEveryWords: 2_000 });
    const chunks = await chunkManuscript(text);
    // SMALL bracket: targetChars 18k ≈ 3k words per chunk → expect a handful.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.length).toBeLessThanOrEqual(12);
    expect(selectChunkerBracket(12_000)).toBe("small");
  }, 60_000);

  test("51k Froggin Noggin sim — SMALL bracket, under 48 cap", async () => {
    const text = generateManuscriptText({ targetWords: 51_000, chapterEveryWords: 3_500 });
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThanOrEqual(8);
    expect(chunks.length).toBeLessThanOrEqual(30);
    expect(selectChunkerBracket(51_000)).toBe("small");
  }, 120_000);

  test("90k novel — MID bracket, well under 48 cap", async () => {
    const text = generateManuscriptText({ targetWords: 90_000, chapterEveryWords: 3_500 });
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThanOrEqual(10);
    expect(chunks.length).toBeLessThanOrEqual(48);
    expect(selectChunkerBracket(90_000)).toBe("mid");
  }, 180_000);

  test("113k Cartel Babies sim — MID bracket, under 48 cap", async () => {
    const text = generateManuscriptText({ targetWords: 113_000, chapterEveryWords: 4_000 });
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThanOrEqual(15);
    expect(chunks.length).toBeLessThanOrEqual(48);
    expect(selectChunkerBracket(113_000)).toBe("mid");
  }, 240_000);

  test("250k epic — LARGE bracket, at or near cap but under 48", async () => {
    const text = generateManuscriptText({ targetWords: 250_000, chapterEveryWords: 6_000 });
    const chunks = await chunkManuscript(text);
    expect(chunks.length).toBeGreaterThanOrEqual(20);
    expect(chunks.length).toBeLessThanOrEqual(48);
    expect(selectChunkerBracket(250_000)).toBe("large");
  }, 360_000);

  test("310k over-ceiling — bracket is LARGE; processor must fail-closed before invoking", () => {
    // Direct chunker doesn't enforce the ceiling — the processor and runPipeline
    // do. This test asserts the contract: the bracket selector returns LARGE
    // and the caller is responsible for fail-closing first.
    expect(selectChunkerBracket(310_000)).toBe("large");
    expect(310_000).toBeGreaterThan(HARD_MANUSCRIPT_CEILING_WORDS);
  });
});

describe("overlap percentage — 10% target", () => {
  test("every bracket has overlapChars between 9% and 11% of targetChars", () => {
    const brackets = [
      selectChunkerConfig(30_000),
      selectChunkerConfig(100_000),
      selectChunkerConfig(200_000),
    ];
    for (const cfg of brackets) {
      const pct = cfg.overlapChars / cfg.targetChars;
      expect(pct).toBeGreaterThanOrEqual(0.09);
      expect(pct).toBeLessThanOrEqual(0.11);
    }
  });
});
