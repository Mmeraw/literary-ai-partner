# Flow 1: Canonical Evidence Artifact

**Generated:** 2026-02-13  
**Status:** 🔒 LOCK-READY (anchors assigned; not fully LOCKED)  
**CI Run:** ✅ 3 consecutive PASS runs captured (2026-02-13)  
**Local Deterministic Run:** ✅ PASS (2026-02-13T04:41:59Z)  

**CI Lock Commit:** `d27c2b1`  
**Documentation Lock Commit:** `a80f59a`  

---

## Current Source of Truth

This document tracks the lock-ready evidence set for Flow 1. Anchors are assigned and should remain immutable unless a new phase is declared.

### Evidence Execution

**Via CI:**
```bash
# Trigger manual run
gh workflow run phase1-evidence.yml

# Check status
gh run list --workflow=phase1-evidence.yml --limit 1
```

**Local verification (deterministic):**
```bash
bash scripts/evidence-flow1.sh
```

---

## What Gets Locked (Evidence Gate Definition)

| Component | Proof Required | Status |
|-----------|----------------|--------|
| Job create envelope | `POST /api/jobs` returns `201` + `ok=true` + non-empty `job_id` + canonical status | ✅ PASS |
| Creator can view | Owner `GET /api/jobs/:jobId` returns `200` + `job.user_id == owner` | ✅ PASS |
| Non-creator cannot view | Non-owner `GET /api/jobs/:jobId` returns strict `404` + `{"ok":false,"error":"Job not found"}` | ✅ PASS |
| Status vocabulary canonical | Returned `status` in `{queued,running,complete,failed}` only | ✅ PASS |
| Full Upload→Evaluate→Results scope | End-to-end submission/results path assertions | 🏗️ TODO |
| **Total (current gate scope)** | **Ownership prerequisite + canonical envelope checks** | **✅ PASS** |

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

### ✅ Evidence Gate (Scaffolded)

- **File:** `.github/workflows/phase1-evidence.yml`
- **Script:** `scripts/evidence-flow1.sh`
- **NPM hook:** `npm run evidence:flow1`
- **Trigger:** `workflow_dispatch`, `pull_request`, `push` (path-scoped)
- **Assertions:** deterministic create/owner/non-owner contract checks
- **Artifacts:** `flow1-evidence-<sha>` with `flow1-evidence-ci.log`

---

## Latest Evidence Output

**Runs (3 consecutive successes):** GitHub Actions `phase1-evidence.yml`  
**Primary commit for gate readiness:** `d27c2b11a0340b597d60fcdab8d9927844126083`  
**Timestamp:** 2026-02-13

```
Run 1: https://github.com/Mmeraw/literary-ai-partner/actions/runs/21975392316
  status=completed
  conclusion=success
  displayTitle=flow1: force supabase job store in CI evidence run

Run 2: https://github.com/Mmeraw/literary-ai-partner/actions/runs/21975452256
  status=completed
  conclusion=success
  displayTitle=docs(flow1): record first passing CI evidence run

Run 3: https://github.com/Mmeraw/literary-ai-partner/actions/runs/21975531680
  status=completed
  conclusion=success
  displayTitle=docs(flow1): note two-pass CI streak before final lock run

Anchor validation: https://github.com/Mmeraw/literary-ai-partner/actions/runs/21975653254 (status=completed, conclusion=success, headSha=69e80f2c6dd750379d5db511b4f5f0b6acae4787)
```

**Local run transcript (reference):**

```
=========================================
FLOW 1 EVIDENCE
=========================================
HEALTH_HTTP=200
CREATE_HTTP=201
OWNER_HTTP=200
OTHER_HTTP=404
JOB_ID=5bc9910b-56cd-4303-a544-3e23f3edac24
Status: ✅ PASS
Evidence archived: /tmp/flow1-evidence-1770957718.log
```

---

## Implementation Roadmap (Pre-Lock)

### Phase 1: Smoke Testing

1. Manual test: Author uploads submission
2. Manual test: Evaluation pipeline executes end-to-end
3. Manual test: Creator can view results
4. Manual test: Result access controls + RLS blocking

### Phase 2: Evidence Gate Scaffolding

1. ✅ Create `phase1-evidence.yml` workflow
2. ✅ Implement deterministic validation script (`scripts/evidence-flow1.sh`)
3. ✅ Execute first deterministic local pass
4. ✅ Execute GitHub Actions evidence runs and capture 3 consecutive passes

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

Before lock:
1. ✅ Run `phase1-evidence.yml` in GitHub Actions and capture first run metadata
2. ✅ Achieve 3+ consecutive passing CI runs with stable assertions
3. ✅ Assign CI Lock + Docs Lock commits in `LOCK_ANCHORS_POLICY.md`
4. Promote this document from PRE-LOCK to LOCKED

**Lock-ready milestone achieved; final LOCK promotion awaits remaining broader smoke scope.**
