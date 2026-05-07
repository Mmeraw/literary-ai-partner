/**
 * run-sipoc-harness.ts
 *
 * SIPOC Deterministic Contract Harness — PR D
 *
 * Evaluates each fixture in tests/fixtures/sipoc/ against its declared
 * contract using only fixture data + deterministic in-memory rule evaluation.
 *
 * Zero external dependencies:
 *   - No OpenAI calls
 *   - No production pipeline execution
 *   - No DB writes
 *   - No Supabase dependency
 *   - No worker execution
 *
 * Output artifacts (written to artifacts/sipoc/):
 *   sipoc-results.json   — per-fixture pass/fail + violation detail
 *   failure-matrix.json  — failure code coverage by stage
 *
 * Exits 0 if all fixtures pass contract evaluation.
 * Exits 1 if any contract violation is detected.
 *
 * Authority: docs/SIPOC_EVALUATION_PROCESS.md
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Canonical types (derived from schema.json — no drift permitted)
// ---------------------------------------------------------------------------

type StageId =
  | "S01_INTAKE"
  | "S02_QUEUE"
  | "S03_CLAIM"
  | "S04_ROUTING_CHUNKING"
  | "S05_PASS1"
  | "S06_PASS2"
  | "S07_PASS3"
  | "S08_ER2_NORMALIZATION"
  | "S09_QUALITYGATEV2"
  | "S10_PERSISTENCE"
  | "S11_RENDERER";

type ResultType = "pass" | "fail" | "warn";

interface FixtureExpected {
  result_type: ResultType;
  must_fail_closed: boolean;
  required_failure_codes: string[];
  forbidden_failure_codes?: string[];
  notes?: string;
}

interface SipocFixture {
  fixture_id: string;
  fixture_version: string;
  stage_id: StageId;
  track: string;
  severity?: string;
  invariant_id: string;
  description: string;
  input_stub?: Record<string, unknown>;
  expected: FixtureExpected;
  evidence_artifacts: string[];
  authority_refs?: {
    sipoc_contract: string;
    canon?: string[];
    spec?: string[];
    runtime?: string[];
  };
}

// ---------------------------------------------------------------------------
// Per-fixture result types
// ---------------------------------------------------------------------------

interface FixtureResult {
  fixture_id: string;
  fixture_version: string;
  stage_id: StageId;
  invariant_id: string;
  severity: string;
  pass: boolean;
  violations: string[];
  contract_assertions: string[];
}

interface HarnessResults {
  run_at: string;
  authority: string;
  fixture_dir: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    by_stage: Record<string, { total: number; passed: number; failed: number }>;
  };
  results: FixtureResult[];
}

interface FailureMatrix {
  run_at: string;
  authority: string;
  by_stage: Record<
    string,
    {
      stage_id: string;
      fixtures_evaluated: number;
      required_failure_codes: string[];
      forbidden_failure_codes: string[];
      must_fail_closed_count: number;
    }
  >;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXTURE_DIR = path.resolve("tests/fixtures/sipoc");
const ARTIFACT_DIR = path.resolve("artifacts/sipoc");
const RESULTS_PATH = path.join(ARTIFACT_DIR, "sipoc-results.json");
const FAILURE_MATRIX_PATH = path.join(ARTIFACT_DIR, "failure-matrix.json");
const EXCLUDED_FILES = new Set(["schema.json", "README.md"]);
const AUTHORITY = "docs/SIPOC_EVALUATION_PROCESS.md";

// ---------------------------------------------------------------------------
// Deterministic contract evaluation
//
// The harness evaluates each fixture's declared contract for internal
// coherence and compliance with the SIPOC governance rules. It does NOT
// execute the actual runtime pipeline — it verifies that the fixture
// correctly encodes a testable, non-contradictory contract.
// ---------------------------------------------------------------------------

function evaluateFixtureContract(fixture: SipocFixture): {
  violations: string[];
  assertions: string[];
} {
  const violations: string[] = [];
  const assertions: string[] = [];

  const { expected, invariant_id, stage_id, evidence_artifacts } = fixture;
  const {
    result_type,
    must_fail_closed,
    required_failure_codes,
    forbidden_failure_codes = [],
  } = expected;

  // --- Rule 1: fail-closed coherence ---
  // If must_fail_closed = true, result_type must be "fail"
  if (must_fail_closed && result_type !== "fail") {
    violations.push(
      `[${invariant_id}] must_fail_closed=true requires result_type="fail", got "${result_type}"`
    );
  } else {
    assertions.push(`fail-closed coherence: OK (must_fail_closed=${must_fail_closed}, result_type="${result_type}")`);
  }

  // --- Rule 2: fail contracts must name at least one failure code ---
  if (result_type === "fail" && required_failure_codes.length === 0) {
    violations.push(
      `[${invariant_id}] result_type="fail" contracts must declare at least one required_failure_code`
    );
  } else if (result_type === "fail") {
    assertions.push(`failure codes declared: ${required_failure_codes.join(", ")}`);
  }

  // --- Rule 3: pass contracts must not declare required_failure_codes ---
  if (result_type === "pass" && required_failure_codes.length > 0) {
    violations.push(
      `[${invariant_id}] result_type="pass" contracts must not declare required_failure_codes ` +
        `(got: ${required_failure_codes.join(", ")})`
    );
  } else if (result_type === "pass") {
    assertions.push(`pass contract: no required_failure_codes (correct)`);
  }

  // --- Rule 4: no overlap between required and forbidden failure codes ---
  const overlap = required_failure_codes.filter((c) =>
    forbidden_failure_codes.includes(c)
  );
  if (overlap.length > 0) {
    violations.push(
      `[${invariant_id}] Contradiction: codes appear in both required_failure_codes and forbidden_failure_codes: ${overlap.join(", ")}`
    );
  } else {
    assertions.push(`required/forbidden code sets are disjoint: OK`);
  }

  // --- Rule 5: stage-specific invariant rules ---
  const stageViolations = evaluateStageInvariant(
    stage_id,
    invariant_id,
    required_failure_codes,
    forbidden_failure_codes,
    must_fail_closed
  );
  violations.push(...stageViolations.violations);
  assertions.push(...stageViolations.assertions);

  // --- Rule 6: evidence artifact coverage relative to result type ---
  if (result_type === "fail") {
    const hasPipelineEvidence =
      evidence_artifacts.includes("pipeline_failure_envelope") ||
      evidence_artifacts.includes("quality_gate_diagnostics_v1");
    if (!hasPipelineEvidence) {
      violations.push(
        `[${invariant_id}] Fail-result fixture must include pipeline_failure_envelope or quality_gate_diagnostics_v1 in evidence_artifacts`
      );
    } else {
      assertions.push(`evidence artifact coverage for fail-result: OK`);
    }
  }

  // --- Rule 7: authority pin present ---
  if (!fixture.authority_refs) {
    violations.push(`[${invariant_id}] authority_refs is required`);
  } else if (fixture.authority_refs.sipoc_contract !== AUTHORITY) {
    violations.push(
      `[${invariant_id}] authority_refs.sipoc_contract must be "${AUTHORITY}", got "${fixture.authority_refs.sipoc_contract}"`
    );
  } else {
    assertions.push(`authority pin: ${AUTHORITY} (correct)`);
  }

  return { violations, assertions };
}

/**
 * Stage-specific contract invariant checks.
 * Each stage has governance rules that fixtures must correctly encode.
 */
function evaluateStageInvariant(
  stage_id: StageId,
  invariant_id: string,
  required: string[],
  forbidden: string[],
  mustFailClosed: boolean
): { violations: string[]; assertions: string[] } {
  const violations: string[] = [];
  const assertions: string[] = [];

  switch (stage_id) {
    case "S01_INTAKE":
      // Intake failures must not allow state mutation — forbidden codes
      // must not include any queue progression codes
      if (forbidden.some((c) => c.startsWith("QUEUE_"))) {
        violations.push(
          `[${invariant_id}] S01_INTAKE: forbidden_failure_codes should not reference QUEUE_ codes; intake must prevent queue entry, not just flag it`
        );
      } else {
        assertions.push(`S01_INTAKE: no queue progression codes in forbidden list (correct)`);
      }
      break;

    case "S02_QUEUE":
      // Queue stage must only allow canonical statuses — must_fail_closed
      if (!mustFailClosed) {
        violations.push(
          `[${invariant_id}] S02_QUEUE: all queue invariants must enforce must_fail_closed=true (canonical status discipline)`
        );
      } else {
        assertions.push(`S02_QUEUE: must_fail_closed=true (correct)`);
      }
      break;

    case "S03_CLAIM":
      // Claim must fail closed — atomicity contract
      if (!mustFailClosed) {
        violations.push(
          `[${invariant_id}] S03_CLAIM: claim atomicity invariants require must_fail_closed=true`
        );
      } else {
        assertions.push(`S03_CLAIM: must_fail_closed=true (atomicity preserved)`);
      }
      break;

    case "S06_PASS2":
      // Independence violations must reference QG codes — pass 2 failures
      // that don't propagate to quality gate break the accountability chain
      if (required.length > 0 && !required.some((c) => c.startsWith("QG_") || c.startsWith("PASS2_"))) {
        violations.push(
          `[${invariant_id}] S06_PASS2: required_failure_codes must include QG_ or PASS2_ prefixed codes for auditability`
        );
      } else if (required.length > 0) {
        assertions.push(`S06_PASS2: failure codes include QG_ or PASS2_ prefix (correct)`);
      }
      break;

    case "S08_ER2_NORMALIZATION":
      // ER2 normalization failures must reference QG codes (normalization
      // failures propagate to quality gate)
      if (required.length > 0 && !required.some((c) => c.startsWith("QG_") || c.startsWith("ER2_"))) {
        violations.push(
          `[${invariant_id}] S08_ER2_NORMALIZATION: required_failure_codes must include QG_ or ER2_ prefixed codes`
        );
      } else if (required.length > 0) {
        assertions.push(`S08_ER2_NORMALIZATION: failure codes include QG_ or ER2_ prefix (correct)`);
      }
      break;

    case "S09_QUALITYGATEV2":
      // Quality gate failures must reference QG_ codes — these are the
      // canonical gate output codes
      if (required.length > 0 && !required.some((c) => c.startsWith("QG_"))) {
        violations.push(
          `[${invariant_id}] S09_QUALITYGATEV2: required_failure_codes must include at least one QG_ prefixed code`
        );
      } else if (required.length > 0) {
        assertions.push(`S09_QUALITYGATEV2: QG_ prefixed failure code(s) present (correct)`);
      }
      // Quality gate must always fail closed
      if (!mustFailClosed) {
        violations.push(
          `[${invariant_id}] S09_QUALITYGATEV2: quality gate must always enforce must_fail_closed=true`
        );
      } else {
        assertions.push(`S09_QUALITYGATEV2: must_fail_closed=true (gating discipline correct)`);
      }
      break;

    case "S10_PERSISTENCE":
      // Persistence must fail closed — no partial writes on gate failure
      if (!mustFailClosed) {
        violations.push(
          `[${invariant_id}] S10_PERSISTENCE: persistence invariants require must_fail_closed=true (no partial writes)`
        );
      } else {
        assertions.push(`S10_PERSISTENCE: must_fail_closed=true (write atomicity correct)`);
      }
      break;

    case "S11_RENDERER":
      // Renderer releasability gate must fail closed — no release on blocked evaluation
      if (!mustFailClosed) {
        violations.push(
          `[${invariant_id}] S11_RENDERER: renderer releasability invariants require must_fail_closed=true`
        );
      } else {
        assertions.push(`S11_RENDERER: must_fail_closed=true (release gate correct)`);
      }
      break;

    default:
      // S04, S05, S07 — no additional stage-specific rules yet; structural
      // validation from PR C validator is sufficient for these stages
      assertions.push(`${stage_id}: no additional stage-specific invariant rules (pass through)`);
      break;
  }

  return { violations, assertions };
}

// ---------------------------------------------------------------------------
// Artifact writer
// ---------------------------------------------------------------------------

function writeArtifacts(results: HarnessResults, matrix: FailureMatrix): void {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), "utf-8");
  fs.writeFileSync(FAILURE_MATRIX_PATH, JSON.stringify(matrix, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function run(): void {
  // Load fixtures
  const allFiles = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith(".json") && !EXCLUDED_FILES.has(f))
    .sort();

  if (allFiles.length === 0) {
    console.error(`[sipoc:harness] ERROR: No fixture files found in ${FIXTURE_DIR}`);
    process.exit(1);
  }

  const results: FixtureResult[] = [];
  const stageMap: Record<string, { total: number; passed: number; failed: number }> = {};
  const matrixByStage: FailureMatrix["by_stage"] = {};

  for (const filename of allFiles) {
    const filePath = path.join(FIXTURE_DIR, filename);
    let fixture: SipocFixture;

    try {
      fixture = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SipocFixture;
    } catch (err) {
      console.error(`[sipoc:harness] Failed to parse ${filename}: ${String(err)}`);
      process.exit(1);
    }

    const { violations, assertions } = evaluateFixtureContract(fixture);
    const passed = violations.length === 0;

    // Per-fixture result
    results.push({
      fixture_id: fixture.fixture_id,
      fixture_version: fixture.fixture_version,
      stage_id: fixture.stage_id,
      invariant_id: fixture.invariant_id,
      severity: fixture.severity ?? "high",
      pass: passed,
      violations,
      contract_assertions: assertions,
    });

    // Stage summary
    if (!stageMap[fixture.stage_id]) {
      stageMap[fixture.stage_id] = { total: 0, passed: 0, failed: 0 };
    }
    stageMap[fixture.stage_id].total++;
    if (passed) stageMap[fixture.stage_id].passed++;
    else stageMap[fixture.stage_id].failed++;

    // Failure matrix accumulation
    if (!matrixByStage[fixture.stage_id]) {
      matrixByStage[fixture.stage_id] = {
        stage_id: fixture.stage_id,
        fixtures_evaluated: 0,
        required_failure_codes: [],
        forbidden_failure_codes: [],
        must_fail_closed_count: 0,
      };
    }
    const entry = matrixByStage[fixture.stage_id];
    entry.fixtures_evaluated++;
    const required = fixture.expected.required_failure_codes ?? [];
    const forbidden = fixture.expected.forbidden_failure_codes ?? [];
    for (const code of required) {
      if (!entry.required_failure_codes.includes(code)) entry.required_failure_codes.push(code);
    }
    for (const code of forbidden) {
      if (!entry.forbidden_failure_codes.includes(code)) entry.forbidden_failure_codes.push(code);
    }
    if (fixture.expected.must_fail_closed) entry.must_fail_closed_count++;
  }

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  const harnessResults: HarnessResults = {
    run_at: new Date().toISOString(),
    authority: AUTHORITY,
    fixture_dir: FIXTURE_DIR,
    summary: {
      total,
      passed,
      failed,
      by_stage: stageMap,
    },
    results,
  };

  const matrix: FailureMatrix = {
    run_at: new Date().toISOString(),
    authority: AUTHORITY,
    by_stage: matrixByStage,
  };

  writeArtifacts(harnessResults, matrix);

  // --- Stdout summary ---
  console.log(`\n[sipoc:harness] SIPOC Deterministic Contract Harness`);
  console.log(`  Authority   : ${AUTHORITY}`);
  console.log(`  Fixture dir : ${FIXTURE_DIR}`);
  console.log(`  Total       : ${total}`);
  console.log(`  Passed      : ${passed}`);
  console.log(`  Failed      : ${failed}`);
  console.log(`  Results     : ${RESULTS_PATH}`);
  console.log(`  Matrix      : ${FAILURE_MATRIX_PATH}`);
  console.log("");

  if (failed > 0) {
    for (const r of results.filter((x) => !x.pass)) {
      console.error(`✗ [${r.stage_id}] ${r.fixture_id} (${r.invariant_id})`);
      for (const v of r.violations) {
        console.error(`    · ${v}`);
      }
    }
    console.error(
      `\n[sipoc:harness] FAILED: ${failed} fixture(s) violate contract rules. Artifacts written.\n`
    );
    process.exit(1);
  }

  for (const r of results) {
    console.log(`✓ [${r.stage_id}] ${r.fixture_id}`);
  }
  console.log(`\n✓ All ${total} fixture(s) passed contract evaluation. Artifacts written.\n`);
  process.exit(0);
}

run();
