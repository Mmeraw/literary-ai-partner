# RevisionGrade Operational Roadmap

**Authority:** `docs/qa/REVISIONGRADE_PRODUCTION_CORRECTIVE_ACTION_REGISTER.md` and the executable SIPOC/FIPOC registries.  
**Workbook:** `docs/forensics/RevisionGrade_E2E_Evaluate_to_Revise_Forensics.xlsx` is a derived evidence mirror and may not create policy.

## Current release gate

`b8283c13` — Pass 2 → Pass 3 recommendation-lineage correction

- Local certification: 603 suites / 6,961 tests, TypeScript, scoped ESLint, critical-test guard, FIPOC export, and diff hygiene passed.
- Publication/deployment: pending; the local workspace cannot currently connect to GitHub.
- Live proof: pending. No claim of restored Workbench cards is valid until a new controlled evaluation is observed end to end.

## Ordered operational work

1. Publish and deploy the lineage correction; verify the exact deployed SHA.
2. Rerun Diamonds Aren't Forever or an equivalent controlled evaluation.
   - Reconcile every Pass 2 source ID as materialized, named consolidation, or governed suppression.
   - Confirm the canonical ledger and Revise Workbench match the persisted authority.
   - Capture reload, replay, and isolation evidence.
3. Complete Held Recovery live proof (RCA-001 / PG-01–PG-03), then decision persistence (PG-07) and cross-job isolation (PG-04).
4. Run representative editorial calibration (RCA-005) only after source-lineage proof; do not change scores, thresholds, or caps without evidence.
5. Expand dirty-input/kickback coverage over remaining SIPOC/FIPOC boundaries (RCA-003 / RCA-008).
6. Correct the report-progress authority so 100% means author-visible report release, not intermediate persistence.

## Invariants

- A recommendation source is not a queue quota.
- Every process rejects or handles dirty input by its registered in-process repair, bounded upstream kickback, block, or governed degraded path.
- A terminal dirty state cannot persist certified authority, expose author-facing output, or enter Revise.
- Legacy readers may remain only when they cannot create current authority and have an owner, evidence, sunset condition, and regression guard.
