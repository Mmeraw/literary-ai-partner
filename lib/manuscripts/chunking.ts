// lib/manuscripts/chunking.ts
// Deterministic, idempotent manuscript chunking for Phase 1
// Implements boundary hierarchy: chapter → scene → section/blank → size fallback

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
  targetChars: number;     // 8000
  maxChars: number;        // 12000
  overlapChars: number;    // 500
};

const DEFAULTS: ChunkingConfig = {
  minChars: 3000,
  targetChars: 8000,
  maxChars: 12000,
  overlapChars: 500,
};

function isBoundaryLine(line: string) {
  // Chapter headings (loose, practical)
  const chapter =
    /^\s*(chapter|ch\.?)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(line) ||
    /^\s*#\s*chapter\b/i.test(line);

  // Screenplay scene headings
  const scene = /^\s*(INT\.|EXT\.|INT\/EXT\.)\b/.test(line);

  // Section breaks (*** alone on a line)
  const section = /^\s*\*{3,}\s*$/.test(line);

  return { chapter, scene, section };
}

function isTripleBlankBoundary(prevLine: string, line: string, nextLine: string) {
  // "3+ blank lines" approximation across line neighbors
  const blank = (s: string) => s.trim().length === 0;
  return blank(prevLine) && blank(line) && blank(nextLine);
}

function computeBoundaries(text: string): Array<{ index: number; label?: string }> {
  // Boundary indices are character offsets where a new segment can start.
  const lines = text.split(/\r?\n/);
  const boundaries: Array<{ index: number; label?: string }> = [{ index: 0, label: "Start" }];

  // Track running char offset for each line start.
  let offset = 0;
  const lineStarts: number[] = [];
  for (const ln of lines) {
    lineStarts.push(offset);
    offset += ln.length + 1; // +1 for "\n" (good enough for deterministic offsets after normalization)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { chapter, scene, section } = isBoundaryLine(line);

    // Strict hierarchy is applied later; here we just record all candidate boundaries with labels.
    if (chapter) boundaries.push({ index: lineStarts[i], label: line.trim().slice(0, 80) });
    else if (scene) boundaries.push({ index: lineStarts[i], label: line.trim().slice(0, 80) });
    else if (section) boundaries.push({ index: lineStarts[i], label: "***" });

    const prevLine = lines[i - 1] ?? "";
    const nextLine = lines[i + 1] ?? "";
    if (isTripleBlankBoundary(prevLine, line, nextLine)) {
      boundaries.push({ index: lineStarts[i], label: "BlankBreak" });
    }
  }

  // De-dupe + sort
  const seen = new Set<number>();
  const unique = boundaries
    .sort((a, b) => a.index - b.index)
    .filter((b) => (seen.has(b.index) ? false : (seen.add(b.index), true)));

  return unique;
}

function pickBoundaryHierarchy(text: string) {
  // Strict hierarchy:
  // If we detect ANY chapter headings, use only chapter boundaries.
  // Else if ANY screenplay scenes, use only scene boundaries.
  // Else if ANY section breaks / 3+ blanks, use those.
  // Else fallback to size-only (boundary list = [0]).
  const lines = text.split(/\r?\n/);
  let hasChapter = false;
  let hasScene = false;
  let hasSectionOrBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { chapter, scene, section } = isBoundaryLine(line);
    if (chapter) hasChapter = true;
    if (scene) hasScene = true;
    if (section) hasSectionOrBlank = true;

    const prevLine = lines[i - 1] ?? "";
    const nextLine = lines[i + 1] ?? "";
    if (isTripleBlankBoundary(prevLine, line, nextLine)) hasSectionOrBlank = true;
  }

  return { hasChapter, hasScene, hasSectionOrBlank };
}

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// You can swap this out for crypto.subtle (edge) or node:crypto (server).
async function sha256Hex(input: string): Promise<string> {
  // Check if we're in Node.js or Edge runtime
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser/Edge runtime
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(hash));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    // Node.js runtime (for server-side usage)
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }
}

/**
 * Chunk a manuscript into deterministic segments based on structure and size.
 * 
 * Boundary hierarchy (strict order):
 * 1. Chapter headings (CHAPTER, Chapter, roman numerals, numeric)
 * 2. Scene headings (INT./EXT. for screenplays)
 * 3. Section breaks (*** or 3+ blank lines)
 * 4. Size-based fallback if no structure exists
 * 
 * @param rawText - The full manuscript text (staged/normalized)
 * @param config - Chunking parameters (optional overrides)
 * @returns Array of chunk specifications ready for database insertion
 */
export async function chunkManuscript(
  rawText: string,
  config: Partial<ChunkingConfig> = {}
): Promise<ChunkSpec[]> {
  const cfg = { ...DEFAULTS, ...config };
  const text = normalizeNewlines(rawText);

  const hierarchy = pickBoundaryHierarchy(text);
  const all = computeBoundaries(text);

  // Filter boundaries according to strict hierarchy
  let boundaries = all;

  if (hierarchy.hasChapter) {
    boundaries = all.filter((b) => {
      const lineStart = b.index;
      // Keep Start, plus chapter boundaries (best-effort label check)
      if (lineStart === 0) return true;
      const snippet = text.slice(lineStart, Math.min(text.length, lineStart + 120));
      return /^\s*(chapter|ch\.?)\s+/i.test(snippet) || /^\s*#\s*chapter\b/i.test(snippet);
    });
  } else if (hierarchy.hasScene) {
    boundaries = all.filter((b) => {
      if (b.index === 0) return true;
      const snippet = text.slice(b.index, Math.min(text.length, b.index + 80));
      return /^\s*(INT\.|EXT\.|INT\/EXT\.)\b/.test(snippet);
    });
  } else if (hierarchy.hasSectionOrBlank) {
    boundaries = all.filter((b) => {
      if (b.index === 0) return true;
      const snippet = text.slice(b.index, Math.min(text.length, b.index + 10));
      // Keep "***" boundaries and blank-break markers
      return /^\s*\*{3,}\s*/.test(snippet) || b.label === "BlankBreak";
    });
  } else {
    boundaries = [{ index: 0, label: "Start" }];
  }

  // Ensure last boundary at end for segment walking
  const end = text.length;
  if (boundaries[boundaries.length - 1]?.index !== end) boundaries.push({ index: end, label: "End" });

  const chunks: ChunkSpec[] = [];
  let chunkIndex = 0;

  for (let s = 0; s < boundaries.length - 1; s++) {
    const segStart = boundaries[s].index;
    const segEnd = boundaries[s + 1].index;
    const segText = text.slice(segStart, segEnd);

    // Walk this segment into size-based chunks
    let cursor = 0;
    while (cursor < segText.length) {
      const remaining = segText.length - cursor;
      const baseStart = segStart + cursor;

      // Preferred cut point
      let cut = Math.min(cfg.targetChars, remaining);

      // If remaining is small, just take it
      if (remaining <= cfg.maxChars) {
        cut = remaining;
      } else {
        // If we can, try to push cut up toward max for fewer chunks
        cut = Math.min(cfg.maxChars, remaining);
      }

      // Enforce min/max
      if (cut < cfg.minChars && remaining > cfg.minChars) {
        cut = cfg.minChars;
      }

      const baseEnd = baseStart + cut;

      // Overlap with previous chunk
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

  // Filter any zero-length chunks (safety)
  return chunks.filter((c) => c.char_end > c.char_start && c.content.trim().length > 0);
}
