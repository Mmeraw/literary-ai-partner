#!/usr/bin/env node
// Mirrors .github/workflows/latency-pr-enforcement.yml — keep both in sync.
// Validates a PR body against the latency template requirements.
// Usage:
//   node scripts/validate-pr-body.mjs                       (validate current branch's PR)
//   node scripts/validate-pr-body.mjs --pr <number>         (validate a specific PR)
//   node scripts/validate-pr-body.mjs --file <path>         (validate a body file)

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function parseArgs(argv) {
  const out = { file: null, pr: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" && argv[i + 1]) { out.file = argv[++i]; continue; }
    if (a.startsWith("--file=")) { out.file = a.slice("--file=".length); continue; }
    if (a === "--pr" && argv[i + 1]) { out.pr = argv[++i]; continue; }
    if (a.startsWith("--pr=")) { out.pr = a.slice("--pr=".length); continue; }
  }
  return out;
}

function tryGh(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch {
    return null;
  }
}

function loadBody({ file, pr }) {
  if (file) {
    return { body: readFileSync(file, "utf8"), source: `file:${file}`, files: null };
  }
  if (pr) {
    const body = tryGh(`gh pr view ${pr} --json body --jq .body`);
    if (body == null) {
      console.error(`Could not read PR #${pr} body via gh.`);
      process.exit(2);
    }
    const filesJson = tryGh(`gh pr view ${pr} --json files`);
    let files = null;
    if (filesJson) {
      try { files = JSON.parse(filesJson).files.map((f) => f.path); } catch {}
    }
    return { body, source: `pr:${pr}`, files };
  }
  // Current branch
  const body = tryGh(`gh pr view --json body --jq .body`);
  if (body == null) {
    console.error("No PR found for current branch and no --file or --pr provided.");
    process.exit(2);
  }
  const filesJson = tryGh(`gh pr view --json files`);
  let files = null;
  if (filesJson) {
    try { files = JSON.parse(filesJson).files.map((f) => f.path); } catch {}
  }
  return { body, source: "pr:current-branch", files };
}

function isExemptOnly(files) {
  if (!files || files.length === 0) return false;
  const isDocs = (n) => n.startsWith("docs/");
  const isMigration = (n) => n.startsWith("supabase/migrations/");
  const isAdminUi = (n) => n.startsWith("app/admin/") || n.startsWith("components/admin/");
  return files.every((n) => isDocs(n) || isMigration(n) || isAdminUi(n));
}

function runChecks(body) {
  const groups = {
    "Required global sections": [
      ["## Summary", "Missing: Summary section"],
      ["## Scope", "Missing: Scope section"],
      ["## Contract Integrity", "Missing: Contract Integrity section"],
      ["## Behavioral Quality", "Missing: Behavioral Quality section"],
      ["## Latency Evidence", "Missing: Latency Evidence section"],
      ["## Risks & Anomalies", "Missing: Risks & Anomalies section"],
    ],
    "Latency anchors": [
      ["Baseline (Pre-change)", "Missing latency anchor: Baseline (Pre-change)"],
      ["Post-change Runs", "Missing latency anchor: Post-change Runs"],
      ["Run 1", "Missing: Run 1 evidence"],
      ["Run 2", "Missing: Run 2 evidence"],
    ],
    "Metric tokens": [
      ["total_ms", "Missing total_ms metric"],
    ],
    "Final principle": [
      ["not reducing intelligence", "Missing final principle: must acknowledge quality preservation rule"],
    ],
  };

  const missing = [];
  for (const [cat, checks] of Object.entries(groups)) {
    for (const [needle, msg] of checks) {
      if (!body.includes(needle)) missing.push({ cat, msg, needle });
    }
  }

  // Pass selection
  const isPass1 = body.includes("[x] Pass 1") || body.includes("[X] Pass 1");
  const isPass2 = body.includes("[x] Pass 2") || body.includes("[X] Pass 2");
  const isPass3 = body.includes("[x] Pass 3") || body.includes("[X] Pass 3");
  if (!(isPass1 || isPass2 || isPass3)) {
    missing.push({
      cat: "Pass selection",
      msg: "You must select Pass 1, Pass 2, or Pass 3 (at least one of [x] Pass 1 / [x] Pass 2 / [x] Pass 3)",
      needle: "[x] Pass {1|2|3}",
    });
  }

  // pass metric regex
  if (!/pass\d?_?ms|passX_ms/.test(body)) {
    missing.push({
      cat: "Metric tokens",
      msg: "Missing pass latency metric (e.g. pass1_ms / pass2_ms / pass3_ms / passX_ms)",
      needle: "/pass\\d?_?ms|passX_ms/",
    });
  }

  // Pass 3 special
  if (isPass3 && !body.includes("criteria_count_by_state")) {
    missing.push({
      cat: "Pass 3 special",
      msg: "Pass 3 PRs must include divergence distribution (criteria_count_by_state)",
      needle: "criteria_count_by_state",
    });
  }

  // Quality gate
  if (!(body.includes("QG_") || body.includes("quality gate") || body.includes("Quality Gate"))) {
    missing.push({
      cat: "Quality gate",
      msg: "Missing quality gate / anomaly disclosure (QG_, quality gate, or Quality Gate)",
      needle: "QG_ | quality gate | Quality Gate",
    });
  }

  return { missing, isPass1, isPass2, isPass3 };
}

function printMissing(missing) {
  const byCat = new Map();
  for (const m of missing) {
    if (!byCat.has(m.cat)) byCat.set(m.cat, []);
    byCat.get(m.cat).push(m);
  }
  console.error("❌ PR body failed enforce-latency-template compliance.");
  console.error("");
  for (const [cat, items] of byCat) {
    console.error(`  ${cat}:`);
    for (const it of items) {
      console.error(`    - ${it.msg}`);
      console.error(`        needle: ${it.needle}`);
    }
  }
}

function printDiff(body, missing) {
  if (missing.length === 0) return;
  console.error("");
  console.error("--- Required tokens not present in body ---");
  for (const m of missing) {
    console.error(`  + ${m.needle}`);
  }
  console.error("--- End diff ---");
}

const args = parseArgs(process.argv.slice(2));
const { body, source, files } = loadBody(args);

if (!args.file && isExemptOnly(files)) {
  console.log(`✅ Skipping enforcement: PR (${source}) changes are exempt-scope (docs/migrations/admin-ui only).`);
  process.exit(0);
}

const { missing } = runChecks(body);

if (missing.length === 0) {
  console.log(`✅ PR body is enforce-latency-template compliant. (source=${source})`);
  process.exit(0);
}

printMissing(missing);
printDiff(body, missing);
process.exit(1);
