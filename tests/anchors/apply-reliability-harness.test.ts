import { describe, expect, test } from "@jest/globals";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { applyProposalsBatchStrict } from "@/lib/revision/applyBatch";
import type { ChangeProposal } from "@/lib/revision/types";

type ValidHarnessCase = {
  id: string;
  source: string;
  proposals: ChangeProposal[];
  expectedOutput: string;
};

type InvalidHarnessCase = {
  id: string;
  source: string;
  proposals: ChangeProposal[];
  expectedError: RegExp;
  mode?: "single-run" | "stale-reapply";
};

type HarnessMetrics = {
  valid_total: number;
  valid_pass: number;
  valid_success_rate: number;
  wrong_location_edits_total: number;
  invalid_total: number;
  invalid_expected_failures: number;
  invalid_unexpected_passes: number;
  invalid_wrong_error_shape: number;
  pass: boolean;
};

function buildProposal(
  source: string,
  original: string,
  replacement: string,
  overrides: Partial<ChangeProposal> = {},
): ChangeProposal {
  const start = source.indexOf(original);
  if (start === -1) {
    throw new Error(`Original text not found in source: ${original}`);
  }
  const end = start + original.length;

  return {
    id: overrides.id ?? `${start}-${end}-${original}`,
    revision_session_id: overrides.revision_session_id ?? "session-packd",
    location_ref: overrides.location_ref ?? "loc:1",
    rule: overrides.rule ?? "clarity",
    action: overrides.action ?? "refine",
    original_text: overrides.original_text ?? original,
    proposed_text: overrides.proposed_text ?? replacement,
    justification: overrides.justification ?? "harness",
    severity: overrides.severity ?? "medium",
    decision: overrides.decision ?? "accepted",
    modified_text: overrides.modified_text ?? null,
    start_offset: overrides.start_offset ?? start,
    end_offset: overrides.end_offset ?? end,
    before_context:
      overrides.before_context ?? source.slice(Math.max(0, start - 40), start),
    after_context:
      overrides.after_context ?? source.slice(end, Math.min(source.length, end + 40)),
    anchor_text_normalized:
      overrides.anchor_text_normalized ?? original.replace(/\r\n/g, "\n"),
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

function loadDeterministicCorpus(): {
  validCases: ValidHarnessCase[];
  invalidCases: InvalidHarnessCase[];
} {
  const validCases: ValidHarnessCase[] = [];

  for (let i = 0; i < 180; i += 1) {
    const source = `Doc ${i}: Alpha beta gamma delta.\nTail ${i}.`;
    const proposal = buildProposal(source, "beta", `BETA_${i}`);
    validCases.push({
      id: `bulk-${i}`,
      source,
      proposals: [proposal],
      expectedOutput: source.replace("beta", `BETA_${i}`),
    });
  }

  const sourceAdjacent = "abcdef";
  const pAdj1 = buildProposal(sourceAdjacent, "ab", "AB", {
    id: "adj-1",
    start_offset: 0,
    end_offset: 2,
    original_text: "ab",
    before_context: "",
    after_context: "cdef",
  });
  const pAdj2 = buildProposal(sourceAdjacent, "cd", "CD", {
    id: "adj-2",
    start_offset: 2,
    end_offset: 4,
    original_text: "cd",
    before_context: "ab",
    after_context: "ef",
  });
  validCases.push({
    id: "adjacent-valid",
    source: sourceAdjacent,
    proposals: [pAdj1, pAdj2],
    expectedOutput: "ABCDef",
  });

  const sourceUnicode = "The café said, “wait—now.”\nNext line.";
  validCases.push({
    id: "unicode-multiline",
    source: sourceUnicode,
    proposals: [buildProposal(sourceUnicode, "café", "bistro")],
    expectedOutput: sourceUnicode.replace("café", "bistro"),
  });

  const invalidCases: InvalidHarnessCase[] = [];

  const sourceOverlap = "abcdefg";
  const pOverlap1 = buildProposal(sourceOverlap, "bcd", "BCD", {
    id: "ov-1",
    start_offset: 1,
    end_offset: 4,
    original_text: "bcd",
    before_context: "a",
    after_context: "efg",
  });
  const pOverlap2 = buildProposal(sourceOverlap, "cde", "CDE", {
    id: "ov-2",
    start_offset: 2,
    end_offset: 5,
    original_text: "cde",
    before_context: "ab",
    after_context: "fg",
  });
  invalidCases.push({
    id: "overlap-rejection",
    source: sourceOverlap,
    proposals: [pOverlap1, pOverlap2],
    expectedError: /Overlapping proposals detected/,
  });

  const sourceDup = "abcdef";
  const pDup1 = buildProposal(sourceDup, "cd", "CD", { id: "dup-1" });
  const pDup2 = buildProposal(sourceDup, "cd", "XX", { id: "dup-2" });
  invalidCases.push({
    id: "duplicate-rejection",
    source: sourceDup,
    proposals: [pDup1, pDup2],
    expectedError: /Duplicate proposal range detected/,
  });

  const sourceStale = "Alpha beta gamma.";
  const pStale = buildProposal(sourceStale, "beta", "BETA", { id: "stale-1" });
  invalidCases.push({
    id: "stale-anchor-reapply",
    source: sourceStale,
    proposals: [pStale],
    expectedError: /source slice does not match original_text|before\/after context verification failed/,
    mode: "stale-reapply",
  });

  return { validCases, invalidCases };
}

function runDeterministicHarness(
  validCases: ValidHarnessCase[],
  invalidCases: InvalidHarnessCase[],
): HarnessMetrics {
  let validPass = 0;
  let wrongLocation = 0;

  for (const c of validCases) {
    const result = applyProposalsBatchStrict(c.source, c.proposals);
    if (result.output_text === c.expectedOutput) {
      validPass += 1;
    } else {
      wrongLocation += 1;
    }
  }

  let invalidExpectedFailures = 0;
  let invalidUnexpectedPasses = 0;
  let invalidWrongErrorShape = 0;

  for (const c of invalidCases) {
    try {
      if (c.mode === "stale-reapply") {
        const first = applyProposalsBatchStrict(c.source, c.proposals);
        applyProposalsBatchStrict(first.output_text, c.proposals);
      } else {
        applyProposalsBatchStrict(c.source, c.proposals);
      }
      invalidUnexpectedPasses += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (c.expectedError.test(message)) {
        invalidExpectedFailures += 1;
      } else {
        invalidWrongErrorShape += 1;
      }
    }
  }

  const validSuccessRate = (validPass / validCases.length) * 100;
  const pass =
    validSuccessRate >= 99.5 &&
    wrongLocation === 0 &&
    invalidUnexpectedPasses === 0 &&
    invalidWrongErrorShape === 0;

  return {
    valid_total: validCases.length,
    valid_pass: validPass,
    valid_success_rate: validSuccessRate,
    wrong_location_edits_total: wrongLocation,
    invalid_total: invalidCases.length,
    invalid_expected_failures: invalidExpectedFailures,
    invalid_unexpected_passes: invalidUnexpectedPasses,
    invalid_wrong_error_shape: invalidWrongErrorShape,
    pass,
  };
}

function writeReportArtifacts(metrics: HarnessMetrics): void {
  const outDirEnv = process.env.PACK_D_REPORT_DIR;
  if (!outDirEnv) return;

  const outDir = path.isAbsolute(outDirEnv)
    ? outDirEnv
    : path.join(process.cwd(), outDirEnv);

  mkdirSync(outDir, { recursive: true });

  const reportJsonPath = path.join(outDir, "packD_apply_reliability_report.json");
  const reportMdPath = path.join(outDir, "packD_apply_reliability_report.md");

  writeFileSync(reportJsonPath, JSON.stringify(metrics, null, 2));

  const md = [
    "# Pack D Apply Reliability Report",
    "",
    `- valid_total: ${metrics.valid_total}`,
    `- valid_pass: ${metrics.valid_pass}`,
    `- valid_success_rate: ${metrics.valid_success_rate.toFixed(3)}%`,
    `- wrong_location_edits_total: ${metrics.wrong_location_edits_total}`,
    `- invalid_total: ${metrics.invalid_total}`,
    `- invalid_expected_failures: ${metrics.invalid_expected_failures}`,
    `- invalid_unexpected_passes: ${metrics.invalid_unexpected_passes}`,
    `- invalid_wrong_error_shape: ${metrics.invalid_wrong_error_shape}`,
    `- pass: ${metrics.pass}`,
    "",
    "## Gates",
    "",
    "- valid_success_rate >= 99.5",
    "- wrong_location_edits_total == 0",
    "- invalid_unexpected_passes == 0",
    "- invalid_wrong_error_shape == 0",
    "",
  ].join("\n");

  writeFileSync(reportMdPath, md);
}

describe("Pack D apply reliability harness", () => {
  test("meets deterministic apply reliability gates", () => {
    const { validCases, invalidCases } = loadDeterministicCorpus();
    const metrics = runDeterministicHarness(validCases, invalidCases);
    writeReportArtifacts(metrics);

    expect(metrics.valid_total).toBeGreaterThanOrEqual(180);
    expect(metrics.valid_success_rate).toBeGreaterThanOrEqual(99.5);
    expect(metrics.wrong_location_edits_total).toBe(0);
    expect(metrics.invalid_unexpected_passes).toBe(0);
    expect(metrics.invalid_wrong_error_shape).toBe(0);
    expect(metrics.pass).toBe(true);
  });
});
