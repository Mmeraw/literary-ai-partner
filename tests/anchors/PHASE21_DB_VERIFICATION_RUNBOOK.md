# Phase 2.1 DB Verification Runbook

This runbook standardizes execution and sign-off for Phase `2.1` (Anchor Metadata System) using:

- `tests/anchors/phase21-db-verification.sql`

---

## Purpose

Move Phase `2.1` from:

- **code-complete + test-verified**

to:

- **fully verified in target DB**

with auditable, repeatable evidence.

---

## Scope

This runbook verifies target-database state for:

1. Migration ledger presence (`20260318000000`)
2. Required schema shape on `public.change_proposals`
3. Required constraints present
4. Null-contract compliance
5. Offset invariant compliance
6. Source-slice and normalized-anchor consistency
7. Final hard-fail assertions

---

## Where to run

Run `tests/anchors/phase21-db-verification.sql` in the **target environment DB** (the environment you intend to mark as verified), using one of:

- Supabase SQL Editor (preferred)
- `psql` against the target database
- CI SQL job pointed at the target database

> Do **not** treat local/dev-only execution as target verification.

---

## How to run

1. Open the SQL tool for the target DB.
2. Paste/run the full contents of `tests/anchors/phase21-db-verification.sql`.
3. Save complete output/logs (including notices/exceptions).
4. Attach output to closure artifact/PR comment.

---

## Expected success output

Verification is considered **PASS** only when:

- migration check returns `passed = true` for `20260318000000`
- required column checks return `passed = true` for each required column
- all required constraints are present
- `bad_rows_global_required_anchor_fields = 0`
- `bad_rows_global_offset_invariants = 0`
- source-slice check returns:
  - `empty_slice_rows = 0`
  - `source_slice_mismatch_rows = 0`
  - `normalized_text_mismatch_rows = 0`
- final assertion block completes and emits notice:
  - `Phase 2.1 DB verification passed: migration present, schema complete, constraints present, and anchor rows valid.`

---

## Failure classes and meaning

### 1) Migration missing

Error pattern: migration check false / exception about migration `20260318000000` not found.

Meaning: target DB rollout is incomplete.

Action: apply migrations to target DB, rerun.

### 2) Required columns missing or malformed

Error pattern: one or more required columns absent/wrong type/default/nullability.

Meaning: schema drift or partial migration.

Action: reconcile schema with migration, rerun.

### 3) Required constraints missing

Error pattern: one or more named constraints absent.

Meaning: invariants not enforced at DB layer.

Action: apply/reapply migration or add missing constraints explicitly, rerun.

### 4) Required-anchor null violations

Error pattern: `bad_rows_global_required_anchor_fields > 0`.

Meaning: rows exist without complete anchor contract fields.

Action: identify/repair bad rows and/or writer path, rerun.

### 5) Offset invariant violations

Error pattern: `bad_rows_global_offset_invariants > 0`.

Meaning: persisted offsets violate `start_offset >= 0` and/or `end_offset > start_offset`.

Action: repair data and prevent invalid writes, rerun.

### 6) Source-slice mismatch

Error pattern: `source_slice_mismatch_rows > 0`.

Meaning: persisted offsets do not reproduce `original_text` reliably.

Action: investigate extraction/write-path defects before advancing to 2.2.

### 7) Normalized anchor mismatch

Error pattern: `normalized_text_mismatch_rows > 0`.

Meaning: `anchor_text_normalized` is inconsistent with normalized extracted slice.

Action: repair normalization logic/data, rerun.

---

## Governance gate rule

Do **not** start Phase `2.2` implementation unless one of these is true:

1. This verification script passes in target DB, or
2. The roadmap explicitly records deferred verification with blocker language and owner/date.

---

## Exact sign-off wording

### If verification passes

Use exactly:

> **Phase 2.1 (Anchor Metadata System) — Status: Completed, Verified: Yes.**
> Verified in target DB using `tests/anchors/phase21-db-verification.sql` with all checks passing and assertion block success.

### If verification is blocked/pending

Use exactly:

> **Phase 2.1 (Anchor Metadata System) — Status: Completed, Verified: Pending target DB execution.**
> Code/tests are complete; final DB verification via `tests/anchors/phase21-db-verification.sql` is not yet executed in target environment.

---

## Evidence checklist

Before declaring final closure, ensure evidence includes:

- target environment name
- execution timestamp (UTC)
- full SQL output (including assertion block)
- operator/reviewer
- final sign-off wording copied exactly
