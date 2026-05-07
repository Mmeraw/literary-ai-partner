/**
 * validate-sipoc-fixtures.ts
 *
 * SIPOC Fixture Schema Validation Runner — PR C
 *
 * Validates every fixture file under tests/fixtures/sipoc/ against the
 * structural contract defined in tests/fixtures/sipoc/schema.json and
 * docs/SIPOC_EVALUATION_PROCESS.md.
 *
 * Checks performed per fixture:
 *   1. JSON parse succeeds
 *   2. Required top-level fields are present
 *   3. stage_id is a member of the canonical S01–S11 enum
 *   4. Filename prefix matches stage_id (e.g. s01_* → S01_INTAKE)
 *   5. fixture_id matches pattern ^[a-z0-9][a-z0-9._-]{2,80}$
 *   6. fixture_version matches ^v[0-9]+$
 *   7. track === "evaluation_runtime_sipoc"
 *   8. invariant_id matches ^[A-Z0-9_]{3,100}$
 *   9. description length 8–500 chars
 *  10. expected.result_type, must_fail_closed, required_failure_codes are present/typed
 *  11. evidence_artifacts is a non-empty array of known enum values
 *  12. authority_refs is present and authority_refs.sipoc_contract === "docs/SIPOC_EVALUATION_PROCESS.md"
 *
 * No runtime execution, no model calls, no production pipeline invocation.
 *
 * Authority: docs/SIPOC_EVALUATION_PROCESS.md
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Canonical stage ID enum — immutable, keyed to SIPOC_EVALUATION_PROCESS.md
// ---------------------------------------------------------------------------
const CANONICAL_STAGE_IDS = [
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
] as const;

type StageId = (typeof CANONICAL_STAGE_IDS)[number];

/** Maps canonical stage_id → required filename prefix (lowercase stage number) */
const STAGE_FILENAME_PREFIX: Record<StageId, string> = {
  S01_INTAKE: "s01",
  S02_QUEUE: "s02",
  S03_CLAIM: "s03",
  S04_ROUTING_CHUNKING: "s04",
  S05_PASS1: "s05",
  S06_PASS2: "s06",
  S07_PASS3: "s07",
  S08_ER2_NORMALIZATION: "s08",
  S09_QUALITYGATEV2: "s09",
  S10_PERSISTENCE: "s10",
  S11_RENDERER: "s11",
};

const VALID_RESULT_TYPES = ["pass", "fail", "warn"] as const;

const VALID_EVIDENCE_ARTIFACT_KINDS = [
  "pipeline_failure_envelope",
  "quality_gate_diagnostics_v1",
  "pass_outputs_diagnostic_v1",
  "evaluation_result_v2",
  "evaluation_artifact_row",
  "release_decision_trace",
] as const;

const FIXTURE_DIR = path.resolve("tests/fixtures/sipoc");
const EXCLUDED_FILES = new Set(["schema.json", "README.md"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ValidationFailure {
  file: string;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------
function validateFixture(filePath: string): string[] {
  const violations: string[] = [];
  const filename = path.basename(filePath);

  // 1. JSON parse
  let data: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    data = JSON.parse(raw);
  } catch (err) {
    violations.push(`JSON parse failed: ${String(err)}`);
    return violations; // Cannot proceed without parsed data
  }

  // 2. Required top-level fields
  const REQUIRED_FIELDS = [
    "fixture_id",
    "fixture_version",
    "stage_id",
    "track",
    "invariant_id",
    "description",
    "expected",
    "evidence_artifacts",
  ];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      violations.push(`Missing required field: ${field}`);
    }
  }

  // 3. stage_id canonical enum
  const stageId = data["stage_id"];
  if (typeof stageId !== "string") {
    violations.push(`stage_id must be a string, got ${typeof stageId}`);
  } else if (!(CANONICAL_STAGE_IDS as readonly string[]).includes(stageId)) {
    violations.push(
      `stage_id "${stageId}" is not a canonical SIPOC stage identifier. ` +
        `Must be one of: ${CANONICAL_STAGE_IDS.join(", ")}`
    );
  } else {
    // 4. Filename prefix matches stage_id
    const expectedPrefix = STAGE_FILENAME_PREFIX[stageId as StageId];
    if (!filename.startsWith(expectedPrefix + "_")) {
      violations.push(
        `Filename "${filename}" must start with "${expectedPrefix}_" for stage_id "${stageId}"`
      );
    }
  }

  // 5. fixture_id pattern
  const fixtureId = data["fixture_id"];
  if (typeof fixtureId !== "string") {
    violations.push(`fixture_id must be a string`);
  } else if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(fixtureId)) {
    violations.push(
      `fixture_id "${fixtureId}" does not match pattern ^[a-z0-9][a-z0-9._-]{2,80}$`
    );
  }

  // 6. fixture_version pattern
  const fixtureVersion = data["fixture_version"];
  if (typeof fixtureVersion !== "string") {
    violations.push(`fixture_version must be a string`);
  } else if (!/^v[0-9]+$/.test(fixtureVersion)) {
    violations.push(
      `fixture_version "${fixtureVersion}" does not match pattern ^v[0-9]+$`
    );
  }

  // 7. track
  if (data["track"] !== "evaluation_runtime_sipoc") {
    violations.push(
      `track must be "evaluation_runtime_sipoc", got "${data["track"]}"`
    );
  }

  // 8. invariant_id
  const invariantId = data["invariant_id"];
  if (typeof invariantId !== "string") {
    violations.push(`invariant_id must be a string`);
  } else if (!/^[A-Z0-9_]{3,100}$/.test(invariantId)) {
    violations.push(
      `invariant_id "${invariantId}" does not match pattern ^[A-Z0-9_]{3,100}$`
    );
  }

  // 9. description length
  const description = data["description"];
  if (typeof description !== "string") {
    violations.push(`description must be a string`);
  } else if (description.length < 8 || description.length > 500) {
    violations.push(
      `description length must be 8–500 chars, got ${description.length}`
    );
  }

  // 10. expected sub-fields
  const expected = data["expected"];
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    violations.push(`expected must be an object`);
  } else {
    const exp = expected as Record<string, unknown>;
    if (!("result_type" in exp)) {
      violations.push(`expected.result_type is required`);
    } else if (!(VALID_RESULT_TYPES as readonly unknown[]).includes(exp["result_type"])) {
      violations.push(
        `expected.result_type "${exp["result_type"]}" must be one of: ${VALID_RESULT_TYPES.join(", ")}`
      );
    }
    if (!("must_fail_closed" in exp)) {
      violations.push(`expected.must_fail_closed is required`);
    } else if (typeof exp["must_fail_closed"] !== "boolean") {
      violations.push(`expected.must_fail_closed must be a boolean`);
    }
    if (!("required_failure_codes" in exp)) {
      violations.push(`expected.required_failure_codes is required`);
    } else if (!Array.isArray(exp["required_failure_codes"])) {
      violations.push(`expected.required_failure_codes must be an array`);
    }
  }

  // 11. evidence_artifacts
  const evidenceArtifacts = data["evidence_artifacts"];
  if (!Array.isArray(evidenceArtifacts)) {
    violations.push(`evidence_artifacts must be an array`);
  } else if (evidenceArtifacts.length === 0) {
    violations.push(`evidence_artifacts must have at least one entry`);
  } else {
    for (const artifact of evidenceArtifacts) {
      if (!(VALID_EVIDENCE_ARTIFACT_KINDS as readonly unknown[]).includes(artifact)) {
        violations.push(
          `evidence_artifacts contains unknown value "${artifact}". ` +
            `Valid values: ${VALID_EVIDENCE_ARTIFACT_KINDS.join(", ")}`
        );
      }
    }
    const uniqueCheck = new Set(evidenceArtifacts);
    if (uniqueCheck.size !== evidenceArtifacts.length) {
      violations.push(`evidence_artifacts contains duplicate entries`);
    }
  }

  // 12. authority_refs presence and sipoc_contract pin
  const authorityRefs = data["authority_refs"];
  if (authorityRefs === undefined || authorityRefs === null) {
    violations.push(`authority_refs is required but missing`);
  } else if (typeof authorityRefs !== "object" || Array.isArray(authorityRefs)) {
    violations.push(`authority_refs must be an object`);
  } else {
    const refs = authorityRefs as Record<string, unknown>;
    if (refs["sipoc_contract"] !== "docs/SIPOC_EVALUATION_PROCESS.md") {
      violations.push(
        `authority_refs.sipoc_contract must be "docs/SIPOC_EVALUATION_PROCESS.md", ` +
          `got "${refs["sipoc_contract"]}"`
      );
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
function run(): void {
  const allFiles = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith(".json") && !EXCLUDED_FILES.has(f))
    .sort();

  if (allFiles.length === 0) {
    console.error(
      `[sipoc:validate] ERROR: No fixture files found in ${FIXTURE_DIR}`
    );
    process.exit(1);
  }

  const failures: ValidationFailure[] = [];

  for (const filename of allFiles) {
    const filePath = path.join(FIXTURE_DIR, filename);
    const violations = validateFixture(filePath);
    if (violations.length > 0) {
      failures.push({ file: filename, violations });
    }
  }

  // Summary
  const total = allFiles.length;
  const passCount = total - failures.length;

  console.log(`\n[sipoc:validate] SIPOC Fixture Corpus Validation`);
  console.log(`  Fixture dir : ${FIXTURE_DIR}`);
  console.log(`  Total files : ${total}`);
  console.log(`  Passed      : ${passCount}`);
  console.log(`  Failed      : ${failures.length}`);
  console.log("");

  if (failures.length === 0) {
    console.log(`✓ All ${total} fixture(s) are schema-compliant.\n`);
    process.exit(0);
  }

  for (const { file, violations } of failures) {
    console.error(`✗ ${file}`);
    for (const v of violations) {
      console.error(`    · ${v}`);
    }
    console.error("");
  }

  console.error(
    `[sipoc:validate] FAILED: ${failures.length} fixture(s) have violations. ` +
      `Fix violations before merging.\n`
  );
  process.exit(1);
}

run();
