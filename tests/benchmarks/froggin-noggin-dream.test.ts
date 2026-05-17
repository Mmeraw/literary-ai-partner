import { readFileSync } from "node:fs";
import { join } from "node:path";

const BENCHMARK_PATH = join(
  process.cwd(),
  "docs/benchmarks/froggin-noggin-dream.md"
);

const CANONICAL_HEADINGS = [
  "## Concept & Core Premise",
  "## Narrative Drive & Momentum",
  "## Character Depth & Psychological Coherence",
  "## Point of View & Voice Control",
  "## Scene Construction & Function",
  "## Dialogue Authenticity & Subtext",
  "## Thematic Integration",
  "## World-Building & Environmental Logic",
  "## Pacing & Structural Balance",
  "## Prose Control & Line-Level Craft",
  "## Tonal Authority & Consistency",
  "## Narrative Closure & Promises Kept",
  "## Professional Readiness & Market Positioning",
];

function readBenchmark(): string {
  return readFileSync(BENCHMARK_PATH, "utf8");
}

function parseFrontMatter(doc: string): Record<string, string> {
  const match = doc.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const lines = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    parsed[key] = value;
  }

  return parsed;
}

describe("Froggin Noggin DREAM Benchmark", () => {
  it("has canonical front matter", () => {
    const frontmatter = parseFrontMatter(readBenchmark());
    expect(frontmatter["benchmark-schema"]).toBe("canonical-13-v1");
  });

  it("contains canonical 13-criteria score grid coverage", () => {
    const benchmark = readBenchmark();
    expect(benchmark).toContain("## Score grid — canonical 13 criteria");

    for (const heading of CANONICAL_HEADINGS) {
      const label = heading.replace(/^##\s*/, "").trim();
      expect(benchmark).toContain(label);
    }

    expect(benchmark).toMatch(/\|\s*Criterion\s*\|\s*Score\s*\|\s*Confidence\s*\|/i);
    expect(benchmark).toMatch(/\bHigh\b|\bModerate\b|\bLow\b/i);
  });

  it("contains required disclaimer", () => {
    const disclaimer = readBenchmark().match(
      /manual gold-standard benchmark|not be used to assert/i
    );
    expect(disclaimer).not.toBeNull();
  });
});
