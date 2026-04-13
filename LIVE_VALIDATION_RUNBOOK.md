# Live Production Validation Runbook

**Purpose:** One-gate proof that the deployed runtime matches the sealed code (PRs #112, #114, #116, #117, #120, #121).  
**Status when complete:** `code-sealed` -> `environment-proven`

---

## Phase 0 -- Preconditions (all must be true before you start)

| # | Check | Command / Method | Pass Condition |
|---|---|---|---|
| 1 | PRs #120 + #121 on main | `git log --oneline main \| head -5` | Both squash commits visible |
| 2 | Migration applied | `SELECT proname FROM pg_proc WHERE proname = 'claim_evaluation_job_phase2';` | 1 row returned |
| 3 | RPC callable (not just present) | `SELECT claim_evaluation_job_phase2(NULL, NULL, NULL);` | No permission/undefined error (null return is fine) |
| 4 | No `triggered` in DB | `SELECT COUNT(*) FROM evaluation_jobs WHERE progress->>'phase_status' = 'triggered';` | 0 |
| 5 | Env vars set | Check `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` | All non-empty, no dev overrides |
| 6 | Worker path is real | Worker/cron route confirmed as production path | Not a harness shortcut |

**Do not proceed until all 6 pass.**

---

## Phase 1 -- Submit

1. Choose a real manuscript: **1,500-5,000 words**, plain prose, UTF-8, no malformed encoding.
2. Submit via the **normal production route** (not a test harness, no mocked provider calls, no manual DB edits).
3. Record immediately:
   - `manuscript_id`: _______________
   - `job_id`: _______________
   - `submitted_at` (UTC): _______________
   - `payload_size_bytes`: _______________

---

## Phase 2 -- Observe Pipeline (no intervention)

Watch logs passively. Do **not** manually trigger phase transitions or edit the DB.

| # | Checkpoint | What to observe | Pass condition |
|---|---|---|---|
| CP1 | Job created | DB or API response | `status = 'queued'`, `progress->>'phase_status' = 'queued'` (never `'triggered'`) |
| CP2 | Phase 1 runs | Worker logs | Phase 1 starts without manual trigger |
| CP3 | Phase 1 completes | Worker logs + DB | `progress->>'phase' = 'phase_1'`, `progress->>'phase_status' = 'complete'` |
| CP4 | Phase 2 claimed atomically | Worker logs | Exactly one `[Phase2Queued]` log for this job; any other attempts show no ownership or explicit lost-race handling |
| CP5 | No duplicate execution | Worker logs | Only one worker log thread owns Phase 2 for this job |
| CP5.5 | No duplicate DB transitions | DB diff during run | `updated_at` progresses monotonically with no conflicting writes |
| CP6 | Pipeline completes | Worker logs | All passes (1, 2, 3) finish with real provider latency |
| CP7 | Artifact persisted | `SELECT id FROM evaluation_artifacts WHERE job_id = '<job_id>';` | Exactly 1 row, `id` non-null |
| CP8 | Terminal state | `SELECT status, progress->>'phase' as phase FROM evaluation_jobs WHERE id = '<job_id>';` | `status = 'complete'`, phase terminal |
| CP9 | No manual cleanup | Operator confirms | Nothing touched manually during run |

---

## Phase 3 -- Capture Evidence

Run these after CP8 passes.

```sql
-- Final job snapshot
SELECT id, status, progress, updated_at
FROM evaluation_jobs WHERE id = '<job_id>';

-- Artifact snapshot
SELECT id, job_id, created_at
FROM evaluation_artifacts WHERE job_id = '<job_id>';

-- Confirm exactly 1 artifact (no duplicates)
SELECT COUNT(*) FROM evaluation_artifacts WHERE job_id = '<job_id>';

-- Confirm no triggered remnant
SELECT COUNT(*) FROM evaluation_jobs WHERE progress->>'phase_status' = 'triggered';

-- Confirm lease cleared
SELECT progress->>'lease_id' as lease_id, progress->>'lease_expires_at' as lease_expires_at
FROM evaluation_jobs WHERE id = '<job_id>';
```

Save to a file: `evidence_<job_id>_<date>.txt`. Minimum contents:

```
manuscript_id:
job_id:
payload_size_bytes:
submitted_at:
phase1_start:
phase1_finish:
phase2_claim_at:
phase2_finish:
artifact_persist_at:
terminal_state_at:
artifact_id:
artifact_count: (must be exactly 1)
final_status:
final_phase:
lease_id_at_terminal: (should be empty string or null)
no_triggered_count: (should be 0)
```

---

## Phase 4 -- Pass / Fail Decision

**PASS** if all of the following:
- [ ] CP1-CP9 all observed (including CP5.5)
- [ ] `phase_status = 'queued'` at creation (never `'triggered'`)
- [ ] Exactly one `[Phase2Queued]` log for this job
- [ ] No `[Phase2LeaseDeadJobLostRace]` on the winning claim
- [ ] Artifact exists and is readable
- [ ] Exactly 1 artifact row for this job (no duplicates)
- [ ] `status = 'complete'` (not `'failed'`)
- [ ] Zero rows with `phase_status = 'triggered'` in DB
- [ ] No manual intervention

**FAIL** if any of the following:
- `'triggered'` appears in DB for this job
- Two workers both log Phase 2 ownership
- Artifact missing, unlinked, or duplicated (count != 1)
- Job ends in `'failed'` state
- Manual intervention was required
- `updated_at` shows non-monotonic or conflicting writes

---

## Optional: Controlled Contention Proof

After the single-manuscript run passes, run this to close the race-condition gate:

1. Queue one job via normal route.
2. Before Phase 2 starts, trigger concurrent Phase 2 access (two worker invocations within the same lease window).
3. **Expected:**
   - Exactly one winner: `[Phase2Queued]` log
   - Loser exits without writing: `[Phase2LeaseDeadJobLostRace]` log (if dead-lease path hit) or no-op on RPC empty return
   - One artifact, one completion, no duplicate
4. Capture both worker log threads as evidence.

This step is not required to begin trusting the runtime. It is the best final stress proof.

---

## Failure Triage Index

| Symptom | First check |
|---|---|
| Job stuck in `queued` | Worker/cron route reachability; auth |
| Phase 2 not claimed | Migration applied? RPC accessible to `service_role`? |
| RPC returns null unexpectedly | Check job eligibility filters inside RPC WHERE clause vs actual DB state |
| Two workers claim Phase 2 | RPC atomicity -- check SQL function on live DB |
| Artifact missing | `artifact_persist_at` vs. job `updated_at` gap; provider error logs |
| Duplicate artifacts | Double Phase 2 execution -- check RPC claim exclusivity |
| `'triggered'` in DB | PR #120 not deployed; check which binary is serving |
| `status = 'failed'` | Provider error (OpenAI timeout); config error (timeout invariant) |
| Silent retry / fallback | Check worker error-handling path; no swallowed exceptions |

---

*Runbook version: 2026-04-13 v2. Applies to main post-PRs #112, #114, #116, #117, #120, #121.*  
*Tables: `evaluation_jobs`, `evaluation_artifacts`. Progress stored as JSONB in `progress` column.*
