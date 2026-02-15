# Gate 7: Schema Verification Complete ✅

**Date**: 2026-02-15  
**Status**: Ready for Copilot Execution  
**Commit**: a3142a8

---

## What Was Wrong

The prior Gate 7 execution packet assumed a **parent-child job data model** that doesn't exist:
- Referenced `parent_job_id` column (doesn't exist)
- Assumed `UNIQUE(parent_job_id, artifact_type)` constraint (doesn't exist)
- Would have caused Copilot to implement broken aggregation

## What's Actually True (Schema Verified)

### evaluation_jobs Table
- **Phase1 results storage**: `evaluation_result` JSONB column (already exists)
- Status tracking: `status` field (queued, running, complete, failed)
- No `parent_job_id` column

### evaluation_artifacts Table
- **Constraint**: `UNIQUE(job_id, artifact_type)` (already enforced)
- **Columns**: id, job_id, manuscript_id, artifact_type, artifact_version, content (JSONB), created_at, updated_at, source_phase, source_hash
- **Purpose**: Store canonical Phase2 output
- **Idempotency**: Guaranteed by DB constraint + Supabase `.upsert()` with `onConflict: "job_id,artifact_type"`

---

## Gate 7 Execution Model (Corrected)

### Phase1 → Phase2 Flow (Single Job, Not Aggregation)
```
1. Job submitted (evaluation_jobs.id = jobId)
2. Phase1 runs, stores result in evaluation_jobs.evaluation_result
3. On Phase1 completion → Phase2 triggered
4. Phase2 reads: SELECT evaluation_result FROM evaluation_jobs WHERE id = jobId
5. Phase2 writes: INSERT/UPDATE evaluation_artifacts 
   (job_id = jobId, artifact_type = "phase2_output", content = aggregated_result)
   with atomic idempotency via UNIQUE constraint
6. Report page reads: SELECT content FROM evaluation_artifacts 
   WHERE job_id = jobId AND artifact_type = "phase2_output"
```

### Why This Model Works
- ✅ No schema migrations needed
- ✅ UNIQUE constraint already enforces idempotency
- ✅ Single atomic write (no race conditions)
- ✅ Report page has canonical single source of truth (evaluation_artifacts)
- ✅ Supabase `.upsert()` works as-is

---

## Landmine 1: RESOLVED ✅

**Before**: Ambiguous whether Phase1 artifacts are on parent or child jobs  
**After**: Explicit — Phase1 results on same job_id, Phase2 writes new artifact row

**Copilot Risk**: ELIMINATED

---

## Landmines 2 & 3: Still Active ⚠️

**Landmine 2**: Admin client requirement in worker
- Still requires explicit confirmation
- Task 2 must use `createClient({ admin: true })` or Supabase RLS bypass

**Landmine 3**: Idempotency pattern (simple for this model)
- Still requires error handling (try/catch + mark failed)
- But no completion-count gating needed (single job doesn't need it)

---

## What Copilot Can Now Execute

✅ **Task 1** — Phase2 Aggregation Engine  
- No blockers
- No schema changes
- Read from `evaluation_result`, write to `evaluation_artifacts`
- Atomic upsert with `onConflict: "job_id,artifact_type"`

✅ **Task 2** — Wire Phase2 Trigger  
- Trigger on job completion (simple gate)
- Use admin client (still needs confirmation)
- Error handling (mark failed)

✅ **Task 3** — Report Page SSR  
- Query evaluation_artifacts for phase2_output
- Show "Processing…" gracefully
- No schema changes

✅ **Task 4** — Smoke Test  
- Poll for phase2_output artifact
- Assert artifact exists and contains result
- Test report page rendering

✅ **Task 5** — CI Verification  
- Add step to run smoke test
- Update Gate Summary

✅ **Task 6** — Guard Rails  
- Add comments referencing actual failure classes
- Document non-negotiable invariants

---

## Pre-Execution Checklist

Before proceeding, confirm with human:

- [ ] Admin/service-role Supabase client is available for workers (Landmine 2)
- [ ] No other blockers on evaluation_jobs or evaluation_artifacts tables
- [ ] Flow 1 Proof Pack is GREEN (current status: ✅ GREEN)

---

## Timeline Estimate

- Code complete (all 6 tasks): **4–6 hours**
- CI green (workflow passes): **6–8 hours**
- Gate 7 closed: **~8 hours from start**

---

## Result

**GATE7_COPILOT_INSTRUCTION_PACKET.md is now schema-safe and blocker-free (except Landmine 2 confirmation).**

Proceed with execution ✅
