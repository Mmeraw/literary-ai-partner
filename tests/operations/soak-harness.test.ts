import { describe, expect, test } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  runSoakHarness,
  type SoakHarnessRunResult,
} from "@/lib/operations/soakHarness";
import { RevisionFailureCode } from "@/lib/errors/revisionCodes";

describe("Pack F soak harness", () => {
  test("runs deterministically, writes evidence artifacts, and preserves canonical metrics", async () => {
    const outputDir = mkdtempSync(path.join(os.tmpdir(), "pack-f-soak-"));

    let result: SoakHarnessRunResult;
    try {
      result = await runSoakHarness({
        events: 180,
        concurrency: 6,
        seed: 42,
        mode: "deterministic",
        outputDir,
        commitSha: "test-sha",
        branch: "test-branch",
      });

      expect(result.metrics.pass).toBe(true);
      expect(result.metrics.total_events_processed).toBe(180);
      expect(result.metrics.unclassified_failures_total).toBe(0);
      expect(result.metrics.wrong_location_edits_total).toBe(0);
      expect(result.metrics.lost_writes_total).toBe(0);
      expect(result.metrics.non_canonical_status_total).toBe(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.ANCHOR_MISS]).toBeGreaterThan(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.ANCHOR_AMBIGUOUS]).toBeGreaterThan(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.CONTEXT_MISMATCH]).toBeGreaterThan(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.OFFSET_CONFLICT]).toBeGreaterThan(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.PARSE_ERROR]).toBeGreaterThan(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.INVARIANT_VIOLATION]).toBeGreaterThan(0);
      expect(result.metrics.classified_failures_total[RevisionFailureCode.APPLY_COLLISION]).toBeGreaterThan(0);

      expect(existsSync(path.join(outputDir, "metadata.json"))).toBe(true);
      expect(existsSync(path.join(outputDir, "metrics.json"))).toBe(true);
      expect(existsSync(path.join(outputDir, "run.log"))).toBe(true);
      expect(existsSync(path.join(outputDir, "summary.md"))).toBe(true);
      expect(existsSync(path.join(outputDir, "failures_sample.json"))).toBe(true);

      const metricsJson = JSON.parse(
        readFileSync(path.join(outputDir, "metrics.json"), "utf8"),
      ) as SoakHarnessRunResult["metrics"];
      expect(metricsJson.total_events_processed).toBe(180);
      expect(metricsJson.pass).toBe(true);

      const summary = readFileSync(path.join(outputDir, "summary.md"), "utf8");
      expect(summary).toContain("pass/fail verdict: PASS");
      expect(summary).toContain("unclassified_failures_total");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
