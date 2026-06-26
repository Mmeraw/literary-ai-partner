/**
 * Gold-standard benchmark structural smoke test
 *
 * Validates the SHAPE of any benchmark file in `docs/benchmarks/*.md`
 * that opts in to the canonical-13 schema by setting front-matter:
 *
 *   ---
 *   benchmark-schema: canonical-13-v1
 *   ---
 *
 * For files that opt in we require:
 *   - the canonical 13 named criteria are all present in the score grid
 *   - every score is a number in [0, 10]
 *   - every confidence value is one of the allowed labels
 *   - a disclaimer is present stating the file is a manual reference,
 *     not a production assertion
 *
 * Files without the opt-in are ignored. This lets noncanonical historical
 * variants coexist with newer canonical-13 files without granting them
 * current benchmark authority.
 *
 * This test does NOT compare any production output to these scores.
 * The benchmarks are manual reference quality bars (see
 * `docs/benchmarks/README.md`).
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const BENCHMARKS_DIR = join(__dirname, "..", "..", "..", "docs", "benchmarks");

const CANONICAL_13_CRITERIA = [
  "Concept & Core Premise",
  "Narrative Drive & Momentum",
  "Character Depth & Psychological Coherence",
  "Point of View & Voice Control",
  "Scene Construction & Function",
  "Dialogue Authenticity & Subtext",
  "Thematic Integration",
  "World-Building & Environmental Logic",
  "Pacing & Structural Balance",
  "Prose Control & Line-Level Craft",
  "Tonal Authority & Consistency",
  "Narrative Closure & Promises Kept",
  "Professional Readiness & Market Positioning",
];

const ALLOWED_CONFIDENCE = new Set([
  "High",
  "Moderate",
  "Moderate-High",
  "Moderate-Low",
  "Low",
]);

const RECOGNIZED_SCHEMAS = [
  "canonical-13-v1",
  "dream-longform-v2-governed-ledgers",
];

interface ParsedRow {
  criterion: string;
  score: number;
  confidence: string;
}

function hasCanonical13FrontMatter(markdown: string): boolean {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return false;
  const body = fm[1];
  const hasSchema = RECOGNIZED_SCHEMAS.some((tag) =>
    new RegExp(`benchmark-schema:\\s*${tag}\\b`).test(body),
  );
  if (!hasSchema) return false;
  // V2 addenda, seeds, and candidate-tier files don't contain a full
  // 13-criteria score grid — skip them. Only validate primary benchmark
  // bodies that are expected to have the full score grid.
  if (/source-benchmark:/.test(body)) return false;
  if (/benchmark-role:.*(?:extension|seed)/.test(body)) return false;
  if (/benchmark-tier:.*candidate/.test(body)) return false;
  // Merged stubs (marker files that reference archived sources but have no
  // score grid content) are excluded by checking for a score table pattern
  // in the body below the front-matter.
  const afterFm = markdown.slice(fm[0].length);
  if (!/\|\s*\d+\s*\/\s*10\s*\|/.test(afterFm)) return false;
  return true;
}

function parseScoreGrid(markdown: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, arr) => !(i === 0 || i === arr.length - 1));
    if (cells.length < 3) continue;

    // Find the score cell dynamically — it contains N / 10
    let scoreIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const clean = cells[i].replace(/\*\*/g, "").trim();
      if (/^\d+\.?\d*\s*\/\s*10$/.test(clean)) { scoreIdx = i; break; }
    }
    if (scoreIdx < 0) continue;

    // Criterion is the cell immediately before the score
    const criterionIdx = scoreIdx - 1;
    // Confidence is the cell immediately after the score
    const confidenceIdx = scoreIdx + 1;
    if (criterionIdx < 0 || confidenceIdx >= cells.length) continue;

    const scoreCell = cells[scoreIdx].replace(/\*\*/g, "").trim();
    const scoreMatch = scoreCell.match(/^([\d.]+)\s*\/\s*10$/);
    if (!scoreMatch) continue;

    rows.push({
      criterion: cells[criterionIdx],
      score: parseFloat(scoreMatch[1]),
      confidence: cells[confidenceIdx].replace(/\s+Confidence$/i, ""),
    });
  }
  return rows;
}

function listCanonical13Files(): string[] {
  if (!existsSync(BENCHMARKS_DIR)) return [];
  return readdirSync(BENCHMARKS_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => join(BENCHMARKS_DIR, f))
    .filter((p) => hasCanonical13FrontMatter(readFileSync(p, "utf8")));
}

describe("docs/benchmarks canonical-13 gold-standard shape", () => {
  const files = listCanonical13Files();

  it("at least one canonical-13-v1 benchmark exists", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe.each(files)("%s", (filePath) => {
    const markdown = readFileSync(filePath, "utf8");
    const rows = parseScoreGrid(markdown);

    it("score grid parses to at least 13 rows", () => {
      expect(rows.length).toBeGreaterThanOrEqual(13);
    });

    it("contains all 13 canonical criteria by name", () => {
      const criterionNames = new Set(rows.map((r) => r.criterion));
      const missing = CANONICAL_13_CRITERIA.filter(
        (name) => !criterionNames.has(name),
      );
      expect(missing).toEqual([]);
    });

    it("every score is a number in [0, 10]", () => {
      for (const row of rows) {
        expect(typeof row.score).toBe("number");
        expect(Number.isNaN(row.score)).toBe(false);
        expect(row.score).toBeGreaterThanOrEqual(0);
        expect(row.score).toBeLessThanOrEqual(10);
      }
    });

    it("every confidence value is in the allowed set", () => {
      for (const row of rows) {
        expect(ALLOWED_CONFIDENCE.has(row.confidence)).toBe(true);
      }
    });

    it("includes a manual-reference disclaimer (not a production claim)", () => {
      const lower = markdown.toLowerCase();
      const hasDisclaimer =
        lower.includes("manual gold-standard benchmark") ||
        lower.includes("not a production output claim") ||
        lower.includes("manual reference quality bar");
      expect(hasDisclaimer).toBe(true);
    });
  });
});
