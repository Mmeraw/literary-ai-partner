import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { PROCESS_REGISTRY } from "../lib/evaluation/fipocRegistry";
import {
  EVIDENCE_KINDS,
  GAP_BUCKETS,
  OBLIGATION_STATES,
  REMEDIATION_AUDIT_STATES,
  REMEDIATION_CLASSES,
  deriveBoundaryEvidenceState,
  isSipocStageId,
  type EvidenceManifest,
  type EvidenceObligation,
  type RemediationAudit,
} from "../tests/sipoc/evidenceModel";

const MANIFEST_PATH = path.resolve("tests/fixtures/sipoc/evidence-obligations.v3.json");
const OUTPUT_PATH = path.resolve("artifacts/sipoc/evidence-results.v3.json");
const JEST_RESULTS_PATH = path.resolve("artifacts/sipoc/.evidence-jest-results.json");
const REMEDIATION_AUDIT_PATH = path.resolve("tests/sipoc/remediation-audit.v3.json");
const EXPECTED_BOUNDARIES = [
  "S02_QUEUE",
  "S03_CLAIM",
  "S10b_PHASE5_AUTHOR_EXPOSURE_GATE",
  "S10c_VIEWMODEL_BOUNDARY_GATE",
  "S11a_RENDERER_WEBPAGE",
  "S11b_DOWNLOAD_PIPELINE",
] as const;

type EffectiveState = EvidenceObligation["current_state"];

function loadManifest(): EvidenceManifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as EvidenceManifest;
}

function loadRemediationAudit(): RemediationAudit {
  return JSON.parse(fs.readFileSync(REMEDIATION_AUDIT_PATH, "utf8")) as RemediationAudit;
}

function isExclusiveUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return Object.keys(value).filter((key) => !allowedSet.has(key));
}

function validateStateSemantics(item: EvidenceObligation): string[] {
  const errors: string[] = [];
  const unresolved = item.current_state !== "satisfied";

  if (item.current_state === "satisfied") {
    errors.push("raw satisfied is forbidden; only an executed attributable assertion may produce effective satisfaction");
  }

  if (unresolved && !isExclusiveUtcTimestamp(item.expires_before_utc)) {
    errors.push("every unresolved obligation requires an exclusive expires_before_utc timestamp");
  }
  if (!unresolved && (item.gap_bucket !== null || item.gap !== null || item.expires_before_utc !== null)) {
    errors.push("satisfied obligations must not carry a gap bucket, gap, or expiry");
  }
  if (unresolved && (!item.gap_bucket || !item.gap?.trim())) {
    errors.push("every unresolved obligation requires exactly one gap bucket and a non-empty gap");
  }

  const expected: Partial<Record<EffectiveState, [EvidenceObligation["gap_bucket"], EvidenceObligation["remediation_class"][]]>> = {
    satisfied_but_unmapped: ["representation_gap", ["governance_mapping"]],
    representable_but_unproven: ["evidence_gap", ["integration_evidence", "test_infrastructure"]],
    unrepresentable: ["representation_gap", ["test_infrastructure"]],
    runtime_conflict: ["enforcement_gap", ["runtime"]],
    policy_conflict: ["policy_contradiction", ["policy"]],
  };
  const rule = expected[item.current_state];
  if (rule && (item.gap_bucket !== rule[0] || !rule[1].includes(item.remediation_class))) {
    errors.push(`state ${item.current_state} requires ${rule[0]} and remediation ${rule[1].join(" or ")}`);
  }
  if (item.current_state === "policy_conflict" && item.blocked_by !== "gate_15_product_policy_ruling") {
    errors.push("policy conflict must name the Gate 15 product-policy blocker");
  }
  if (item.current_state === "satisfied_but_unmapped" && item.evidence_refs.length === 0) {
    errors.push("satisfied_but_unmapped requires attributable evidence_refs");
  }
  return errors;
}

function validateManifest(manifest: EvidenceManifest): string[] {
  const errors: string[] = [];
  const manifestRecord = manifest as unknown as Record<string, unknown>;
  const manifestUnknown = unknownKeys(manifestRecord, ["schema_version", "generated_from", "obligations"]);
  if (manifestUnknown.length > 0) errors.push(`manifest has unknown properties: ${manifestUnknown.join(", ")}`);
  if (manifest.schema_version !== 3) errors.push("schema_version must equal 3");
  if (typeof manifest.generated_from !== "string" || manifest.generated_from.trim().length === 0) {
    errors.push("generated_from must be a non-empty string");
  }
  if (!Array.isArray(manifest.obligations)) return [...errors, "obligations must be an array"];
  if (manifest.obligations.length !== 33) errors.push(`expected 33 obligations, found ${manifest.obligations.length}`);

  const ids = new Set<string>();
  for (const item of manifest.obligations) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("every obligation must be an object");
      continue;
    }
    const itemUnknown = unknownKeys(item as unknown as Record<string, unknown>, [
      "id", "boundary", "dirty_data_rule", "evidence_kind", "enforcement_point",
      "current_state", "gap_bucket", "remediation_class", "evidence_refs", "gap",
      "expires_before_utc", "blocked_by",
    ]);
    if (itemUnknown.length > 0) errors.push(`${String(item.id)}: unknown properties: ${itemUnknown.join(", ")}`);
    if (typeof item.id !== "string" || !/^[A-Za-z0-9_]+\.failclosed\.[0-9]{2}$/.test(item.id)) {
      errors.push(`${String(item.id)}: invalid stable obligation id`);
    }
    if (typeof item.dirty_data_rule !== "string" || item.dirty_data_rule.trim().length < 3) errors.push(`${item.id}: dirty_data_rule is required`);
    if (typeof item.enforcement_point !== "string" || item.enforcement_point.trim().length < 3) errors.push(`${item.id}: enforcement_point is required`);
    if (!Array.isArray(item.evidence_refs)) {
      errors.push(`${item.id}: evidence_refs must be an array`);
      continue;
    }
    const prefix = `${item.boundary}.failclosed.`;
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate stable obligation id`);
    ids.add(item.id);
    if (!item.id.startsWith(prefix)) errors.push(`${item.id}: id must be scoped to boundary ${item.boundary}`);
    if (!isSipocStageId(item.boundary)) errors.push(`${item.id}: unknown stage ${item.boundary}`);
    if (!(EVIDENCE_KINDS as readonly string[]).includes(item.evidence_kind)) errors.push(`${item.id}: unknown evidence kind`);
    if (!(OBLIGATION_STATES as readonly string[]).includes(item.current_state)) errors.push(`${item.id}: unknown current state`);
    if (item.gap_bucket !== null && !(GAP_BUCKETS as readonly string[]).includes(item.gap_bucket)) errors.push(`${item.id}: unknown gap bucket`);
    if (!(REMEDIATION_CLASSES as readonly string[]).includes(item.remediation_class)) errors.push(`${item.id}: unknown remediation class`);
    errors.push(...validateStateSemantics(item).map((error) => `${item.id}: ${error}`));

    for (const ref of item.evidence_refs) {
      if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
        errors.push(`${item.id}: every evidence ref must be an object`);
        continue;
      }
      const refUnknown = unknownKeys(ref as unknown as Record<string, unknown>, ["test_file", "test_name"]);
      if (refUnknown.length > 0) errors.push(`${item.id}: evidence ref has unknown properties: ${refUnknown.join(", ")}`);
      if (typeof ref.test_file !== "string" || !ref.test_file.trim() || typeof ref.test_name !== "string" || !ref.test_name.trim()) {
        errors.push(`${item.id}: evidence refs require non-empty test_file and test_name`);
        continue;
      }
      const filePath = path.resolve(ref.test_file);
      if (!fs.existsSync(filePath)) {
        errors.push(`${item.id}: evidence file does not exist: ${ref.test_file}`);
      }
    }
  }

  for (const boundary of EXPECTED_BOUNDARIES) {
    const registry = PROCESS_REGISTRY.find((item) => item.stageId === boundary);
    const obligations = manifest.obligations.filter((item) => item.boundary === boundary);
    if (!registry) {
      errors.push(`${boundary}: absent from PROCESS_REGISTRY`);
      continue;
    }
    const manifestRules = obligations.map((item) => item.dirty_data_rule);
    if (manifestRules.length !== registry.dirtyDataRules.length) {
      errors.push(`${boundary}: obligation count ${manifestRules.length} does not match ${registry.dirtyDataRules.length} registry dirty rules`);
    }
    for (const rule of registry.dirtyDataRules) {
      if (!manifestRules.includes(rule)) errors.push(`${boundary}: missing exact registry dirty rule: ${rule}`);
    }
  }

  const s03Kinds = manifest.obligations.filter((item) => item.boundary === "S03_CLAIM").map((item) => item.evidence_kind);
  if (s03Kinds.some((kind) => kind !== "integration_transactional")) errors.push("S03_CLAIM: every obligation must be integration_transactional");
  const s10cKinds = manifest.obligations.filter((item) => item.boundary === "S10c_VIEWMODEL_BOUNDARY_GATE").map((item) => item.evidence_kind);
  if (s10cKinds.some((kind) => kind !== "static_architecture_invariant")) errors.push("S10c_VIEWMODEL_BOUNDARY_GATE: every obligation must be static_architecture_invariant");
  return errors;
}

function validateRemediationAudit(manifest: EvidenceManifest, audit: RemediationAudit): string[] {
  const errors: string[] = [];
  if (audit.schema_version !== 1) errors.push("remediation audit schema_version must equal 1");
  if (audit.based_on_manifest_schema !== manifest.schema_version) {
    errors.push("remediation audit must name the current evidence manifest schema");
  }
  if (!audit.generated_from?.trim()) errors.push("remediation audit generated_from is required");
  if (!Array.isArray(audit.entries)) return [...errors, "remediation audit entries must be an array"];

  const manifestById = new Map(manifest.obligations.map((item) => [item.id, item]));
  const seenPrs = new Set<number>();
  const seenIds = new Set<string>();
  for (const entry of audit.entries) {
    if (!Number.isInteger(entry.pull_request) || entry.pull_request <= 0) {
      errors.push("remediation audit pull_request must be a positive integer");
    }
    if (seenPrs.has(entry.pull_request)) errors.push(`PR #${entry.pull_request}: duplicate remediation audit entry`);
    seenPrs.add(entry.pull_request);
    if (!entry.scope?.trim() || !entry.capable_evidence_required?.trim() || !entry.residual_gap?.trim()) {
      errors.push(`PR #${entry.pull_request}: scope, capable evidence, and residual gap are required`);
    }
    if (!(REMEDIATION_AUDIT_STATES as readonly string[]).includes(entry.audit_state)) {
      errors.push(`PR #${entry.pull_request}: unknown remediation audit state`);
    }
    if (!Array.isArray(entry.obligation_ids)) {
      errors.push(`PR #${entry.pull_request}: obligation_ids must be an array`);
      continue;
    }
    for (const id of entry.obligation_ids) {
      const obligation = manifestById.get(id);
      if (!obligation) errors.push(`PR #${entry.pull_request}: unknown obligation ${id}`);
      if (obligation?.current_state === "satisfied") errors.push(`PR #${entry.pull_request}: already-satisfied obligation ${id} cannot be remediation debt`);
      if (id === "S10b_PHASE5_AUTHOR_EXPOSURE_GATE.failclosed.04") {
        errors.push(`PR #${entry.pull_request}: Gate 15 policy conflict cannot be selected by remediation`);
      }
      if (seenIds.has(id)) errors.push(`${id}: mapped by more than one remediation PR`);
      seenIds.add(id);
    }
  }
  return errors;
}

interface JestAssertionResult {
  title: string;
  status: string;
}

interface JestFileResult {
  name: string;
  assertionResults: JestAssertionResult[];
}

interface JestJsonResult {
  success: boolean;
  testResults: JestFileResult[];
}

function evidenceRefKey(testFile: string, testName: string): string {
  return `${path.resolve(testFile).toLowerCase()}::${testName}`;
}

function runAttributableTests(obligations: EvidenceObligation[]): {
  passed: boolean;
  files: string[];
  passedRefs: Set<string>;
  output: string;
} {
  const files = [...new Set(
    obligations
      .filter((item) => item.current_state === "satisfied_but_unmapped")
      .flatMap((item) => item.evidence_refs.map((ref) => ref.test_file)),
  )].sort();
  const jestBin = path.resolve("node_modules/jest/bin/jest.js");
  if (fs.existsSync(JEST_RESULTS_PATH)) fs.unlinkSync(JEST_RESULTS_PATH);
  const child = spawnSync(process.execPath, [
    jestBin,
    "--runInBand",
    "--runTestsByPath",
    ...files,
    "--json",
    `--outputFile=${JEST_RESULTS_PATH}`,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  const output = `${child.stdout ?? ""}${child.stderr ?? ""}`.trim();
  if (child.status !== 0 || !fs.existsSync(JEST_RESULTS_PATH)) {
    if (fs.existsSync(JEST_RESULTS_PATH)) fs.unlinkSync(JEST_RESULTS_PATH);
    return { passed: false, files, passedRefs: new Set(), output };
  }

  let json: JestJsonResult;
  try {
    json = JSON.parse(fs.readFileSync(JEST_RESULTS_PATH, "utf8")) as JestJsonResult;
  } finally {
    fs.unlinkSync(JEST_RESULTS_PATH);
  }
  const passedRefs = new Set<string>();
  const attributionErrors: string[] = [];
  for (const item of obligations.filter((value) => value.current_state === "satisfied_but_unmapped")) {
    for (const ref of item.evidence_refs) {
      const fileResult = json.testResults.find(
        (result) => path.resolve(result.name).toLowerCase() === path.resolve(ref.test_file).toLowerCase(),
      );
      const matches = fileResult?.assertionResults.filter((assertion) => assertion.title === ref.test_name) ?? [];
      if (matches.length !== 1 || matches[0].status !== "passed") {
        attributionErrors.push(
          `${item.id}: expected exactly one executed passing assertion ${ref.test_file} :: ${ref.test_name}; ` +
          `found ${matches.length}${matches.length === 1 ? ` with status ${matches[0].status}` : ""}`,
        );
        continue;
      }
      passedRefs.add(evidenceRefKey(ref.test_file, ref.test_name));
    }
  }
  return {
    passed: child.status === 0 && json.success && attributionErrors.length === 0,
    files,
    passedRefs,
    output: [output, ...attributionErrors].filter(Boolean).join("\n"),
  };
}

function main(): void {
  const manifest = loadManifest();
  const remediationAudit = loadRemediationAudit();
  const validationErrors = [
    ...validateManifest(manifest),
    ...validateRemediationAudit(manifest, remediationAudit),
  ];
  if (validationErrors.length > 0) {
    for (const error of validationErrors) console.error(`[sipoc:evidence] ${error}`);
    process.exit(1);
  }

  const testRun = runAttributableTests(manifest.obligations);
  if (!testRun.passed) {
    console.error(testRun.output);
    console.error("[sipoc:evidence] Attributable evidence tests failed; no obligation was promoted.");
    process.exit(1);
  }

  const effectiveObligations = manifest.obligations.map((item) => {
    const earned = item.current_state === "satisfied_but_unmapped" && item.evidence_refs.every(
      (ref) => testRun.passedRefs.has(evidenceRefKey(ref.test_file, ref.test_name)),
    );
    return { ...item, effective_state: earned ? "satisfied" as const : item.current_state };
  });
  const byBoundary = Object.fromEntries(EXPECTED_BOUNDARIES.map((boundary) => {
    const obligations = effectiveObligations.filter((item) => item.boundary === boundary);
    const derived = deriveBoundaryEvidenceState(obligations.map((item) => ({ ...item, current_state: item.effective_state })));
    return [boundary, derived];
  }));
  const byState = Object.fromEntries(OBLIGATION_STATES.map((state) => [
    state,
    effectiveObligations.filter((item) => item.effective_state === state).length,
  ]));
  const byRemediationClass = Object.fromEntries(REMEDIATION_CLASSES.map((value) => [
    value,
    effectiveObligations.filter((item) => item.effective_state !== "satisfied" && item.remediation_class === value).length,
  ]));

  const output = {
    schema_version: 3,
    source_manifest: path.relative(process.cwd(), MANIFEST_PATH).replaceAll("\\", "/"),
    attributable_test_files: testRun.files,
    summary: {
      obligations: effectiveObligations.length,
      by_state: byState,
      by_remediation_class: byRemediationClass,
      boundaries: byBoundary,
    },
    remediation_audit: remediationAudit,
    obligations: effectiveObligations,
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log("[sipoc:evidence] v3 executive evidence dashboard");
  console.log(`  obligations: ${effectiveObligations.length}`);
  for (const [state, count] of Object.entries(byState)) console.log(`  ${state}: ${count}`);
  for (const [boundary, result] of Object.entries(byBoundary)) {
    console.log(`  ${boundary}: ${result.proven ? "proven" : "not_proven"} (${result.satisfied}/${result.total})`);
  }
  console.log(`  results: ${OUTPUT_PATH}`);
}

main();
