# OPERATIONS HARDENING SPEC

**Post–Phase 2.4 Baseline (Commit: `461a004`)**

## 1. Mission Objective

Process **100,000 classified failure events** under load with:

- 0 lost writes
- 0 unclassified failures
- 0 silent fallbacks
- 0 wrong-location applies
- 0 non-canonical states

All invalid inputs must fail closed, never degrade silently.

## 2. Canonical Invariants (Non-Negotiable)

### Job State

Allowed: `queued | running | complete | failed`

- No additional states permitted anywhere in system.

### Anchor Contract

- `start_offset`: inclusive
- `end_offset`: exclusive
- `before_context`: exact preceding slice
- `after_context`: exact following slice

Hard rules:

- `start_offset >= end_offset` → reject everywhere (DB + TS + validator)
- Context must match deterministically
- No partial or fuzzy matches

### Failure Classification

Every failure emits a canonical code.

- No `UNKNOWN`
- No generic fallback

Every failure includes:

- `failure_code`
- `failure_envelope`
- `last_error`

## 3. System Architecture Hardening

### 3.1 Ingress Hardening

- Validate all inputs at boundary
- Reject malformed proposals immediately
- Enforce anchor contract before persistence
- Use idempotency keys for all write operations

### 3.2 Persistence Safety

Atomic write of:

- `status`
- `last_error`
- `failure_envelope`
- `failure_code`

Writes must be:

- idempotent
- retry-safe

Dead-letter queue for irrecoverable failures.

### 3.3 Classification Pipeline

- Deterministic mapping → failure codes
- 1:1 mapping between failure condition and code

Coverage enforced by:

- contract tests
- classification-path tests

CI gate:

- unclassified failures must be 0

### 3.4 Apply Path Integrity

Preflight all proposals before mutation.

Reject:

- overlaps
- duplicates
- stale anchors

No fuzzy matching.  
No fallback search.

Full traceability:

- every rejection has a code + context

### 3.5 Observability

#### Metrics (Required)

- `classified_failures_total{code}`
- `unclassified_failures_total` (must be 0)
- `persistence_write_failures_total`
- `wrong_location_edits_total` (must be 0)

#### Logging

Every failure includes:

- code
- anchor data
- context window
- `job_id`

#### Alerts (Paging Conditions)

- unclassified failures > 0
- wrong-location edits > 0
- non-canonical status detected
- persistence failure spike

## 4. Test Matrix

| Layer | Coverage |
| --- | --- |
| Unit | validators, classification, apply |
| Contract | DB ↔ TS ↔ validator parity |
| Integration | `setJobFailed` → `getJob` → API |
| Golden | extraction edge cases |
| Harness | apply reliability |
| Soak | 100k failure events |
| Chaos | fault injection |

## 5. Quality Gates (CI/CD)

Block merge if:

- Non-canonical status/code appears
- `unclassified_failures_total > 0`
- Anchor parity tests fail
- Extraction allows unverifiable anchors
- Apply harness `< 99.5%` success
- `wrong_location_edits_total != 0`

## 6. Apply Reliability Standard

Two separate gates:

### Accuracy

`>= 99.5%` success rate on valid anchors

### Safety (hard gate)

`0` wrong-location edits

Failure of either = system not shippable.

## 7. Load + Chaos Qualification

### Soak Test

- 100,000 failure events
- Mixed valid + invalid inputs

### Fault Injection

- DB latency/failure
- partial retries
- malformed payload bursts
- concurrent writes

### Pass Conditions

- All invariants hold
- No data loss
- No unclassified failures
- No silent fallback behavior

## 8. Go / No-Go Checklist

Ship only if:

- Anchor contract fully enforced
- Extraction is fail-closed
- Golden tests all pass (no drift)
- Apply harness meets `>=99.5%`
- Wrong-location edits = `0`
- Soak test passes all invariants
- Observability + alerts verified

## 9. Rollback Playbook

If any invariant is violated:

1. Disable affected path (feature flag / route guard)
2. Preserve all failure envelopes (no data deletion)
3. Revert to last stable commit
4. Re-run:
   - classification tests
   - jobs endpoint tests
   - apply harness
5. Confirm:
   - canonical reads still valid
   - no data corruption
6. Patch + redeploy

## 10. Execution Order (Locked)

1. 2.1 Anchor enforcement hard-lock
2. 2.1 DB/type/runtime parity
3. 2.2 Fail-closed extraction
4. 2.2 Golden set
5. 2.3 Apply harness expansion
6. Soak + chaos qualification

## 11. Sprint Objective

Prevent unverifiable anchors from entering the pipeline, prove exact extraction on edge cases, and demonstrate repeatable apply reliability without wrong-location edits.

## 12. Tracker Line

Phase 2.4 closed on `main` at `461a004`; current execution focuses on hard-locking 2.1–2.3 invariants, fail-closed extraction, and `>=99.5%` apply reliability with zero wrong-location edits.

---

## Reliability Standard Clarification

For scale, we target **no uncontrolled failures** (not “no failures”). Controlled, classified fail-closed outcomes are expected behavior.
