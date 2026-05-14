/**
 * Static guard: any direct .update() on evaluation_jobs that writes top-level
 * `status:` MUST also write top-level `phase_status:` in the same payload.
 *
 * Rationale: production trigger `enforce_evaluation_jobs_status_phase_consistent`
 * raises P0001 unless status and phase_status are paired:
 *   queued <-> queued|null
 *   running <-> running
 *   complete <-> complete
 *   failed <-> failed
 *
 * Writes that violate the pairing roll back silently in the worker
 * (Supabase client returns { error } but many sites don't terminalize),
 * leaving zombie running rows.
 *
 * If this test fails, fix the offending .update() block by adding the matching
 * top-level phase_status, or refactor the path to use an RPC that pairs both.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["lib", "workers", "scripts", "app"];
const EXTS = new Set([".ts", ".tsx"]);

// Known-safe call sites that go through RPC or helper functions that guarantee pairing.
// Add entries only with a brief justification.
const ALLOWLIST: { file: string; lineApprox: number; reason: string }[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git" || e === "dist") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(p));
    else if (EXTS.has(p.slice(p.lastIndexOf(".")))) out.push(p);
  }
  return out;
}

function findUpdateBlocks(src: string): { startLine: number; body: string }[] {
  // Find every `.from("evaluation_jobs")` followed (within ~30 lines) by `.update({ ... })`.
  // Extract the update payload object via brace-matching.
  const out: { startLine: number; body: string }[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/\bfrom\(\s*["'`]evaluation_jobs["'`]\s*\)/.test(lines[i])) continue;
    // search forward up to 40 lines for `.update({`
    for (let j = i; j < Math.min(i + 40, lines.length); j++) {
      const m = lines[j].match(/\.update\(\s*\{/);
      if (!m) continue;
      // brace match from this { forward
      let depth = 0;
      let buf = "";
      let started = false;
      for (let k = j; k < lines.length; k++) {
        const ln = lines[k];
        for (const ch of ln) {
          if (ch === "{") { depth++; started = true; }
          else if (ch === "}") { depth--; }
          buf += ch;
          if (started && depth === 0) {
            out.push({ startLine: j + 1, body: buf });
            k = lines.length; break;
          }
        }
        buf += "\n";
        if (started && depth === 0) break;
      }
      break;
    }
  }
  return out;
}

function topLevelHasKey(body: string, key: string): boolean {
  // Strip nested braces so we only see top-level keys of the update payload object.
  // body looks like "{ a: 1, b: { c: 2 }, status: 'x' }"
  let depth = 0;
  let stripped = "";
  for (const ch of body) {
    if (ch === "{") {
      depth++;
      if (depth === 1) { stripped += ch; continue; }
    } else if (ch === "}") {
      if (depth === 1) { stripped += ch; }
      depth--;
      continue;
    }
    if (depth === 1) stripped += ch;
  }
  const re = new RegExp(`(^|[,{\\s])${key}\\s*:`);
  return re.test(stripped);
}

describe("evaluation_jobs status/phase_status pairing guard", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  const violations: string[] = [];
  for (const f of files) {
    let src: string;
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    if (!src.includes("evaluation_jobs")) continue;
    const blocks = findUpdateBlocks(src);
    for (const b of blocks) {
      const hasStatus = topLevelHasKey(b.body, "status");
      const hasPhase = topLevelHasKey(b.body, "phase_status");
      if (hasStatus && !hasPhase) {
        const rel = f.replace(ROOT + "/", "");
        const allow = ALLOWLIST.find((a) => rel.endsWith(a.file) && Math.abs(a.lineApprox - b.startLine) <= 5);
        if (allow) continue;
        violations.push(`${rel}:${b.startLine}`);
      }
    }
  }

  it("every direct evaluation_jobs.update({status:...}) also sets top-level phase_status", () => {
    expect(violations).toEqual([]);
  });
});
