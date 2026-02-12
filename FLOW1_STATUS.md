# Flow 1 — Upload → Evaluate → View Results 🏗️ PRE-LOCK

**Status:** 🏗️ PRE-LOCK (stabilization phase)  
**Target Lock:** Phase E1 (after production smoke + evidence gate passes reliably)  

**CI Lock Commit:** TBD (workflow_dispatch gate implementation)  
**Documentation Lock Commit:** TBD (after evidence gate green in production)  
**Governance:** [phase1-evidence.yml](.github/workflows/phase1-evidence.yml) (workflow_dispatch, not yet on push)  
**Current CI Runs:** N/A (gate not yet production-ready)  

---

## Scope: Author Submission & Results Visibility

Enable authors to:
1. **Upload** a submission (document, metadata)
2. **Evaluate** against criteria (run evaluation pipeline)
3. **View Results** (only author + admins can see their results)

Flow 1 proven when:
- ✅ Real author can upload + evaluate + view results end-to-end
- ✅ Creator sees their own results; non-creator cannot access
- ✅ Evaluation pipeline executes reliably
- ✅ No state corruption or visibility leaks

---

## Design: Row-Level Security + Job Pipeline

### Visibility Invariants

| Actor | Can See | Evidence |
|-------|---------|----------|
| Author (creator) | Own submission, evaluation results | RLS policy on `user_submissions` |
| Author (non-creator) | Nothing | RLS policy blocks access |
| Admin | All submissions + results | bypass_rls or admin role |
| Anonymous | Nothing | No authentication = no access |

### State Machine

```
Upload → queued
  ↓
Evaluate → running
  ↓
Complete → complete (with results) OR failed (with error)
  ↓
View Results (if complete) or retry (if failed)
```

Canonical job statuses: `queued`, `running`, `complete`, `failed`

---

## Intended Invariants

1. **Submission Ownership**: Author can only create submissions as themselves
2. **Result Access**: Author can only query their own results
3. **Job State Transitions**: Illegal transitions (e.g., `complete` → `running`) are rejected
4. **Evaluation Atomicity**: Job state + results committed together or not at all
5. **No Silent Failures**: Errors must propagate; do not mask as client errors

---

## Pre-Lock Stabilization Checklist

### Production Smoke Tests

- [ ] Real author can upload document + metadata
- [ ] Submission appears in evaluator queue (queued state)
- [ ] Evaluation runs without errors (running → complete transition)
- [ ] Results written to database and retrievable
- [ ] Creator can view results; non-creator cannot (RLS enforced)
- [ ] Job status transitions follow canonical state machine
- [ ] No database constraints violated during job execution

### Evidence Gate Requirements (Future CI Workflow)

- [ ] Seed test author via database or fixtures
- [ ] Upload fixture submission (standard test document)
- [ ] Trigger evaluation pipeline
- [ ] Assert job status transitions are valid
- [ ] Query results endpoint as creator (expect success)
- [ ] Query results endpoint as different user (expect 403 or empty)
- [ ] Assert evaluation results populated correctly

### Rough Edges to Track

- [ ] Submission visibility in list endpoints
- [ ] Pagination and filtering behavior
- [ ] Concurrent submissions from same author
- [ ] Error handling for malformed inputs
- [ ] Job timeout / cancellation behavior
- [ ] Admin override / debugging capabilities

---

## Implementation Status

### Completed (Baseline)

- ✅ [AI_GOVERNANCE.md](AI_GOVERNANCE.md) — Job status enum contract defined
- ✅ [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — Job state transitions canonicalized
- ✅ RLS policies on author submissions table (Phase 2D, Phase 2E)
- ✅ Job evaluation pipeline (basic implementation)

### In Progress (Stabilization)

- 🏗️ Production smoke tests (manual verification)
- 🏗️ End-to-end visibility verification (author sees own, others don't)
- 🏗️ State machine hardening (catch illegal transitions)
- 🏗️ Evidence gate scaffold (workflow_dispatch → manual trigger)

### Future (Lock Event)

- ⏳ phase1-evidence.yml production green (CI Lock event)
- ⏳ Flow 1 documentation completion (Docs Lock event)
- ⏳ Registry entry in [LOCK_ANCHORS_POLICY.md](LOCK_ANCHORS_POLICY.md)
- ⏳ phase1-evidence.yml promoted to `push` trigger

---

## Related Documentation

- [PHASE2E_STATUS.md](PHASE2E_STATUS.md) — RLS policies locked (dependency)
- [PHASE2E_CANONICAL_EVIDENCE.md](PHASE2E_CANONICAL_EVIDENCE.md) — Evidence gate pattern reference
- [AI_GOVERNANCE.md](AI_GOVERNANCE.md) — Job status canonical values
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — State transition rules
- [FLOW1_CANONICAL_EVIDENCE.md](FLOW1_CANONICAL_EVIDENCE.md) — Evidence gate definition (placeholder)
- [LOCK_ANCHORS_POLICY.md](LOCK_ANCHORS_POLICY.md) — Lock anchor governance

---

## Transition to Lock

Flow 1 is ready to lock when:

1. ✅ Production smoke tests green (all items checked above)
2. ✅ CI evidence gate (`phase1-evidence.yml`) runs reliably on workflow_dispatch
3. ✅ Evidence gate passes 3+ consecutive times
4. ✅ FLOW1_CANONICAL_EVIDENCE.md populated with real run data
5. ✅ Ready to add CI Lock + Docs Lock commits to registry

```bash
# At lock time:
git log --oneline | grep "phase1-evidence"  # CI Lock commit
git log --oneline | grep "docs(flow1).*declare"  # Docs Lock commit
# Both added to LOCK_ANCHORS_POLICY.md registry
```

---

## ⚠️ PRE-LOCK STATUS

**Flow 1 remains PRE-LOCK until:**
- Production smoke tests consistently pass
- `phase1-evidence.yml` runs reliably (workflow_dispatch)
- Evidence shows "Upload → Evaluate → View Results" end-to-end working

**No lock anchors assigned yet. Do not add commit hashes to this file.**
