#!/usr/bin/env node
// Exports each sheet of docs/roadmap/RevisionGrade_System_Ledger_CURRENT.xlsx
// into a kebab-case CSV mirror under docs/roadmap/.
//
// Safety rules:
//  - Never overwrites manually-maintained files (README.md, change-log.csv).
//  - Sheet names with spaces / punctuation are normalized to safe slugs.
//  - Refuses to run if workbook is missing.
//  - Pass --dry-run to preview without writing.
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src  = join(root, 'docs/roadmap/RevisionGrade_System_Ledger_CURRENT.xlsx');
const out  = join(root, 'docs/roadmap');
const dryRun = process.argv.includes('--dry-run');

const PROTECTED = new Set(['README.md', 'change-log.csv']);

const CANONICAL = {
  CURRENT_STATE: 'system-ledger.csv',
  ROOT_CAUSE_ANALYSIS: 'root-cause-analysis.csv',
  RCA_LINK_MAP: 'rca-link-map.csv',
  EXECUTION_BLOCK: 'execution-block.csv',
  RCA_SCRIPT_LINKS: 'rca-script-links.csv',
  VERIFICATION_ARTIFACTS: 'verification-artifacts.csv',
  E2E_SCRIPT_MAP: 'e2e-script-map.csv',
  ENFORCEMENT_SCALE: 'enforcement-scale.csv',
  RCA_BATCH_PLAN: 'rca-batch-plan.csv',
  ROADMAP_LANES: 'roadmap-lanes.csv',
  CANON_CODE_MAP: 'canon-code-map.csv',
  SOURCE_INDEX: 'source-index.csv',
  U_GATES_ENFORCEMENT: 'u-gates-enforcement.csv',
  ROADMAP_SYSTEM: 'roadmap-system.csv',
  ROADMAP_ARCHIVE_KEY: 'roadmap-archive-key.csv',
  COMPLETE_PARTIALLY_PENDING: 'complete-partially-pending.csv',
  README: 'sheet-readme.csv',
};

function slugify(name) {
  return name
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'sheet';
}
function canonicalKey(name) {
  return name.replace(/[^A-Z0-9_]/gi, '_').toUpperCase().replace(/_+/g,'_').replace(/^_|_$/g,'');
}

if (!existsSync(src)) {
  console.error('FATAL: workbook not found at', src);
  console.error('       Drop the .xlsx into docs/roadmap/ and rename to CURRENT.xlsx, then re-run.');
  process.exit(1);
}

const wb = XLSX.readFile(src);
let exported = 0, skipped = 0;
for (const sheetName of wb.SheetNames) {
  const key = canonicalKey(sheetName);
  const csvName = CANONICAL[key] || `sheet-${slugify(sheetName)}.csv`;
  if (PROTECTED.has(csvName)) {
    console.log(`⚠  ${sheetName} -> ${csvName} (PROTECTED, skipping)`);
    skipped++; continue;
  }
  const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
  const target = join(out, csvName);
  if (dryRun) {
    console.log(`(dry) ${sheetName} -> ${csvName} (${csv.split('\n').length} rows)`);
  } else {
    writeFileSync(target, csv);
    console.log(`✓ ${sheetName} -> ${csvName} (${csv.split('\n').length} rows)`);
  }
  exported++;
}
console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Exported ${exported} sheets, skipped ${skipped} protected files. Out: ${out}`);
