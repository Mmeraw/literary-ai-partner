# Worker Daemon Runbook

> ⚠️ **Legacy/Quarantine Notice (2026-04 canonical cutover):**
> This runbook documents the legacy `workers/phase2Worker.ts` path for controlled migration only.
> It is **not** the canonical production evaluation runtime.
>
> Authoritative runtime operations are documented in:
> `docs/CANONICAL_RUNTIME_OPERATIONS.md`

**Status**: Quarantined legacy worker daemon (kill-switch gated)

## 🎯 Legacy Worker Contract (Quarantine Only)

The legacy Phase 2 worker daemon processes evaluation jobs from the `evaluation_jobs` table with the following guarantees (migration mode only):

- **Exactly-once** job execution (atomic claim via `FOR UPDATE SKIP LOCKED`)
- **Deterministic** lifecycle (start/stop/restart)
- **Observable** state (structured JSON logs, heartbeat, PID tracking)
- **Crash-safe** (jobs released on shutdown/crash)
- **No silent failures** (all errors logged)

---

## 🚀 Operations (Legacy Path Only)

> Canonical production path does **not** require this daemon.
> To invoke legacy mode intentionally, `ENABLE_LEGACY_PHASE2_WORKER=1` must be set.

### Start Worker
```bash
./scripts/worker-start.sh
```

Pre-flight checks:
- Verifies no worker already running (PID file check)
- Tests database connectivity
- Loads `.env.staging.local` (local Supabase) or `.env.local` (remote)
- Creates PID file at `.dev-worker.pid`
- Redirects logs to `.worker.log`

### Stop Worker
```bash
./scripts/worker-stop.sh
```

Graceful shutdown (10-second window):
1. Sends SIGINT to worker
2. Worker stops heartbeat
3. Worker releases current job (sets status='queued')
4. Worker exits cleanly
5. PID file removed

If worker doesn't stop gracefully, force kills after 10 seconds.

### Check Worker Status
```bash
./scripts/worker-check.sh
```

Shows:
- Worker PID
- Running time
- Process command line

### View Logs
```bash
tail -f .worker.log
```

Logs are structured JSON:
```json
{"timestamp":"2026-01-27T16:22:03.311Z","level":"info","workerId":"worker-87829-1769530858141","message":"Job claimed","jobId":"41cb8b92-2137-40d3-b142-22752a560824"}
```

---

## 📊 Expected Behavior

### Normal Operation
Worker polls every 5 seconds for eligible jobs:
```
Worker started
→ Poll for jobs (every 5s)
→ Claim job (atomic via claim_job_atomic RPC)
→ Start heartbeat (every 60s updates lease_until)
→ Process job (Phase 2 evaluation logic)
→ Stop heartbeat
→ Mark complete (or failed)
→ Loop
```

### When Jobs Available
```
[info] Worker started
[info] Job claimed (jobId: ...)
[info] Processing job (jobId: ...)
[debug] Heartbeat updated (every 60s)
[info] Job completed (jobId: ...)
```

### When No Jobs Available
Worker polls silently. No "No eligible jobs" spam in logs (filtered out).

### On Error
```
[error] Job processing failed (jobId: ..., error: ...)
→ Job marked as failed in database
→ Worker continues polling
```

### On Crash/SIGTERM
```
[info] Received SIGINT, shutting down gracefully...
[info] Releasing current job (jobId: ...)
[info] Worker shutdown complete
```

---

## 🔧 Configuration

### Environment Variables (required)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (full access)

Loaded from:
1. `.env.local` (if exists, remote Supabase)
2. `.env.staging.local` (fallback, local Supabase at http://127.0.0.1:54321)

### Worker Behavior Constants
(In `workers/phase2Worker.ts`)
- `POLL_INTERVAL_MS`: 5000 (poll every 5 seconds)
- `HEARTBEAT_INTERVAL_MS`: 60000 (heartbeat every 60 seconds)
- Lease timeout: 5 minutes (jobs auto-reclaim after 5 min if worker dies)

---

## 🗄️ Database Schema

### Required Table: `evaluation_jobs`
```sql
CREATE TABLE evaluation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued',
  worker_id TEXT,                     -- Worker that claimed this job
  lease_until TIMESTAMPTZ,             -- Lease expiration (5 min from claim)
  started_at TIMESTAMPTZ,              -- When job was first claimed
  work_type TEXT,                      -- Job type (phase2_evaluation, etc.)
  phase TEXT,                          -- phase_0, phase_1, phase_2
  evaluation_result JSONB,             -- Result payload when complete
  ...
);
```

### Required RPC: `claim_job_atomic`
```sql
CREATE FUNCTION claim_job_atomic(
  p_worker_id TEXT,
  p_now TIMESTAMPTZ,
  p_lease_until TIMESTAMPTZ
)
RETURNS TABLE (id UUID, work_type TEXT, phase TEXT);
```

Implements `FOR UPDATE SKIP LOCKED` to prevent race conditions.

---

## 🚨 Troubleshooting

### Worker Won't Start
**Symptom**: "Worker already running"
```bash
./scripts/worker-stop.sh
rm -f .dev-worker.pid
./scripts/worker-start.sh
```

**Symptom**: "Database not accessible"
```bash
# Check Supabase is running
docker ps | grep supabase
supabase status

# Start if needed
supabase start
```

### Worker Crashes Immediately
Check logs:
```bash
cat .worker.log
```

Common causes:
- Missing env vars (`SUPABASE_SERVICE_ROLE_KEY`)
- Invalid Supabase URL
- Missing `evaluation_jobs` table
- Missing `claim_job_atomic` RPC function

### Jobs Stuck in "running"
**Symptom**: Jobs never complete, worker not claiming new jobs

Check for zombie workers:
```bash
ps aux | grep phase2Worker
```

Kill all workers:
```bash
pkill -9 -f "phase2Worker"
rm -f .dev-worker.pid
```

Release stuck jobs:
```sql
UPDATE evaluation_jobs 
SET status='queued', worker_id=NULL, lease_until=NULL 
WHERE status='running';
```

### "Could not find table … in schema cache"
PostgREST needs schema refresh:
```bash
docker exec supabase_db_literary-ai-partner \
  psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"

docker restart supabase_rest_literary-ai-partner
```

---

## 📈 Monitoring

### Check Worker Health
```bash
./scripts/worker-check.sh
```

### Check Job Queue
```sql
SELECT status, COUNT(*) 
FROM evaluation_jobs 
GROUP BY status;
```

### Check Active Jobs
```sql
SELECT id, status, worker_id, 
       NOW() - started_at as duration,
       lease_until
FROM evaluation_jobs 
WHERE status='running';
```

### Check Stale Leases
```sql
SELECT id, worker_id, lease_until
FROM evaluation_jobs
WHERE status='running' 
  AND lease_until < NOW();
```

Stale leases auto-reclaim on next poll cycle.

---

## 🔐 Security

- Worker uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- Database RPC has `GRANT EXECUTE ... TO service_role`
- Worker logs include `jobId` but not sensitive payload data
- PID files are local-only (not committed)

---

## 🧪 Testing

### Smoke Test: Full Lifecycle
```bash
# 1. Start worker
./scripts/worker-start.sh

# 2. Create test job
# Allowed values: policy_family IN ('standard','dark_fiction','trauma_memoir')
#                 voice_preservation_level IN ('strict','balanced','expressive')
#                 english_variant IN ('us','uk','ca','au')
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
INSERT INTO evaluation_jobs (manuscript_id, job_type, status, policy_family, voice_preservation_level, english_variant)
VALUES (1, 'full_evaluation', 'queued', 'standard', 'balanced', 'us');
"

# 3. Watch logs
tail -f .worker.log

# 4. Verify completion
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
SELECT id, status, evaluation_result IS NOT NULL as has_result 
FROM evaluation_jobs;
"

# 5. Stop worker
./scripts/worker-stop.sh
```

### Test Graceful Shutdown
```bash
# Create job in progress
# ... (start worker, job gets claimed)

# Shutdown while processing
./scripts/worker-stop.sh

# Verify job released
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';
"
# Should be 0
```

---

## 📝 Maintenance

### Update Worker Logic
Edit `workers/phase2Worker.ts` → `processJob()` function.

After changes:
```bash
./scripts/worker-stop.sh
./scripts/worker-start.sh
```

No compilation step needed (tsx runs TypeScript directly).

### Update Claim Logic
Edit `workers/claimJob.ts` → `claimNextJob()` function.

### Update Database RPC
```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -f supabase/migrations/<new_migration>.sql

docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"

docker restart supabase_rest_literary-ai-partner
```

---

## 🚀 Production Considerations

**Not yet implemented** (Phase 2 hardening):
- Multiple workers (horizontal scaling)
- Metrics/observability (Prometheus, Datadog)
- Dead-letter queue for permanently failed jobs
- Retry backoff policy
- Worker auto-restart (systemd, Docker healthcheck)
- Structured error classification

**Current limits**:
- Single worker only
- Local dev environment
- 5-second poll interval (not optimized)
- Simulated job processing (no OpenAI yet)

---

## 🎯 Success Criteria

Worker is production-ready when:
- [x] Starts/stops deterministically
- [x] Claims jobs atomically
- [x] Processes jobs without crashes
- [x] Releases jobs on shutdown
- [x] Logs are structured and queryable
- [x] No orphaned jobs after crash
- [ ] Scales to multiple workers (future)
- [ ] Integrated with OpenAI (future)
- [ ] Metrics exported (future)

---

**Last verified:** 2026-01-27  
**Test suite status:** Worker lifecycle verified manually  
**Database migrations:** All applied to local Supabase
