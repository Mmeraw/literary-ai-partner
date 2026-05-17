import { describe, expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("resolveManuscriptText source priority guard", () => {
  test("file_url data URI is resolved before manuscript_chunks fallback", () => {
    const source = read("lib/evaluation/processor.ts");
    const fileUrlPriority = source.indexOf("Priority 2: Decode data URI from file_url");
    const chunkFallback = source.indexOf("Priority 3: Reconstruct from manuscript_chunks");

    expect(fileUrlPriority).toBeGreaterThan(-1);
    expect(chunkFallback).toBeGreaterThan(-1);
    expect(fileUrlPriority).toBeLessThan(chunkFallback);
    expect(source).toContain("resolveManuscriptText.file_url_data_uri");
    expect(source).toContain("resolveManuscriptText.manuscript_chunks_fallback");
  });

  test("chunk materialization has inflation invariants before persistence", () => {
    const source = read("lib/evaluation/processor.ts");

    expect(source).toContain("CHUNK_INDEX_RANGE_MISMATCH");
    expect(source).toContain("CHUNK_CONTENT_INFLATION");
    expect(source).toContain("baseIndexedChars");
    expect(source).toContain("totalOverlapChars");
  });
});
