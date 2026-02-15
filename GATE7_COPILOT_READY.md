# 🚀 GATE 7: READY FOR COPILOT EXECUTION

**Copy this entire section to your next Copilot Chat or create GitHub Issues from it.**

---

## Status

✅ Schema verified (no parent_job_id, using actual single-job model)  
✅ Instruction packet locked (GATE7_COPILOT_INSTRUCTION_PACKET.md)  
✅ Landmine 1 resolved (data model explicit)  
✅ No schema migrations needed  
✅ Flow 1 Proof Pack GREEN  

**Blockers**: Only Landmine 2 (admin client confirmation) and generic code review

---

## EXACT COPILOT EXECUTION PROMPT

Copy this to Copilot Chat:

---

You are implementing **Gate 7 of RevisionGrade** — close the user loop (Flow 1).

**Context**:
- Flow 1 Proof Pack is GREEN (CI passing)
- Phase1 results are stored in: `evaluation_jobs.evaluation_result` (JSONB)
- Phase2 output goes to: `evaluation_artifacts` with `job_id, artifact_type="phase2_output"`
- Constraint already exists: `UNIQUE(job_id, artifact_type)`
- No schema migrations needed

**Task Order** (sequential):
1. Implement `lib/evaluation/phase2.ts` — aggregation engine
2. Wire phase2 trigger in `lib/jobs/worker.ts` (or existing worker file)
3. Create `app/evaluate/[jobId]/report/page.tsx` — SSR report page
4. Create `tests/flow1-aggregation.test.ts` — smoke test
5. Update `.github/workflows/flow1-proof-pack.yml` — CI verification step
6. Add guard-rail comments to all files

**CRITICAL REQUIREMENTS**:

Requirement 1: Use admin/service-role Supabase client in Phase2 and worker (NOT `createClient()` which is session-based).

Requirement 2: Make all writes idempotent via atomic upsert: `.upsert(..., { onConflict: "job_id,artifact_type" })`

Requirement 3: On Phase2 error, mark job as failed (prevent zombie jobs).

Requirement 4: Report page must never crash — show "Processing…" when artifact missing.

Requirement 5: Add guard-rail comments referencing failure classes (Class 1: too early, Class 2: duplicates, Class 3: wrong source, Class 4: serialization, Class 6: zombie).

**Files to Create**:
- `lib/evaluation/phase2.ts` (aggregation function, ~50–80 lines)
- `app/evaluate/[jobId]/report/page.tsx` (SSR page, ~30–50 lines)
- `tests/flow1-aggregation.test.ts` (smoke test, ~100–150 lines)

**Files to Modify**:
- `lib/jobs/worker.ts` (add Phase2 trigger, ~10–20 lines)
- `.github/workflows/flow1-proof-pack.yml` (add verification step, ~5 lines)

**Testing Locally**:
```bash
npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000
```

**Acceptance Criteria**:
- [ ] Phase2 reads from evaluation_result, writes to evaluation_artifacts
- [ ] Upsert is atomic and idempotent
- [ ] Worker uses admin client
- [ ] Report page shows "Processing…" when missing
- [ ] Tests pass locally
- [ ] Guard rails documented
- [ ] No schema changes
- [ ] No breaking changes to existing gates

**Reference**: `GATE7_COPILOT_INSTRUCTION_PACKET.md` (detailed spec with examples and failure map)

---

## FOR GITHUB ISSUES (Create 6 Issues)

**Issue 1: Task 1 — Phase2 Aggregation Engine**

Title: feat(gate7): implement Phase2 aggregation engine

Labels: `gate7`, `phase2`, `p0`

Body:
```
## Task 1: Phase2 Aggregation Engine

File: `lib/evaluation/phase2.ts`

### Requirements
- Read `evaluation_result` from `evaluation_jobs` WHERE `id = jobId`
- Normalize payload (handle inconsistent shapes, nulls)
- Compute aggregated result (e.g., consolidate scores, summaries)
- Upsert atomically to `evaluation_artifacts` 
  - `job_id = jobId`
  - `artifact_type = "phase2_output"`
  - `content = aggregated_result` (JSONB)
  - Use `onConflict: "job_id,artifact_type"`
- Use admin/service-role Supabase client
- Return typed result

### Type Signature (Minimum)
```typescript
export async function runPhase2Aggregation(jobId: string): Promise<unknown>
```

### Guard Rail Comment (Add to Top of File)
```typescript
/**
 * PHASE2 AGGREGATION CONTRACT
 * 
 * - Must be idempotent (safe to run multiple times)
 * - Must produce exactly ONE phase2_output artifact per job
 * - Must tolerate concurrent execution (atomic upsert)
 * - Serialization must be deterministic (normalize before JSON)
 * - Report page reads ONLY this artifact
 * 
 * Failure Class Prevention:
 * - Class 2 (Duplicates): Atomic upsert with unique constraint
 * - Class 4 (Serialization): normalize() before aggregation
 */
```

### Test Locally
```bash
npm test -- phase2.test.ts
```

### Acceptance Criteria
- [ ] Function exists and is callable
- [ ] Reads from evaluation_jobs.evaluation_result
- [ ] Writes to evaluation_artifacts atomically
- [ ] No schema changes
- [ ] Tests pass locally

Blocks: Task 2, Task 3
```

---

**Issue 2: Task 2 — Wire Phase2 Trigger in Worker**

Title: feat(gate7): wire Phase2 trigger in worker

Labels: `gate7`, `worker`, `p0`

Body:
```
## Task 2: Wire Phase2 Trigger

File: `lib/jobs/worker.ts` (or equivalent)

### Requirements
- On job completion, trigger Phase2 aggregation
- Call: `await runPhase2Aggregation(job.id)`
- Use admin/service-role Supabase client (NOT `createClient()`)
- Wrap in try/catch
- On error: mark job as failed (prevent zombie jobs)
- Make idempotent (safe to retry)

### Guard Rail Comment (Add Before Phase2 Call)
```typescript
// CRITICAL: Phase2 aggregation on job completion
// - Must use admin client (background execution, no session)
// - Must mark failed on error (no zombie jobs)
// - Must be idempotent (safe to retry)

try {
  await runPhase2Aggregation(job.id);
  await markJobComplete(job.id);
} catch (error) {
  await markJobFailed(job.id, error.message);
  throw error;
}
```

### Acceptance Criteria
- [ ] Phase2 triggers on job completion
- [ ] Uses admin client (not session)
- [ ] Error handling marks job failed
- [ ] Idempotent
- [ ] No broken changes to existing worker logic

Depends on: Task 1
Blocks: Task 4
```

---

**Issue 3: Task 3 — Create SSR Report Page**

Title: feat(gate7): create SSR report page

Labels: `gate7`, `frontend`, `p0`

Body:
```
## Task 3: SSR Report Page

File: `app/evaluate/[jobId]/report/page.tsx`

### Requirements
- Server-side (SSR) fetch from `evaluation_artifacts`
- Query: `job_id = params.jobId AND artifact_type = "phase2_output"`
- If artifact found: render JSON (minimal; no styling)
- If artifact missing: show "Processing…" (no crash)
- Use Supabase server client (session-based, SSR safe)

### Example Code Structure
```typescript
import { createClient } from "@/lib/supabase/server";

export default async function ReportPage({ params }) {
  const supabase = createClient();
  
  const { data } = await supabase
    .from("evaluation_artifacts")
    .select("content, created_at")
    .eq("job_id", params.jobId)
    .eq("artifact_type", "phase2_output")
    .single();
  
  if (!data) {
    return <p>Processing…</p>;
  }
  
  return (
    <div>
      <h1>Evaluation Report</h1>
      <pre>{JSON.stringify(data.content, null, 2)}</pre>
    </div>
  );
}
```

### Acceptance Criteria
- [ ] Page doesn't crash
- [ ] Queries artifact table correctly
- [ ] Shows "Processing…" when missing
- [ ] SSR only (no client-side Supabase calls)

Depends on: Task 1
Blocks: Task 4
```

---

**Issue 4: Task 4 — Smoke Test**

Title: test(gate7): create smoke test for aggregation flow

Labels: `gate7`, `test`, `p0`

Body:
```
## Task 4: End-to-End Smoke Test

File: `tests/flow1-aggregation.test.ts`

### Test Flow
1. Submit job (via API)
2. Poll for `phase2_output` artifact (every 1s, max 180s)
3. Assert artifact exists
4. Assert artifact content is valid
5. Fetch report page SSR
6. Assert page returns 200 and contains data

### Key Pattern: Polling (Not Sleep)
```typescript
async function waitForArtifact(jobId: string, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const { data } = await supabase
      .from("evaluation_artifacts")
      .select("content")
      .eq("job_id", jobId)
      .eq("artifact_type", "phase2_output")
      .single();
    
    if (data) return data;
    await new Promise(r => setTimeout(r, 1000)); // Poll every 1s
  }
  throw new Error(`Timeout waiting for phase2_output on job ${jobId}`);
}
```

### Test Example
```typescript
test("phase2 artifact exists after evaluation", async () => {
  const jobId = "test-job-id";
  const artifact = await waitForArtifact(jobId);
  expect(artifact).toBeDefined();
  expect(artifact.content).toBeDefined();
});
```

### Run
```bash
npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000
```

### Acceptance Criteria
- [ ] Test passes locally
- [ ] Polling pattern (not sleep)
- [ ] Asserts DB state and page rendering
- [ ] Timeout 180s
- [ ] Uses admin client

Depends on: Tasks 1, 2, 3
Blocks: Task 5
```

---

**Issue 5: Task 5 — CI Verification**

Title: ci(gate7): add Phase2 verification to flow1-proof-pack

Labels: `gate7`, `ci`, `p0`

Body:
```
## Task 5: CI Workflow Update

File: `.github/workflows/flow1-proof-pack.yml`

### Changes
1. Add new step after "Run Flow 1 proof pack (Jest)":
   ```yaml
   - name: Verify Phase2 Aggregation
     run: npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000
   ```

2. Update CI Gate Summary step to include:
   ```yaml
   - name: CI Gate Summary
     if: always()
     run: |
       echo "Flow 1 Proof Pack: Gate 7 Complete"
       echo ""
       echo "  ✓ Phase2 aggregation persisted to evaluation_artifacts"
       echo "  ✓ Report page SSR rendering verified"
       echo "  ✓ Artifact content validated"
       echo ""
       echo "Gate status: Green"
   ```

### Acceptance Criteria
- [ ] New verification step runs smoke test (not echo)
- [ ] Workflow fails if test fails
- [ ] Gate Summary includes Phase2 checks
- [ ] No changes to existing Flow 1 logic

Depends on: Task 4
Blocks: None (final step)
```

---

**Issue 6: Task 6 — Guard-Rail Comments**

Title: docs(gate7): add guard-rail comments to all files

Labels: `gate7`, `docs`, `p2`

Body:
```
## Task 6: Guard-Rail Comments

Add comments to all Gate 7 files referencing failure classes and non-negotiable invariants.

### Files to Update
- `lib/evaluation/phase2.ts` - Add to top of file
- `lib/jobs/worker.ts` - Add before Phase2 call
- `tests/flow1-aggregation.test.ts` - Add to test description

### Comment Template
```typescript
/**
 * GATE 7 GUARD RAILS
 * 
 * Failure Classes Prevented:
 * - Class 1 (Too Early): [specific pattern]
 * - Class 2 (Duplicates): Atomic upsert with unique constraint
 * - Class 3 (Wrong Source): Report page queries artifact table only
 * - Class 4 (Serialization): Normalize before JSON
 * - Class 6 (Zombie): Mark failed on error
 * 
 * Non-Negotiable Invariants:
 * - Phase2 reads from evaluation_result (same job)
 * - Phase2 writes to evaluation_artifacts (atomic, idempotent)
 * - Report page reads phase2_output (canonical source)
 * - Worker uses admin client (no session in background)
 */
```

### Acceptance Criteria
- [ ] Comments are clear and visible
- [ ] Reference specific failure classes
- [ ] State non-negotiable rules
- [ ] Help future developers understand constraints

Depends on: Tasks 1-5 (can be parallel)
```

---

## VERIFICATION CHECKLIST (Before Merging)

- [ ] All 6 tasks implemented
- [ ] Tests pass locally
- [ ] CI Green (flow1-proof-pack running and passing)
- [ ] No schema changes
- [ ] No breaking changes to existing gates
- [ ] Guard rails documented
- [ ] Admin client used in worker/Phase2
- [ ] Report page handling missing artifacts gracefully

---

## Next Steps After Gate 7 Closes

1. **Product Demo** — Show real user evaluation flow
2. **Investor Demo** — Full end-to-end with real data
3. **Revenue Experimentation** — Start beta user trials

---

**Ready to execute: YES ✅**

Paste this into Copilot Chat or create GitHub Issues from the 6 issue templates above.
