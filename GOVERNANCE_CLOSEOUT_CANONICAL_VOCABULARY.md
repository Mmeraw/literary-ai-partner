# Governance Rule #4: Canonical Vocabulary — CLOSED

**Status**: ✅ CLOSED  
**Date Closed**: 2026-02-07  
**PR**: [#20](https://github.com/Mmeraw/literary-ai-partner/pull/20)  
**Commit**: ffb5c44 (Merge PR #20)

---

## Summary

Governance Rule #4 (Canonical Vocabulary) has been fully implemented and merged. All job lifecycle terminology (status, phase, phase_status) now enforces single source of truth across types, implementations, storage, tests, and scripts.

---

## What Was Closed

| Rule | Status | Evidence | PR |
|------|--------|----------|-----|
| **Fresh Database Rule** (A4 migrations) | ✅ CLOSED | PR #9 merged, governance headers added | #9 + #10 |
| **Immutable Public API** (RPC contract) | ✅ CLOSED | JOB_CONTRACT_v1.md defines canonical RPC shape | docs/ |
| **Compilation Boundary** (TypeScript) | ✅ CLOSED | tsconfig.workers.json decoupleda from bundler context | #19 |
| **Canonical Vocabulary** (semantics) | ✅ CLOSED | All terminology now canonical, enforcement verified | #20 |

---

## What This Means

1. **Semantic Consistency**: All code layers (types, implementations, storage, tests) speak the same vocabulary
   - `status`: queued \| running \| complete \| failed (never "canceled", "retry_pending", "state")
   - `phase`: phase_0 \| phase_1 \| phase_2 (never phase1/phase2/p1/p2)
   - `phase_status`: pending \| running \| complete \| failed (never stage/done/processing)

2. **Storage Enforcement**: All DB writes go through constants (JOB_STATUS, PHASES), no string literals
   - `lib/jobs/canon.ts`: Type guards, validators, legacy migration helpers
   - `lib/jobs/jobStore.supabase.ts`: All writes enforced via constants
   - `lib/jobs/jobStore.memory.ts`: Memory store consistency

3. **Semantic Rules Enforced**:
   - Cancellation = `status=failed` + `progress.canceled_at` (not separate "canceled" status)
   - Retry = `status=failed` + `progress.next_retry_at` (not "retry_pending" status)
   - Phase status values aligned with job status values

4. **Backward Compatibility**: Reads via migration helpers normalize legacy aliases automatically
   - `migrateProgressStageToPhaseStatus()`: Handles legacy progress.stage
   - `migrateProgressPhaseToCanonical()`: Handles legacy phase1/phase2 → phase_1/phase_2
   - No database schema changes needed

---

## Implementation Scope

**Core Infrastructure**:
- `lib/jobs/canon.ts`: 310+ lines (validators, formatters, legacy helpers)
- `lib/jobs/types.ts`: Canonical enums (JOB_STATUS, PHASES, JobProgress)
- `lib/jobs/phase1.ts` & `lib/jobs/phase2.ts`: State machines using canonical constants
- `lib/jobs/jobStore.supabase.ts`: All DB writes enforced (16 files touched total)

**Tests & Scripts** (9 files updated):
- Removed legacy phase naming (phase1 → phase_1)
- Removed progress.stage references (use phase_status)
- Removed "canceled" status checks (check failed + canceled_at)
- All smoke tests passing with canonical terminology

**UI Layer**:
- Display "Canceled" remains UX-friendly for failed + canceled_at
- Underlying storage stays canonical

---

## CI Evidence

**PR #20 Checks**:
- ✅ Canon Guard: SUCCESS (JOB_CONTRACT_v1 validation)
- ✅ TypeScript: SUCCESS (all types enforced after fix)
- ✅ Job System Smoke Tests: SUCCESS (canonical values validated)
- ✅ Supabase-Backed Tests: SUCCESS (storage layer consistency)
- ✅ Security (Secret Scan): SUCCESS
- ✅ Vercel Build: SUCCESS

---

## Future: Strict Enforcement

After 1–2 releases stabilize this, enable strict mode on CI:

```bash
# In workflow, update:
scripts/canon-audit-banned-aliases.sh --strict
```

This will block any new violations (legacy aliases, string literals in storage) during PR CI, preventing semantic drift.

---

## Governance Position

With PR #20 merged, **all four governance rules are complete**:

1. ✅ Fresh Database Rule (A4)
2. ✅ Immutable Public API (RPC)
3. ✅ Compilation Boundary (TS)
4. ✅ Canonical Vocabulary (semantics) ← **THIS RULE, NOW CLOSED**

**Net Effect**: Old code and new code now communicate structurally, syntactically, and semantically.

You are **fully governed** and ready for production readiness declaration.

---

## References

- See `docs/CANONICAL_VOCABULARY.md` for complete governance rules
- See `docs/JOB_CONTRACT_v1.md` for canonical contract enforcement
- See `lib/jobs/canon.ts` for implementation details
- PR #20 for implementation trace

---

**Signed Off**: Agent (Automated Governance)  
**Effective**: 2026-02-07
