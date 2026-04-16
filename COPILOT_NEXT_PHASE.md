# GitHub Copilot Instructions — Next Phase

## Current Status

✅ **Governance Locked**: JOB_CONTRACT_v1 enforced  
✅ **Passive Observability**: Event recording added (best-effort, never throws)  
✅ **Canon Guard**: Active in git hooks + CI  
✅ **GET /api/jobs/[jobId]**: Canonical read-only endpoint — user-scoped, 404 on not-found/unowned, no derived statuses  
✅ **Frontend Polling UI**: `JobStatusPoll.tsx` polls at 1500ms, renders canonical state only, stops on terminal states — no fabricated progress or ETAs

## Scope Closed

All tasks in this document are **complete** as of 2026-04-16.  
Any further work (stale-job banners, abnormal-transition logging) is **new scope**, not unfinished work.

## What to Tell Copilot for Next Work

### Copy-Paste Instruction Block

```
Canon is active. Do not change job control flow. Do not invent or infer job statuses beyond queued/running/complete/failed.

NEXT TASKS (in order):

1. Implement GET /api/jobs/:job_id
   - Return canonical job state only (id, status, progress, created_at, updated_at)
   - User-scoped via x-user-id header
   - 404 if not found or not owned by user
   - No derived statuses, no estimated time

2. Frontend polling UI for /evaluate/[jobId]
   - Poll GET /api/jobs/:job_id every 1-2 seconds
   - Render status exactly as returned: queued → running → complete → failed
   - Show last_error if failed
   - No fabricated progress indicators

All implementations must:
- Read from canonical job state only
- Not modify job control flow
- Pass canon:guard checks
- Follow JOB_CONTRACT_v1
```

## Constraints for AI

### ✅ Allowed
- Create read-only API endpoints that return persisted job state
- Poll existing APIs from frontend
- Render UI based on canonical JobStatus
- Display `last_error` from database
- Show timestamps (created_at, updated_at)

### ❌ Forbidden
- Invent new job statuses (like "processing", "initializing", "finishing")
- Calculate "estimated time remaining"
- Show progress % unless it comes from `progress.units_completed / units_total`
- Change job state based on UI interactions (except explicit actions like cancel)
- Fabricate phase information not in the database
- Mask failed status as "retrying" without canonical retry_pending status

## Example Good Implementation

```typescript
// GET /api/jobs/:job_id
export async function GET(req: Request, { params }: { params: { job_id: string } }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const job = await getJob(params.job_id);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  // TODO: Add user ownership check when auth is implemented
  // if (job.user_id !== userId) { return 403; }

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      created_at: job.created_at,
      updated_at: job.updated_at,
      last_error: job.last_error ?? null,
    },
  });
}
```

## Example Bad Implementation (Don't Allow)

```typescript
// ❌ BAD - Inventing statuses
if (job.status === "running" && !job.progress) {
  return { status: "initializing" }; // FORBIDDEN
}

// ❌ BAD - Fabricating progress
const estimatedTime = calculateEstimate(job); // FORBIDDEN
return { estimated_time_remaining: estimatedTime };

// ❌ BAD - Deriving status
if (job.retry_count > 0 && job.status === "failed") {
  return { status: "retrying" }; // FORBIDDEN
}
```

## Verification Steps

After implementing new features:

1. Run canon guard:
   ```bash
   npm run canon:guard
   ```

2. Check TypeScript:
   ```bash
   npx tsc --noEmit
   ```

3. Verify no forbidden patterns:
   ```bash
   grep -r "completed\|done\|success\|initializing\|processing" app/api/jobs/
   ```

4. Test read-only guarantee:
   - Confirm GET endpoints don't call `updateJob()`
   - Confirm UI polling doesn't write to DB

## Emergency: If Copilot Suggests Contract Violation

1. **Stop** — Don't accept the suggestion
2. **Reference**: Point Copilot to `docs/JOB_CONTRACT_v1.md`
3. **Rephrase**: "Implement this using only canonical JobStatus values from JOB_CONTRACT_v1"
4. **Verify**: Run `npm run canon:guard` before committing

---

**Remember**: The UI consumes truth; it doesn't create it.
