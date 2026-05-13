/**
 * tests/stress/fixtures/generate.ts
 *
 * Deterministic synthetic-manuscript generator for the pipeline stress harness.
 *
 * Anti-flake guarantees:
 *   - Output is a pure function of (wordCount, seed). No Date.now(), no
 *     unseeded Math.random(), no process.hrtime().
 *   - Default seed = 42 (override via STRESS_SEED env var, documented in the
 *     runbook). Identical inputs always produce byte-identical strings.
 *   - All randomness flows through a single seeded mulberry32 PRNG.
 *
 * Buckets exposed: W-5k, W-25k, W-60k, W-100k, W-137k, W-200k (matching
 * stress_test_plan.md §1.1).
 */

const DEFAULT_SEED = Number.parseInt(process.env.STRESS_SEED ?? "42", 10);

export const WORD_BUCKETS = {
  "W-5k": 5_000,
  "W-25k": 25_000,
  "W-60k": 60_000,
  "W-100k": 100_000,
  "W-137k": 137_758,
  "W-200k": 200_000,
} as const;

export type WordBucket = keyof typeof WORD_BUCKETS;

// Small, deterministic vocabulary. Keeps fixtures readable, avoids unicode
// surprises, and prevents accidental matches against canonical phrases.
const VOCAB = [
  "the", "manuscript", "evidence", "scene", "chapter", "narrator", "character",
  "tension", "voice", "rhythm", "image", "moment", "pressure", "decision",
  "consequence", "stakes", "memory", "echo", "thread", "silence", "weight",
  "horizon", "edge", "shadow", "promise", "fracture", "thread", "pulse",
  "fragment", "ledger", "anchor", "lattice", "interval", "current", "tide",
];

/** mulberry32 — small, fast, well-distributed PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  /** Target word count. */
  wordCount: number;
  /** Random seed. Defaults to STRESS_SEED env var or 42. */
  seed?: number;
  /** When true, suppress chapter markers entirely (matrix row M-no-chap). */
  suppressChapters?: boolean;
}

/**
 * Generate a deterministic synthetic manuscript with approximate word count.
 *
 * Output structure:
 *   - Chapter markers ("\n\nChapter N\n\n") every ~3000 words unless
 *     suppressChapters is set.
 *   - Sentences of 8-16 words from the small VOCAB; lower-case only.
 *   - Final word count is ≥ target and < target + 16 (one sentence over).
 */
export function generateManuscript(opts: GenerateOptions): string {
  const seed = opts.seed ?? DEFAULT_SEED;
  const target = Math.max(1, Math.floor(opts.wordCount));
  const rng = mulberry32(seed);
  const parts: string[] = [];
  let words = 0;
  let chapter = 1;

  if (!opts.suppressChapters) {
    parts.push(`Chapter ${chapter}`);
  }

  while (words < target) {
    const sentLen = 8 + Math.floor(rng() * 9); // 8..16 words
    const sentence: string[] = [];
    for (let i = 0; i < sentLen; i++) {
      sentence.push(VOCAB[Math.floor(rng() * VOCAB.length)]);
    }
    parts.push(sentence.join(" ") + ".");
    words += sentLen;

    if (!opts.suppressChapters && words >= chapter * 3000 && words < target - 100) {
      chapter += 1;
      parts.push(`\n\nChapter ${chapter}\n`);
    }
  }
  return parts.join(" ");
}

/** Convenience: generate by named bucket. */
export function generateBucket(bucket: WordBucket, seed?: number): string {
  return generateManuscript({ wordCount: WORD_BUCKETS[bucket], seed });
}

/** Word-count helper that mirrors the runtime's countWords (whitespace split). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// When invoked directly, emit a tiny smoke summary so the file is exercisable.
if (require.main === module) {
  for (const [bucket, target] of Object.entries(WORD_BUCKETS) as Array<[WordBucket, number]>) {
    const text = generateBucket(bucket);
    const actual = countWords(text);
    // eslint-disable-next-line no-console
    console.log(`[stress-fixtures] ${bucket}: target=${target} actual=${actual} chars=${text.length}`);
  }
}
