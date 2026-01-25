# Nomenclature Standardization - Implementation Summary

**Status:** Framework complete, ready for migration execution  
**Created:** 2026-01-25  
**Impact:** Eliminates vocabulary drift across storage, code, and APIs

---

## What Was Delivered

### 1. Canonical Constants & Type System ✅
**File:** [lib/jobs/canon.ts](../lib/jobs/canon.ts)

**Features:**
- Canonical enums for job status, phases, phase_status
- Legacy → canonical normalizers (`toCanonicalPhase()`, etc.)
- Canonical → display formatters (`toDisplayPhase()`, etc.)
- Type guards and validation helpers
- Migration utilities for `progress.stage` → `progress.phase_status`

**Usage:**
```typescript
import { CANONICAL_PHASE, toDisplayPhase } from '@/lib/jobs/canon';

// Writing to storage
job.phase = CANONICAL_PHASE.PHASE_1;

// Reading from UI
const label = toDisplayPhase(job.phase);  // "Phase 1"
```

### 2. Enforcement Tooling ✅
**File:** [scripts/canon-audit-banned-aliases.sh](../scripts/canon-audit-banned-aliases.sh)

**Features:**
- Two-tier enforcement (ERROR vs WARNING)
- Storage layer (app, lib, supabase, tests) → blocks PR merge
- Display layer (scripts, docs) → informational warnings
- Contextual pattern detection (avoids false positives in comments)
- Ready for CI/CD integration

**Run it:**
```bash
./scripts/canon-audit-banned-aliases.sh
```

**Expected output:**
- 🚨 Errors: Banned terms in storage layer
- ⚠️ Warnings: Review needed in scripts/docs
- ✅ Pass: No violations detected

### 3. Governance Documentation ✅

| Document | Purpose | Audience |
|----------|---------|----------|
| [CANONICAL_VOCABULARY.md](./CANONICAL_VOCABULARY.md) | Complete audit-grade governance (16 sections) | Engineers, auditors |
| [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md) | Step-by-step tactical migration guide | Implementation team |
| [CANONICAL_VOCABULARY_QUICK_REF.md](./CANONICAL_VOCABULARY_QUICK_REF.md) | One-page cheat sheet | Daily development |

---

## Current State (Audit Results)

Running `./scripts/canon-audit-banned-aliases.sh` reveals:

**ERROR-level violations (blocks merge):**
- ❌ `phase1`/`phase2` in ~60+ files (lib, app, tests, supabase)
- ❌ `progress.stage` in phase1.ts, phase2.ts, jobStore.supabase.ts
- ❌ Legacy phase literals in test fixtures

**WARNING-level (informational):**
- ⚠️ Legacy terms in scripts (scripts/jobs-*.mjs, worker-daemon.mjs)
- ⚠️ Natural language "state" in docs (acceptable)

---

## Migration Path (2 Weeks)

**Week 1: Foundation (Non-Breaking)**
- ✅ Infrastructure setup (canon.ts, audit script, docs)
- Day 2-3: Update TypeScript types to use `CanonicalPhase`
- Day 4-5: Add normalization layer to all DB reads

**Week 2: Breaking Changes**
- Day 6-7: Update all storage writes to canonical only
- Day 8: Database migration (phase normalization, progress.stage → phase_status)
- Day 9: Update API endpoints (deprecate `/run-phase1`, create `/run`)
- Day 10: Update all scripts and tests

**See:** [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md) for detailed steps

---

## Integration with Existing Docs

This framework complements and enforces:
- [SCHEMA_CODE_NAMING_GOVERNANCE.md](./SCHEMA_CODE_NAMING_GOVERNANCE.md) - Original governance (306 lines)
- [jobs/CONTRACT.md](./jobs/CONTRACT.md) - UI contract (now must use canonical values)
- [jobs/PRODUCTION_READINESS.md](./jobs/PRODUCTION_READINESS.md) - Production checklist

**Key difference:** Previous docs stated principles. This framework **enforces** them via:
1. Executable code (`lib/jobs/canon.ts`)
2. Automated scanning (`scripts/canon-audit-banned-aliases.sh`)
3. Tactical migration path with rollback plans

---

## How to Use This Framework

### For Daily Development

1. **Import canonical constants:**
   ```typescript
   import { CANONICAL_PHASE, CANONICAL_JOB_STATUS } from '@/lib/jobs/canon';
   ```

2. **Use constants in code:**
   ```typescript
   if (job.status === CANONICAL_JOB_STATUS.COMPLETE) { ... }
   ```

3. **Run audit before commit:**
   ```bash
   ./scripts/canon-audit-banned-aliases.sh
   ```

### For Code Review

**Block PR if:**
- Audit script fails (exit code 1)
- New code introduces `phase1`, `phase2`, `progress.stage`, `owner_id`, etc.

**Accept PR if:**
- Audit passes or only shows warnings (scripts/docs layer)
- Migration plan documented for legacy code being fixed

### For Migration Execution

Follow the 10-day plan in [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md):
1. Type system updates
2. Add normalization layer
3. Database migration
4. API endpoint deprecation
5. Script/test updates
6. Validation enforcement

---

## CI/CD Integration (Recommended)

Add to `.github/workflows/ci.yml`:

```yaml
name: Canonical Vocabulary Audit

on: [pull_request]

jobs:
  canon-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run canon audit
        run: |
          chmod +x scripts/canon-audit-banned-aliases.sh
          ./scripts/canon-audit-banned-aliases.sh
```

This blocks merges if storage-layer violations detected.

---

## Comparison with External Recommendations

### ChatGPT's Recommendation
✅ **Adopted:** Create `lib/jobs/canon.ts` with normalization helpers  
✅ **Adopted:** Phase-by-phase migration (type system → reads → writes → DB)  
✅ **Adopted:** Keep API endpoints for backward compat, translate internally  

### Perplexity's Recommendation
✅ **Adopted:** Audit-grade documentation (CANONICAL_VOCABULARY.md)  
✅ **Adopted:** Executable audit script with error/warning tiers  
✅ **Expanded:** Added migration guide, quick reference, CI integration  

### GitHub Copilot's Recommendation (This Implementation)
✅ **Pragmatic:** Fixed audit script false positives (docs vs code)  
✅ **Tactical:** 10-day migration plan with exact file targets  
✅ **Production-ready:** Rollback scripts, canary deployment guidance  
✅ **Enforceable:** CI-ready audit, zero-drift validation  

---

## Success Metrics

Migration is complete when:
1. ✅ `./scripts/canon-audit-banned-aliases.sh` exits 0 (no errors)
2. ✅ Database: `SELECT DISTINCT phase FROM evaluation_jobs;` → only `phase_1`, `phase_2`
3. ✅ Database: `SELECT COUNT(*) FROM evaluation_jobs WHERE progress ? 'stage';` → 0
4. ✅ All TypeScript compiles without errors
5. ✅ All tests pass
6. ✅ Worker daemon processes jobs without normalization warnings
7. ✅ UI displays phases correctly

---

## Next Actions

**Immediate (today):**
1. Review the three canonical docs (governance, migration, quick ref)
2. Run `./scripts/canon-audit-banned-aliases.sh` to establish baseline
3. Decide on migration timeline (recommended: start Week 1 foundation tasks)

**Within 1 week:**
1. Update TypeScript types to use `CanonicalPhase` from `lib/jobs/canon.ts`
2. Add normalization layer to all DB read operations
3. Run tests to verify backward compatibility

**Within 2 weeks:**
1. Execute database migration (staging first)
2. Update all storage writes to canonical values
3. Update scripts and API endpoints
4. Enable CI enforcement

---

## Questions or Blockers?

- **Conceptual questions:** See [CANONICAL_VOCABULARY.md](./CANONICAL_VOCABULARY.md)
- **Implementation questions:** See [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md)
- **Quick lookup:** See [CANONICAL_VOCABULARY_QUICK_REF.md](./CANONICAL_VOCABULARY_QUICK_REF.md)
- **Technical support:** Open GitHub issue with label `canonical-migration`

---

**This framework is ready for immediate use.** Start with the audit script to see current violations, then follow the migration guide to fix them systematically.
