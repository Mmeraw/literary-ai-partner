import { describe, expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("long-form zero-score contamination guard", () => {
  test("Pass 1 does not coerce invalid criterion scores to zero", () => {
    const source = read("lib/evaluation/pipeline/runPass1.ts");
    expect(source).not.toContain("? Math.round(Number(rawScore)) : 0");
    expect(source).not.toContain("Math.max(0, avgScore)");
    expect(source).toContain("PASS1_CHUNK_AGGREGATE_SCORE_MISSING");
  });

  test("Pass 2 does not coerce invalid criterion scores to zero", () => {
    const source = read("lib/evaluation/pipeline/runPass2.ts");
    expect(source).not.toContain("? Math.round(Number(rawScore)) : 0");
    expect(source).not.toContain("Math.max(0, avgScore)");
    expect(source).toContain("PASS2_CHUNK_AGGREGATE_SCORE_MISSING");
  });

  test("Pass 3 does not emit canonical scores below one", () => {
    const source = read("lib/evaluation/pipeline/runPass3Synthesis.ts");
    expect(source).not.toContain("Math.max(0,");
    expect(source).toContain("Math.max(1,");
  });

  test("Pass 4 remains strict about canonical score range", () => {
    const source = read("lib/evaluation/pipeline/perplexityCrossCheck.ts");
    expect(source).toContain("< 1");
    expect(source).toContain("canonValid");
  });
});
