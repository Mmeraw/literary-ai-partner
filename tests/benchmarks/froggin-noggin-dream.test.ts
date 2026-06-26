import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ACTIVE_BENCHMARK_PATH = join(
  process.cwd(),
  "docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md"
);

const ARCHIVE_PATH = join(
  process.cwd(),
  "docs/benchmarks/archive/froggin-noggin-dream.md"
);

function readBenchmark(): string {
  return readFileSync(ACTIVE_BENCHMARK_PATH, "utf8");
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
  it("has canonical front matter pointing to governed-ledger schema", () => {
    const frontmatter = parseFrontMatter(readBenchmark());
    expect(frontmatter["benchmark-schema"]).toBe("dream-longform-v2-governed-ledgers");
    expect(frontmatter["benchmark-tier"]).toBe("required-gold");
    expect(frontmatter["criteria-spine"]).toBe("canonical-13");
  });

  it("references archived source benchmarks", () => {
    const benchmark = readBenchmark();
    expect(benchmark).toContain("docs/benchmarks/archive/froggin-noggin-dream.md");
  });

  it("archive stub exists and points to active benchmark", () => {
    expect(existsSync(ARCHIVE_PATH)).toBe(true);
    const archive = readFileSync(ARCHIVE_PATH, "utf8");
    expect(archive).toContain("froggin-noggin-dream-longform-multilayer-gold-standard.md");
  });
});
