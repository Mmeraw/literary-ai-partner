#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const ROOT = process.cwd();
const ALLOWED_SCRIPT = "scripts/pipeline-stress-tier2.ts";

const SOURCE_FILES = globSync("**/*.{ts,tsx,js,mjs,cjs}", {
  cwd: ROOT,
  nodir: true,
  ignore: [
    "node_modules/**",
    ".git/**",
    ".next/**",
    "coverage/**",
    "dist/**",
    "build/**",
    "archive/**",
    "base44-export/**",
  ],
});

const CONTRACT_IMPORT_RE = String.raw`[^"']*tests\/contract(?:\/[^"']*)?`;
const IMPORT_PATTERNS = [
  new RegExp(String.raw`from\s+["']${CONTRACT_IMPORT_RE}["']`, "g"),
  new RegExp(String.raw`require\(\s*["']${CONTRACT_IMPORT_RE}["']\s*\)`, "g"),
  new RegExp(String.raw`import\(\s*["']${CONTRACT_IMPORT_RE}["']\s*\)`, "g"),
];

function isAllowedImporter(relativePath) {
  return relativePath.startsWith("tests/") || relativePath === ALLOWED_SCRIPT;
}

function lineForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

const violations = [];

for (const relativePath of SOURCE_FILES) {
  const absolutePath = path.join(ROOT, relativePath);
  const content = fs.readFileSync(absolutePath, "utf8");

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (!isAllowedImporter(relativePath)) {
        violations.push({
          relativePath,
          line: lineForIndex(content, match.index),
          snippet: match[0],
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    "[guard:tier2-contract-import-boundary] Forbidden imports from tests/contract/** detected.",
  );
  console.error(
    "Only tests/** and scripts/pipeline-stress-tier2.ts may import from tests/contract/**.",
  );
  for (const violation of violations) {
    console.error(` - ${violation.relativePath}:${violation.line} :: ${violation.snippet}`);
  }
  process.exit(1);
}

console.log(
  "[guard:tier2-contract-import-boundary] PASS — import boundary preserved.",
);
