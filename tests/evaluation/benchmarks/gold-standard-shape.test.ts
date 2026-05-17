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
 * Files without the opt-in are ignored. This lets legacy benchmark
 * variants (e.g. the original Ancient Bloodlines files, which use
 * abbreviated criterion names) coexist with newer canonical-13 files.
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

const SCHEMA_TAG = "canonical-13-v1";

interface ParsedRow {
  criterion: string;
  score: number;
  confidence: string;
}

function hasCanonical13FrontMatter(markdown: string): boolean {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return false;
  return new RegExp(`benchmark-schema:\\s*${SCHEMA_TAG}\\b`).test(fm[1]);
}

function parseScoreGrid(markdown: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, arr) => !(i === 0 || i === arr.length - 1));
    if (cells.length < 4) continue;

    // Support both 4-col (Criterion | Score | Confidence | ...) and
    // 5-col (# | Criterion | Score | Confidence | ...) table layouts.
    // Detect by checking if the second cell looks like a score.
    let criterionIdx = 0;
    let scoreIdx = 1;
    let confidenceIdx = 2;
    const cell1Stripped = cells[1].replace(/\*\*/g, "").trim();
    if (!cell1Stripped.match(/^[\d.]+\s*\/\s*10$/) && cells.length >= 5) {
      // 5-col layout: cells[0]=# cells[1]=Criterion cells[2]=Score cells[3]=Confidence
      criterionIdx = 1;
      scoreIdx = 2;
      confidenceIdx = 3;
    }

    const header = cells[scoreIdx].toLowerCase();
    if (/^-+:?$/.test(header) || header === "score") continue;

    const scoreCell = cells[scoreIdx].replace(/\*\*/g, "").trim();
    const scoreMatch = scoreCell.match(/^([\d.]+)\s*\/\s*10$/);
    if (!scoreMatch) continue;

    rows.push({
      criterion: cells[criterionIdx],
      score: parseFloat(scoreMatch[1]),
      confidence: cells[confidenceIdx],
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
