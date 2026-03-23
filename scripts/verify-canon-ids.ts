#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "lib/governance/canonRegistry.ts");
const NOMENCLATURE_PATH = path.join(ROOT, "docs/NOMENCLATURE_CANON_v1.md");

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function readFileOrFail(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function extractCanonicalCriteriaIds(markdown: string): Set<string> {
  const marker = "**Canonical IDs (only valid keys):**";
  const markerIndex = markdown.indexOf(marker);

  if (markerIndex < 0) {
    fail(`Could not locate criteria section marker in ${NOMENCLATURE_PATH}`);
  }

  const tail = markdown.slice(markerIndex + marker.length);
  const lines = tail.split(/\r?\n/);

  const ids: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0 && ids.length > 0) {
      break;
    }

    if (!line.startsWith("- ")) {
      if (ids.length > 0) {
        break;
      }
      continue;
    }

    ids.push(line.slice(2).trim());
  }

  if (ids.length !== 13) {
    fail(
      `Expected 13 canonical criteria IDs from NOMENCLATURE_CANON_v1.md, found ${ids.length}`,
    );
  }

  return new Set(ids);
}

type RegistryEntry = {
  canonId: string;
  name: string;
};

function extractRegistryEntries(source: string): RegistryEntry[] {
  const entries: RegistryEntry[] = [];

  const regex = /canonId:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null = regex.exec(source);

  while (match) {
    entries.push({ canonId: match[1], name: match[2] });
    match = regex.exec(source);
  }

  if (entries.length === 0) {
    fail(`No canon registry entries found in ${REGISTRY_PATH}`);
  }

  return entries;
}

const CRIT_TOKEN_TO_CRITERIA_ID: Record<string, string> = {
  CONCEPT: "concept",
  MOMENTUM: "narrativeDrive",
  CHARACTER: "character",
  POVVOICE: "voice",
  SCENE: "sceneConstruction",
  DIALOGUE: "dialogue",
  THEME: "theme",
  WORLD: "worldbuilding",
  PACING: "pacing",
  PROSE: "proseControl",
  TONE: "tone",
  CLOSURE: "narrativeClosure",
  MARKET: "marketability",
};

function main() {
  console.log("🔍 Canon ID verification against NOMENCLATURE_CANON_v1.md\n");

  const nomenclature = readFileOrFail(NOMENCLATURE_PATH);
  const registrySource = readFileOrFail(REGISTRY_PATH);

  const canonicalCriteria = extractCanonicalCriteriaIds(nomenclature);
  const entries = extractRegistryEntries(registrySource);

  const allowedNonCriteriaPrefixes = new Set(["GATE", "ENV", "REFINEMENT"]);

  let matched = 0;

  for (const entry of entries) {
    const [prefix, token] = entry.canonId.split("-");

    if (!prefix || !token) {
      fail(`Malformed canonId format: ${entry.canonId}`);
    }

    if (prefix === "CRIT") {
      const expectedCriteriaId = CRIT_TOKEN_TO_CRITERIA_ID[token];
      if (!expectedCriteriaId) {
        fail(`No CRIT token mapping found for canonId: ${entry.canonId}`);
      }

      if (!canonicalCriteria.has(expectedCriteriaId)) {
        fail(
          `Mapped criteria ID '${expectedCriteriaId}' for ${entry.canonId} not found in NOMENCLATURE_CANON_v1.md`,
        );
      }

      matched += 1;
      console.log(`✅ ${entry.canonId} -> ${expectedCriteriaId}`);
      continue;
    }

    if (!allowedNonCriteriaPrefixes.has(prefix)) {
      fail(`Unknown non-criteria prefix for canonId ${entry.canonId}`);
    }

    matched += 1;
    console.log(`✅ ${entry.canonId} -> non-criteria canon (prefix ${prefix})`);
  }

  if (entries.length !== 16) {
    fail(`Expected 16 registry entries, found ${entries.length}`);
  }

  if (matched !== entries.length) {
    fail(`Verification mismatch: matched=${matched}, total=${entries.length}`);
  }

  console.log(`\n✅ Verification complete: ${matched}/${entries.length} entries matched.`);
}

main();
