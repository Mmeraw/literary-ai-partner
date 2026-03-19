# Operations Evidence Summary

## Evidence Rule

If it is not captured under `docs/operations/evidence/`, it did not happen.

Accepted evidence:

- logs
- metadata
- commit-linked runs

Not accepted as primary evidence:

- screenshots
- chat summaries
- terminal recollections

## Latest Verified Run

- Date: 2026-03-19
- Commit: `dcd85ca`
- Status: Pack F 100k qualification PASS archived (with machine-readable metrics artifacts)

## Packs Status

| Pack | Status | Evidence |
|------|--------|---------|
| A | PARTIAL | `runs/2026-03-19_2.1_packA_parity_run1/packA_anchor_parity.log` (+ `metadata.json`, `summary.md`) |
| B | PASS | `runs/2026-03-19_phase2.4_baseline/packB_fail_closed.log` |
| C | PASS (test-layer) | `runs/2026-03-19_2.2_packC_golden_run1/packC_golden_extraction.log` (+ `metadata.json`, `summary.md`) |
| D | PASS (test-layer) | `runs/2026-03-19_2.3_packD_reliability_run1/packD_apply_harness.log` (+ `packD_apply_reliability_report.json`, `metadata.json`, `summary.md`) |
| E | PASS | `runs/2026-03-19_phase2.4_baseline/packE_jobs_endpoint.log` |
| F | PASS | `runs/2026-03-19_packF_debug_1k/`, `runs/2026-03-19_packF_stability_10k/`, `runs/2026-03-19_packF_qualification_100k/` |

## Notes

- Pack A parity run archived on `main` at commit `70a4184ae04f8db2a8742d80957fa71ceb7d0675` with final successful command output at `runs/2026-03-19_2.1_packA_parity_run1/` (`3/3` suites, `36/36` tests).
- No unclassified failures observed in the covered Phase 2.4 and current Pack A test-layer runs.
- Canonical statuses enforced on the current jobs/apply path.
- Pack A requires target DB verification output (`tests/anchors/phase21-db-verification.sql`) before full sign-off can be marked PASS.
- Pack C dedicated golden corpus is now checked in and archived as a passing test-layer run at `runs/2026-03-19_2.2_packC_golden_run1/` (`2/2` suites, `24/24` tests).
- Pack D dedicated apply reliability harness is now checked in and archived at `runs/2026-03-19_2.3_packD_reliability_run1/` with `valid_success_rate = 100%` and `wrong_location_edits_total = 0` on the deterministic corpus run.
- Pack F soak harness is now checked in (`lib/operations/soakHarness.ts`, `scripts/soak/run-soak.ts`, `tests/operations/soak-harness.test.ts`) and executes via `npm run soak:run -- ...`.
- Pack F archived qualification ladder runs are now present:
	- `runs/2026-03-19_packF_debug_1k/` (PASS)
	- `runs/2026-03-19_packF_stability_10k/` (PASS)
	- `runs/2026-03-19_packF_qualification_100k/` (PASS)
- 100k qualification metrics: `total_events_processed=100000`, `unclassified_failures_total=0`, `wrong_location_edits_total=0`, `lost_writes_total=0`, `non_canonical_status_total=0`.
- Fresh raw logs are now captured for Packs A/C/D in their respective run directories; baseline scaffold entries remain and should continue to be backfilled with rerun outputs under the runbook evidence contract.
