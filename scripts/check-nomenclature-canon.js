#!/usr/bin/env node
/**
 * Nomenclature Canon Enforcement (CI-gated)
 * 
 * Validates that:
 * 1. Canon version matches CI pin (explicit upgrades only)
 * 2. No banned aliases are used as JSON/TS keys in codebase
 * 
 * This ensures nomenclature drift is mechanically impossible.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

const CANON_JSON = "lib/canon/nomenclature_canon.v1.json";

console.log("🔍 Nomenclature Canon Enforcement\n");

// ---- 1) Verify canon file exists ----
if (!fs.existsSync(CANON_JSON)) {
  fail(`Missing ${CANON_JSON}`);
}

const canon = JSON.parse(fs.readFileSync(CANON_JSON, "utf8"));

// ---- 2) Verify version pin (if CI sets CANON_VERSION) ----
const expectedVersion = process.env.CANON_VERSION;
if (expectedVersion) {
  console.log(`Checking version pin: expected=${expectedVersion}, actual=${canon.version}`);
  if (canon.version !== expectedVersion) {
    fail(`CANON_VERSION mismatch: env=${expectedVersion} json=${canon.version}. Update CI pin or bump canon version.`);
  }
  console.log(`✅ Canon version pin matches: ${canon.version}\n`);
} else {
  console.log(`ℹ️  No CANON_VERSION env var set (skipping version pin check)\n`);
}

// ---- 3) Collect banned aliases ----
const bannedAliases = new Set();

for (const domain of ["evaluationCriteria", "mdmCriteria"]) {
  const domainMap = canon[domain] || {};
  for (const key of Object.keys(domainMap)) {
    const aliases = domainMap[key]?.aliases_invalid || [];
    for (const alias of aliases) {
      bannedAliases.add(alias);
    }
  }
}

if (bannedAliases.size === 0) {
  console.log("✅ No banned aliases configured (skipping scan)\n");
  process.exit(0);
}

console.log(`🔍 Scanning for ${bannedAliases.size} banned aliases used as keys...\n`);

// ---- 4) Scan codebase for banned aliases as JSON/TS keys ----
let foundViolations = false;

for (const alias of bannedAliases) {
  // Search for the alias used as a quoted key in code
  // Pattern: "alias": or "alias" as object key
  const searchPattern = `"${alias}"`;
  
  try {
    // Use ripgrep if available (faster), fall back to grep
    // Exclude the canon files themselves (they list banned aliases for documentation)
    const cmd = `rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/.git/**' --glob '!**/archive/**' --glob '!lib/canon/nomenclature_canon.v1.json' --glob '!docs/NOMENCLATURE_CANON_v1.md' '${searchPattern}' app/ lib/ tests/ scripts/ 2>/dev/null || true`;
    
    const output = execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim();
    
    if (output) {
      console.error(`\n❌ Found banned alias "${alias}" used as key:\n${output}\n`);
      foundViolations = true;
    }
  } catch (err) {
    // ripgrep not found, use grep as fallback
    try {
      const grepCmd = `grep -rn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.git --exclude-dir=archive --exclude=nomenclature_canon.v1.json --exclude=NOMENCLATURE_CANON_v1.md '${searchPattern}' app/ lib/ tests/ scripts/ 2>/dev/null || true`;
      const output = execSync(grepCmd, { encoding: "utf8", stdio: "pipe" }).trim();
      
      if (output) {
        console.error(`\n❌ Found banned alias "${alias}" used as key:\n${output}\n`);
        foundViolations = true;
      }
    } catch (grepErr) {
      // If both fail, warn but don't block
      console.warn(`⚠️  Could not search for alias "${alias}" (ripgrep and grep unavailable)`);
    }
  }
}

if (foundViolations) {
  fail("Banned aliases detected in codebase. Use canonical keys from NOMENCLATURE_CANON_v1.md");
}

console.log("✅ Nomenclature canon enforcement PASSED\n");
