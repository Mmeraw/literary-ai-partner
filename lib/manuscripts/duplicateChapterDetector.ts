/**
 * duplicateChapterDetector.ts
 *
 * Pre-chunking duplicate content detector (Issue #542).
 * Runs after the manuscript is split into section blocks but before chunking fires.
 *
 * Detection strategy:
 *   1. Exact duplicates: SHA-256 fingerprint of first 2000 normalized chars.
 *   2. Near-duplicates: 6-gram shingling with Jaccard similarity ≥ 0.95.
 *
 * Behavior:
 *   - Exact duplicate: later occurrence is flagged for skip + DUPLICATE_CHAPTER_CONTENT warning.
 *   - Near-duplicate: both kept but NEAR_DUPLICATE_CHAPTER_CONTENT warning emitted.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionBlock {
  index: number;
  title: string;
  charOffset: number;
  content: string;
}

export interface DuplicateSection {
  sectionA: { index: number; title: string; charOffset: number };
  sectionB: { index: number; title: string; charOffset: number };
  similarity: number; // 1.0 = exact, <1 = near-duplicate
  type: "exact" | "near_duplicate";
}

export interface DuplicateDetectionResult {
  duplicates: DuplicateSection[];
  /** Indices of sections to skip during chunking (later occurrence of exact dupes). */
  skipIndices: Set<number>;
  /** Governance warning codes to surface in the evaluation report. */
  warnings: Array<{
    code: "DUPLICATE_CHAPTER_CONTENT" | "NEAR_DUPLICATE_CHAPTER_CONTENT";
    message: string;
  }>;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeForFingerprint(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Fingerprinting (exact duplicates)
// ---------------------------------------------------------------------------

const FINGERPRINT_CHARS = 2000;

function fingerprint(content: string): string {
  const normalized = normalizeForFingerprint(content).slice(0, FINGERPRINT_CHARS);
  return createHash("sha256").update(normalized).digest("hex");
}

// ---------------------------------------------------------------------------
// Shingling (near-duplicates)
// ---------------------------------------------------------------------------

const SHINGLE_SIZE = 6;
const NEAR_DUPLICATE_THRESHOLD = 0.95;
/** Only compute Jaccard on sections with ≥ this many chars (avoid false positives on tiny sections). */
const MIN_CHARS_FOR_NEAR_DUPE = 500;

function computeShingles(text: string): Set<string> {
  const normalized = normalizeForFingerprint(text);
  const words = normalized.split(" ");
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) {
    shingles.add(words.slice(i, i + SHINGLE_SIZE).join(" "));
  }
  return shingles;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const s of smaller) {
    if (larger.has(s)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

/**
 * Detect duplicate and near-duplicate section blocks.
 * Performance: O(n²) on section count — bounded to <100ms for novels with ≤80 chapters.
 */
export function detectDuplicateChapters(
  sections: SectionBlock[],
): DuplicateDetectionResult {
  const result: DuplicateDetectionResult = {
    duplicates: [],
    skipIndices: new Set(),
    warnings: [],
  };

  if (sections.length < 2) return result;

  // Phase 1: exact fingerprint matching.
  const fingerprints = sections.map((s) => fingerprint(s.content));
  const fpToFirstIdx = new Map<string, number>();

  for (let i = 0; i < sections.length; i++) {
    const fp = fingerprints[i];
    if (fpToFirstIdx.has(fp)) {
      const firstIdx = fpToFirstIdx.get(fp)!;
      const a = sections[firstIdx];
      const b = sections[i];
      result.duplicates.push({
        sectionA: { index: a.index, title: a.title, charOffset: a.charOffset },
        sectionB: { index: b.index, title: b.title, charOffset: b.charOffset },
        similarity: 1.0,
        type: "exact",
      });
      result.skipIndices.add(i);
      result.warnings.push({
        code: "DUPLICATE_CHAPTER_CONTENT",
        message: `Chapter ${b.index + 1} ('${b.title}') appears to be a duplicate of Chapter ${a.index + 1} ('${a.title}') and was excluded from scoring.`,
      });
    } else {
      fpToFirstIdx.set(fp, i);
    }
  }

  // Phase 2: near-duplicate detection via Jaccard on shingles.
  // Only check pairs not already flagged as exact.
  const shingleCache = new Map<number, Set<string>>();
  const getShingles = (idx: number) => {
    if (!shingleCache.has(idx)) {
      shingleCache.set(idx, computeShingles(sections[idx].content));
    }
    return shingleCache.get(idx)!;
  };

  for (let i = 0; i < sections.length; i++) {
    if (result.skipIndices.has(i)) continue;
    if (sections[i].content.length < MIN_CHARS_FOR_NEAR_DUPE) continue;

    for (let j = i + 1; j < sections.length; j++) {
      if (result.skipIndices.has(j)) continue;
      if (sections[j].content.length < MIN_CHARS_FOR_NEAR_DUPE) continue;
      // Skip if already an exact match (same fingerprint).
      if (fingerprints[i] === fingerprints[j]) continue;

      const sim = jaccardSimilarity(getShingles(i), getShingles(j));
      if (sim >= NEAR_DUPLICATE_THRESHOLD) {
        const a = sections[i];
        const b = sections[j];
        result.duplicates.push({
          sectionA: { index: a.index, title: a.title, charOffset: a.charOffset },
          sectionB: { index: b.index, title: b.title, charOffset: b.charOffset },
          similarity: sim,
          type: "near_duplicate",
        });
        result.warnings.push({
          code: "NEAR_DUPLICATE_CHAPTER_CONTENT",
          message: `Chapter ${b.index + 1} ('${b.title}') is a near-duplicate of Chapter ${a.index + 1} ('${a.title}') (${(sim * 100).toFixed(1)}% similarity).`,
        });
      }
    }
  }

  return result;
}
