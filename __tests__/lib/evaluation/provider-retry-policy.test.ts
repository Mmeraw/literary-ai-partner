import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { OPENAI_SDK_MAX_RETRIES } from "@/lib/evaluation/policy";

const LIVE_OPENAI_PASS_FILES = [
  "lib/evaluation/pipeline/runPass1.ts",
  "lib/evaluation/pipeline/runPass2.ts",
  "lib/evaluation/pipeline/runPass3Synthesis.ts",
] as const;

describe("provider retry policy", () => {
  it("keeps OpenAI SDK retry ceiling explicit and low", () => {
    expect(OPENAI_SDK_MAX_RETRIES).toBe(1);
  });

  it("prevents hardcoded retry drift in live OpenAI pass files", () => {
    for (const file of LIVE_OPENAI_PASS_FILES) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(content).toContain("OPENAI_SDK_MAX_RETRIES");
      expect(content).not.toMatch(/maxRetries:\s*2/);
      expect(content).not.toMatch(/maxRetries:\s*0/);
    }
  });
});
