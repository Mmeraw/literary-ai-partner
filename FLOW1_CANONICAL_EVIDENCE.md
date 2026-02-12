# Flow 1: Canonical Evidence Artifact (PRE-LOCK)

**Generated:** 2026-02-12 (scaffold / placeholder)  
**Status:** 🏗️ PRE-LOCK  
**CI Run:** N/A (gate not yet promoted to push trigger)  

**CI Lock Commit:** TBD  
**Documentation Lock Commit:** TBD  

---

## The Single Source of Truth (When Locked)

Once Flow 1 stabilizes, this document will contain the canonical proof that the "Upload → Evaluate → View Results" flow is production-ready and secure.

### Evidence Execution (Future)

**Via CI (When Ready):**
```bash
# Trigger manual run
gh workflow run phase1-evidence.yml

# Check status
gh run list --workflow=phase1-evidence.yml --limit 1
```

**Local verification (requires test fixtures + Supabase secrets):**
```bash
bash scripts/evidence-flow1.sh
```

---

## What Gets Locked (Evidence Gate Definition)

| Component | Proof Required | Status |
|-----------|----------------|--------|
| Author can upload | Submission created, status = `queued` | 🏗️ TODO |
| Evaluation runs | Job status transitions `queued` → `running` → `complete` | 🏗️ TODO |
| Results persist | Evaluation results written + readable | 🏗️ TODO |
| Creator can view | Query returns results when queried as creator | 🏗️ TODO |
| Non-creator cannot view | Query returns 403/empty when queried as different user | 🏗️ TODO |
| State transitions valid | No illegal job state changes (e.g., `complete` → `running`) | 🏗️ TODO |
| RLS enforced | Row-level security policy blocks unauthorized access | 🏗️ TODO |
| **Total** | **All checks pass** | **🏗️ PLACEHOLDER** |

---

## Why This Will Be Bulletproof

### ✅ Submission Ownership (Phase 2E Dependency)

- **Locked By:** [Phase 2E RLS policies](PHASE2E_STATUS.md)
- **How:** `author_id` column enforced via RLS on `user_submissions` table
- **Proof:** RPC query returns only submissions for authenticated user

### ✅ Job State Machine (AI_GOVERNANCE Dependency)

- **Contract:** [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md)
- **Canonical Statuses:** `queued`, `running`, `complete`, `failed`
- **Enforcement:** API rejects invalid transitions before database write
- **Proof:** Job records show only valid state sequences

### ✅ Evidence Gate (Workflow Pattern from Phase 2E)

- **File:** `.github/workflows/phase1-evidence.yml` (to be created)
- **Trigger:** `workflow_dispatch` (manual), later `push` to main
- **Test Fixture:** Seeded author + sample submission
- **Validation Script:** Python checks all items in "What Gets Locked" table
- **Artifacts:** Evidence logs + dry-run results

---

## Latest Evidence Output (Placeholder)

**Run:** TBD  
**Commit:** TBD  
**Timestamp:** TBD

```
=== Flow 1 Evidence Verification ===
Timestamp: TBD
Commit: TBD

Testing end-to-end: Upload → Evaluate → View Results
  [ ] Seed test author
  [ ] Create submission
  [ ] Trigger evaluation
  [ ] Retrieve results as creator
  [ ] Verify results inaccessible to non-creator
  [ ] Check job state transitions

Status: 🏗️ PLACEHOLDER (gate not yet deployed)
```

---

## Implementation Roadmap (Pre-Lock)

### Phase 1: Smoke Testing

1. Manual test: Author uploads submission
2. Manual test: Evaluation pipeline executes end-to-end
3. Manual test: Creator can view results
4. Manual test: Result access controls + RLS blocking

### Phase 2: Evidence Gate Scaffolding

1. Create `phase1-evidence.yml` workflow (workflow_dispatch only)
2. Implement Python validation script
3. Test on branch (not main)
4. Verify grip on state machine + RLS

### Phase 3: Lock Event

1. Run evidence gate 3+ times successfully
2. Promote workflow to `push` trigger on main
3. Create CI Lock commit
4. Create Docs Lock commit
5. Update [LOCK_ANCHORS_POLICY.md](LOCK_ANCHORS_POLICY.md) registry

---

## Governance Compliance (When Locked)

- ✅ **Job Status Enum:** Canonical values only (`queued`, `running`, `complete`, `failed`)
- ✅ **State Transitions:** Invalid transitions rejected before database write
- ✅ **RLS Enforcement:** Author can only see own results
- ✅ **Fail-Closed:** Evidence gate exits non-zero if any check fails
- ✅ **Auditability:** Job logs + evaluation results archived as artifacts
- ✅ **Reproducible:** Evidence gate repeatable with same test fixtures

---

## How to Verify Manually (When Locked)

```bash
# 1. Seed test author via fixtures or direct SQL
export TEST_USER_ID="00000000-0000-0000-0000-000000000001"

# 2. Create submission
curl -X POST "$SUPABASE_URL/rest/v1/rpc/create_submission" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"document_text": "test", "metadata": {}}'

# 3. Trigger evaluation
# (implementation-specific)

# 4. Query results as creator
curl -X GET "$SUPABASE_URL/rest/v1/evaluation_results?author_id=eq.$TEST_USER_ID" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Expected: Results returned

# 5. Query results as different user
curl -X GET "$SUPABASE_URL/rest/v1/evaluation_results?author_id=eq.$TEST_USER_ID" \
  -H "Authorization: Bearer $DIFFERENT_USER_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Expected: 403 Forbidden or empty result (RLS enforced)
```

---

## Related Documentation

- [FLOW1_STATUS.md](FLOW1_STATUS.md) — Pre-lock status and stabilization checklist
- [PHASE2E_STATUS.md](PHASE2E_STATUS.md) — RLS policies foundation (locked)
- [PHASE2E_CANONICAL_EVIDENCE.md](PHASE2E_CANONICAL_EVIDENCE.md) — Evidence gate pattern reference
- [AI_GOVERNANCE.md](AI_GOVERNANCE.md) — Job status canonical contract
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — State transition rules
- [LOCK_ANCHORS_POLICY.md](LOCK_ANCHORS_POLICY.md) — Lock anchor governance

---

## ⚠️ PRE-LOCK PLACEHOLDER

**This document is a scaffold for the evidence gate that will lock Flow 1.**

Once the gate is stable and production-ready:
1. Generate real evidence from CI runs
2. Populate "Latest Evidence Output" with actual results
3. Update "What Gets Locked" with checksums or verification data
4. Assign CI Lock + Docs Lock commits to LOCK_ANCHORS_POLICY.md
5. Remove this "PRE-LOCK PLACEHOLDER" section

**No lock anchors assigned until evidence gate is proven reliable.**
