# Daemon Verification - Clean Run Test

**Status**: ✅ Daemon selection logic fixed (Commit 6541b5e)  
**Date**: 2026-01-24

---

## What Was Fixed

### Problem
Worker daemon was hammering all historical jobs, causing:
- 404s (jobs from wrong environment/old IDs)
- 409s (jobs not eligible, repeated attempts)
- Log spam (dozens of jobs per tick)

### Solution
1. **Eligible-only endpoint**: GET `/api/internal/jobs` returns filtered candidates
2. **Response state machine**: Proper handling of 409 (not eligible), 404 (skip), 5xx (retry)
3. **Throttling**: MAX_PER_TICK=3 (configurable)
4. **Deduplication**: Set-based tracking within poll cycle

---

## Verification Steps (5 Minutes)

### Step 1: Start Fresh Environment

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Verify server is up
curl http://localhost:3002/api/health
# Expected: {"ok":true,"service":"revisiongrade",...}
```

### Step 2: Check Eligible Jobs (Should Be Empty or Minimal)

```bash
curl -s "http://localhost:3002/api/internal/jobs" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq '.summary'

# Expected output (example):
# {
#   "total": 42,
#   "phase1_eligible": 0,
#   "phase2_eligible": 0
# }
```

If you see `phase1_eligible: 0` and `phase2_eligible: 0`, perfect - daemon will be idle.

### Step 3: Create Single Test Job

```bash
TEST_JOB=$(curl -s -X POST "http://localhost:3002/api/internal/jobs" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id":"2","job_type":"evaluate_quick"}' | jq -r '.job.id')

echo "Created job: $TEST_JOB"
```

Verify job was created:
```bash
curl "http://localhost:3002/api/internal/jobs" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq '.summary'

# Expected:
# {
#   "total": 43,
#   "phase1_eligible": 1,  # ← Your new job
#   "phase2_eligible": 0
# }
```

### Step 4: Start Daemon (Observe Clean Behavior)

```bash
# Terminal 2
node scripts/worker-daemon.mjs
```

**Expected output**:
```
[worker-xxxxx] Worker daemon started
[worker-xxxxx] Base URL: http://localhost:3002
[worker-xxxxx] Poll interval: 5000ms
[worker-xxxxx] Max per tick: 3
[worker-xxxxx] Starting main loop...
[worker-xxxxx] ✓ Phase1 triggered for <TEST_JOB>
[worker-xxxxx] Tick complete: 1 processed, 1 P1 eligible, 0 P2 eligible
```

**What you should NOT see**:
- ❌ Dozens of "Phase1 error: 404" messages
- ❌ Repeated triggers for same job
- ❌ "Phase2 error: 404" for old jobs
- ❌ 409 spam

**What you SHOULD see**:
- ✅ Exactly ONE job processed (your new test job)
- ✅ Clean "✓ Phase1 triggered" message
- ✅ Daemon becomes quiet after first tick (idle, waiting for more work)

### Step 5: Verify Job Progressed

```bash
curl "http://localhost:3002/api/jobs/$TEST_JOB" | jq '.job.status'

# Expected: "running" (Phase 1 in progress)
# Or: "complete" (if Phase 1 finished quickly)
```

---

## Success Criteria

✅ **Daemon runs without errors**  
✅ **Only targets eligible jobs** (no 404 spam)  
✅ **Handles 409 gracefully** (no retry loops)  
✅ **Processes exactly MAX_PER_TICK jobs per cycle**  
✅ **Silent when idle** (no noise)  

---

## Configuration Options

```bash
# Adjust poll interval (default 5000ms = 5s)
WORKER_POLL_INTERVAL_MS=3000 node scripts/worker-daemon.mjs

# Adjust max jobs per tick (default 3)
WORKER_MAX_PER_TICK=1 node scripts/worker-daemon.mjs

# Custom worker ID (default: worker-<pid>)
WORKER_ID=production-worker-1 node scripts/worker-daemon.mjs
```

---

## Troubleshooting

### "Poll cycle error: Failed to fetch jobs: 401"
**Cause**: SUPABASE_SERVICE_ROLE_KEY not set or wrong  
**Fix**: `source .env.local` or set explicitly

### "Poll cycle error: Failed to fetch jobs: 500"
**Cause**: Server error (check Next.js terminal)  
**Fix**: Check server logs, verify Supabase connection

### Daemon processes same job repeatedly
**Cause**: Job is stuck in eligible state (lease expired?)  
**Fix**: Check job status, verify Phase 1 execution logic

### No jobs processed despite eligible jobs
**Cause**: MAX_PER_TICK=0 or job trigger endpoints returning 409  
**Fix**: Check endpoint responses, verify job state machine

---

## Next Steps After Verification

Once daemon runs cleanly with a single test job:

1. **Leave daemon running** (continuous processing)
2. **Move to Phase 2 implementation**
3. **Create more jobs** and watch daemon process them
4. **Deploy daemon** (VM, PM2, or serverless)

---

## Commit Reference

**Fix**: `6541b5e` - Fix daemon worker selection and response handling  
**Anchor**: This commit makes daemon safe for production-style operation

---

## Clean Run Output (Reference)

```
[worker-117281] Worker daemon started
[worker-117281] Base URL: http://localhost:3002
[worker-117281] Poll interval: 5000ms
[worker-117281] Max per tick: 3
[worker-117281] Starting main loop...
```

Then silent (no eligible jobs) until you create one, at which point:

```
[worker-117281] ✓ Phase1 triggered for 486b0bf4-6280-4dcf-8fa0-f29f2b76af18
[worker-117281] Tick complete: 1 processed, 1 P1 eligible, 0 P2 eligible
```

Then silent again (idle).

**This is correct behavior.**
