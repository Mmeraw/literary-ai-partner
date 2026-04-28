# RevisionGrade System Ledger

## Source of Truth
The system roadmap is governed by the RCA-driven ledger.

**Primary file:**
- `RevisionGrade_System_Ledger_CURRENT.xlsx`

**Machine-readable mirrors** (auto-generated — do NOT hand-edit):
- `system-ledger.csv` (sheet: CURRENT_STATE)
- `root-cause-analysis.csv` (sheet: ROOT_CAUSE_ANALYSIS)
- `rca-link-map.csv` (sheet: RCA_LINK_MAP)
- `execution-block.csv` (sheet: EXECUTION_BLOCK)
- `rca-script-links.csv` (sheet: RCA_SCRIPT_LINKS)
- `verification-artifacts.csv` (sheet: VERIFICATION_ARTIFACTS)
- `change-log.csv` (manual append-only)

## Doctrine
> If it is not enforced, it is not real.
> Complete = implemented + hard-enforced + proven.

- RCA is the system of record. All roadmap views derive from `RCA_ID`.
- Every issue MUST have an `RCA_ID`. No `RCA_ID` = not a real problem.
- AMBIGUOUS lifecycle: `AMBIGUOUS → RESOLVED` only after subtype classified.
- Phase 2E / RLS evidence is NOT valid as U2 closure proof.

## Current State (last refresh 2026-04-28)
- `SYSTEM_STATE`: U1 ENFORCED · BOUNDARY_SHAPE RESOLVED · U2-003/U2-006 PARTIAL_REMOTE LIVE_PROOF_PENDING
- `PRIMARY_BLOCKER`: U2_PROPAGATION_ENFORCEMENT
- `SECONDARY_BLOCKER`: PASS_1_OUTPUT_FEASIBILITY
- `ACTIVE_LLR_TRACK`: LLR-004 (AMBIGUOUS, classification pending)

## Update Workflow
1. Edit `RevisionGrade_System_Ledger_CURRENT.xlsx` (workbook is the source).
2. Run `node scripts/export-roadmap-csv.mjs` to refresh CSV mirrors.
3. Append a row to `change-log.csv` with `date | version | summary | RCA_IDs | evidence`.
4. Commit workbook + CSVs + change-log together; never partial.
5. Old workbook revisions go to `docs/roadmap/archive/<filename>_<YYYY-MM-DD>.xlsx`.

## Validation
`scripts/validate-roadmap-sync.mjs` (TODO) will check:
- CSV row counts match source sheets.
- Every `RCA_ID` referenced in `system-ledger.csv` and `rca-link-map.csv` exists in `root-cause-analysis.csv`.
- No orphan `RCA_ID`s.

## Anti-Patterns (do NOT do)
- Commit `V7/V8/V9` filename variants alongside CURRENT.
- Hand-edit CSV mirrors.
- Use Phase 2E / RLS logs as U2 closure evidence.
- Dump narrative paragraphs into RCA cells — RCA cells are structured fields only.
