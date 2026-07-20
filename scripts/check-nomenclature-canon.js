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
const { spawnSync } = require("child_process");

const CANON_JSON = "lib/canon/nomenclature_canon.v1.json";
const VOCABULARY_DETECTION_ALLOW_MARKER = "canon-audit-allow: vocabulary-detection";

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function loadCanon(canonPath = CANON_JSON) {
  if (!fs.existsSync(canonPath)) {
    fail(`Missing ${canonPath}`);
  }

  return JSON.parse(fs.readFileSync(canonPath, "utf8"));
}

function collectBannedAliases(canon) {
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

  return bannedAliases;
}

function parseSearchOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // ripgrep emits <path>:<line>:<text>. Match the numeric line delimiter
      // instead of the first colon so Windows drive roots (C:\\...) remain
      // part of the path and text may still contain arbitrary colons.
      const match = line.match(/^(.+?):(\d+):(.*)$/);

      if (!match) {
        return {
          filePath: line,
          lineNumber: null,
          lineText: "",
          raw: line,
        };
      }

      return {
        filePath: match[1],
        lineNumber: Number.parseInt(match[2], 10),
        lineText: match[3],
        raw: line,
      };
    });
}

function hasVocabularyDetectionAllowMarker(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").includes(VOCABULARY_DETECTION_ALLOW_MARKER);
  } catch {
    return false;
  }
}

function filterAllowedMatches(matches, repoRoot = process.cwd()) {
  const allowCache = new Map();

  return matches.filter((match) => {
    const absoluteFilePath = path.isAbsolute(match.filePath)
      ? match.filePath
      : path.resolve(repoRoot, match.filePath);

    if (!allowCache.has(absoluteFilePath)) {
      allowCache.set(
        absoluteFilePath,
        hasVocabularyDetectionAllowMarker(absoluteFilePath),
      );
    }

    return !allowCache.get(absoluteFilePath);
  });
}

function formatMatches(matches) {
  return matches.map((match) => match.raw).join("\n");
}

function searchAliasMatches(alias) {
  const searchPattern = `"${alias}"`;
  const result = spawnSync(
    "rg",
    [
      "-n",
      "--fixed-strings",
      "--hidden",
      "--glob", "!**/node_modules/**",
      "--glob", "!**/.next/**",
      "--glob", "!**/dist/**",
      "--glob", "!**/.git/**",
      "--glob", "!**/archive/**",
      "--glob", "!lib/canon/nomenclature_canon.v1.json",
      "--glob", "!docs/NOMENCLATURE_CANON_v1.md",
      searchPattern,
      "app/", "lib/", "tests/", "scripts/",
    ],
    { encoding: "utf8", stdio: "pipe" },
  );

  // ripgrep uses 0 for matches and 1 for a clean no-match result. Any other
  // status means enforcement did not run and must fail closed.
  if (!result.error && (result.status === 0 || result.status === 1)) {
    return (result.stdout || "").trim();
  }

  const reason = result.error?.message || (result.stderr || "").trim() || `exit ${result.status}`;
  throw new Error(`Nomenclature scan could not execute for alias "${alias}": ${reason}`);
}

function run() {
  console.log("🔍 Nomenclature Canon Enforcement\n");

  const canon = loadCanon();

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

  const bannedAliases = collectBannedAliases(canon);

  if (bannedAliases.size === 0) {
    console.log("✅ No banned aliases configured (skipping scan)\n");
    process.exit(0);
  }

  console.log(`🔍 Scanning for ${bannedAliases.size} banned aliases used as keys...\n`);

  let foundViolations = false;

  for (const alias of bannedAliases) {
    const rawOutput = searchAliasMatches(alias);
    if (!rawOutput) {
      continue;
    }

    const filteredMatches = filterAllowedMatches(parseSearchOutput(rawOutput));
    if (filteredMatches.length > 0) {
      console.error(`\n❌ Found banned alias "${alias}" used as key:\n${formatMatches(filteredMatches)}\n`);
      foundViolations = true;
    }
  }

  if (foundViolations) {
    fail("Banned aliases detected in codebase. Use canonical keys from NOMENCLATURE_CANON_v1.md");
  }

  console.log("✅ Nomenclature canon enforcement PASSED\n");
}

if (require.main === module) {
  run();
}

module.exports = {
  CANON_JSON,
  VOCABULARY_DETECTION_ALLOW_MARKER,
  collectBannedAliases,
  filterAllowedMatches,
  hasVocabularyDetectionAllowMarker,
  loadCanon,
  parseSearchOutput,
  run,
  searchAliasMatches,
};
