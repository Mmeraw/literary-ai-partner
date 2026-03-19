# PACK F EXECUTION CONTRACT

_Post–Phase 2.4 Baseline (Commit: `461a004`)_

---

## 1. Purpose

Define how Pack F is executed, what evidence must be captured, and what conditions block release.

Pack F is not considered complete because a harness spec exists.
Pack F is complete only when a real harness run produces evidence artifacts and passes all invariants.

---

## 2. Required Inputs

Every Pack F run must declare:

- commit SHA
- branch
- mode (`dry-run` | `deterministic` | `stress`)
- seed
- total event count
- concurrency level
- fault injection enabled / disabled

These values must be written to `metadata.json`.

---

## 3. Required Commands

### Debug pass

`npm run soak:run -- --events=1000 --concurrency=5 --seed=42 --mode=deterministic`

### Stability pass

`npm run soak:run -- --events=10000 --concurrency=10 --seed=42 --mode=stress`

### Final qualification pass

`npm run soak:run -- --events=100000 --concurrency=10 --seed=42 --mode=stress`

If the actual CLI differs, this contract must be updated to the checked-in command shape before sign-off.

---

## 4. Evidence Output Location

Every Pack F run must write to:

- `docs/operations/evidence/runs/<run-id>/`

Required files:

- `metadata.json`
- `metrics.json`
- `run.log`
- `summary.md`
- `failures_sample.json` (if any failures occur)

Example locations:

- `docs/operations/evidence/runs/2026-03-19_packF_debug/`
- `docs/operations/evidence/runs/2026-03-20_packF_10k/`
- `docs/operations/evidence/runs/2026-03-21_packF_100k/`

---

## 5. Required Metrics

`metrics.json` must include at minimum:

- `total_events_processed`
- `classified_failures_total`
- `unclassified_failures_total`
- `wrong_location_edits_total`
- `lost_writes_total`
- `persistence_write_failures_total`
- `retries_total`
- `non_canonical_status_total`

Optional but recommended:

- `throughput_events_per_sec`
- `duration_ms`
- `max_concurrency_observed`

---

## 6. Hard Pass Criteria

A Pack F run is PASS only if all are true:

- total processed events equal requested count
- `unclassified_failures_total == 0`
- `wrong_location_edits_total == 0`
- `lost_writes_total == 0`
- `non_canonical_status_total == 0`
- all observed failure codes are canonical
- no silent fallback behavior is recorded

---

## 7. Hard Fail Conditions

A Pack F run is automatic FAIL if any are true:

- any wrong-location edit occurs
- any unclassified failure occurs
- any write is lost
- any non-canonical state appears
- any silent fallback is detected
- run terminates without required evidence artifacts

---

## 8. Escalation Rules

### Immediate stop

Stop the run immediately if:

- wrong-location edits `> 0`
- unclassified failures `> 0`
- non-canonical status `> 0`

### Continue but mark degraded

Continue only for diagnostic purposes if:

- transient persistence failures occur but are classified and recovered
- retry volume spikes above expected threshold

Any degraded run cannot be used for release sign-off.

---

## 9. Release Blocking Rule

Release is blocked until a full 100,000-event Pack F run passes and evidence is archived.

No exception:

- not because lower-count runs passed
- not because logic looks correct
- not because prior commits passed

Only the archived passing run counts.

---

## 10. Required Summary Format

`summary.md` must include:

- run date
- commit SHA
- command used
- requested event count
- actual event count
- concurrency
- duration
- pass/fail verdict
- invariant table
- notes on any recovered transient faults

---

## 11. Evidence Authenticity Rule

If a run is not captured under `docs/operations/evidence/runs/<run-id>/`, it did not happen.

Screenshots, chat summaries, or terminal recollections do not count as evidence.

---

## 12. Relationship to Other Docs

- `docs/operations/OPERATIONS_HARDENING_SPEC.md` defines the why and invariants
- `docs/operations/OPERATIONS_HARDENING_RUNBOOK.md` defines the verification packs
- `docs/operations/SOAK_CHAOS_HARNESS_SPEC.md` defines the Pack F harness design
- this document defines Pack F execution and evidence requirements

---

## 13. Completion Definition

Pack F is officially complete only when:

- harness code exists in repo
- Pack F commands execute successfully
- 100,000-event stress run passes
- evidence is archived under the canonical evidence path
- run is referenced in `docs/operations/evidence/SUMMARY.md`
