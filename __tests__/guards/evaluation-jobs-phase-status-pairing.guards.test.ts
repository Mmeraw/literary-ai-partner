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


// =============================================================================
// PR #487 extension: scan Supabase SQL migrations for direct
// `UPDATE public.evaluation_jobs SET status = ...` blocks that fail to also set
// top-level `phase_status` in the SAME UPDATE. This closes the gap surfaced by
// the finalizer RPC migrations (20260405000000 / 20260405000001) whose status
// writes were not visible to the TypeScript-only guard above.
// =============================================================================

const SQL_SCAN_DIRS = ["supabase/migrations"];
const SQL_EXTS = new Set([".sql"]);

// Known-safe SQL sites (RPC bodies that route through helpers or trigger-aware
// CTEs). Add entries only with a brief justification.
const SQL_ALLOWLIST: { file: string; lineApprox: number; reason: string }[] = [
  {
    file: 'supabase/migrations/20260405000000_finalizer_completion_authority_rpc.sql',
    lineApprox: 130,
    reason: 'Historical append-only migration superseded by 20260514023000_finalizer_complete_pairing.sql and 20260514023001_finalizer_mark_failed_pairing.sql; retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260405000001_finalizer_completion_authority_failure_rpc.sql',
    lineApprox: 56,
    reason: 'Historical append-only migration superseded by 20260514023000_finalizer_complete_pairing.sql and 20260514023001_finalizer_mark_failed_pairing.sql; retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260417000000_add_validity_status_evaluation_jobs.sql',
    lineApprox: 46,
    reason: 'One-shot legacy backfill (LOWER(TRIM(status)) canonicalization). Applied before the enforce_evaluation_jobs_status_phase_consistent trigger existed; no live write path. phase_status pairing not applicable to historical data normalization.',
  },
  {
    file: 'supabase/migrations/20260417000000_add_validity_status_evaluation_jobs.sql',
    lineApprox: 96,
    reason: 'One-shot legacy lifecycle value remap (completed->complete, in_progress->running, etc). Applied before the enforce trigger existed; no live write path. phase_status pairing not applicable to historical data normalization.',
  },
  {
    file: 'supabase/migrations/20260215000001_harden_claim_job_atomic.sql',
    lineApprox: 40,
    reason: 'Historical append-only migration of claim_job_atomic, superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260407000000_fix_claim_job_atomic_production_canonical.sql',
    lineApprox: 62,
    reason: 'Historical append-only migration of claim_job_atomic, superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260207000017_fix_claim_job_atomic_started_at_ambiguity.sql',
    lineApprox: 52,
    reason: 'Historical ancestor migration of claim_job_atomic, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql. Function body since CREATE OR REPLACEd. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260214180000_claim_evaluation_job_rpc.sql',
    lineApprox: 24,
    reason: 'Historical ancestor migration of the claim RPC family, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql. Function body since CREATE OR REPLACEd. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260206000000_fix_admin_retry_job_overload_ambiguity.sql',
    lineApprox: 27,
    reason: 'Historical admin_retry_job RPC body, superseded by 20260423000001_fix_admin_retry_job_phase_status.sql which CREATE OR REPLACEs the function with top-level phase_status = queued paired with status = queued. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260207000012_create_claim_job_atomic_canonical.sql',
    lineApprox: 49,
    reason: 'Original creation migration of claim_job_atomic, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260131000000_admin_retry_job_atomic_rpc.sql',
    lineApprox: 23,
    reason: 'Original creation migration of admin_retry_job, superseded by 20260423000001_fix_admin_retry_job_phase_status.sql which CREATE OR REPLACEs the function with top-level phase_status = queued paired with status = queued. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260205000001_fix_claim_job_contract_compliance.sql',
    lineApprox: 56,
    reason: 'Historical claim_job_atomic contract-compliance fix, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260128000002_fix_claim_job_atomic_eval_jobs.sql',
    lineApprox: 36,
    reason: 'Historical claim_job_atomic eval_jobs fix, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260130000002_update_claim_retry_gate.sql',
    lineApprox: 43,
    reason: 'Historical claim_retry_gate update on claim_job_atomic, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260130000007_create_claim_job_atomic_invariants.sql',
    lineApprox: 50,
    reason: 'Historical claim_job_atomic invariants migration, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
  {
    file: 'supabase/migrations/20260130000008_fix_claim_job_atomic_attempt_count.sql',
    lineApprox: 45,
    reason: 'Historical claim_job_atomic attempt_count fix, transitively superseded by 20260513000000_restore_claim_job_atomic_ttl_clamp.sql which CREATE OR REPLACEs the function with top-level phase_status pairing already in place. Retained for migration history immutability.',
  },
];

function walkSql(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git" || e === "dist") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out.push(...walkSql(p));
    else if (SQL_EXTS.has(p.slice(p.lastIndexOf(".")))) out.push(p);
  }
  return out;
}

// Find UPDATE public.evaluation_jobs ... SET <body> ; blocks.
// Returns each block's SET-clause body (up to the terminating top-level `;`)
// alongside the 1-indexed start line of the UPDATE keyword.
function findSqlEvalJobsUpdateBlocks(src: string): { startLine: number; body: string }[] {
  const out: { startLine: number; body: string }[] = [];
  // Match "UPDATE" possibly followed by ONLY ... ; "public.evaluation_jobs" or
  // "evaluation_jobs". Case-insensitive. We capture the start index then walk forward.
  const re = /\bUPDATE\s+(?:ONLY\s+)?(?:public\.)?evaluation_jobs\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const startIdx = m.index;
    // Find the SET keyword after the table name.
    const setMatch = /\bSET\b/i.exec(src.slice(m.index + m[0].length));
    if (!setMatch) continue;
    const setStart = m.index + m[0].length + setMatch.index + setMatch[0].length;
    // Walk forward until we hit a top-level `;` (respecting single-quoted strings,
    // parentheses depth, and PostgreSQL dollar-quoted blocks like $tag$ ... $tag$).
    let i = setStart;
    let depth = 0;
    let inSingle = false;
    let dollarTag: string | null = null;
    while (i < src.length) {
      const ch = src[i];
      if (dollarTag) {
        if (src.startsWith(dollarTag, i)) { i += dollarTag.length; dollarTag = null; continue; }
        i++; continue;
      }
      if (inSingle) {
        if (ch === "'") {
          if (src[i + 1] === "'") { i += 2; continue; } // escaped quote
          inSingle = false; i++; continue;
        }
        i++; continue;
      }
      if (ch === "'") { inSingle = true; i++; continue; }
      if (ch === "$") {
        const tagMatch = /^\$[A-Za-z0-9_]*\$/.exec(src.slice(i));
        if (tagMatch) { dollarTag = tagMatch[0]; i += tagMatch[0].length; continue; }
      }
      if (ch === "(") { depth++; i++; continue; }
      if (ch === ")") { depth--; i++; continue; }
      if (ch === ";" && depth === 0) break;
      i++;
    }
    const body = src.slice(setStart, i);
    const startLine = src.slice(0, startIdx).split("\n").length;
    out.push({ startLine, body });
  }
  return out;
}

// Detect a top-level `key = ...` assignment inside a SQL SET clause body.
// Top-level means not nested inside parentheses, single-quoted strings, or
// dollar-quoted blocks. We process the body char-by-char and at depth 0 look
// for `<key>\s*=` tokens, with the previous non-whitespace char being either
// the SET keyword start (i.e., we are at first assignment) or a `,` (later
// assignments in the comma-separated SET list).
function sqlSetHasTopLevelAssignment(body: string, key: string): boolean {
  let i = 0;
  let depth = 0;
  let inSingle = false;
  let dollarTag: string | null = null;
  const keyRe = new RegExp(`^${key}\\s*=`, "i");
  let lastSignificant: "," | "start" | "other" = "start";
  while (i < body.length) {
    const ch = body[i];
    if (dollarTag) {
      if (body.startsWith(dollarTag, i)) { i += dollarTag.length; dollarTag = null; lastSignificant = "other"; continue; }
      i++; continue;
    }
    if (inSingle) {
      if (ch === "'") {
        if (body[i + 1] === "'") { i += 2; continue; }
        inSingle = false; i++; lastSignificant = "other"; continue;
      }
      i++; continue;
    }
    if (ch === "'") { inSingle = true; i++; continue; }
    if (ch === "$") {
      const tagMatch = /^\$[A-Za-z0-9_]*\$/.exec(body.slice(i));
      if (tagMatch) { dollarTag = tagMatch[0]; i += tagMatch[0].length; continue; }
    }
    if (ch === "(") { depth++; i++; lastSignificant = "other"; continue; }
    if (ch === ")") { depth--; i++; lastSignificant = "other"; continue; }
    if (depth === 0 && (lastSignificant === "start" || lastSignificant === ",")) {
      // Skip whitespace, then test key.
      if (/\s/.test(ch)) { i++; continue; }
      if (keyRe.test(body.slice(i))) return true;
      lastSignificant = "other";
      i++; continue;
    }
    if (depth === 0 && ch === ",") { lastSignificant = ","; i++; continue; }
    if (!/\s/.test(ch)) lastSignificant = "other";
    i++;
  }
  return false;
}

describe("evaluation_jobs status/phase_status pairing guard (SQL migrations) [PR #487]", () => {
  const sqlFiles = SQL_SCAN_DIRS.flatMap((d) => walkSql(join(ROOT, d)));

  const violations: string[] = [];
  for (const f of sqlFiles) {
    let src: string;
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    if (!/evaluation_jobs/i.test(src)) continue;
    const blocks = findSqlEvalJobsUpdateBlocks(src);
    for (const b of blocks) {
      const hasStatus = sqlSetHasTopLevelAssignment(b.body, "status");
      const hasPhase = sqlSetHasTopLevelAssignment(b.body, "phase_status");
      if (hasStatus && !hasPhase) {
        const rel = f.replace(ROOT + "/", "");
        const allow = SQL_ALLOWLIST.find(
          (a) => rel.endsWith(a.file) && Math.abs(a.lineApprox - b.startLine) <= 5,
        );
        if (allow) continue;
        violations.push(`${rel}:${b.startLine}`);
      }
    }
  }

  it("every direct SQL UPDATE public.evaluation_jobs SET status=... also sets top-level phase_status", () => {
    expect(violations).toEqual([]);
  });
});
