#!/usr/bin/env node
/**
 * PUBLIC_SURFACE_CANON_v1 — CI Public Surface Term Guard
 *
 * Scans user-facing code paths for banned internal identifiers.
 * Fails the PR if any protected term appears in a Tier 1 surface file.
 *
 * Scanned paths:
 *   - app/          (Next.js routes and page components)
 *   - components/   (UI components)
 *
 * Explicitly excluded from the ban scan (Tier 2 files where terms are legal):
 *   - lib/evaluation/translateToPublicReport.ts  (drops/maps terms — reviewed separately)
 *   - lib/evaluation/pipeline/
 *   - schemas/
 *   - docs/
 *   - scripts/
 *   - types/public-evaluation-report.ts          (uses public vocabulary only)
 *
 * Usage:
 *   npx tsx scripts/ci-guard/check_public_surface_terms.ts
 *   node --loader ts-node/esm scripts/ci-guard/check_public_surface_terms.ts
 *
 * See: docs/PUBLIC_SURFACE_CANON_v1.md §5
 */

import * as fs from "fs";
import * as path from "path";

// ─── Banned patterns (PUBLIC_SURFACE_CANON_v1 §5.1) ─────────────────────────

const BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /WAVE-[A-Z0-9_]+/, reason: "Internal wave identifier" },
  { pattern: /\bWAVE_GUIDE\b/, reason: "Wave guide internal reference" },
  { pattern: /Gate\s+\d+[\.\d]*/, reason: "Gate identifier (e.g. Gate 15.1)" },
  { pattern: /RITUAL-[A-Z0-9_-]+/, reason: "Ritual/doctrine code" },
  { pattern: /evaluation_result_v2/, reason: "Internal schema version" },
  { pattern: /\bschema_version\b/, reason: "Internal schema field" },
  { pattern: /\bpolicy_family\b/, reason: "Internal governance field" },
  { pattern: /\brepro_anchor\b/, reason: "Internal reproducibility field" },
  { pattern: /\bartifact_validation_result\b/, reason: "Internal gate field" },
  { pattern: /\bartifact_reason_codes\b/, reason: "Internal gate field" },
  { pattern: /\bcriteria_plan\b/, reason: "Internal transparency field" },
  { pattern: /\bCRITERIA_13\b/, reason: "Internal criteria source reference" },
  { pattern: /\bprompt_version\b/, reason: "Internal engine field" },
  { pattern: /\bevaluation_run_id\b/, reason: "Internal correlation ID" },
  { pattern: /\bpipeline_stage\b/, reason: "Internal pipeline field" },
  { pattern: /\bfailure_origin\b/, reason: "Internal failure envelope field" },
  { pattern: /\bAUTHORITY_CAP_APPLIED\b/, reason: "Internal score adjustment code" },
  { pattern: /\bscore_adjustments\b/, reason: "Internal score adjustment array" },
  { pattern: /\bNO_SIGNAL\b/, reason: "Internal signal status" },
  { pattern: /\bINSUFFICIENT_SIGNAL\b/, reason: "Internal signal status" },
  { pattern: /\bSCORABLE\b/, reason: "Internal signal status" },
  { pattern: /\bNOT_APPLICABLE\b/, reason: "Internal criterion status" },
  { pattern: /\bMDM_WORK_TYPE_CANON\b/, reason: "Internal MDM reference" },
  { pattern: /\bCANON_PHASE_STATUS\b/, reason: "Internal phase status reference" },
  { pattern: /REC-1A/, reason: "Internal recommendation code" },
  { pattern: /Volume [IVX-]+/, reason: "Internal doctrine volume reference" },
  { pattern: /Tsunami/i, reason: "Internal wave family name" },
  { pattern: /Ledger [AB]/, reason: "Internal scoring ledger" },
  { pattern: /\bSIPOC\b/, reason: "Internal telemetry field" },
  { pattern: /Lost World/i, reason: "Internal wave group name" },
];

// ─── Scanned directories ─────────────────────────────────────────────────────

const SCANNED_DIRS = ["app", "components"];

// Explicitly excluded file paths (relative to workspace root)
const EXCLUDED_FILES = new Set([
  "lib/evaluation/translateToPublicReport.ts",
  // The translator maps/drops banned terms — it is reviewed separately.
]);

// Excluded directory prefixes
const EXCLUDED_PREFIXES = [
  // Internal operator dashboards — not end-user surfaces
  "app/admin",
  "app/api/admin",
  "app/api/internal",
  // Share-token infrastructure: manages share records in DB; does not render eval content to users.
  "app/api/report-shares",
  // Engine and pipeline internals
  "lib/evaluation/pipeline",
  "lib/evaluation/__tests__",
  "schemas",
  "docs",
  "scripts",
  "node_modules",
  ".next",
];

// ─── File traversal ──────────────────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function* walkDir(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

function isExcluded(filePath: string, root: string): boolean {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  if (EXCLUDED_FILES.has(rel)) return true;
  return EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

// ─── Main scan ───────────────────────────────────────────────────────────────

type Violation = {
  file: string;
  line: number;
  col: number;
  match: string;
  reason: string;
};

function scanFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Skip comment-only lines (single-line) — banned terms in code comments about
    // the doctrine are acceptable. Only flag in code/string literals.
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    // Lines annotated // ci-surface:allow are internal infrastructure (DB query constants,
    // TypeScript type definitions that mirror internal schemas) that never reach user output.
    // Use sparingly and only where the term is not rendered in any user-visible string.
    if (line.includes("// ci-surface:allow")) {
      continue;
    }

    for (const { pattern, reason } of BANNED_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        violations.push({
          file: filePath,
          line: lineIdx + 1,
          col: match.index + 1,
          match: match[0],
          reason,
        });
      }
    }
  }

  return violations;
}

function main(): void {
  const root = process.cwd();
  const allViolations: Violation[] = [];

  for (const dir of SCANNED_DIRS) {
    const absDir = path.join(root, dir);
    for (const file of walkDir(absDir)) {
      if (!isExcluded(file, root)) {
        allViolations.push(...scanFile(file));
      }
    }
  }

  if (allViolations.length === 0) {
    console.log(
      "[PUBLIC_SURFACE_CANON_v1] CI guard passed: no banned internal identifiers in user-facing surfaces."
    );
    process.exit(0);
  }

  console.error(
    `[PUBLIC_SURFACE_CANON_v1] CI guard FAILED: ${allViolations.length} violation(s) found.\n`
  );
  for (const v of allViolations) {
    const rel = path.relative(root, v.file);
    console.error(`  ${rel}:${v.line}:${v.col}  "${v.match}"  — ${v.reason}`);
  }
  console.error(
    "\nInternal identifiers may not appear in user-facing code paths. See docs/PUBLIC_SURFACE_CANON_v1.md §5."
  );
  process.exit(1);
}

main();
