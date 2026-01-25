# Staging Verification

**Purpose**: Prove the hardened job system works in a real production-like environment  
**Status**: 🚧 Ready to execute  
**Last Run**: _Not yet executed_  
**Next Run**: After staging deployment  

---

## What This Proves

✅ **Real Supabase**: Not memory mode - actual DB with RPCs, RLS, migrations  
✅ **Real Auth**: No header bypass - JWT tokens only  
✅ **Real Workers**: Lease contention with actual worker processes  
✅ **Real Invariants**: All CI contracts hold under production conditions  

---

## Prerequisites

### 1. Staging Environment Setup

**Supabase Staging Project**:
- [ ] Created at [app.supabase.com](https://app.supabase.com)
- [ ] Migrations applied: `supabase db push --project-ref <staging-ref>`
- [ ] RLS policies enabled
- [ ] Project reference copied: `___________________`

**Vercel Staging Deployment**:
- [ ] Created staging environment in Vercel project settings
- [ ] Environment variables configured (see below)
- [ ] Deployed: `vercel` (preview deployment)
- [ ] Staging URL: `https://_____________________.vercel.app`

### 2. Required Environment Variables (Vercel Staging)

```bash
# Add these in Vercel Dashboard → Project → Settings → Environment Variables → Staging

SUPABASE_SERVICE_ROLE_KEY=<your-staging-service-role-key>
NEXT_PUBLIC_SUPABASE_URL=https://<your-staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-staging-anon-key>

# CRITICAL: These must be set exactly
NODE_ENV=production
USE_SUPABASE_JOBS=true

# CRITICAL: This must NOT exist in staging
# ALLOW_HEADER_USER_ID=true  ← DO NOT SET THIS
```

### 3. Test User Setup

Create a test user in Supabase Staging:

```sql
-- Run in Supabase SQL Editor (staging project)

-- 1. Create test user (if not exists)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'staging-test@example.com',
  crypt('test-password-123', gen_salt('bf')),
  now(),
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create test manuscript for job creation
INSERT INTO manuscripts (
  id,
  user_id,
  title,
  content,
  created_at,
  updated_at
) VALUES (
  999,
  '00000000-0000-0000-0000-000000000001',
  'Staging Test Manuscript',
  'Test content for staging smoke tests.',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET updated_at = now();
```

### 4. Get Test User JWT Token

```bash
# Method 1: Via Supabase Dashboard
# Go to: Authentication → Users → staging-test@example.com → Generate Access Token

# Method 2: Via curl (sign in)
curl -X POST "https://<your-staging-ref>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <your-staging-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staging-test@example.com",
    "password": "test-password-123"
  }'

# Extract access_token from response
# Save it: export STAGING_JWT="eyJhbG..."
```

---

## Test Suite

### Test 1: Create Job (Real Auth)

**Goal**: Prove job creation works with real JWT token.

```bash
export STAGING_URL="https://your-app.vercel.app"
export STAGING_JWT="<your-jwt-token>"

curl -X POST "$STAGING_URL/api/jobs" \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "manuscript_id": "999",
    "job_type": "evaluate_quick"
  }' | jq .

# ✅ EXPECTED:
# {
#   "ok": true,
#   "job": {
#     "id": "job-abc123...",
#     "status": "queued",
#     "manuscript_id": "999",
#     "job_type": "evaluate_quick",
#     "created_at": "2026-01-24T...",
#     ...
#   }
# }
```

**Failure Modes**:
- `401 Unauthorized` → JWT token invalid or expired
- `500` + "Missing required fields" → Request body malformed
- `403` + "Rate limit" → Too many test runs (wait 1 hour)

### Test 2: Header Bypass MUST Fail

**Goal**: Prove `x-user-id` header bypass is disabled in staging.

```bash
curl -X POST "$STAGING_URL/api/jobs" \
  -H "x-user-id: fake-bypass-attempt" \
  -H "Content-Type: application/json" \
  -d '{
    "manuscript_id": "999",
    "job_type": "evaluate_quick"
  }' | jq .

# ✅ EXPECTED: 401 Unauthorized
# {
#   "ok": false,
#   "error": "Unauthorized"
# }

# ❌ FAILURE: If this returns 200 OK, ALLOW_HEADER_USER_ID is enabled
# → STOP. Fix environment variables. This is a security violation.
```

**If Test 2 Fails**:
1. Check Vercel env vars: `ALLOW_HEADER_USER_ID` must not exist
2. Verify deployment used staging environment (not preview/production)
3. Check logs for `SECURITY VIOLATION` panic message

### Test 3: Job Status Polling

**Goal**: Verify job progresses through states.

```bash
# Use job_id from Test 1
JOB_ID="job-abc123..."

# Poll status
curl -X GET "$STAGING_URL/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $STAGING_JWT" | jq '.job.status'

# ✅ EXPECTED PROGRESSION:
# Initial: "queued"
# After worker claims: "running" 
# After phase 1: "complete" or "failed"

# Poll every 5 seconds until terminal state
```

### Test 4: Verify Job in Database

**Goal**: Confirm job exists in Supabase with correct fields.

```sql
-- Run in Supabase SQL Editor (staging)

SELECT 
  id,
  manuscript_id,
  job_type,
  status,
  phase,
  phase_1_status,
  phase_1_locked_by,
  phase_1_locked_at,
  created_at,
  updated_at
FROM evaluation_jobs
WHERE manuscript_id = 999
ORDER BY created_at DESC
LIMIT 5;

-- ✅ EXPECTED:
-- One row per job created in tests
-- status should match API response
-- phase_1_locked_by should be set if worker claimed it
-- phase_1_locked_at should be recent (within 5 min if worker is running)
```

### Test 5: Worker Claims Job (Lease Contention)

**Goal**: Prove lease mechanism works with real workers.

**Setup Worker Locally (Pointing at Staging)**:

```bash
# Create .env.staging file
cat > .env.staging <<EOF
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
USE_SUPABASE_JOBS=true
NODE_ENV=production
WORKER_ID=local-worker-1
EOF

# Run worker once (claim and process one job)
# TODO: Create worker script if it doesn't exist
# node scripts/worker.mjs --once --env staging
```

**Expected Behavior**:
1. Worker queries for queued jobs
2. Calls `claim_chunk_for_processing` RPC
3. Exactly one worker gets the lease
4. Job transitions: `queued` → `running` → `complete`
5. No double-processing (verify in DB: only one `phase_1_locked_by`)

**Verify Lease in DB**:

```sql
SELECT 
  id,
  status,
  phase_1_locked_by,
  phase_1_locked_at,
  last_heartbeat,
  phase_1_started_at,
  phase_1_completed_at
FROM evaluation_jobs
WHERE id = '<job-id-from-test-1>';

-- ✅ EXPECTED:
-- phase_1_locked_by: "local-worker-1" (or Vercel instance ID)
-- phase_1_locked_at: Recent timestamp
-- last_heartbeat: Updated within 30 seconds
```

### Test 6: Concurrent Lease Contention

**Goal**: Prove only one worker wins when multiple compete.

```bash
# Start 3 workers simultaneously (different terminals)
# Terminal 1:
WORKER_ID=worker-1 node scripts/worker.mjs --once --env staging &

# Terminal 2:
WORKER_ID=worker-2 node scripts/worker.mjs --once --env staging &

# Terminal 3:
WORKER_ID=worker-3 node scripts/worker.mjs --once --env staging &

# Wait for completion
wait

# Check DB
SELECT 
  id,
  phase_1_locked_by,
  COUNT(*) OVER (PARTITION BY id) as lock_count
FROM evaluation_jobs
WHERE manuscript_id = 999
  AND created_at > now() - interval '10 minutes';

-- ✅ EXPECTED:
-- Each job has exactly ONE phase_1_locked_by value
-- lock_count = 1 for all rows (no double locks)

-- ❌ FAILURE:
-- If lock_count > 1 → RPC contention broken (critical bug)
```

### Test 7: Lease Expiry Recovery

**Goal**: Prove expired leases are recovered automatically.

```sql
-- Simulate stale lease (worker crashed)
UPDATE evaluation_jobs
SET 
  status = 'running',
  phase_1_locked_at = now() - interval '10 minutes',
  phase_1_locked_by = 'dead-worker-999',
  last_heartbeat = now() - interval '10 minutes'
WHERE manuscript_id = 999
  AND status = 'complete'
LIMIT 1
RETURNING id;

-- Start a new worker - it should reclaim the expired job
WORKER_ID=recovery-worker node scripts/worker.mjs --once --env staging

-- Verify recovery
SELECT 
  id,
  status,
  phase_1_locked_by,
  phase_1_locked_at,
  phase_1_attempt_count
FROM evaluation_jobs
WHERE id = '<returned-job-id>';

-- ✅ EXPECTED:
-- phase_1_locked_by changed to "recovery-worker"
-- phase_1_locked_at updated to recent time
-- phase_1_attempt_count incremented (if tracked)
```

---

## Automated Test Runner

Run all tests with one command:

```bash
bash scripts/staging-smoke.sh
```

**Expected Output**:

```
🔍 STAGING SMOKE TEST
Environment: https://your-app.vercel.app

✅ Test 1: Create Job (Real Auth) - PASS
✅ Test 2: Header Bypass Blocked - PASS
✅ Test 3: Job Status Progression - PASS
✅ Test 4: Database Verification - PASS
✅ Test 5: Worker Lease Claim - PASS
✅ Test 6: Concurrent Lease Contention - PASS
✅ Test 7: Lease Expiry Recovery - PASS

========================================
🎉 ALL TESTS PASSED
Staging environment is PRODUCTION-READY
========================================

Next Steps:
1. Update STAGING_VERIFICATION.md with:
   - Last Run Date: 2026-01-24
   - Staging URL: <your-url>
   - Test Results: ✅ All Pass
2. Create production deployment plan
3. Run production smoke with same tests
```

---

## Failure Investigation

### Common Failures

| Test | Failure | Root Cause | Fix |
|------|---------|------------|-----|
| Test 1 | 401 Unauthorized | Invalid JWT | Regenerate token via Supabase dashboard |
| Test 2 | 200 OK (should be 401) | `ALLOW_HEADER_USER_ID=true` set | Remove from Vercel env vars, redeploy |
| Test 3 | Job stuck in "queued" | No worker running | Start worker or check worker logs |
| Test 5 | Multiple leases | RPC not atomic | Check `claim_chunk_for_processing` migration applied |
| Test 7 | Expired lease not recovered | Worker not checking expiry | Review worker lease claim logic |

### Debug Commands

```bash
# Check Vercel deployment logs
vercel logs <deployment-url>

# Check Supabase logs
# Go to: Supabase Dashboard → Logs → Postgres Logs

# Verify migrations applied
supabase db diff --project-ref <staging-ref>
# (Should show "No changes")

# Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'evaluation_jobs';

# List recent jobs
SELECT id, status, created_at, phase_1_locked_by 
FROM evaluation_jobs 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Success Criteria

Before marking staging as verified:

- [ ] All 7 tests pass
- [ ] Test 2 (header bypass) definitively fails with 401
- [ ] At least one job completes end-to-end (queued → complete)
- [ ] Lease contention test shows exactly 1 winner per job
- [ ] No "SECURITY VIOLATION" errors in logs
- [ ] Worker can claim and process jobs
- [ ] Database queries return expected schema

---

## Recording Results

After successful run, update this section:

```markdown
## Last Verification Run

**Date**: _____________  
**Staging URL**: _____________  
**Test Results**:
- Test 1 (Create Job): ✅ / ❌
- Test 2 (Header Bypass Blocked): ✅ / ❌
- Test 3 (Job Status): ✅ / ❌
- Test 4 (Database Check): ✅ / ❌
- Test 5 (Worker Lease): ✅ / ❌
- Test 6 (Concurrency): ✅ / ❌
- Test 7 (Lease Recovery): ✅ / ❌

**Overall**: ✅ VERIFIED / ❌ FAILED

**Notes**: _____________
```

---

## Next Steps After Verification

Once all tests pass:

1. **Update [ZERO_DRIFT_VERIFICATION.md](../ZERO_DRIFT_VERIFICATION.md)**:
   ```markdown
   ## Staging Verification
   **Last Verified**: 2026-01-24
   **URL**: https://your-staging.vercel.app
   **Evidence**: [Link to this doc with results filled in]
   ```

2. **Create Production Plan**:
   - Copy staging environment to production
   - Use production Supabase project
   - Re-run smoke tests against production

3. **Add to CI**:
   - Nightly staging smoke test
   - Alert on failures

4. **Ship Features**:
   - You've proven the foundation holds
   - Safe to add new job types (Perplexity's plan)
