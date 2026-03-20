import { describe, expect, test } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildA6Report } from "@/lib/evaluation/a6/buildA6Report";
import { writeA6Artifacts } from "@/lib/evaluation/a6/writeA6Artifacts";

describe("Phase 2.6 A6 artifact output", () => {
  test("writes JSON and Markdown artifacts", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "a6-artifacts-"));

    try {
      const sourceText =
        'The river moved slowly through the valley. "You said you would be here," she whispered.';

      const report = buildA6Report({
        evaluation_id: "eval_a6_artifact_1",
        criteria: [
          {
            name: "narrative_cohesion",
            score: 8.5,
            max_score: 10,
            reasoning: "Movement through the scene is coherent and easy to follow.",
            evidence_refs: ["anchor_1"],
          },
        ],
        anchors: [
          {
            anchor_id: "anchor_1",
            start_offset: 4,
            end_offset: 22,
            source_excerpt: sourceText.slice(4, 22),
          },
        ],
        source_text: sourceText,
        commit_sha: "artifactsha123",
        model_version: "a6-test",
      });

      const result = writeA6Artifacts(report, tempDir);

      expect(existsSync(result.json_path)).toBe(true);
      expect(existsSync(result.md_path)).toBe(true);

      const json = JSON.parse(readFileSync(result.json_path, "utf8")) as {
        evaluation_id: string;
      };
      const md = readFileSync(result.md_path, "utf8");

      expect(json.evaluation_id).toBe("eval_a6_artifact_1");
      expect(md).toContain("# A6 Report — eval_a6_artifact_1");
      expect(md).toContain("## Criteria Breakdown");
      expect(md).toContain("## Provenance Trace");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
