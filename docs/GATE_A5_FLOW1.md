# Gate A5 — Flow 1: End-to-End User Evaluation Loop

**Status:** IN PROGRESS  
**Created:** 2026-02-17  
**Goal:** Prove end-to-end user evaluation loop: submit → job → phase2 → persisted evaluation_result → report renders

---

## Scope: Report Authority Lock

The definition of "done" that prevents scope creep and makes proof audit-grade:

### Four Surfaces (Non-Negotiable)

1. **Phase 2 Authority**  
   - Writes one canonical artifact per `(job_id, artifact_type)`
   - Deterministic overwrite behavior via `writeArtifact`
   - Idempotent reruns (last write wins)
   - Invariant: `(job_id, artifact_type)` UNIQUE enforced by DB

2. **Artifact Contract Enforcement**  
   - Compile-time: type definitions + tests
   - Runtime: `ARTIFACT_TYPES.ONE_PAGE_SUMMARY` constant
   - Content shape: typed `ReportContent` interface
   - Hash: deterministic `sha256Json` for Evidence Gate

3. **Report = Source of Truth**  
   - Route: `/evaluate/[jobId]/report`
   - Reads ONLY from `evaluation_artifacts`
   - Never recomputes
   - Never falls back to memory
   - Fails clearly if artifact missing
   - Enforces ownership: `job.user_id === user.id`

4. **Flow 1 Evidence Gate Upgrade**  
   - Assertion: `GET /evaluate/[jobId]/report` contains artifact content markers
   - Proves: DB persistence → UI rendering → ownership rules → invariant safety
   - Full chain validation in CI

---

## In Scope

- Phase 2 aggregation helper: `lib/jobs/phase2.ts`
- Artifact writer: `lib/artifacts/writeArtifact.ts` (already exists)
- Report page: `app/evaluate/[jobId]/report/page.tsx`
- Evidence script step 6: `scripts/evidence-flow1.sh`

## Out of Scope

- Schema changes
- Worker refactors
- Quality improvements to scoring output
- New admin pages or routes
- Any feature unrelated to the vertical slice

---

## Fixed Deliverables

| File | Purpose |
|------|---------|
| `lib/jobs/phase2.ts` | Aggregates Phase 1 output, writes canonical artifact with hash |
| `app/evaluate/[jobId]/report/page.tsx` | Renders persisted artifact with ownership enforcement |
| `scripts/evidence-flow1.sh` (Step 6) | Validates DB → UI chain in CI |
| `docs/GATE_A5_CLOSURE.md` | Evidence document when CI passes |

---

## Verification Checklist

- [ ] User can load report for completed job
- [ ] Ownership is enforced (403 for non-owner → masked as 404)
- [ ] Unauthenticated returns redirect to login
- [ ] Report renders canonical artifact content
- [ ] No recomputation paths exist
- [ ] CI green (Flow 1 Evidence Gate passes)
- [ ] Vercel Ready

---

## Stop Condition (Critical)

**STOP when:**

1. `/evaluate/[jobId]/report` renders `evaluation_result` for a completed job
2. CI is green (including Flow 1 Evidence: PASS)
3. Vercel deployment is Ready

**Do NOT:**
- Continue optimizing
- Add features
- Refactor unrelated code

---

## Definition of Done

When all true:

- ✅ Phase 2 writes authoritative artifact
- ✅ Writer enforces artifact contract
- ✅ Report reads DB only
- ✅ Evidence Gate validates report render
- ✅ Rerun semantics verified (idempotent)
- ✅ CI green + Vercel Ready

Then **Flow 1 is closed permanently**.

---

## What This Unlocks

After A5 closes, you can truthfully state:

> "RevisionGrade produces authoritative evaluations end-to-end."

This is the first **investor-grade milestone** — the moment RevisionGrade transitions from engineering project to product.

Next phase moves from **engineering risk** to **market risk** (StoryGate Studio / Agent Portal Preview).
