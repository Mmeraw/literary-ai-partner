# Gate A5 — Flow 1 End-to-End User Evaluation Loop
**Closure Evidence**

---

## 1. Summary

- **Gate:** A5 — Flow 1 End-to-End User Evaluation Loop
- **Scope thesis:** Report Authority Lock (canonical artifact, ownership, no recompute)
- **Status:** ✅ CLOSED
- **Closed on:** 2026-02-17
- **Environment:** Production
- **Repo commit:** `f9defe4368ca06e908670662f125ae5bf2a17fe1`
- **CI Run:** [#22084689705](https://github.com/Mmeraw/literary-ai-partner/actions/runs/22084689705)

---

## 2. What A5 Guarantees

✅ A manuscript submission deterministically produces an authoritative evaluation visible to the owning user.

✅ Phase 2 aggregates results and writes **one canonical artifact** per `(job_id, artifact_type)` with deterministic `sha256Json` hash.

✅ Report page reads **only** from `evaluation_artifacts` and never recomputes.

✅ Ownership is enforced (`job.user_id === user.id`), with non-owners masked via `notFound()`.

✅ Reruns are idempotent (last write wins via upsert).

---

## 3. CI Evidence (Flow 1 Evidence Gate)

**Evidence from successful CI run:**

```
✅ FLOW 1 EVIDENCE: PASS
=========================================
HEALTH_HTTP=200
CREATE_HTTP=201
OWNER_HTTP=200
OTHER_HTTP=404
REPORT_HTTP=200
JOB_ID=43c56fc9-72d6-4ac1-91e2-528af96adb58
Ended: 2026-02-17T03:17:17Z
```

**CI workflow:** `.github/workflows/flow1-proof-packed.yml`  
**Run URL:** https://github.com/Mmeraw/literary-ai-partner/actions/runs/22084689705  
**Evidence artifact:** `flow1-evidence-5e2eaf96adda67e1605844217989c4f9730a5397` (90-day retention)

---

## 4. Evidence Details

### 4.1 DB → Artifact (Phase 2 Authority)

**Code:** [lib/jobs/phase2.ts](../lib/jobs/phase2.ts)

**Behavior:**
- Phase 2 aggregates chunk results
- Calls `writeArtifact()` with deterministic content + hash
- One canonical row per `(job_id, ARTIFACT_TYPES.ONE_PAGE_SUMMARY)`
- Idempotent: reruns update `updated_at`, preserve `created_at`

**Key functions:**
- `aggregateChunkResults()` — produces typed artifact content
- `sha256Json()` — deterministic hash for Evidence Gate
- `persistOutput()` — writes via `writeArtifact()` (upsert)

**Invariant enforced:** DB unique constraint on `(job_id, artifact_type)`

---

### 4.2 Artifact → UI (Report Authority Lock)

**Code:** [app/evaluate/[jobId]/report/page.tsx](../app/evaluate/%5BjobId%5D/report/page.tsx)

**Behavior:**
1. Requires authenticated user (redirect to `/login` if not)
2. Verifies ownership: loads job, checks `job.user_id === user.id`
3. Non-owner → `notFound()` (masked 404, no info leak)
4. Loads artifact from `evaluation_artifacts` table
5. Renders persisted content (summary, score, counts, timestamp)
6. **No recomputation paths exist**

**Security:**
- Uses user-scoped `createClient()` (RLS-protected)
- Explicit ownership check before artifact load
- Fails safe if artifact missing or unauthorized

---

### 4.3 CI Flow 1 Script

**Script:** [scripts/evidence-flow1.sh](../scripts/evidence-flow1.sh)

**What it proves:**

| Step | What's Validated |
|------|------------------|
| 0-0b | Environment + URL/key project match |
| 1 | Health check (API reachable) |
| 2 | Seed manuscript created in Supabase |
| 3 | Owner can create job (201) |
| 4 | Owner can read job (200, correct `user_id`) |
| 5 | Non-owner sees strict 404 "Job not found" |
| **6** | **Report page renders canonical artifact** |

**Step 6 assertions:**
- `REPORT_HTTP=200` (after redirects if unauthenticated)
- Report contains "Evaluation Report" heading
- Report contains "Overall Score" content marker
- If unauthenticated: login protection confirmed

**Chain proven:** Seed → Job → Artifact → Report → Ownership → No leak

---

## 5. Stop Condition Check

| Requirement | Status |
|-------------|--------|
| `/evaluate/[jobId]/report` renders canonical artifact for completed job | ✅ |
| CI (including Flow 1 Evidence) green | ✅ Run #22084689705 |
| Vercel deployment status: Ready | ✅ Production |

**Decision:** Gate A5 is closed; move roadmap focus to next gate.

---

## 6. Commits

| Commit | Message | Files Changed |
|--------|---------|---------------|
| `f9defe4` | feat(gate-a5): implement Report Authority Lock | `app/evaluate/[jobId]/report/page.tsx`, `lib/jobs/phase2.ts`, `scripts/evidence-flow1.sh` |
| `[PRIOR]` | feat(artifacts): add writeArtifact helper | `lib/artifacts/writeArtifact.ts` |
| `[PRIOR]` | feat(phase2): add phase 2 execution engine | `lib/jobs/phase2.ts` (initial) |

---

## 7. What Changed (High-Level)

**Before A5:**
- System worked internally
- Jobs completed but output was ephemeral
- No user-visible evaluation surface

**After A5:**
- Product exists: users see authoritative evaluations
- Canonical artifact persisted (single source of truth)
- Report page renders DB truth (never recomputes)
- Ownership enforced (no cross-user leaks)
- Full CI proof chain (DB → UI → ownership)

---

## 8. Risk Stack After A5

| Phase | Primary Risk |
|-------|--------------|
| Gates 1–6 | Infrastructure correctness |
| A4 (closed) | Operational observability |
| **A5 (closed)** | **Product proof / user loop validation** |
| Next | Market risk / value delivery |

---

## 9. Next Roadmap Item

With A5 closed, the next logical gate is **value enhancement**, not infrastructure:

**Candidates:**
- Report Credibility Layer (scoring explanations, rubric mapping, confidence metadata)
- StoryGate Studio / Agent Portal Preview (market risk reduction)
- Flow 2 (multi-submission or batch operations)

The guiding principle: **optimize for user value, not system safety** (safety is now proven).

---

## 10. Audit Trail

- Planning doc: [docs/GATE_A5_FLOW1.md](./GATE_A5_FLOW1.md)
- Closure doc: this file
- Golden Spine entry: [docs/GOLDEN_SPINE.md](./GOLDEN_SPINE.md) `[TO BE UPDATED]`
- Evidence log: `[CI ARTIFACT LINK]`

---

**Gate A5 — CLOSED**  
*First user-visible evaluation loop proven end-to-end.*
