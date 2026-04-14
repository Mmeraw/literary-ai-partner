const {
  buildPromptInputWindow,
  summarizePromptCoverage,
  buildCoverageDisclosure,
} = require("../../../lib/evaluation/pipeline/promptInput");

describe("promptInput helpers", () => {
  test("keeps full text when under budget", () => {
    const text = "alpha beta gamma";
    const window = buildPromptInputWindow(text, 1000);
    const coverage = summarizePromptCoverage(text, 1000);

    expect(window).toBe(text);
    expect(coverage.truncated).toBe(false);
    expect(coverage.sourceWords).toBe(3);
    expect(buildCoverageDisclosure(coverage)).toMatch(/full submission included/i);
  });

  test("samples beginning middle and end when over budget", () => {
    const text = Array.from({ length: 12000 }, (_, idx) => `word${idx}`).join(" ");
    const window = buildPromptInputWindow(text, 12000);
    const coverage = summarizePromptCoverage(text, 12000);

    expect(window).toContain("middle of manuscript omitted");
    expect(window).toContain("word0");
    expect(window).toContain("word6000");
    expect(window).toContain("word11999");
    expect(coverage.truncated).toBe(true);
    expect(coverage.strategy).toBe("sampled_beginning_middle_end");
    expect(buildCoverageDisclosure(coverage)).toMatch(/sampled beginning\/middle\/end window/i);
  });
});
