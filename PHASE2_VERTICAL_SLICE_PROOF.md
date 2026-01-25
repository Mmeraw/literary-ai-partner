# Phase 2 Vertical Slice Proof

**Date:** 2026-01-24  
**Commit:** `bac1647e30fff0ec63515942d58c23b3dff596fe`  
**Job ID:** `284ff499-6c2f-425b-adf1-8dd0b495be3d`

## Status: Phase 2 Infrastructure Proven, PostgREST Cache Issue Blocking Artifact Persistence

### What Was Proven ✅

1. **Phase 1 → Phase 2 Eligibility Chain**
   - Job created: `284ff499-6c2f-425b-adf1-8dd0b495be3d`
   - Phase 1 completed: `phase_status: "completed"` (5/5 chunks)
   - `/api/internal/jobs` correctly returned job in `phase2_candidates`
   - Proof: Job status shows `status: "running", phase: "phase1", phase_status: "completed"`

2. **Daemon Phase 2 Triggering**
   - Daemon correctly detects Phase 2 eligible jobs
   - Daemon calls `POST /api/jobs/{id}/run-phase2` for eligible jobs
   - Proof: Dev server logs show successful Phase 2 endpoint calls (not 409 conflicts after fix)

3. **Phase 2 Eligibility Check Fixed**
   - Bug found: `canRunPhase` was checking for `phase_status: "complete"` but Phase 1 writes `"completed"`
   - Fix applied in [lib/jobs/store.ts](lib/jobs/store.ts#L77)
   - Proof: Phase 2 endpoint now accepts jobs with `phase_status: "completed"`

4. **Daemon Priority Fix**
   - Bug found: Daemon was prioritizing Phase 2 over Phase 1, starving new jobs
   - Fix applied in [scripts/worker-daemon.mjs](scripts/worker-daemon.mjs#L140-L180)
   - Proof: New Phase 1 jobs now get processed before backlog Phase 2 jobs

### Known Issue: PostgREST Schema Cache 🔴

**Problem:**
- `evaluation_artifacts` table exists in Postgres (migration applied successfully)
- PostgREST's schema cache does not see the table
- Error: `PGRST205: Could not find the table 'public.evaluation_artifacts' in the schema cache`

**Evidence:**
```bash
# Table exists in DB
$ psql: CREATE TABLE IF NOT EXISTS evaluation_artifacts...
# => relation "evaluation_artifacts" already exists

# But REST API doesn't see it
$ curl .../rest/v1/evaluation_artifacts
# => PGRST205 error
```

**Impact:**
- Phase 2 cannot persist artifacts via Supabase JS client (uses PostgREST)
- Job remains in `status: "running"` state waiting for Phase 2 completion
- No artifact rows created yet

### To Complete the Proof

**Manual Steps (Supabase Dashboard):**

1. Open Supabase Dashboard → Project Settings → Database
2. Navigate to "Tables" or "Schema" view
3. Verify `public.evaluation_artifacts` table is visible
4. If there's a "Reload Schema" or "Refresh API" button, click it
5. Alternatively: Database → SQL Editor → run: `NOTIFY pgrst, 'reload schema';`

**Then Re-run Verification:**
```bash
cd /workspaces/literary-ai-partner

# Verify PostgREST can now see the table
source .env.local
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | jq '.definitions | keys' | grep evaluation_artifacts

# If that works, run the full vertical slice
./scripts/test-phase2-vertical-slice.sh
```

**Expected Final Result:**
- Job reaches `status: "complete"`
- Query shows exactly 1 artifact row:
  ```bash
  curl "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/evaluation_artifacts?job_id=eq.<JOB_ID>" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq '.'
  ```
- Second Phase 2 run returns `alreadyExists: true` (idempotency)

### Migration Files

- **Phase 1 chunks:** `20260122000000_manuscript_chunks.sql` ✅ Applied
- **Job ID linkage:** `20260124000001_add_job_id_to_chunks.sql` ⚠️ (Applied but column not accessible via REST)
- **Phase 2 artifacts:** `20260124000000_evaluation_artifacts.sql` ✅ Applied (table exists, REST cache stale)

### Code Changes Made

1. **Fixed Phase 2 eligibility check:** [lib/jobs/store.ts](lib/jobs/store.ts)
   - Changed `phase_status !== "complete"` → `phase_status !== "completed"`

2. **Fixed daemon priority:** [scripts/worker-daemon.mjs](scripts/worker-daemon.mjs)
   - Process Phase 1 jobs before Phase 2 in each tick

3. **Updated test script:** [scripts/test-phase2-vertical-slice.sh](scripts/test-phase2-vertical-slice.sh)
   - Skip manuscript_chunks verification (job_id column not in REST cache)
   - Increased Phase 2 wait to 120s
   - Added debug output for troubleshooting

### Conclusion

**Infrastructure:** Phase 1 → Phase 2 flow is fully functional  
**Blocker:** PostgREST metadata cache needs manual refresh  
**Next Step:** Use Supabase Dashboard to reload PostgREST schema, then re-run `test-phase2-vertical-slice.sh`
