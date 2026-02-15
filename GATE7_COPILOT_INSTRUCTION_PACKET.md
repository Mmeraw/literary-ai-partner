# GATE 7 COPILOT EXECUTION PACKET

**Status**: Ready for immediate execution (code-level tasks only)  
**Date**: 2026-02-15  
**Owner**: Copilot / GitHub Actions  
**Blocker**: None for code tasks; schema changes require design review

---

## 🎯 NON-NEGOTIABLE INVARIANTS (Read First)

These are not suggestions. They encode the failure modes. Copilot must follow exactly.

1. **Phase2 aggregates CHILD phase1_output artifacts**
   - Fetch all child jobs where `parent_job_id = parentJobId`
   - Fetch their `phase1_output` artifacts
   - Aggregate into ONE `phase2_output` for the parent job
   - NOT: reading from the same job_id (that's single-job, not aggregation)

2. **Exactly ONE phase2_output exists per parent job**
   - Upsert with `onConflict: "parent_job_id,artifact_type"`
   - If this constraint doesn't exist in schema, halt and notify

3. **Worker/Phase2 uses admin/service-role Supabase client**
   - NOT `createClient()` (that's session/cookie-based, fails in worker)
   - Must be: `createClient({ admin: true })` or equivalent
   - Phase2 runs asynchronously with NO authenticated user

4. **Report page reads phase2_output and never crashes**
   - SSR fetch using user-scoped server client (inherits session auth)
   - Shows "Processing…" if missing (graceful state)
   - Never exposes errors; returns 200 with error boundary

---

## 🚀 EXECUTE NOW (No Schema/Infra Changes Required)

### Task 1: Implement Phase2 Aggregation Engine
**File**: `lib/evaluation/phase2.ts`  
**Priority**: P0  
**Depends on**: Nothing (existing phase1_output artifacts already in DB)

**Implementation Requirements**:
- Fetch all CHILD jobs where `parent_job_id = parentJobId`
- Fetch THEIR `phase1_output` artifacts (not job_id = parentJobId)
- Normalize artifacts (handle inconsistent shapes from Phase1 workers)
- Compute aggregated result (merge scores, summaries, error states)
- Upsert single canonical `phase2_output` artifact **atomically** with `onConflict: "parent_job_id,artifact_type"`
- Use **admin/service-role Supabase client** (not session client)
- Return typed result; no schema changes
- Add guard-rail comment block (see below)

**Acceptance Criteria**:
- [ ] Function is `async`, typed with TypeScript
- [ ] Upsert is atomic (single DB call)
- [ ] Running twice produces identical state (idempotent)
- [ ] Throws on missing phase1 artifacts
- [ ] No DB schema changes

**Test Locally Before Commit**:
```bash
npm test -- phase2.test.ts --testPathPattern="aggregation"
```

---

### Task 2: Wire Phase2 Trigger in Worker
**File**: `lib/jobs/worker.ts` (or equivalent worker entry point)  
**Priority**: P0  
**Depends on**: Task 1 complete

**Implementation Requirements**:
- When a Phase1 job completes, check: are ALL child jobs for this parent complete?
- Use completion-count pattern (mandatory, not optional):
  ```typescript
  // CRITICAL: Recheck just before Phase2 runs
  const { count } = await supabase
    .from("evaluation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("parent_job_id", parentJobId)
    .neq("status", "complete");
  
  if (count > 0) {
    console.log(`Phase2 not ready: ${count} child jobs still pending`);
    return; // NOT READY
  }
  ```
- **Use admin/service-role client** (not session/cookie client)
  ```typescript
  const adminClient = createClient({ admin: true }); // or supabase.from() with RLS disabled
  ```
- When all child jobs complete, call `await runPhase2Aggregation(parentJobId)`
- Wrap in try/catch; on error, mark job as `"failed"` (NEVER leave in `"processing"` — zombie prevention)
- Log aggregation start/completion (use existing logger)

**Acceptance Criteria**:
- [ ] Phase2 ONLY runs when ALL child jobs are complete
- [ ] Completion check is done TWICE (once initial, re-check just before Phase2)
- [ ] Idempotent (safe to call multiple times on same job)
- [ ] Admin/service-role client is used (not session client)
- [ ] Error handling marks job as failed (no zombies)
- [ ] No changes to existing Phase1 workers
- [ ] No changes to `claim_job_atomic()` semantics

**Guard Rail**: Do NOT use `createClient()` without `{ admin: true }` in background Worker. Do NOT change job lifecycle semantics.

---

### Task 3: Create SSR Report Page
**File**: `app/evaluate/[jobId]/report/page.tsx`  
**Priority**: P0  
**Depends on**: Task 1 complete (but page can be created with stub data first)

**Implementation Requirements**:
- Server-side (SSR) fetch from `evaluation_artifacts` table
- Query: `artifact_type = "phase2_output"` AND `job_id = params.jobId`
- If artifact found: render JSON (minimal; no styling yet)
- If artifact not found: show "Processing…" message (no crash, no error)
- Use Supabase server client
- No auth changes; inherit existing middleware auth

**Acceptance Criteria**:
- [ ] Page never crashes (graceful "Processing" state)
- [ ] Query is server-side only (no client-side Supabase calls)
- [ ] JSON rendering works (use `<pre>` + `JSON.stringify`)
- [ ] Artifact table query works (tested locally)

**Guard Rail**: UX polish (styling, interactivity) deferred until after core loop proven.

---

### Task 4: End-to-End Smoke Test
**File**: `tests/flow1-aggregation.test.ts`  
**Priority**: P0  
**Depends on**: Tasks 1, 2, 3 complete

**Implementation Requirements**:
- Create new test file (separate from existing flow1-proof-pack.test.ts)
- Test flow:
  1. Submit job (create parent)
  2. Poll for phase2_output artifact with **backoff pattern** (NOT sleep):
     ```typescript
     async function waitForArtifact(parentJobId: string, timeout = 180000) {
       const start = Date.now();
       while (Date.now() - start < timeout) {
         const { data } = await supabase
           .from("evaluation_artifacts")
           .select("content")
           .eq("parent_job_id", parentJobId)
           .eq("artifact_type", "phase2_output")
           .single();
         
         if (data) return data;
         await new Promise(r => setTimeout(r, 1000)); // Poll every 1s
       }
       throw new Error("Timeout waiting for phase2_output");
     }
     ```
  3. Assert artifact exists and `content.summary` contains expected string
  4. Fetch report page SSR (GET /evaluate/[parentJobId]/report)
  5. Assert status 200 and response contains artifact data (or JSON marker)
- Timeout: 180 seconds (allow time for Phase1 + Phase2)
- Use admin/service-role client for artifact checks (same as worker)
- Use existing test harness (Jest, Supabase test client)

**Acceptance Criteria**:
- [ ] Test passes locally (`npm test -- flow1-aggregation.test.ts`)
- [ ] Polling pattern, not guessed sleep
- [ ] Asserts both DB state AND page rendering
- [ ] Clear error messages on failure (not just falsy assertions)
- [ ] Uses admin client (not session)

**Test Command**:
```bash
npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000
```

---

### Task 5: Update CI Workflow for Gate 7 Verification
**File**: `.github/workflows/flow1-proof-pack.yml`  
**Priority**: P1  
**Depends on**: Tasks 1–4 complete

**Implementation Requirements**:
- Add new workflow step after "Run Flow 1 proof pack (Jest)" step
- Step name: `Verify Phase2 Aggregation`
- **Run the new smoke test suite** (not an echo; real test execution):
  ```yaml
  - name: Verify Phase2 Aggregation
    run: npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000
  ```
- This step MUST PASS or the gate fails
- Update CI Gate Summary to include:
  ```
  ✓ Phase2 aggregation persisted to evaluation_artifacts
  ✓ Report page SSR rendering verified
  ✓ Artifact content.summary validated
  ```

**Acceptance Criteria**:
- [ ] Workflow step runs smoke test (not echo/placeholder)
- [ ] Workflow fails if smoke test fails
- [ ] Gate Summary clearly indicates Phase2 completion
- [ ] No changes to existing Flow 1 Proof Pack gate logic

**Example Workflow**:
```yaml
- name: Verify Phase2 Aggregation
  run: npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000

- name: CI Gate Summary
  if: always()
  run: |
    echo "="
    echo "Flow 1 Proof Pack: Gate 7 Verification Complete"
    echo "="
    echo ""
    echo "Functional checks:"
    echo "  ✓ Supabase migrations applied"
    echo "  ✓ Next.js server boot with mapped env"
    echo "  ✓ Phase2 aggregation persisted to evaluation_artifacts"
    echo "  ✓ Report page SSR rendering verified"
    echo "  ✓ Artifact content.summary contains Phase2 marker"
    echo ""
    echo "Gate status: Green (all functional checks passed)"
```

---

### Task 6: Add Guard-Rail Comments and Contracts
**Files**: `lib/evaluation/phase2.ts`, worker file, tests  
**Priority**: P2 (can follow after implementation)

**Implementation Requirements**:

**In `lib/evaluation/phase2.ts` (top of file)**:
```typescript
/**
 * PHASE2 AGGREGATION CONTRACT
 *
 * This is the canonical aggregation point for evaluation results.
 *
 * Invariants (non-negotiable):
 * - Must be idempotent (safe to run multiple times, same result)
 * - Must produce exactly ONE canonical phase2_output artifact per job
 * - Must tolerate concurrent execution (atomic upsert)
 * - Must NOT rely on worker timing (use completion-count gating)
 * - Serialization must be deterministic (normalized before JSON)
 *
 * Failure Class Prevention:
 * - Class 1 (Too Early): Gated by completion-count check in worker
 * - Class 2 (Duplicates): Atomic upsert with unique constraint
 * - Class 3 (Wrong Source): Report page queries ONLY this table
 * - Class 4 (Serialization): normalize() called before aggregation
 * - Class 6 (Zombie): marked as failed on error, not left in processing
 *
 * Report page reads ONLY this artifact. No other source is canonical.
 */
```

**In worker (before Phase2 call)**:
```typescript
// CRITICAL: Phase2 only runs when ALL Phase1 jobs for this parent are complete.
// This prevents the "too early" failure class.
const { count } = await supabase
  .from("evaluation_jobs")
  .select("*", { count: "exact", head: true })
  .eq("parent_job_id", jobId)
  .neq("status", "complete");

if (count > 0) {
  console.log(`[Phase2] Waiting: ${count} Phase1 jobs still pending.`);
  return; // NOT READY
}

// All Phase1 complete. Proceed with aggregation.
try {
  await runPhase2Aggregation(jobId);
  await markJobComplete(jobId);
} catch (error) {
  // CRITICAL: Mark failed immediately. Do not leave in processing (zombie class).
  await markJobFailed(jobId, error.message);
  throw error;
}
```

**Acceptance Criteria**:
- [ ] Comments are present and visible in code review
- [ ] Guard rails reference specific failure classes
- [ ] Developers reading code understand non-negotiable invariants

---

## 🚨 THREE CRITICAL LANDMINES (Copilot Will Guess Wrong Without These)

### Landmine 1: jobId Ambiguity (Parent vs Child) — **CLARIFY BEFORE STARTING**

**Problem**: Copilot will guess whether Phase1 artifacts are stored on parent jobs or child jobs.  
**Result if guessed wrong**: "No phase1 artifacts found" — gates passes but system doesn't work.

**Decision Required**:
- [ ] **Confirm your data model**: Are Phase1 results stored on child jobs with `parent_job_id` reference?
  - If YES: Phase2 must fetch child jobs by `parent_job_id = parentJobId`, then their artifacts
  - If NO (all on same job): Phase2 fetches by `job_id = jobId`

**Copilot instruction** (use your answer):

If **Model A** (child jobs + parent aggregation):
```
All references "job_id" in Phase1 query context actually mean "child job_id."
Parent job is the aggregation target.
Phase2 query: parent_job_id = parentJobId. Do NOT query job_id = parentJobId.
```

If **Model B** (single job, no children):
```
All Phase1 artifacts are on the same job_id.
Phase2 aggregates artifacts on job_id = jobId (same job, different artifact types).
```

---

### Landmine 2: Supabase Client (Session vs Admin) — **EXPLICIT REQUIREMENT**

**Problem**: Copilot will use `createClient()` (session-based) in worker. Works locally, fails in production (no user session).  
**Result if guessed wrong**: Worker/Phase2 runs but gets permission errors or empty reads.

**Requirement**:
- [ ] Confirm your Supabase instance supports admin/service-role clients in background workers
- [ ] Confirm you have a mechanism to pass credentials to workers (env vars, etc.)

**Copilot instruction** (use as-is):
```
Phase2 and all worker queries must use admin/service-role client, NOT session client.
- Correct: createClient({ admin: true }) or supabase with RLS disabled
- Wrong: createClient() (this is session-based, fails in background)

Report page and all SSR routes use user-scoped server client (inherits session).
```

---

### Landmine 3: Idempotency Isn't Just `.upsert()` — **PATTERN LOCK**

**Problem**: Copilot implements `.upsert()` but rechecks "ready state" not-atomically. Race wins.  
**Result if pattern wrong**: Concurrent workers both decide "ready" and run Phase2 twice (or zombie job if first crashes).

**Requirement**:
- [ ] Implement completion-check pattern as shown in Task 2 (non-negotiable)
- [ ] Recheck count just before Phase2 runs (not in separate transaction)
- [ ] Wrap in try/catch with explicit "mark failed" (no zombies)

**Copilot instruction** (copy to Task 2 comment):
```
IDEMPOTENCY PATTERN (non-negotiable):

1. Check: count pending child jobs → if count > 0, return (not ready)
2. Run: Phase2 aggregation (inside try)
3. Update: mark parent job.status = "complete" OR "failed" (must happen)
4. Never: leave job in "processing" state on error (zombie prevention)

Pattern must tolerate: concurrent workers, network retries, partial failures.
```

---



### DO NOT IMPLEMENT yet:

#### Schema Change: UNIQUE(parent_job_id, artifact_type) Constraint
**Status**: BLOCKED pending schema design review  
**Why**: This is critical for idempotency but should be explicit migration, not inferred.

**Required Before Implementation Starts**:
- [ ] Confirm schema already enforces `UNIQUE(parent_job_id, artifact_type)` constraint on evaluation_artifacts
- [ ] If constraint already exists: Task 1/2 can proceed (no migration needed)
- [ ] If constraint does NOT exist: **STOP** — create explicit migration first (do not auto-generate)

**If Migration Required**:
- Create migration: `migrations/[timestamp]-add-phase2-idempotency-constraint.sql`
- Migration MUST set `ON CONFLICT DO UPDATE` semantics (explicit, not inferred)
- Test locally against test DB first
- Ensure no existing rows violate constraint before applying

**Responsible Party**: DevOps / Schema Maintainer  
**Action Item**: 
1. Check if constraint exists: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'evaluation_artifacts' AND constraint_type = 'UNIQUE';`
2. If missing: create blocker issue "Schema: Add UNIQUE(parent_job_id, artifact_type) for Phase2 idempotency"
3. Do NOT proceed with Tasks 1/2 until confirmed

---

#### Changes to Job Lifecycle / Status Semantics
**Status**: BLOCKED until code review  
**Files**: Anything touching `marking jobs complete/failed`, parent-child relationships, worker dispatch  
**Why**: Could break existing Gates 1–6 if not carefully integrated

**Required Before Implementation**:
- [ ] Code review against existing worker.ts to ensure compatibility
- [ ] Verify no changes to `claim_job_atomic()` semantics
- [ ] Verify no changes to job status enum or transitions

**Responsible Party**: Code Review (Human)  
**Action Item**: After Tasks 1–2 implemented, run through existing worker code with human reviewer

---

#### UX/Styling Changes to Report Page
**Status**: DEFERRED (do not implement)  
**Why**: Core loop must be proven stable first; styling is cosmetic

**Will Implement After Gate 7 CLOSED**:
- [ ] CSS / styling
- [ ] Loading animations
- [ ] Error page design
- [ ] Mobile responsiveness

**Current Scope**: Minimal MVP only (JSON in `<pre>` tag, "Processing…" state)

---

#### Changes to Production Config / Secrets
**Status**: BLOCKED pending ops review  
**Why**: Gate 7 should not require new secrets or config changes

**If you encounter a need for new env vars**:
- STOP
- Create blocker issue: "Gate 7: New ENV var required — [VAR_NAME]"
- Do NOT proceed until approved

**Responsible Party**: DevOps / Security

---

## 🧪 LOCAL VERIFICATION BEFORE COMMIT

Run this command locally to validate all tasks:

```bash
# Install/update dependencies
npm ci

# Run Phase2 aggregation logic tests
npm test -- lib/evaluation/phase2.test.ts

# Run end-to-end smoke tests
npm test -- tests/flow1-aggregation.test.ts --testTimeout=180000

# Verify report page SSR
npm run build && npm run start &
sleep 5
curl http://localhost:3000/api/health
curl http://localhost:3000/evaluate/test-job-id/report
kill %1
```

All tests must pass before submitting PR.

---

## 🚦 COMMIT MESSAGE TEMPLATE

Use this template for commits in Gate 7:

```
feat(gate7): [TASK_NUMBER] - [BRIEF_DESCRIPTION]

- Implements [what]
- Satisfies acceptance criteria [list]
- Does NOT change [list of things we're not touching]

Gate 7 Verification:
- [ ] Tests passing locally
- [ ] No schema changes
- [ ] No lifecycle semantics changes
- [ ] Guard rails documented
```

Example:
```
feat(gate7): Task 1 - implement Phase2 aggregation engine

- Fetches and normalizes phase1_output artifacts
- Implements atomic idempotent upsert
- Adds guard-rail comments (Failure Classes 1, 2, 4, 6)

Gate 7 Verification:
- [x] Tests passing locally
- [x] No schema changes
- [x] No lifecycle semantics changes
- [x] Guard rails documented
```

---

## 📋 EXECUTION CHECKLIST

Before you (Copilot) start, confirm:

- [ ] Flow 1 Proof Pack is GREEN (last CI run)
- [ ] No existing schema blockers (check CI logs for UNIQUE constraint status)
- [ ] No secrets required for this scope
- [ ] No breaking changes to existing worker.ts or job lifecycle

**If any checkbox is unclear**: Create a blocker issue and STOP until human reviews.

---

## 🎯 SUCCESS CRITERIA (Gate 7 Complete)

Gate 7 closes ONLY when ALL of the following are true:

1. **Phase2 aggregation engine exists** (`lib/evaluation/phase2.ts`)
   - Fetches phase1 artifacts
   - Normalizes data
   - Upserts atomically
   - Idempotent
   - Typed

2. **Worker trigger implemented** (worker.ts)
   - Gated by completion-count (not single-job completion)
   - Error handling marks failed jobs
   - No zombie jobs possible

3. **Report page renders** (app/evaluate/[jobId]/report/page.tsx)
   - SSR fetches phase2_output
   - Shows "Processing…" when missing
   - Never crashes
   - Queries artifact table correctly

4. **End-to-end smoke test passes** (tests/flow1-aggregation.test.ts)
   - Full flow: submit → wait → assert artifact exists
   - Artifact content validated
   - Report page rendering verified

5. **CI workflow updated** (flow1-proof-pack.yml)
   - Phase2 verification step runs
   - Gate Summary reflects completion

6. **Guard rails documented** (comments in code)
   - Failure classes referenced
   - Invariants stated
   - Non-negotiable rules clear

7. **No regressions** (existing gates still green)
   - Flow 1 Proof Pack: GREEN ✅
   - Health endpoint: SECURE ✅
   - Worker dispatch: UNCHANGED ✅

---

## 🚨 BLOCKER RESOLUTION PROCESS

**If you encounter a blocker**:

1. **Name it clearly**: "What is blocking execution?"
2. **Create GitHub Issue**: Tag with `gate7-blocker`
3. **Wait for human approval**: Do NOT work around
4. **Resume only after approval**

Do NOT proceed without explicit human sign-off on blockers.

---

**Ready to execute: YES**  
**Estimated time to code complete**: 4–6 hours  
**Estimated time to CI green**: 6–8 hours  

Proceed ✅
