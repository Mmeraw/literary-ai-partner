# Next Steps: Harden Infrastructure → Build Features

**Decision**: Prove reliability before spending it  
**Timeline**: 2-3 days hardening → Ship user value  
**Date**: January 24, 2026

---

## Phase 1: Prove the Foundation (2-3 days)

### ✅ Step 1: Lock CI Evidence (30 min)
**Goal**: Make CI verification auditable

**Actions**:
1. Add "Last Verified CI Run" to [ZERO_DRIFT_VERIFICATION.md](ZERO_DRIFT_VERIFICATION.md)
   ```markdown
   **Last CI Run**: [GitHub Actions link]
   **Date**: 2026-01-24
   **Commit**: abc1234
   **Result**: ✅ All contracts verified
   ```

2. Update CI workflow to post verification URL as PR comment

**Done When**: Anyone can click a link and see proof the contracts pass

---

### 🎯 Step 2: Staging Smoke Test (HIGH PRIORITY - 4 hours)
**Goal**: Prove real Supabase behavior with real auth

**Current Gap**: You have `STAGING_READY.md` but haven't run it  

**Actions**:
1. Deploy to Vercel staging following [STAGING_READY.md](STAGING_READY.md)
2. Create `docs/STAGING_VERIFICATION.md` with:
   ```bash
   # Staging Smoke Test
   
   ## Setup
   export STAGING_URL="https://your-app.vercel.app"
   export STAGING_API_KEY="real-user-jwt-token"
   
   ## Tests (run against live staging)
   
   ### Test 1: Create Job (Real Auth)
   curl -X POST "$STAGING_URL/api/jobs" \
     -H "Authorization: Bearer $STAGING_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"manuscript_id":"1","job_type":"evaluate_quick"}'
   
   # Expected: 200 OK, job_id returned
   
   ### Test 2: Verify Header Bypass FAILS
   curl -X POST "$STAGING_URL/api/jobs" \
     -H "x-user-id: fake-bypass" \
     -H "Content-Type: application/json" \
     -d '{"manuscript_id":"1","job_type":"evaluate_quick"}'
   
   # Expected: 401 Unauthorized (MUST fail - proves bypass is off)
   
   ### Test 3: Worker Claims Job
   # SSH into Vercel staging instance or run worker locally pointing at staging DB
   node scripts/worker.js --once
   
   # Expected: Job transitions queued → running → complete
   ```

3. Run all 3 tests and document results
4. Add staging URL + results to this doc

**Done When**: 
- All 3 tests pass
- Header bypass definitively fails in staging
- One full job completes end-to-end on real infrastructure

**Files to Create**:
- `docs/STAGING_VERIFICATION.md` (test procedure)
- `scripts/staging-smoke.sh` (automated version)

---

### 🔒 Step 3: Concurrency Proof (2 hours)
**Goal**: Prove lease contention works under realistic load

**Actions**:
1. Create `tests/concurrency/lease-contention.test.ts`:
   ```typescript
   describe("Lease Contention (Deterministic)", () => {
     test("2 workers, 1 job → exactly 1 winner", async () => {
       const job = await createJob({ job_type: "evaluate_quick" });
       
       const [claim1, claim2] = await Promise.all([
         claimJob(job.id, "worker-1"),
         claimJob(job.id, "worker-2"),
       ]);
       
       const winners = [claim1, claim2].filter(c => c.success);
       expect(winners).toHaveLength(1);
     });
     
     test("4 workers, 1 job → lease expires, 2nd worker recovers", async () => {
       // Similar but forces lease expiry and recovery
     });
   });
   ```

2. Add to CI as a required check

**Done When**: Test passes in CI with Supabase secrets

---

### 📊 Step 4: Observability Minimums (2 hours)
**Goal**: Debug stuck jobs without guessing

**Actions**:
1. Add structured logging to worker:
   ```typescript
   logger.info("Job lifecycle event", {
     job_id,
     phase,
     status,
     lease_expires_at,
     worker_id,
     last_heartbeat_at,
     action: "claim_success" | "phase_transition" | "retry_scheduled"
   });
   ```

2. Create `docs/DEBUGGING_STUCK_JOBS.md`:
   ```markdown
   # How to Debug a Stuck Job
   
   ## Quick Triage
   1. Get job state: `SELECT * FROM evaluation_jobs WHERE id = 'job-xyz'`
   2. Check lease: Is `phase_1_locked_at` > 5 min old?
   3. Check worker: Search logs for `job_id=job-xyz` in last hour
   4. Check heartbeat: Is `last_heartbeat` recent?
   
   ## Common Issues
   - Stuck in "running" + old lease → Worker crashed, will auto-recover
   - Stuck in "retry_pending" → Check retry_count and next_retry_at
   - No heartbeat updates → Worker lost DB connection
   ```

**Done When**: You can answer "why is this job stuck?" in < 2 minutes

---

### ✅ Step 5: Production Safety Checklist (1 hour)
**Goal**: Don't ship obvious security holes

**Actions**:
1. Create `docs/PRODUCTION_DEPLOY_CHECKLIST.md`:
   ```markdown
   # Production Deploy Checklist
   
   ## Pre-Deploy (5 min)
   - [ ] `ALLOW_HEADER_USER_ID` is absent from Vercel production env vars
   - [ ] `USE_SUPABASE_JOBS=true` is set
   - [ ] `NODE_ENV=production` is set
   - [ ] Service role key is from production Supabase project
   - [ ] RLS policies enabled on `evaluation_jobs` table
   
   ## Post-Deploy (2 min)
   - [ ] Run staging smoke test against production (with real user JWT)
   - [ ] Verify header bypass fails: `curl -H "x-user-id: bypass" prod-url` → 401
   - [ ] Check logs for "SECURITY VIOLATION" (should be 0)
   
   ## Rollback Plan
   - [ ] Previous Vercel deployment slug: ____________
   - [ ] Rollback command: `vercel rollback <deployment-url>`
   ```

2. Verify checklist against current Vercel config

**Done When**: Checklist exists and you've verified it once

---

## Phase 2: Ship One Vertical Slice (Week 2)

**Now you can spend the reliability you just proved.**

### Target Flow: Evaluate → Package (Query Letter)
This is the highest-value, lowest-risk flow.

#### Step 6: Define Job Type Contracts (2 hours)
1. Extend `lib/jobs/types.ts`:
   ```typescript
   export const JOB_TYPES = {
     // Existing Phase 1
     EVALUATE_QUICK: "evaluate_quick",
     EVALUATE_FULL: "evaluate_full",
     
     // NEW: Phase 2 User-Facing
     PACKAGE_QUERY: "package_query",  // Generate query letter from evaluation
     CONVERT_SYNOPSIS: "convert_synopsis",  // Manuscript → synopsis
     REVISE_MANUSCRIPT: "revise_manuscript",  // Apply evaluation feedback
   } as const;
   ```

2. Create `docs/JOB_TYPE_CONTRACTS.md`:
   ```markdown
   # Job Type Contracts
   
   ## evaluate_quick
   - **Input**: manuscript_id
   - **Output**: JSON with 13 criteria scores + narrative feedback
   - **Duration**: ~30 seconds
   - **Phases**: Phase 1 only
   
   ## package_query
   - **Input**: manuscript_id + evaluation_job_id (uses eval results)
   - **Output**: { query_letter: string, synopsis: string, comps: string[] }
   - **Duration**: ~60 seconds  
   - **Phases**: Phase 2 (assumes Phase 1 evaluation complete)
   - **Prerequisites**: Valid evaluation exists for manuscript
   ```

#### Step 7: Implement `package_query` Job (1 day)
1. Create `app/api/package-query/route.ts`
2. Add Phase 2 worker logic in `lib/jobs/phase2.ts`
3. Add CI tests for contract in `tests/package-query.test.ts`

#### Step 8: Build Minimal UI (1 day)
1. Add "Generate Query Package" button to evaluation results page
2. Show progress bar during job execution
3. Display/download query letter when complete

#### Step 9: One Full E2E Demo (30 min)
Record a video:
1. Upload manuscript
2. Run evaluation
3. Click "Generate Query Package"
4. Download query letter

**This becomes your demo/pitch material.**

---

## Fast ROI Prioritization (If Time-Constrained)

**Do These First**:
- ✅ Step 2 (Staging smoke) - CRITICAL
- ✅ Step 3 (Concurrency test) - CRITICAL  
- ✅ Step 5 (Production checklist) - CRITICAL

**Do These Second**:
- Step 4 (Observability)
- Step 1 (CI evidence)

**Skip for Now**:
- Multi-job flows (Evaluate → Revise → Convert)
- Film adaptation jobs
- Agent/editor flows

---

## Success Metrics

### After Phase 1 (Hardening)
- [ ] Staging smoke test passes with real auth
- [ ] Concurrency test proves lease safety
- [ ] Production deploy checklist verified once
- [ ] You can debug any stuck job in < 2 min

### After Phase 2 (First Feature)
- [ ] One user can evaluate → generate query letter end-to-end
- [ ] Job completes in < 90 seconds  
- [ ] Demo video recorded
- [ ] Zero "stuck job" support tickets in first week

---

## Why This Order?

1. **Staging smoke (Step 2)** catches real-world auth/DB bugs before production
2. **Concurrency test (Step 3)** proves your lease logic isn't just theory
3. **Production checklist (Step 5)** prevents embarrassing security mistakes
4. **Then features** - you've earned the right to build on a proven foundation

The infrastructure work you've done is excellent. Now prove it holds, then ship something users can see.
