#!/usr/bin/env node
// Exports each sheet of docs/roadmap/RevisionGrade_System_Ledger_CURRENT.xlsx
// to a kebab-case CSV mirror in docs/roadmap/.
// Usage: node scripts/export-roadmap-csv.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src  = join(root, 'docs/roadmap/RevisionGrade_System_Ledger_CURRENT.xlsx');
const out  = join(root, 'docs/roadmap');

if (!existsSync(src)) {
  console.error('FATAL: workbook not found at', src);
  process.exit(1);
}

const SHEET_TO_CSV = {
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
};

const wb = XLSX.readFile(src);
let exported = 0;
for (const sheetName of wb.SheetNames) {
  const key = sheetName.replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
  const csvName = SHEET_TO_CSV[key] || `sheet-${sheetName.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`;
  const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
  writeFileSync(join(out, csvName), csv);
  console.log(`✓ ${sheetName} -> ${csvName} (${csv.split('\n').length} rows)`);
  exported++;
}
console.log(`\nExported ${exported} sheets to ${out}`);
