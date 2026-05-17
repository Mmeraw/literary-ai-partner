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
  "## POV & Voice Control",
  "## Scene Construction & Function",
  "## Dialogue & Interaction",
  "## Theme & Message",
  "## Worldbuilding & Setting",
  "## Pacing & Flow",
  "## Prose Control & Clarity",
  "## Tone & Style Consistency",
  "## Narrative Closure",
  "## Marketability / Release Readiness",
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

function sectionBodies(doc: string): string[] {
  const sections = doc.split(/\n##\s+/).slice(1);
  return sections.map((s) => s.trim());
}

describe("Froggin Noggin DREAM Benchmark", () => {
  it("has canonical front matter", () => {
    const frontmatter = parseFrontMatter(readBenchmark());
    expect(frontmatter["benchmark-schema"]).toBe("canonical-13-v1");
    expect(frontmatter.canonical).toBe("true");
    expect(frontmatter.version).toBeDefined();
    expect(frontmatter.title).toBeDefined();
  });

  it("contains 13 canonical criteria", () => {
    const benchmark = readBenchmark();
    const sections = sectionBodies(benchmark).filter(
      (section) => !section.startsWith("DISCLAIMER")
    );

    expect(sections.length).toBe(13);

    for (const heading of CANONICAL_HEADINGS) {
      expect(benchmark).toContain(heading);
    }

    sections.forEach((section) => {
      expect(section).toMatch(/- id:\s*.+/i);
      expect(section).toMatch(/- Description:\s*.+/i);
      expect(section).toMatch(/- Confidence:\s*(high|medium|low)\b/i);
    });
  });

  it("contains required disclaimer", () => {
    const disclaimer = readBenchmark().match(/##\s*DISCLAIMER/i);
    expect(disclaimer).not.toBeNull();
  });
});
