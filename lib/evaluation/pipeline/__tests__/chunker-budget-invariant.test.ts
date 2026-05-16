/**
 * Chunker / Pass 1 prompt budget alignment invariant.
 *
 * Mistake-proofs against the failure mode observed in job
 * a8d3723c-b034-404a-a497-155d56ebc7e1 (Froggin Noggin, 2026-05-16): the
 * LARGE adaptive bracket emitted a 42_000-char chunk, but the Pass 1
 * chunker post-condition fails closed when any chunk exceeds
 * `floor(inputCharBudget * 0.95)`. With the default budget at 40_000 the
 * ceiling was 38_000, so the bracket's own max was *guaranteed* to overflow
 * before Pass 1 ever dispatched.
 *
 * After PR (chunker-budget-alignment) the default budget is 50_000 and the
 * ceiling is floor(50000 * 0.95) = 47_500. This test asserts that every
 * bracket's emitted-content ceiling (`cfg.maxChars`) stays at or below that
 * ceiling, so any future re-tuning of either side trips a unit-test failure
 * before it can ship.
 *
 * Fix history:
 *   - PR #471 introduced the post-condition (`runPipeline` + `processor`).
 *   - PR (this) raised inputCharBudget 40_000 → 50_000 so LARGE bracket fits.
 */

import { describe, expect, test } from "@jest/globals";
import { selectChunkerConfig } from "@/lib/manuscripts/chunking";
import { getDefaultPassInputCharBudget } from "../promptInput";

// Mirrors the constant in lib/evaluation/pipeline/runPipeline.ts and the 0.95
// literal in lib/evaluation/processor.ts. Kept as a local literal here on
// purpose: the invariant we are protecting IS the alignment of these two
// numbers, so duplicating the literal makes any silent drift loud.
const CHUNK_BUDGET_RATIO = 0.95;

// Word counts that exercise every bracket in selectChunkerConfig:
//   <= 60k → SMALL, 60k–150k → MID, > 150k → LARGE.
const BRACKET_SAMPLE_WORD_COUNTS = [
  20_000,   // SMALL bracket
  100_000,  // MID bracket
  200_000,  // LARGE bracket — the production failure case
  290_000,  // LARGE bracket near the hard ceiling
];

describe("chunker / Pass 1 prompt budget alignment invariant", () => {
  test("every adaptive bracket maxChars fits inside the Pass 1 chunker post-condition ceiling", () => {
    const budget = getDefaultPassInputCharBudget();
    const ceiling = Math.floor(budget * CHUNK_BUDGET_RATIO);

    expect(ceiling).toBeGreaterThan(0);

    for (const words of BRACKET_SAMPLE_WORD_COUNTS) {
      const cfg = selectChunkerConfig(words);
      // The chunker emits content up to cfg.maxChars (the first chunk has no
      // overlap; later chunks are capped at (maxChars - overlap) base + overlap
      // = maxChars emitted). Either way the worst case is cfg.maxChars.
      expect({
        words,
        maxChars: cfg.maxChars,
        ceiling,
        budget,
      }).toEqual({
        words,
        maxChars: cfg.maxChars,
        ceiling,
        budget,
      });
      expect(cfg.maxChars).toBeLessThanOrEqual(ceiling);
    }
  });

  test("documented default budget (50_000) yields the documented ceiling (47_500)", () => {
    // Anchor the documented numbers so docs/env-contract.md and the constants
    // in lib/config/envContract.ts cannot drift silently apart.
    const budget = getDefaultPassInputCharBudget();
    expect(budget).toBe(50_000);
    expect(Math.floor(budget * CHUNK_BUDGET_RATIO)).toBe(47_500);
  });

  test("LARGE bracket has non-trivial headroom under the ceiling", () => {
    // Defends against a future re-tuning that would push LARGE.maxChars
    // exactly onto the ceiling and leave zero slack for chunker rebalance
    // logic. Require at least 5_000 chars of headroom (≈ 800 words).
    const budget = getDefaultPassInputCharBudget();
    const ceiling = Math.floor(budget * CHUNK_BUDGET_RATIO);
    const largeCfg = selectChunkerConfig(200_000);
    expect(ceiling - largeCfg.maxChars).toBeGreaterThanOrEqual(5_000);
  });
});
