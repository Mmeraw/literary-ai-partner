/* Stage-1 Entities Linter
   - Spine keys must be snake_case (no projectId/orgId/runId/etc)
   - Each entity must have anchors: id, created_at, updated_at
   - No unknown/duplicate entity names (based on filenames)
*/

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENTITIES_DIR = path.join(ROOT, "entities");
const BAD_CAMEL_KEYS = new Set(["projectId", "orgId", "runId"]);

const ANCHORS = ["id", "created_at", "updated_at"];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 125;
}

function isCamelCaseKey(k) {
  return /[a-z][A-Z]/.test(k);
}

function collectJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonFiles(p));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) out.push(p);
  }
  return out;
}

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`${file} is not valid JSON (${e.message})`);
    return null;
  }
}

function lintEntityFile(file) {
  const obj = readJson(file);
  if (!obj) return;

  // If your schema format nests the "properties" under a JSON Schema object, support both:
  const props =
    obj?.properties ??
    obj?.schema?.properties ??
    obj?.definition?.properties ??
    null;

  if (!props || typeof props !== "object") {
    fail(`${file} has no readable "properties" object (expected JSON schema-like structure).`);
    return;
  }

  // Anchor check
  for (const a of ANCHORS) {
    if (!(a in props)) fail(`${file} missing anchor field "${a}".`);
  }

  // Spine/camelCase check
  for (const k of Object.keys(props)) {
    if (BAD_CAMEL_KEYS.has(k)) fail(`${file} uses forbidden spine key "${k}" (camelCase).`);
    if (isCamelCaseKey(k)) fail(`${file} contains camelCase key "${k}" (Stage-1 forbids any camelCase).`);
  }
}

function main() {
  if (!fs.existsSync(ENTITIES_DIR)) {
    fail(`Missing entities folder at ${ENTITIES_DIR}`);
    process.exit(125);
  }

  const files = collectJsonFiles(ENTITIES_DIR);

  if (files.length === 0) {
    fail(`No .json files found under ${ENTITIES_DIR}. (Right now you have .docx files in root; move/convert schemas into /entities as .json.)`);
    process.exit(125);
  }

  // Duplicate entity name check (by filename base)
  const seen = new Map();
  for (const f of files) {
    const base = path.basename(f, ".json");
    if (seen.has(base)) fail(`Duplicate entity name "${base}" found:\n  - ${seen.get(base)}\n  - ${f}`);
    else seen.set(base, f);
  }

  for (const f of files) lintEntityFile(f);

  if (process.exitCode === 125) process.exit(125);
  console.log("OK: Stage-1 Golden Spine lint passed.");
}

main();
