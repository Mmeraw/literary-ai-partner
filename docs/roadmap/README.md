# RevisionGrade Roadmap Authority

## Source of Truth

The authoritative roadmap for RevisionGrade is:

`docs/roadmap/RevisionGrade_System_Ledger_CURRENT.xlsx`

This workbook is the only living roadmap / RCA ledger authority.

> If it is not in the workbook, it is not real.

## What This Means

- The workbook is the source of truth for COMPLETE / PARTIAL / PENDING status.
- CSV files are not separate truth sources.
- Markdown files are not separate truth sources.
- Any CSV or Markdown roadmap material is either archived, transitional, or generated from the workbook.

## Required Workbook Sheets

The current workbook should contain these worksheets:

- `README`
- `Doctrine`
- `Complete-Partially-Pending`
- `Execution-Block`
- `RCA-Batch-Plan`
- `RCA-Link-Map`
- `RCA-Script-Links`
- `Enforcement-Scale`
- `E2E-Script-Map`
- `Canon-Code-Map`
- `Change-Log`
- `Source-Index`
- `Summary`

## Current System State

- `U1`: ENFORCED
- `U2`: PARTIAL
- `U3`: BLOCKED
- `QUALITY`: NOT ENFORCED

## Update Workflow

1. Update `RevisionGrade_System_Ledger_CURRENT.xlsx`.
2. Commit the workbook.
3. Do not hand-edit CSV mirrors as authority.
4. Do not use `ROADMAP.md` as authority.
5. Archive old roadmap and CSV material when it is replaced by workbook worksheets.

## Anti-Drift Rule

Do not maintain parallel roadmap truth across `.md`, `.csv`, and `.xlsx`.

The workbook wins.
