#!/usr/bin/env node
/**
 * Criteria Registry Enforcement (CI-gated)
 * 
 * Validates that:
 * 1. MDM matrices use ONLY canonical keys from schemas/criteria-keys.ts
 * 2. MDM matrices have COMPLETE coverage (all 13 canonical keys)
 * 3. Fixtures use ONLY canonical keys (subset allowed)
 * 4. All status codes are exactly R/O/NA/C
 * 
 * This script WILL FAIL until the MDM matrix is migrated to canonical keys.
 * That is intentional governance enforcement.
 */

const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function loadJson(p) {
  return JSON.parse(readText(p));
}

function extractCriteriaKeysFromTS(tsPath) {
  const src = readText(tsPath);
  const m = src.match(/export const CRITERIA_KEYS\s*=\s*\[(.*?)\]\s*as const/s);
  if (!m) fail(`CRITERIA_KEYS array not found in ${tsPath}`);
  const keys = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (keys.length !== 13) fail(`Expected 13 CRITERIA_KEYS, got ${keys.length}`);
  return keys;
}

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function assertNoUnknownKeys(label, foundKeys, canonSet) {
  const unknown = foundKeys.filter((k) => !canonSet.has(k));
  if (unknown.length) {
    fail(`${label}: UNKNOWN keys: ${unknown.join(", ")}\n   Expected only: ${[...canonSet].sort().join(", ")}`);
  }
}

function assertFullCoverage(label, foundKeys, canonKeys) {
  const foundSet = new Set(foundKeys);
  const missing = canonKeys.filter((k) => !foundSet.has(k));
  if (missing.length) {
    fail(`${label}: MISSING canonical keys: ${missing.join(", ")}`);
  }
}

// ---- CONFIG ----
const TS_REGISTRY = "schemas/criteria-keys.ts";
const MDM_MATRIX = "criteria_matrix_v1.0.0_work_type_to_criteria_status_master_data_management_MDM.json";
const FIXTURE_ROOT = "evidence/phase-d/d2/agent-view-fixtures";

console.log("🔍 Criteria Registry Enforcement\n");

// Load canonical keys
const canonKeys = extractCriteriaKeysFromTS(TS_REGISTRY);
const canonSet = new Set(canonKeys);
console.log(`✅ Loaded ${canonKeys.length} canonical keys from ${TS_REGISTRY}`);
console.log(`   Keys: ${canonKeys.join(", ")}\n`);

// ---- 1) Validate MDM matrix ----
if (!fs.existsSync(MDM_MATRIX)) {
  console.log(`⚠️  MDM matrix not found: ${MDM_MATRIX} (skipping MDM validation)\n`);
} else {
  console.log(`🔍 Validating MDM matrix: ${MDM_MATRIX}`);
  console.log("MDM_MATRIX=", MDM_MATRIX);
  const matrix = loadJson(MDM_MATRIX);

  if (!matrix.workTypes || typeof matrix.workTypes !== "object") {
    fail("MDM matrix: workTypes object missing");
  }

  const workTypeKeys = Object.keys(matrix.workTypes);
  console.log(`   Found ${workTypeKeys.length} work types\n`);

  for (const [workTypeKey, wt] of Object.entries(matrix.workTypes)) {
    const criteria = wt?.criteria;
    if (!criteria || typeof criteria !== "object") {
      fail(`MDM matrix: criteria missing for workType=${workTypeKey}`);
    }

    const keys = Object.keys(criteria);

    // Canon enforcement (WILL FAIL until matrix is migrated)
    assertNoUnknownKeys(`MDM workType=${workTypeKey}`, keys, canonSet);
    assertFullCoverage(`MDM workType=${workTypeKey}`, keys, canonKeys);

    // Status code validation
    for (const [k, v] of Object.entries(criteria)) {
      if (!["R", "O", "NA", "C"].includes(v)) {
        fail(`MDM BAD_STATUS workType=${workTypeKey} key=${k} value=${String(v)}`);
      }
    }
  }

  console.log(`✅ MDM matrix validated: all work types use canonical keys with R/O/NA/C status codes\n`);
}

// ---- 2) Validate fixtures ----
if (!fs.existsSync(FIXTURE_ROOT)) {
  console.log(`⚠️  Fixture root not found: ${FIXTURE_ROOT} (skipping fixture validation)\n`);
} else {
  console.log(`🔍 Validating fixtures: ${FIXTURE_ROOT}`);
  const jsonFiles = walk(FIXTURE_ROOT).filter((p) => p.endsWith(".json"));
  
  if (jsonFiles.length === 0) {
    console.log(`   No JSON fixtures found (skipping)\n`);
  } else {
    console.log(`   Found ${jsonFiles.length} fixture files\n`);

    for (const jf of jsonFiles) {
      const j = loadJson(jf);
      const cp = j?.governance?.transparency?.criteria_plan;
      if (!cp) continue; // Fixture may not include D2 by design

      for (const b of ["R", "O", "NA", "C"]) {
        if (!Array.isArray(cp[b])) {
          fail(`Fixture ${path.basename(jf)}: criteria_plan.${b} must be an array`);
        }
        if (cp[b].length > 0) {
          assertNoUnknownKeys(`Fixture ${path.basename(jf)} bucket=${b}`, cp[b], canonSet);
        }
      }
    }

    console.log(`✅ Fixtures validated: all criteria_plan keys are canonical\n`);
  }
}

console.log("✅ Criteria registry enforcement PASSED");
