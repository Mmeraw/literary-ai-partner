# SOAK / CHAOS HARNESS SPEC

_Post–Phase 2.4 Baseline (Commit: `461a004`)_

---

## 1. Objective

Validate system integrity under scale and fault conditions.

Target:

- 100,000 failure events processed
- Mixed valid + invalid proposals
- Concurrent execution

---

## 2. Success Criteria (NON-NEGOTIABLE)

| Invariant | Requirement |
|----------|------------|
| Lost writes | 0 |
| Unclassified failures | 0 |
| Silent fallbacks | 0 |
| Wrong-location edits | 0 |
| Non-canonical status | 0 |

Failure of any invariant = test fails.

---

## 3. Test Dimensions

### 3.1 Event Types

- Valid apply proposals
- Invalid anchors (offset mismatch)
- Invalid context (before/after drift)
- Overlap conflicts
- Duplicate proposals
- Stale anchors (re-run after mutation)

### 3.2 Fault Injection

Simulate:

- DB write failure (random %)
- Network latency spikes
- Partial retry scenarios
- Out-of-order job completion
- Burst malformed payloads

### 3.3 Concurrency Model

- Workers: configurable (start with 5 → scale to 20)
- Queue-based processing
- Parallel apply attempts allowed
- Shared document mutation (critical stress case)

---

## 4. Harness Architecture

### Components

- `eventGenerator.ts`
  - Produces deterministic + randomized proposals

- `workerPool.ts`
  - Executes jobs concurrently

- `faultInjector.ts`
  - Wraps DB + apply calls

- `metricsCollector.ts`
  - Tracks all invariants

- `runController.ts`
  - Orchestrates full run lifecycle

---

## 5. Metrics (Captured in Real Time)

Required:

- `total_events_processed`
- `classified_failures_total{code}`
- `unclassified_failures_total`
- `wrong_location_edits_total`
- `persistence_write_failures_total`
- `retries_total`

---

## 6. Output Artifacts

Each run must produce:

- `metrics.json`
- `run.log`
- `failures_sample.json`
- `summary.md`

If failures occur, `failures_sample.json` must include the first N classified failures with enough context for replay and debugging.

---

## 7. Pass Conditions

Run is PASS only if:

- `total_events_processed == 100000`
- `unclassified_failures_total == 0`
- `wrong_location_edits_total == 0`
- all failures have valid canonical codes
- no invariant violations logged

---

## 8. Fail Conditions

Immediate FAIL if:

- any invariant breaks
- system enters non-canonical state
- apply produces incorrect placement

---

## 9. Execution Modes

- `--dry-run` (no DB writes)
- `--stress` (full concurrency + faults)
- `--deterministic` (repeatable seed)

---

## 10. Determinism Requirement

All runs must support:

- seedable randomness
- reproducible failure sequences

---

## 11. Integration with Runbook

This harness is **Pack F**.

The runbook must:

- call this harness
- capture outputs to `docs/operations/evidence/`
- block release if FAIL

---

## 12. Completion Definition

Pack F is complete only when:

- harness exists in repo
- 100k run passes
- evidence artifacts are stored under the canonical evidence path
- metrics are validated
