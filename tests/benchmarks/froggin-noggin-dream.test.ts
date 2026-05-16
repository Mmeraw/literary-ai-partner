import benchmark from "../../docs/benchmarks/froggin-noggin-dream.md";
import { validateBenchmarkSchema } from "../../lib/benchmark/validate";

describe("Froggin Noggin DREAM Benchmark", () => {
  it("has canonical front matter", () => {
    const frontmatter = benchmark.frontmatter || {};
    expect(frontmatter["benchmark-schema"]).toBe("canonical-13-v1");
    expect(frontmatter.canonical).toBe(true);
    expect(frontmatter.version).toBeDefined();
    expect(frontmatter.title).toBeDefined();
  });

  it("contains 13 canonical criteria", () => {
    const criteria = validateBenchmarkSchema(benchmark);
    expect(criteria.length).toBe(13);
    criteria.forEach(c => {
      expect(c.id).toBeDefined();
      expect(c.description).toBeDefined();
      expect(c.confidence).toMatch(/high|medium|low/);
    });
  });

  it("contains required disclaimer", () => {
    const disclaimer = benchmark.content.match(/DISCLAIMER/i);
    expect(disclaimer).not.toBeNull();
  });
});
