// lib/manuscripts/chunking.ts
// Deterministic, idempotent manuscript chunking for Phase 1.
//
// Boundary hierarchy (strict order):
//   1. Chapter headings (CHAPTER, Chapter, # Chapter, roman numerals, numeric, en-dash titles)
//   2. Scene headings (INT./EXT. for screenplays)
//   3. Section breaks (*** or 3+ blank lines)
//   4. Size-based fallback if no structure exists
//
// TOC awareness (PR #382):
//   Many ingestion paths (Word DOCX → docx2txt-style) emit a Table of Contents
//   as bare chapter-pattern lines packed close together. Without TOC awareness,
//   every TOC entry was treated as a chapter boundary, producing hundreds of
//   micro-chunks. We now detect TOC regions and chapter-line headings that
//   are not followed by substantive prose, and exclude them from boundaries.
//   We additionally enforce a min-segment-merge invariant so the size walker
//   cannot emit sub-`minChars` chunks except possibly the trailing tail.

export type ChunkSpec = {
  chunk_index: number;     // 0-based
  char_start: number;      // inclusive in full staged text
  char_end: number;        // exclusive in full staged text
  overlap_chars: number;   // overlap included at start of content
  label?: string | null;
  content: string;         // includes overlap when overlap_chars > 0
  content_hash: string;    // sha256 hex
};

export type ChunkingConfig = {
  minChars: number;        // 3000
  targetChars: number;     // 12000
  maxChars: number;        // 20000
  overlapChars: number;    // 300

  // TOC awareness — see issue #382
  /** Min consecutive chapter-pattern lines (within tocMaxGapLines spacing) to declare a TOC region. */
  tocMinEntries: number;            // 5
  /** Max line gap between consecutive chapter-pattern lines for them to belong to the same TOC region. */
  tocMaxGapLines: number;           // 4
  /** Mean line length within a TOC region must be ≤ this for it to qualify. */
  tocMaxMeanLineLen: number;        // 200

  // Chapter-line strictness — see issue #382
  /** A real chapter heading must be followed within this many lines by substantive prose. */
  chapterLookaheadLines: number;    // 20
  /** Substantive prose threshold (chars of non-heading, non-page-number text following a chapter line). */
  chapterMinFollowingChars: number; // 200
};

const DEFAULTS: ChunkingConfig = {
  minChars: 3000,
  targetChars: 12000,
  maxChars: 20000,
  overlapChars: 300,
  tocMinEntries: 5,
  tocMaxGapLines: 4,
  tocMaxMeanLineLen: 200,
  chapterLookaheadLines: 20,
  chapterMinFollowingChars: 200,
};

// ----------------------------------------------------------------------------
// Boundary line classification
// ----------------------------------------------------------------------------

const CHAPTER_RE =
  /^\s*#*\s*(chapter|ch\.?)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const CHAPTER_HASH_RE = /^\s*#\s*chapter\b/i;
const SCENE_RE = /^\s*(INT\.|EXT\.|INT\/EXT\.)\b/;
const SECTION_RE = /^\s*\*{3,}\s*$/;

function isChapterPatternLine(line: string): boolean {
  return CHAPTER_RE.test(line) || CHAPTER_HASH_RE.test(line);
}

function isBoundaryLine(line: string) {
  const chapter = isChapterPatternLine(line);
  const scene = SCENE_RE.test(line);
  const section = SECTION_RE.test(line);
  return { chapter, scene, section };
}

function isTripleBlankBoundary(prevLine: string, line: string, nextLine: string) {
  const blank = (s: string) => s.trim().length === 0;
  return blank(prevLine) && blank(line) && blank(nextLine);
}

// ----------------------------------------------------------------------------
// TOC detection
// ----------------------------------------------------------------------------

/**
 * Returns a Set of line indices that belong to a Table-of-Contents region.
 *
 * A TOC region is a contiguous run of chapter-pattern lines where:
 *   - the run contains ≥ tocMinEntries chapter-pattern lines, AND
 *   - adjacent chapter-pattern lines are separated by ≤ tocMaxGapLines lines, AND
 *   - the mean length of all lines in the run (including the gaps) is ≤ tocMaxMeanLineLen.
 *
 * Lines flagged here are exactly the chapter-pattern lines inside the run.
 * Non-chapter "filler" lines between TOC entries are not flagged — they are
 * neither boundaries nor candidates, so flagging them would be a no-op.
 */
function detectTocLineIndices(lines: string[], cfg: ChunkingConfig): Set<number> {
  const tocIndices = new Set<number>();
  const chapterLineIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isChapterPatternLine(lines[i])) chapterLineIdxs.push(i);
  }
  if (chapterLineIdxs.length < cfg.tocMinEntries) return tocIndices;

  // Group consecutive chapter-pattern lines into runs by max-gap rule.
  let runStartIdx = 0; // index into chapterLineIdxs
  for (let i = 1; i <= chapterLineIdxs.length; i++) {
    const breakHere =
      i === chapterLineIdxs.length ||
      chapterLineIdxs[i] - chapterLineIdxs[i - 1] > cfg.tocMaxGapLines + 1;
    if (!breakHere) continue;

    const runEntries = chapterLineIdxs.slice(runStartIdx, i);
    runStartIdx = i;
    if (runEntries.length < cfg.tocMinEntries) continue;

    const firstLine = runEntries[0];
    const lastLine = runEntries[runEntries.length - 1];
    const spanLineCount = lastLine - firstLine + 1;

    let totalLen = 0;
    for (let k = firstLine; k <= lastLine; k++) totalLen += lines[k].length;
    const meanLineLen = totalLen / spanLineCount;
    if (meanLineLen > cfg.tocMaxMeanLineLen) continue;

    for (const idx of runEntries) tocIndices.add(idx);
  }
  return tocIndices;
}

// ----------------------------------------------------------------------------
// Chapter-line strictness
// ----------------------------------------------------------------------------

/**
 * Page-number tail like "\t12", "  12", "...12", "..  12" — common docx2txt residue.
 */
const PAGE_NUMBER_TAIL_RE = /[\t.\s]+\d{1,4}\s*$/;

function stripPageTail(line: string): string {
  return line.replace(PAGE_NUMBER_TAIL_RE, "").trim();
}

/**
 * Counts substantive following chars after a chapter-pattern line.
 * "Substantive" excludes:
 *   - blank lines
 *   - lines that are themselves chapter/scene/section boundaries
 *   - the page-number tail of any line (stripped before counting)
 */
function countSubstantiveFollowingChars(
  lines: string[],
  fromLineIdx: number,
  lookaheadLines: number,
): number {
  const stop = Math.min(lines.length, fromLineIdx + 1 + lookaheadLines);
  let total = 0;
  for (let k = fromLineIdx + 1; k < stop; k++) {
    const ln = lines[k];
    if (ln.trim().length === 0) continue;
    const { chapter, scene, section } = isBoundaryLine(ln);
    // Strictness: encountering another structural boundary line before any
    // substantive prose means the prose belongs to the *next* boundary, not
    // this one. Stop counting — this chapter line should not survive as a
    // boundary unless we already accumulated enough prose.
    if (chapter || scene || section) break;
    total += stripPageTail(ln).length;
  }
  return total;
}

// ----------------------------------------------------------------------------
// Boundary computation
// ----------------------------------------------------------------------------

type Boundary = { index: number; label?: string };

function computeBoundaries(
  text: string,
  cfg: ChunkingConfig,
): { all: Boundary[]; hasChapter: boolean; hasScene: boolean; hasSectionOrBlank: boolean } {
  const lines = text.split(/\r?\n/);

  // Running char offset for each line start.
  const lineStarts: number[] = [];
  {
    let offset = 0;
    for (const ln of lines) {
      lineStarts.push(offset);
      offset += ln.length + 1; // +1 for "\n"
    }
  }

  const tocLineSet = detectTocLineIndices(lines, cfg);

  const boundaries: Boundary[] = [{ index: 0, label: "Start" }];
  let hasChapter = false;
  let hasScene = false;
  let hasSectionOrBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { chapter, scene, section } = isBoundaryLine(line);

    if (chapter) {
      // Defense layer 1: skip TOC entries.
      if (tocLineSet.has(i)) continue;
      // Defense layer 2: chapter line must be followed by substantive prose.
      const following = countSubstantiveFollowingChars(lines, i, cfg.chapterLookaheadLines);
      if (following < cfg.chapterMinFollowingChars) continue;

      hasChapter = true;
      boundaries.push({ index: lineStarts[i], label: line.trim().slice(0, 80) });
    } else if (scene) {
      hasScene = true;
      boundaries.push({ index: lineStarts[i], label: line.trim().slice(0, 80) });
    } else if (section) {
      hasSectionOrBlank = true;
      boundaries.push({ index: lineStarts[i], label: "***" });
    }

    const prevLine = lines[i - 1] ?? "";
    const nextLine = lines[i + 1] ?? "";
    if (isTripleBlankBoundary(prevLine, line, nextLine)) {
      hasSectionOrBlank = true;
      boundaries.push({ index: lineStarts[i], label: "BlankBreak" });
    }
  }

  // De-dupe + sort. When multiple boundaries share an index, prefer the most
  // informative label (chapter/scene/section over Start/BlankBreak) so the
  // first chunk's label reflects the actual structural element at offset 0
  // when the manuscript opens directly with a chapter heading.
  const labelRank = (label?: string) => {
    if (!label) return 0;
    if (label === "Start" || label === "BlankBreak" || label === "End") return 0;
    return 1; // any real chapter/scene/section label
  };
  const byIndex = new Map<number, Boundary>();
  for (const b of boundaries) {
    const existing = byIndex.get(b.index);
    if (!existing || labelRank(b.label) > labelRank(existing.label)) {
      byIndex.set(b.index, b);
    }
  }
  const all = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);

  return { all, hasChapter, hasScene, hasSectionOrBlank };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(hash));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(input, "utf8").digest("hex");
  }
}

/**
 * Min-segment-merge invariant: any segment shorter than minChars is merged with
 * its successor before the size-walk runs. The walker therefore cannot emit
 * sub-minChars chunks except possibly the trailing tail of the last segment.
 *
 * Adjacent boundaries are merged by dropping the inner boundary; the resulting
 * segments still partition the text exactly.
 */
function mergeUndersizedSegments(boundaries: Boundary[], minChars: number, totalLen: number): Boundary[] {
  if (boundaries.length <= 2) return boundaries;

  // Special handling for a small leading segment [Start..b1):
  // If b1 is the first real boundary and the segment between Start and b1 is
  // shorter than minChars, we don't want to drop b1 (which would lose its
  // label). Instead, absorb the small prefix into b1's segment by sliding b1
  // back to index 0 — its label survives, and the prefix becomes the lead-in
  // of the first chunk. This preserves chapter labels for manuscripts where
  // the first chapter follows tiny front-matter.
  let workingBoundaries = boundaries.slice();
  if (workingBoundaries.length >= 3) {
    const start = workingBoundaries[0];
    const first = workingBoundaries[1];
    const firstSegLen = first.index - start.index;
    const firstIsLast = workingBoundaries.length === 2; // not possible here, length≥3
    if (firstSegLen < minChars && !firstIsLast) {
      // Replace [Start, b1, ...] with [{index:0, label:b1.label}, ...].
      const promoted: Boundary = { index: 0, label: first.label ?? start.label };
      workingBoundaries = [promoted, ...workingBoundaries.slice(2)];
    }
  }

  const out: Boundary[] = [workingBoundaries[0]];
  for (let i = 1; i < workingBoundaries.length; i++) {
    const prev = out[out.length - 1];
    const cur = workingBoundaries[i];
    const isLast = i === workingBoundaries.length - 1;
    // The "End" sentinel is always retained; segments ending at End may be < minChars.
    if (isLast) {
      out.push(cur);
      continue;
    }
    const segLen = cur.index - prev.index;
    if (segLen < minChars) {
      // Drop `cur` — extend `prev` segment forward.
      continue;
    }
    out.push(cur);
  }
  // Defensive: if everything collapsed (rare), keep at least Start + End.
  if (out.length < 2) {
    return [boundaries[0], boundaries[boundaries.length - 1]];
  }
  // Final coverage sanity: last out boundary must equal totalLen sentinel.
  if (out[out.length - 1].index !== totalLen) {
    out.push({ index: totalLen, label: "End" });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Chunk a manuscript into deterministic segments based on structure and size.
 *
 * @param rawText - The full manuscript text (staged/normalized)
 * @param config - Chunking parameters (optional overrides)
 * @returns Array of chunk specifications ready for database insertion
 */
export async function chunkManuscript(
  rawText: string,
  config: Partial<ChunkingConfig> = {},
): Promise<ChunkSpec[]> {
  const cfg = { ...DEFAULTS, ...config };
  const text = normalizeNewlines(rawText);

  const { all, hasChapter, hasScene, hasSectionOrBlank } = computeBoundaries(text, cfg);

  // Strict hierarchy filter — same intent as before, but `hasChapter` now means
  // "we found at least one chapter heading that survived TOC + strictness checks".
  let boundaries: Boundary[] = all;

  if (hasChapter) {
    boundaries = all.filter((b) => {
      if (b.index === 0) return true;
      const snippet = text.slice(b.index, Math.min(text.length, b.index + 120));
      return CHAPTER_RE.test(snippet) || CHAPTER_HASH_RE.test(snippet);
    });
  } else if (hasScene) {
    boundaries = all.filter((b) => {
      if (b.index === 0) return true;
      const snippet = text.slice(b.index, Math.min(text.length, b.index + 80));
      return SCENE_RE.test(snippet);
    });
  } else if (hasSectionOrBlank) {
    boundaries = all.filter((b) => {
      if (b.index === 0) return true;
      const snippet = text.slice(b.index, Math.min(text.length, b.index + 10));
      return /^\s*\*{3,}\s*/.test(snippet) || b.label === "BlankBreak";
    });
  } else {
    boundaries = [{ index: 0, label: "Start" }];
  }

  // Ensure last boundary at end for segment walking.
  const end = text.length;
  if (boundaries[boundaries.length - 1]?.index !== end) {
    boundaries.push({ index: end, label: "End" });
  }

  // Defense layer 3: min-segment-merge invariant. Eliminates the ability of the
  // size walker to emit sub-minChars chunks for short inter-boundary segments
  // (e.g. lingering single TOC entries that escaped the TOC heuristic).
  boundaries = mergeUndersizedSegments(boundaries, cfg.minChars, end);

  const chunks: ChunkSpec[] = [];
  let chunkIndex = 0;

  // Pre-compute segment cut points using look-ahead tail-folding so we never
  // emit a sub-minChars chunk except when the entire segment itself is < minChars.
  // For each segment we plan all cuts before emitting any chunk.
  for (let s = 0; s < boundaries.length - 1; s++) {
    const segStart = boundaries[s].index;
    const segEnd = boundaries[s + 1].index;
    const segLen = segEnd - segStart;

    // Plan cuts within the segment so no chunk is < minChars except possibly
    // when the entire segment is < minChars (in which case there is no fix).
    const cuts: number[] = [];
    let remaining = segLen;
    while (remaining > 0) {
      const cut = Math.min(cfg.maxChars, remaining);
      cuts.push(cut);
      remaining -= cut;
    }
    // Rebalance the last two cuts if the tail is < minChars.
    // Borrow from the second-to-last cut down to (but not below) minChars,
    // and give to the tail until it is ≥ minChars or no more can be borrowed.
    if (cuts.length >= 2) {
      let i = cuts.length - 1;
      while (i > 0 && cuts[i] < cfg.minChars) {
        const need = cfg.minChars - cuts[i];
        const canBorrow = Math.max(0, cuts[i - 1] - cfg.minChars);
        const borrow = Math.min(need, canBorrow);
        if (borrow === 0) break;
        cuts[i - 1] -= borrow;
        cuts[i] += borrow;
      }
      // If even after rebalance the tail is still < minChars (segment too short
      // for two min-sized chunks), merge the tail into its predecessor when
      // doing so doesn't push the predecessor above maxChars.
      while (cuts.length >= 2 && cuts[cuts.length - 1] < cfg.minChars) {
        const tail = cuts[cuts.length - 1];
        const prev = cuts[cuts.length - 2];
        if (prev + tail <= cfg.maxChars) {
          cuts[cuts.length - 2] = prev + tail;
          cuts.pop();
        } else {
          break; // can't merge without exceeding maxChars
        }
      }
    }

    // Emit chunks per planned cut.
    let cursor = 0;
    for (const cut of cuts) {
      const baseStart = segStart + cursor;
      const baseEnd = baseStart + cut;

      const overlap = chunkIndex === 0 ? 0 : Math.min(cfg.overlapChars, baseStart);
      const overlapStart = baseStart - overlap;

      const content = text.slice(overlapStart, baseEnd);
      const content_hash = await sha256Hex(content);

      chunks.push({
        chunk_index: chunkIndex,
        char_start: baseStart,
        char_end: baseEnd,
        overlap_chars: overlap,
        label: boundaries[s].label ?? null,
        content,
        content_hash,
      });

      chunkIndex += 1;
      cursor += cut;
    }
  }

  // Filter any zero-length chunks (safety).
  return chunks.filter((c) => c.char_end > c.char_start && c.content.trim().length > 0);
}
