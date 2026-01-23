
Defined in code and enforced by `canTransitionPhase1()`.

### Forbidden Transitions
- `completed → any`
- `running → not_started`

---

## 7. Job Progress Authority

### Source of Truth
Chunk table is the **authoritative execution state**.

Job progress fields are **derived summaries**:
- `total_units` = total chunk count
- `completed_units` = count(status = done)
- `failed_units` = count(status = failed)

### Resume Fields
The following fields are authoritative for resumption:
- `phase1_last_processed_index`
- `completed_units`
- Chunk `status` + `attempt_count`

Progress must never contradict chunk reality.

---

## 8. Terminal State Immutability

### Chunk
- `done` is final
- `result_json` must never be overwritten

### Job
- `completed` and `failed` are terminal
- No further phase execution is permitted

Terminal states are **write-once**.

---

## 9. Concurrency Guarantees

The system guarantees:
- No double-processing of chunks
- No progress regression after restart
- No silent data loss due to worker crash

This holds under:
- Multiple concurrent workers
- Partial failures
- Process termination mid-execution

---

## 10. Required Tests (Contractual)

### Existing (Satisfied)
- Polling backoff SSoT tests
- Phase 1 transition guards
- Claim atomicity behavior
- Resume after partial completion

### Required Before Phase 2
1. **Double-claim contention test**
   - Two workers racing for same chunk
2. **Crash mid-processing recovery**
   - Chunk reclaimed after lease expiry
3. **Terminal immutability assertion**
   - `done` chunk cannot be mutated

---

## 11. Adoption Clause

Once marked **ADOPTED**:
- All future job/chunk changes must comply
- Violations require contract amendment
- Tests are authoritative over comments

This contract is binding until superseded.
