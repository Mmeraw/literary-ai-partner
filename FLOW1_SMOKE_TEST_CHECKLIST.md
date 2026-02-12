# Flow 1 Smoke Test Checklist
## Manual Verification Guide (Pre-Lock Stabilization)

**Date:** 2026-02-12  
**Purpose:** Verify Flow 1 backbone is stable before implementing evidence gate CI workflow  
**Scope:** Three endpoint paths, seven core smoke tests, eleven rough edges

---

## What You're Testing

Flow 1 = **Upload → Evaluate → View Results**

Real test: One author goes through complete flow, verify RLS blocks non-creators

---

## The Three Endpoint Paths (From Code Archaeology)

### 1. Create Evaluation Job
```
POST /api/jobs
Content-Type: application/json
Authorization: Bearer {USER_TOKEN}

{
  "job_type": "evaluate_full",
  "manuscript_id": "{string_id_or_uuid}"
}

Response:
{
  "job_id": "...",
  "manuscript_id": "...",
  "status": "queued",  // canonical status
  "created_at": "..."
}
```

### 2. Fetch Evaluation Result (Creator)
```
GET /api/jobs/{jobId}/evaluation-result
Authorization: Bearer {CREATOR_TOKEN}

Response (if complete):
{
  "job_id": "...",
  "status": "complete",
  "evaluation_result": { /* full results */ }
}

Response (if not ready):
404 + { "error": "Evaluation not complete" }
```

### 3. Fetch Evaluation Result (Non-Creator)
```
GET /api/jobs/{jobId}/evaluation-result
Authorization: Bearer {DIFFERENT_USER_TOKEN}

Expected Response:
403 (Forbidden) - RLS blocks access
or
404 (Not Found) - RLS filtered out result
or
200 + { jobs: [] } - Empty results (RLS enforcement)
```

---

## Core Smoke Tests (7 Items)

### Test 1: ✅ Real Author Can Upload/Create Job

**Action:**
```bash
# As User A
curl -X POST "http://localhost:3002/api/jobs" \
  -H "Authorization: Bearer {USER_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "evaluate_full",
    "manuscript_id": "smoke_test_1_'"$(date +%s)"'"
  }'
```

**Expected:**
- HTTP 200
- Response contains `job_id` (string)
- Response contains `status: "queued"` (canonical status)
- Job searchable by jobId

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

### Test 2: ✅ Job Appears in Queue (queued State)

**Action:**
After Test 1, poll the job or check queue:
```bash
curl -X GET "http://localhost:3002/api/jobs/{jobId}" \
  -H "Authorization: Bearer {USER_A_TOKEN}"
```

**Expected:**
- Job returned with `status: "queued"`
- Job contains manuscript_id from Test 1
- No state corruption

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

### Test 3: ✅ Evaluation Runs & Reaches Complete State

**Action:**
- Wait for background worker to process job (may be automatic or require `POST /api/jobs/{jobId}/run-phase1`)
- Poll `GET /api/jobs/{jobId}/evaluation-result` until result available
- Max wait: 30 seconds

**Expected:**
- Job status transitions: `queued` → `running` → `complete` (or straight to `complete`)
- No intermediate stuck states
- Final status is `complete` (canonical value)
- No `failed` status unless explicitly broken

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

### Test 4: ✅ Creator Can Fetch Results

**Action:**
```bash
# As User A (creator)
curl -X GET "http://localhost:3002/api/jobs/{jobId}/evaluation-result" \
  -H "Authorization: Bearer {USER_A_TOKEN}"
```

**Expected:**
- HTTP 200
- Response contains `evaluation_result` object
- Result contains expected fields (criteria, scores, etc.)
- Can parse as valid JSON

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

### Test 5: ✅ Non-Creator CANNOT Fetch Results (RLS Enforced)

**Action:**
```bash
# As User B (different user, not creator)
curl -X GET "http://localhost:3002/api/jobs/{jobId}/evaluation-result" \
  -H "Authorization: Bearer {USER_B_TOKEN}"
```

**Expected:**
- HTTP 403 (Forbidden) OR 404 (Not Found)  
- NOT 200 with results
- Error message present (e.g., "Unauthorized" or "Not Found")
- RLS policy successfully blocked access

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

### Test  6: ✅ Non-Creator Cannot See Manuscript Itself

**Action:**
```bash
# As User B, try to list/fetch manuscripts of User A
curl -X GET "http://localhost:3002/api/manuscripts?owner_id=eq.{USER_A_ID}" \
  -H "Authorization: Bearer {USER_B_TOKEN}"
```

**Expected:**
- HTTP 403 OR
- Empty result set `[]` (RLS filters silently) OR
- HTTP 404
- Definitely NOT User A's manuscript visible

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

### Test 7: ✅ Job State Transitions Follow Contract

**Action:**
Create multiple jobs and observe state sequences:

**Expected Sequences (canonical JOB_CONTRACT_v1):**
- `queued` → `running` → `complete` ✅
- `queued` → `running` → `failed` ✅
- `queued` → `complete` ✅ (fast path)

**Illegal Sequences (must NOT occur):**
- `complete` → `running` ❌
- `failed` → `queued` ❌
- `running` → `queued` ❌
- Any other non-canonical status ❌

**Status:** [ ] Pass [ ] Fail [ ] Unknown

**Notes:**

---

## Rough Edges to Investigate (11 Items)

### Edge 1: Submission Visibility in List Endpoints
- [ ] Can creator LIST their own submissions?
- [ ] Does list endpoint return correct owner_id?
- [ ] Does pagination work?

### Edge 2: Concurrent Submissions from Same Author
- [ ] User A creates Job 1, then immediately Job 2
- [ ] Both jobs appear in list?
- [ ] Both reach `complete` without conflict?

### Edge 3: Malformed Inputs  
- [ ] Missing `job_type` → HTTP 400?
- [ ] Invalid manuscript_id format → HTTP 400?
- [ ] Null body → HTTP 400?

### Edge 4: Job Timeout / Long-Running Evaluations
- [ ] Job takes > 60 seconds → reaches `complete` eventually?
- [ ] Client timeout doesn't corrupt job state?
- [ ] Polling multiple times doesn't create duplicates?

### Edge 5: RLS Policy Enforcement Consistency
- [ ] Same user, different tokens → same result?
- [ ] Admin role can bypass/see all? (if applicable)
- [ ] Non-authenticated requests → 401?

### Edge 6: Error Handling & Propagation
- [ ] Evaluation fails (bad input) → status = `failed` with error message?
- [ ] Error not silent; visible in result?
- [ ] No HTTP 500 from malformed data (should be 400)?

### Edge 7: Result Data Integrity
- [ ] Result JSON validates against schema?
- [ ] No missing required fields?
- [ ] Timestamps match job creation/completion?

### Edge 8: Artifact/Logging Storage
- [ ] Evaluation logs captured?
- [ ] Can access logs for debugging failed jobs?
- [ ] Logs don't persist user PII?

### Edge 9: Parallel Creator/Non-Creator Access
- [ ] Creator and non-creator query result simultaneously → no race condition?
- [ ] One sees result, one sees 403, consistently?

### Edge 10: State After Unexpected Termination
- [ ] Job in `running` state → restart job → resumes or errors gracefully?
- [ ] No orphaned jobs?

### Edge 11: Admin / Debugging Access
- [ ] Admin can list all jobs (bypassing RLS)?
- [ ] Admin can see failed job error details?

---

## Test Execution

### Setup (Run Once)

1. **Identify test server:**
   ```bash
   export BASE_URL="http://localhost:3002"  # or production URL
   ```

2. **Create two test users** (if not already seeded):
   ```bash
   export USER_A_ID="..."
   export USER_A_TOKEN="..."  # or use auth flow to get token
   export USER_B_ID="..."
   export USER_B_TOKEN="..."
   ```

3. **Verify connectivity:**
   ```bash
   curl -s "${BASE_URL}/health" && echo "✓ Server up"
   ```

### Run Tests

```bash
# Copy tests 1-7 from above
# Run each curl command
# Mark [ ] Pass / [ ] Fail for each
# Note any errors in "Notes:" field
```

### Collect Results

After each test:
1. Note exact HTTP status
2. Capture response (JSON)
3. Note timing (how long job took)
4. Record any error messages

---

## Stability Snapshot (Fill In Results)

After running all tests:

```
=== SMOKE TEST RESULTS ===

Core Tests:
  Test 1 (Create job): [✅ PASS / ❌ FAIL / ❓ UNK]
  Test 2 (Job queued): [✅ PASS / ❌ FAIL / ❓ UNK]
  Test 3 (Complete):   [✅ PASS / ❌ FAIL / ❓ UNK]
  Test 4 (Creator read): [✅ PASS / ❌ FAIL / ❓ UNK]
  Test 5 (Non-creator blocked): [✅ PASS / ❌ FAIL / ❓ UNK]
  Test 6 (Manuscript RLS): [✅ PASS / ❌ FAIL / ❓ UNK]
  Test 7 (State machine): [✅ PASS / ❌ FAIL / ❓ UNK]

Score: ___/7 (target: 7/7 before lock)

Rough Edges (solid/broken/unknown):
  Edge 1: [solid / broken / unknown]
  Edge 2: [solid / broken / unknown]
  ... (all 11)

Critical Issues Found:
  - (list any blockers)

Ready for evidence gate? [YES / NO]
  -> If YES: implement phase1-evidence.yml
  -> If NO: fix issues above, re-test
```

---

## Next Steps

**If 7/7 Pass + Rough Edges Mostly Solid:**
1. Implement `.github/workflows/phase1-evidence.yml` (workflow_dispatch only)
2. Automate smoke tests as CI checks
3. Run gate 3+ times successfully
4. Populate `FLOW1_CANONICAL_EVIDENCE.md` with real evidence
5. Assign CI Lock + Docs Lock commits
6. Add to `LOCK_ANCHORS_POLICY.md` registry

**If Any Core Test Fails:**
1. Identify root cause (code bug, config issue, etc.)
2. Fix issue
3. Re-run full smoke test
4. Document what broke & why

---

## Reference: Related Docs

- [FLOW1_STATUS.md](FLOW1_STATUS.md) — Pre-lock checklist source
- [FLOW1_CANONICAL_EVIDENCE.md](FLOW1_CANONICAL_EVIDENCE.md) — Evidence gate target
- [AI_GOVERNANCE.md](AI_GOVERNANCE.md) — Canonical job statuses
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — Job state machine rules
- [LOCK_ANCHORS_POLICY.md](LOCK_ANCHORS_POLICY.md) — Anchor governance

---

## 🚦 This Doc Itself

- **Purpose:** Manual smoke test guide (before CI automation)
- **Input:** You running curl commands against live server
- **Output:** Stability snapshot → decision to implement CI gate
- **Owner:** You (manual tester)
- **No anchors here.** Anchors only assigned after all tests pass x3.
