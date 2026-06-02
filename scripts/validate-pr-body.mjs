#!/usr/bin/env node
/**
 * validate-pr-body.mjs — Local PR body validator
 *
 * Mirrors the enforce-latency-template CI check so you can catch
 * template violations BEFORE pushing.
 *
 * Usage:
 *   node scripts/validate-pr-body.mjs <pr-body-file> [--type evaluation|ui|code|infra|docs|migration|minor]
 *   echo "## Summary ..." | node scripts/validate-pr-body.mjs --stdin [--type evaluation]
 *   node scripts/validate-pr-body.mjs --pr 896          # fetch from GitHub API (requires gh CLI)
 *
 * If --type is omitted, defaults to "evaluation".
 * Exit code 0 = pass, 1 = failures found.
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";

// ── Parse args ──────────────────────────────────────────────────
const args = process.argv.slice(2);
let body = "";
let type = "evaluation";

const typeIdx = args.indexOf("--type");
if (typeIdx !== -1 && args[typeIdx + 1]) {
  type = args[typeIdx + 1];
  args.splice(typeIdx, 2);
}

if (args.includes("--stdin")) {
  body = readFileSync(0, "utf-8");
} else if (args.includes("--pr")) {
  const prIdx = args.indexOf("--pr");
  const prNum = args[prIdx + 1];
  if (!prNum) {
    console.error("Usage: --pr <number>");
    process.exit(2);
  }
  try {
    body = execSync(`gh pr view ${prNum} --json body -q .body`, {
      encoding: "utf-8",
      timeout: 10000,
    });
  } catch {
    console.error(`Failed to fetch PR #${prNum} via gh CLI. Is gh authenticated?`);
    process.exit(2);
  }
} else if (args[0] && !args[0].startsWith("--")) {
  body = readFileSync(args[0], "utf-8");
} else {
  console.error(
    "Usage: node scripts/validate-pr-body.mjs <file> [--type evaluation]\n" +
    "       node scripts/validate-pr-body.mjs --stdin [--type evaluation]\n" +
    "       node scripts/validate-pr-body.mjs --pr 896 [--type evaluation]"
  );
  process.exit(2);
}

// ── Validation engine (mirrors CI exactly) ──────────────────────
const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };

const hasSection = (h) => body.includes(h);
const stripHtmlComments = (value) => value.replace(/<!--[\s\S]*?-->/g, "");
const extractSectionBody = (heading) => {
  const start = body.indexOf(heading);
  if (start === -1) return null;
  const afterHeading = body.slice(start + heading.length);
  const nextHeadingIndex = afterHeading.search(/\n##\s+/);
  const raw = nextHeadingIndex === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIndex);
  return raw.split(/\n---\s*\n/)[0].trim();
};
const normalizeSectionBody = (value) =>
  stripHtmlComments(value).replace(/^\s*[-*]\s*$/gm, "").trim();
const isPlaceholderOnly = (value) => {
  const compact = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (!compact) return true;
  return (
    ["tbd", "todo", "pending", "unknown", "placeholder", "lorem ipsum", "na", "n/a"].includes(compact) ||
    /^tbd\b/.test(compact) ||
    /^todo\b/.test(compact)
  );
};
const isExplainedNa = (value) => /^(n\/a|na)\s*[—:-]\s*\S.{8,}$/i.test(value.trim());
const assertMeaningfulSection = (heading, label = heading.replace(/^##\s+/, "")) => {
  assert(hasSection(heading), `Missing: ${label} section`);
  const raw = extractSectionBody(heading);
  const normalized = normalizeSectionBody(raw || "");
  assert(normalized.length > 0, `${label} must not be blank`);
  assert(!isPlaceholderOnly(normalized), `${label} must not be placeholder-only`);
  if (/^(n\/a|na)$/i.test(normalized)) {
    assert(false, `${label} must explain why it is N/A`);
    return;
  }
  if (/^(n\/a|na)\b/i.test(normalized)) {
    assert(isExplainedNa(normalized), `${label} must use "N/A — <reason>" when not applicable`);
  }
};
const hasNoPipelineImpact = () => {
  const m = body.match(/^No-Pipeline-Impact:\s*(.+)$/m);
  return !!(m && m[1].trim().length > 0);
};

// ── Validators per type ─────────────────────────────────────────
const commonFloor = () => {
  assert(hasSection("## Summary"), "Missing: Summary section");
  assert(hasSection("## Scope"), "Missing: Scope section");
  assert(hasSection("## Branch Freshness (Never Behind)"), "Missing: Branch Freshness (Never Behind) section");
  const branchBehindLine = body.match(/^Branch-Behind-Base:\s*(\d+)\s*$/m);
  assert(!!branchBehindLine, "Missing: Branch-Behind-Base: <integer> line");
  if (branchBehindLine) {
    assert(branchBehindLine[1] === "0", "Branch-Behind-Base must be 0 before merge");
  }
  assert(hasSection("## Risks & Anomalies"), "Missing: Risks & Anomalies section");
};

const validateEvaluation = () => {
  commonFloor();
  assert(hasSection("## Evaluation Process Change Declaration"), "Missing: Evaluation Process Change Declaration section");
  assert(hasSection("## Contract Integrity"), "Missing: Contract Integrity section");
  assert(hasSection("## Behavioral Quality"), "Missing: Behavioral Quality section");
  assert(hasSection("## Latency Evidence"), "Missing: Latency Evidence section");

  const processChangeMatch = body.match(/^Process Change:\s*(yes|no)\s*$/im);
  assert(!!processChangeMatch, 'Missing or invalid process declaration: use "Process Change: yes" or "Process Change: no"');

  const processChangeYes = !!processChangeMatch && processChangeMatch[1].toLowerCase() === "yes";
  if (processChangeYes) {
    const requiredCheckedItems = [
      "Sequential phase-gate doctrine preserved (parallelism only within safe sub-workloads).",
      "Phase 0 remains first and is proven before downstream processing.",
      "Phase 2 remains blocked on accepted_story_ledger_v1 (Review Gate authority).",
      "Phase 3 remains blocked on pass12_handoff_v1 and is sole owner of Pass 3B synthesis.",
      "Deterministic quality gates run after Pass 3B and before completion.",
      "WAVE remains post-evaluation (after evaluation_result_v2) and non-fatal to base evaluation.",
    ];
    for (const item of requiredCheckedItems) {
      const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const checkedRe = new RegExp(`^-\\s*\\[[xX]\\]\\s*${escaped}\\s*$`, "m");
      assert(checkedRe.test(body), `Process Change requires checked item: ${item}`);
    }
    assert(
      body.includes("One-line doctrine: The pipeline is sequential at the phase/gate level and parallel only inside safe sub-workloads."),
      "Missing one-line doctrine statement for process-change PR"
    );
    const impactSummaryMatch = body.match(
      /^Process-Change Impact Summary \(required when Process Change: yes\):\s*[\r\n]+-\s*(.+)$/im
    );
    assert(
      !!impactSummaryMatch && impactSummaryMatch[1].trim() !== "",
      "Process Change requires a non-empty Process-Change Impact Summary"
    );
  }

  assert(
    body.includes("Baseline (Pre-change)") && body.includes("Post-change Runs"),
    "Missing latency evidence tables (baseline + post-change runs)"
  );
  assert(body.includes("Run 1"), "Missing: Run 1 evidence");
  assert(body.includes("Run 2"), "Missing: Run 2 evidence");

  const isPass1 = body.includes("[x] Pass 1") || body.includes("[X] Pass 1");
  const isPass2 = body.includes("[x] Pass 2") || body.includes("[X] Pass 2");
  const isPass3 = body.includes("[x] Pass 3") || body.includes("[X] Pass 3");
  assert(isPass1 || isPass2 || isPass3, "You must select Pass 1, Pass 2, or Pass 3");

  assert(/pass\d?_?ms|passX_ms/.test(body), "Missing pass latency metric");
  assert(body.includes("total_ms"), "Missing total_ms metric");
  if (isPass3) {
    assert(body.includes("criteria_count_by_state"), "Pass 3 PRs must include divergence distribution (criteria_count_by_state)");
  }
  assert(
    body.includes("QG_") || body.includes("quality gate") || body.includes("Quality Gate"),
    "Missing quality gate / anomaly disclosure"
  );
  assert(body.includes("not reducing intelligence"), "Missing final principle: must acknowledge quality preservation rule");
};

const validateUi = () => {
  commonFloor();
  assertMeaningfulSection("## Visual Evidence");
  assertMeaningfulSection("## Accessibility");
  assertMeaningfulSection("## Browser Targets");
  assert(hasNoPipelineImpact(), "Missing: No-Pipeline-Impact: <value> line");
};

const validateInfra = () => {
  commonFloor();
  assertMeaningfulSection("## CI/Infra Scope");
  assertMeaningfulSection("## Rollback Plan");
  assertMeaningfulSection("## Affected Workflows");
  assert(hasNoPipelineImpact(), "Missing: No-Pipeline-Impact: <value> line");
};

const validateDocs = () => {
  commonFloor();
  assert(hasNoPipelineImpact(), "Missing: No-Pipeline-Impact: <value> line");
};

const validateMigration = () => {
  commonFloor();
  assertMeaningfulSection("## Schema Diff");
  assertMeaningfulSection("## Rollback Plan");
  assertMeaningfulSection("## Data Backfill");
  assertMeaningfulSection("## Rollback Posture");
  assertMeaningfulSection("## Lock / Table-Scan Risk");
  assertMeaningfulSection("## Data Backfill Risk");
  assertMeaningfulSection("## RLS / Access Impact");
  assertMeaningfulSection("## Production Verification Query");
  assert(hasNoPipelineImpact(), "Missing: No-Pipeline-Impact: <value> line");
};

const validateCode = () => {
  commonFloor();
  assertMeaningfulSection("## Tests Updated");
  assert(hasNoPipelineImpact(), "Missing: No-Pipeline-Impact: <value> line");
};

const validateMinor = () => {
  commonFloor();
  assert(hasSection("## Risk"), "Missing: Risk section");
  assert(hasNoPipelineImpact(), "Missing: No-Pipeline-Impact: <value> line");
};

const VALIDATORS = {
  evaluation: validateEvaluation,
  ui: validateUi,
  infra: validateInfra,
  docs: validateDocs,
  migration: validateMigration,
  code: validateCode,
  minor: validateMinor,
};

// ── Run ─────────────────────────────────────────────────────────
if (!VALIDATORS[type]) {
  console.error(`Unknown PR type: ${type}. Valid: ${Object.keys(VALIDATORS).join(", ")}`);
  process.exit(2);
}

console.log(`Validating PR body as type: ${type}`);
VALIDATORS[type]();

if (failures.length > 0) {
  console.log(`\n${failures.length} validation failure(s):\n`);
  for (const f of failures) console.log(`  ❌ ${f}`);
  console.log("\nSee .github/PULL_REQUEST_TEMPLATE/evaluation.md for the required template.");
  process.exit(1);
} else {
  console.log(`\n✅ PR body passes ${type} validator`);
  process.exit(0);
}
