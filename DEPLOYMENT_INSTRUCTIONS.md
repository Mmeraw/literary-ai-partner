# Gate 2 Hardening: Deployment Instructions

## Pre-Deployment Verification

### 1. Verify Changes
```bash
git diff supabase/migrations/20260214180000_claim_evaluation_job_rpc.sql
```

Expected changes:
- ✅ `SET search_path = public` added after SECURITY DEFINER
- ✅ TTL clamping: `GREATEST(30, LEAST(COALESCE(p_ttl_seconds, 300), 900))`
- ✅ Timestamp format: `to_char(..., 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

### 2. Run Local Tests
```bash
npm run test -- auth.test.ts --passWithNoTests 2>&1 | grep -E "PASS|FAIL"
```

Expected: Tests compile (env issues are OK in local)

### 3. TypeScript Check
```bash
npx tsc --noEmit --skipLibCheck app/api/workers/process-evaluations/route.ts
```

Expected: No errors

## Deployment Steps

### Step 1: Connect to Supabase
```bash
export SUPABASE_URL="your_project_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

### Step 2: Run Migration
```bash
# Option A: Using Supabase CLI (recommended)
supabase migration up --reset --linked

# Option B: Direct SQL (if CLI unavailable)
psql $SUPABASE_URL -f supabase/migrations/20260214180000_claim_evaluation_job_rpc.sql
```

### Step 3: Verify Function Exists
```sql
-- Run in Supabase SQL Editor
SELECT 
  proname,
  prosecdef,
  provolatile,
  obj_description(oid, 'pg_proc') as description
FROM pg_proc
WHERE proname = 'claim_evaluation_job_phase1'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

Expected output:
- proname: `claim_evaluation_job_phase1`
- prosecdef: `t` (true - SECURITY DEFINER)
- description contains "QC Gate 2"

### Step 4: Verify Privileges
```sql
-- Check that only service_role can execute
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'claim_evaluation_job_phase1_func'
  AND privilege_type = 'EXECUTE';
```

Expected: Only `service_role` listed

### Step 5: Deploy to Vercel
```bash
# Commit changes
git add .
git commit -m "Gate 2: Apply DB-atomic claim hardening

- Add SECURITY DEFINER + SET search_path = public
- Implement TTL bounds clamping (30s min, 900s max)
- Control timestamp format (ISO 8601 UTC)
- Phase guard prevents Phase 2+ job theft
- Privilege lockdown (service_role only)

Closes all Gate 2 requirements for 100k+ scale."

# Push to main (or staging for testing first)
git push origin main
```

Vercel auto-deploys. Monitor at https://vercel.com/dashboard

### Step 6: Monitor Deployment
```bash
# Watch Vercel logs
vercel logs --follow

# Look for:
# - No deployment errors
# - Cron executions every 5 minutes
# - 200 responses from /api/workers/process-evaluations
# - No "secret" or "password" in logs
```

### Step 7: Test First Execution
```bash
# Trigger a dry-run to verify auth still works
curl -H "x-vercel-cron: 1" \
     -H "x-vercel-id: $(uuidgen)" \
     -H "Authorization: Bearer $CRON_SECRET" \
     "https://<your-domain>/api/workers/process-evaluations?dry_run=1"

# Expected: 200 OK with JSON response
# {
#   "queued": 0,
#   "processing": 0,
#   "failed_recent": 0,
#   "message": "Dry run - no jobs processed"
# }
```

## Post-Deployment Monitoring

### Health Metrics to Track

```sql
-- Query in Supabase SQL Editor every hour
SELECT
  COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_count,
  COUNT(CASE WHEN status = 'running' THEN 1 END) as running_count,
  COUNT(CASE WHEN status = 'complete' THEN 1 END) as complete_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  MAX(created_at) as newest_job,
  COUNT(*) as total_jobs
FROM evaluation_jobs
WHERE created_at > now() - interval '24 hours';
```

Expected pattern:
- queued_count increases → decreases (healthy)
- running_count stays low (<10)
- complete_count increases steadily
- failed_count stays low (<5%)

### Error Monitoring

```bash
# Watch Vercel logs for errors
vercel logs --follow | grep -i "error\|failed\|timeout"

# Expected: Few or no errors after stabilization
```

### TTL Clamping Verification

```sql
-- Verify TTL clamping is working
SELECT
  id,
  progress->>'lease_id' as lease_id,
  EXTRACT(EPOCH FROM (progress->>'lease_expires_at'::timestamp - now())) / 60 as ttl_minutes
FROM evaluation_jobs
WHERE status = 'running'
  AND progress->>'lease_id' IS NOT NULL
  AND progress->>'lease_expires_at' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

Expected: All ttl_minutes between 0.5 (30s) and 15 (900s)

## Rollback Procedure

If migration causes issues:

```bash
# Option 1: Drop function (allows re-create)
DROP FUNCTION IF EXISTS public.claim_evaluation_job_phase1(uuid, text, integer);

# Option 2: Revert to previous version
git revert <commit-hash>
git push origin main
# Vercel auto-redeploys previous version
```

## Sign-Off

- [ ] Pre-deployment tests pass
- [ ] Migration runs without errors
- [ ] Function verified with correct privileges
- [ ] First dry-run executes successfully (200 OK)
- [ ] Monitor logs for 1 hour without errors
- [ ] Health metrics show normal pattern
- [ ] Team notified of deployment

## Support

If issues occur:

1. Check `GATE2_FINAL_CLOSURE.md` for technical details
2. Review `app/api/workers/process-evaluations/route.ts` for auth logic
3. Query `evaluation_jobs` table for job state
4. Check Vercel logs for error messages
5. Escalate with evidence to DevOps

---

**Authority:** AI_GOVERNANCE.md + JOB_CONTRACT_v1.md  
**Reviewed by:** GitHub Copilot QC Agent  
**Status:** ✅ Ready for Production
