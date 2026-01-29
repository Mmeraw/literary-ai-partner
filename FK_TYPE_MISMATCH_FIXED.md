# FK Type Mismatch Fix — Complete

**Status:** ✅ FIXED  
**Date:** 2026-01-29  
**Scope:** Align all FK columns to manuscripts.id as bigint

---

## Issue Identified

**Type mismatch:** `manuscript_chunks.manuscript_id` was `integer` while `manuscripts.id` is `bigint`.

### Discovery
Verification query revealed:
```sql
manuscripts.id            = bigint
manuscript_chunks.manuscript_id = integer  -- ❌ MISMATCH
evaluation_jobs.manuscript_id   = bigint   -- ✅ correct
evaluation_artifacts.manuscript_id = bigint -- ✅ correct
evaluations.manuscript_id       = bigint   -- ✅ correct
```

### Risk
While Postgres allowed the FK to exist (integer→bigint is binary-compatible), this creates:
- Edge case risks with large manuscript IDs
- Index optimization issues
- Type coercion overhead
- Client library confusion
- Migration fragility

**Not canon-compliant:** RevisionGrade requires explicit, audit-grade type consistency.

---

## Fix Applied

### Migration: `20260129000000_fix_manuscript_chunks_fk_type.sql`

**Sequence:**
1. Drop RLS policies (they reference `manuscript_id`)
2. Drop FK constraint
3. `ALTER COLUMN manuscript_id TYPE bigint`
4. Recreate FK constraint
5. Recreate RLS policies
6. Verify all FK columns are now bigint

**RLS Policies Recreated:**
- `Author: view own manuscript chunks` — Users can view their own manuscript chunks
- `Admin: view Storygate manuscript chunks` — Admins can view Storygate-linked chunks

### Migration Output
```
DROP POLICY
DROP POLICY
ALTER TABLE
ALTER TABLE
ALTER TABLE
CREATE POLICY
CREATE POLICY
NOTICE:  Migration successful: All FK columns to manuscripts.id are now bigint
DO
```

---

## Verification

### Before Fix
```sql
manuscript_chunks.manuscript_id | integer   ❌
```

### After Fix
```sql
-- All FK columns to manuscripts.id
evaluation_artifacts.manuscript_id | bigint  ✅
evaluation_jobs.manuscript_id      | bigint  ✅
evaluations.manuscript_id          | bigint  ✅
manuscript_chunks.manuscript_id    | bigint  ✅
```

### Test Results
Canonical test `test-large-chunks-canonical.sh` passed:
- ✅ 100 chunks created successfully
- ✅ All FK relationships intact
- ✅ Performance unchanged (68-80ms queries)
- ✅ RLS policies working correctly

---

## Technical Details

### Why RLS Policies Had to Be Recreated

Postgres error:
```
ERROR:  cannot alter type of a column used in a policy definition
DETAIL:  policy Author: view own manuscript chunks depends on column "manuscript_id"
```

**Solution:** Drop policies, change type, recreate policies with identical logic.

### Safe Migration Path

```sql
-- 1. Drop dependencies
DROP POLICY ...;

-- 2. Drop FK
ALTER TABLE ... DROP CONSTRAINT ...;

-- 3. Change type (safe: integer values fit in bigint)
ALTER TABLE manuscript_chunks
  ALTER COLUMN manuscript_id TYPE bigint;

-- 4. Recreate FK
ALTER TABLE ... ADD CONSTRAINT ...;

-- 5. Recreate policies
CREATE POLICY ...;
```

**Data safety:** No data loss possible because:
- All existing integer values fit in bigint
- Type widening is safe (int4 → int8)
- FK constraint validates referential integrity

---

## Commit Details

```
fix: align manuscript_chunks.manuscript_id type to bigint

- Fix FK type mismatch: manuscript_chunks.manuscript_id was integer, 
  manuscripts.id is bigint
- Drop and recreate RLS policies (required for type change)
- Verify all FK columns to manuscripts.id are now bigint
- Add migration: 20260129000000_fix_manuscript_chunks_fk_type.sql
- Re-run canonical test: all checks passing

Closes: FK type mismatch (canon violation)
```

---

## Canonical Status

✅ **All FK columns to manuscripts.id are now bigint**  
✅ **Type consistency enforced**  
✅ **RLS policies intact**  
✅ **Test suite passing**  
✅ **Zero data loss**  
✅ **Canon-compliant**

---

## Related Files

- Migration: `supabase/migrations/20260129000000_fix_manuscript_chunks_fk_type.sql`
- Test: `scripts/test-large-chunks-canonical.sh` (verified working)
- Docs: `LARGE_DOC_CHUNKING_COMPLETE.md` (updated)

---

**Next:** Commit and push to ensure production schema matches.
