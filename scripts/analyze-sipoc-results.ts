/**
 * analyze-sipoc-results.ts
 *
 * SIPOC Results Analyzer — PR D (companion to run-sipoc-harness.ts)
 *
 * Reads artifacts/sipoc/sipoc-results.json and artifacts/sipoc/failure-matrix.json
 * produced by the harness and emits a human-readable summary to stdout.
 *
 * Usage:
 *   npm run sipoc:analyze
 *
 * Zero external dependencies. No runtime execution. No model calls.
 *
 * Authority: docs/SIPOC_EVALUATION_PROCESS.md
 */

import fs from "fs";
import path from "path";

const RESULTS_PATH = path.resolve("artifacts/sipoc/sipoc-results.json");
const MATRIX_PATH = path.resolve("artifacts/sipoc/failure-matrix.json");

function run(): void {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error(
      `[sipoc:analyze] ERROR: ${RESULTS_PATH} not found. Run 'npm run sipoc:harness' first.`
    );
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
  const matrix = fs.existsSync(MATRIX_PATH)
    ? JSON.parse(fs.readFileSync(MATRIX_PATH, "utf-8"))
    : null;

  const { summary } = results;

  console.log(`\n[sipoc:analyze] SIPOC Harness Results Analysis`);
  console.log(`  Run at      : ${results.run_at}`);
  console.log(`  Authority   : ${results.authority}`);
  console.log(`  Total       : ${summary.total}`);
  console.log(`  Passed      : ${summary.passed}`);
  console.log(`  Failed      : ${summary.failed}`);
  console.log("");

  // Stage breakdown
  console.log("Stage Coverage:");
  for (const [stageId, counts] of Object.entries(summary.by_stage) as [
    string,
    { total: number; passed: number; failed: number }
  ][]) {
    const status = counts.failed === 0 ? "✓" : "✗";
    console.log(
      `  ${status} ${stageId.padEnd(24)} ${counts.passed}/${counts.total} passed`
    );
  }
  console.log("");

  // Seeded stage coverage — which canonical stages have fixtures
  const CANONICAL_STAGES = [
    "S01_INTAKE",
    "S02_QUEUE",
    "S03_CLAIM",
    "S04_ROUTING_CHUNKING",
    "S05_PASS1",
    "S06_PASS2",
    "S07_PASS3",
    "S08_ER2_NORMALIZATION",
    "S09_QUALITYGATEV2",
    "S10_PERSISTENCE",
    "S11_RENDERER",
  ];
  const seeded = new Set(Object.keys(summary.by_stage));
  const unseeded = CANONICAL_STAGES.filter((s) => !seeded.has(s));
  if (unseeded.length > 0) {
    console.log(`Unseeded stages (no fixtures yet): ${unseeded.join(", ")}`);
    console.log("");
  }

  // Per-fixture detail for failures
  const failures = results.results.filter((r: { pass: boolean }) => !r.pass);
  if (failures.length > 0) {
    console.log("Contract Violations:");
    for (const f of failures) {
      console.error(`  ✗ [${f.stage_id}] ${f.fixture_id} — ${f.invariant_id}`);
      for (const v of f.violations) {
        console.error(`      · ${v}`);
      }
    }
    console.log("");
  }

  // Failure matrix summary
  if (matrix) {
    console.log("Failure Code Coverage (by stage):");
    for (const [stageId, entry] of Object.entries(matrix.by_stage) as [
      string,
      {
        fixtures_evaluated: number;
        required_failure_codes: string[];
        forbidden_failure_codes: string[];
        must_fail_closed_count: number;
      }
    ][]) {
      console.log(`  ${stageId}:`);
      console.log(`    fixtures     : ${entry.fixtures_evaluated}`);
      console.log(`    fail-closed  : ${entry.must_fail_closed_count}`);
      if (entry.required_failure_codes.length > 0) {
        console.log(`    required     : ${entry.required_failure_codes.join(", ")}`);
      }
      if (entry.forbidden_failure_codes.length > 0) {
        console.log(`    forbidden    : ${entry.forbidden_failure_codes.join(", ")}`);
      }
    }
    console.log("");
  }

  if (summary.failed > 0) {
    console.error(
      `[sipoc:analyze] Summary: ${summary.failed}/${summary.total} fixture(s) failed contract evaluation.\n`
    );
    process.exit(1);
  }

  console.log(
    `[sipoc:analyze] Summary: All ${summary.total} fixture(s) passed contract evaluation.\n`
  );
  process.exit(0);
}

run();
