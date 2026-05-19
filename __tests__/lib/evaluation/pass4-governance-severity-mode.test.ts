/**
 * Pass 4 Governance — Severity + Mode Enforcement — RETIRED
 *
 * ARCHIVED: Pass 4 retired in favor of dual-model parallel scoring
 * (feat/dual-model-parallel-scoring). The runtime governance gate that this
 * test enforced is no longer invoked by runPipeline; evaluatePass4Governance
 * is preserved on disk for type/import back-compat but is not called.
 *
 * The previous assertions checked the consumer-side gate for severity + mode
 * branching. After retirement, the file is preserved as a marker so the
 * test suite documents the contract change. The retained assertion verifies
 * that the legacy governance call is gone.
 */

import { describe, test, expect } from "@jest/globals";
import * as fs from "fs/promises";
import * as path from "path";

describe("Pass 4 Governance — Retired", () => {
  test("runPipeline no longer invokes evaluatePass4Governance", async () => {
    const pipelinePath = path.join(
      process.cwd(),
      "lib/evaluation/pipeline/runPipeline.ts",
    );
    const source = await fs.readFile(pipelinePath, "utf-8");
    // The retired call site invoked evaluatePass4Governance(crossCheckResult).
    // After retirement, only commentary about the retirement may reference it.
    expect(source).not.toMatch(/^\s*pass4Governance\s*=\s*evaluatePass4Governance\s*\(/m);
  });
});
