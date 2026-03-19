# OPERATIONS HARDENING RUNBOOK

**Objective:** Convert the hardening spec into a repeatable verification procedure with command-level evidence and explicit go/no-go gates.

## Purpose

This runbook operationalizes `docs/operations/OPERATIONS_HARDENING_SPEC.md`.

Use it to produce repeatable verification evidence for post-Phase 2.4 hardening work, with named packs, exact commands where they exist, pass criteria, evidence locations, stop conditions, and rollback execution steps.

## Baseline

- Post–Phase 2.4 baseline commit: `461a004`
- Canonical spec: `docs/operations/OPERATIONS_HARDENING_SPEC.md`
- Evidence index: `docs/operations/evidence/SUMMARY.md`
- Pack F harness design: `docs/operations/SOAK_CHAOS_HARNESS_SPEC.md`
- Pack F execution contract: `docs/operations/PACK_F_EXECUTION_CONTRACT.md`
- Current tracker line: Phase 2.4 closed on `main` at `461a004`; current execution focuses on hard-locking 2.1–2.3 invariants, fail-closed extraction, and `>=99.5%` apply reliability with zero wrong-location edits.

## Evidence authenticity rule

If it is not captured under `docs/operations/evidence/`, it did not happen.

Accepted evidence:

- logs
- metadata
- commit-linked runs

Not accepted as primary evidence:

- screenshots
- chat summaries
- terminal recollections

## Verification Packs

| Pack | Name | Purpose | Current status |
| --- | --- | --- | --- |
| A | Anchor parity | Prove anchor contract enforcement across tests and target DB verification | Executable now |
| B | Fail-closed extraction | Prove unverifiable / ambiguous extraction paths fail closed | Executable now |
| C | Golden extraction edge cases | Prove exact-span behavior on tricky text shapes | Partially executable now; dedicated golden corpus still required for final sign-off |
| D | Apply harness reliability | Prove repeatable apply behavior and wrong-location safety | Executable now (dedicated reliability harness + report artifacts implemented) |
| E | Jobs / failure surfacing | Prove classified failures persist and surface on read path | Executable now |
| F | Soak / chaos | Prove invariants hold under 100,000-event load and injected faults | Not yet executable in-repo; hard blocker for release sign-off |

## Commands

Standard capture pattern:

`<command> | tee docs/operations/evidence/runs/<run-id>/<artifact-name>.log`

### Pack A — Anchor parity

#### Command set

1. Test-layer parity and invariant checks:

`npm test -- tests/anchors/anchor-validation.test.ts tests/anchors/anchor-parity-contract.test.ts tests/anchors/extraction-contract.test.ts --runInBand`

2. Target DB verification:

Execute `tests/anchors/phase21-db-verification.sql` in the target database using the procedure in `tests/anchors/PHASE21_DB_VERIFICATION_RUNBOOK.md`.

#### Expected result

- All suites pass
- Target DB verification passes all assertions
- No anchor parity drift between DB, TypeScript, and runtime validation

#### Evidence artifacts

Archive under:

- `docs/operations/evidence/<UTC_TIMESTAMP>/pack-a-anchor-parity/`

Required artifacts:

- `jest.log`
- `phase21-db-verification.log`
- target environment name
- operator / reviewer name
- commit SHA

### Pack B — Fail-closed extraction

#### Command set

`npm test -- tests/anchors/extraction-contract.test.ts tests/failures/apply-failure-codes.test.ts tests/failures/apply-failure-classification-paths.test.ts --runInBand`

#### Expected result

- All suites pass
- Unverifiable anchors fail closed
- Ambiguous anchors fail closed
- No silent fallback behavior in covered extraction/apply failure paths
- No unclassified failures in covered paths

#### Evidence artifacts

Archive under:

- `docs/operations/evidence/<UTC_TIMESTAMP>/pack-b-fail-closed-extraction/`

Required artifacts:

- `jest.log`
- failure code coverage summary
- commit SHA
- reviewer sign-off note

### Pack C — Golden extraction edge cases

#### Command set

Current executable gate:

`npm test -- tests/anchors/extraction-contract.test.ts tests/anchors/extraction-golden-corpus.test.ts --runInBand`

#### Expected result

- All current extraction contract assertions pass
- No drift on exact-span extraction behavior in covered cases

#### Release sign-off rule

Pack C is **not complete for final release sign-off** until a dedicated checked-in golden corpus exists for edge cases called out in the roadmap, including mixed smart/curly punctuation and other exact-span traps.

#### Evidence artifacts

Archive under:

- `docs/operations/evidence/<UTC_TIMESTAMP>/pack-c-golden-extraction/`

Required artifacts:

- `jest.log`
- corpus manifest (when dedicated golden suite lands)
- commit SHA

### Pack D — Apply harness reliability

#### Command set

Current executable preflight:

`npm test -- tests/anchors/apply-integrity.test.ts tests/anchors/apply-session-atomicity.test.ts tests/anchors/apply-reliability-harness.test.ts --runInBand`

#### Expected result

- All suites pass
- Covered integrity and atomicity invariants hold
- No wrong-location applies in covered test cases

#### Release sign-off rule

Pack D is **not complete for final release sign-off** until a dedicated checked-in reliability harness reports both:

- valid-anchor success rate `>=99.5%`
- wrong-location edits `= 0`

Archived harness reports remain required for release sign-off; if absent for a release candidate, release remains **no-go**.

#### Evidence artifacts

Archive under:

- `docs/operations/evidence/<UTC_TIMESTAMP>/pack-d-apply-harness/`

Required artifacts:

- `jest.log`
- harness report (`report.json` and/or `report.md`) when dedicated harness lands
- commit SHA
- owner sign-off note

### Pack E — Jobs / failure surfacing

#### Command set

`npm test -- tests/failures/apply-failure-classification-paths.test.ts tests/failures/apply-failure-codes.test.ts tests/api/jobs-endpoint.test.ts --runInBand`

#### Expected result

- All suites pass
- No unclassified failures
- No non-canonical job states in surfaced payloads
- Failed jobs surface classified failure information on canonical read path

#### Evidence artifacts

Archive under:

- `docs/operations/evidence/<UTC_TIMESTAMP>/pack-e-jobs-failure-surfacing/`

Required artifacts:

- `jest.log`
- API payload proof / assertion summary
- commit SHA

### Pack F — Soak / chaos

Design and execution references:

- `docs/operations/SOAK_CHAOS_HARNESS_SPEC.md`
- `docs/operations/PACK_F_EXECUTION_CONTRACT.md`

#### Command set

No executable checked-in soak / chaos harness command exists yet in this repository.

This is a **hard blocker**, not a waived step.

Before release sign-off, Pack F must be backed by a checked-in executable command and archived output proving:

- 100,000 classified failure events processed
- 0 lost writes
- 0 unclassified failures
- 0 silent fallbacks
- 0 wrong-location edits
- 0 non-canonical states

#### Expected result

- All soak invariants hold through the full run
- Fault injection does not produce uncontrolled failures
- Invalid inputs fail closed under load

#### Evidence artifacts

Archive under:

- `docs/operations/evidence/<UTC_TIMESTAMP>/pack-f-soak-chaos/`

Required artifacts:

- soak / chaos command used
- full run log
- summary report
- commit SHA
- operator and reviewer names

## Pass / Fail Gates

## Pack-level pass criteria

A pack passes only if:

- every listed command completes successfully
- all referenced suites pass
- no unclassified failures appear
- no non-canonical states appear
- no silent fallback behavior appears in covered paths

## Global no-go triggers

Stop immediately and mark release **no-go** if any of the following occur:

- canonical drift of status or failure code
- `unclassified_failures_total > 0`
- wrong-location edits `> 0`
- anchor parity mismatch
- extraction accepts unverifiable anchors
- target DB verification fails
- soak invariant breach
- required pack is still preflight-only when final sign-off is being attempted

## Evidence to Archive

For every run, archive evidence under a timestamped directory:

- `docs/operations/evidence/<UTC_TIMESTAMP>/`

Minimum archive contents:

- one subdirectory per pack
- raw logs
- summary note (`SUMMARY.md`)
- operator name
- reviewer name
- target environment (if applicable)
- commit SHA
- final go / no-go decision

Recommended `SUMMARY.md` fields:

- baseline SHA
- run timestamp (UTC)
- packs executed
- packs passed
- packs blocked
- stop condition encountered (if any)
- rollback executed (yes/no)
- final sign-off statement

## Escalation and Rollback

## Stop conditions

Escalate immediately to the hardening owner if:

- any no-go trigger fires
- any pack result cannot be reproduced on rerun
- target DB verification diverges from test-layer behavior
- a read path surfaces non-canonical status or missing classified failure data

## Rollback execution steps

1. Identify the last known good commit SHA.
2. Disable the affected path using the existing feature-flag or guarded-path mechanism.
3. Preserve all failure envelopes and logs; do not scrub or delete evidence.
4. Revert the affected change set.
5. Re-run the minimum verification subset before redeploy:
   - `npm test -- tests/failures/apply-failure-classification-paths.test.ts tests/failures/apply-failure-codes.test.ts tests/api/jobs-endpoint.test.ts --runInBand`
   - `npm test -- tests/anchors/apply-integrity.test.ts tests/anchors/apply-session-atomicity.test.ts --runInBand`
   - `npm test -- tests/anchors/anchor-validation.test.ts tests/anchors/extraction-contract.test.ts --runInBand`
6. Confirm canonical reads are intact and no corruption is present.
7. Patch forward only after the rerun evidence is archived.

## Release Sign-Off

Final sign-off requires all of the following:

- Pack A passed, including target DB verification
- Pack B passed
- Pack C has a dedicated golden corpus and passed
- Pack D has a dedicated reliability harness report with:
  - success rate `>=99.5%`
  - wrong-location edits `= 0`
- Pack E passed
- Pack F has a checked-in soak / chaos harness and passed all invariants
- Evidence archive is complete
- Commit SHA is recorded
- Reviewer signs the final go decision

## Sign-off checklist

- [ ] Baseline SHA recorded
- [ ] Pack A passed
- [ ] Pack B passed
- [ ] Pack C passed with dedicated golden corpus
- [ ] Pack D passed with dedicated harness metrics
- [ ] Pack E passed
- [ ] Pack F passed with 100,000-event evidence
- [ ] No unclassified failures
- [ ] No non-canonical states
- [ ] No wrong-location edits
- [ ] Final evidence archived
- [ ] Go / no-go decision recorded

## Final sign-off wording

Use exactly one of the following:

### Go

> Operations hardening verification complete. All required packs passed with archived evidence, canonical invariants held, and go-live is approved.

### No-go

> Operations hardening verification incomplete or failed. One or more required packs did not pass, evidence is incomplete, or a no-go trigger fired. Release is blocked pending remediation and rerun.
