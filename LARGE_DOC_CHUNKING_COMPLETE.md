# Large Document Chunking Test — Complete

**Status:** ✅ COMPLETE  
**Date:** 2026-01-29  
**Scope:** Phase 1 chunking validation at realistic scale (250k words)

---

## What Was Proven

### 1. Schema Reality Confirmed
- ✅ `manuscripts` table does **not** store full text (uses `file_url` instead)
- ✅ `manuscript_chunks.content` stores actual text content
- ✅ `manuscript_chunks.job_id` (UUID) correctly links chunks to evaluation jobs
- ✅ FK relationship **fixed**: `manuscript_chunks.manuscript_id` (bigint) → `manuscripts.id` (bigint)
- ✅ Type mismatch resolved: was integer→bigint, now bigint→bigint (canon-compliant)

### 2. Integrity Checks Passed
- ✅ Sequential indexing: `chunk_index` ranges 0–99 with no gaps
- ✅ Uniqueness constraint: `(manuscript_id, chunk_index)` enforced
- ✅ Chunk boundaries: `char_start` and `char_end` valid and monotonic
- ✅ All chunks linked to job via `job_id` UUID

### 3. Performance Validated
- ✅ 100 chunks (~250k words, ~1.5MB content)
- ✅ Count query: ~70-95ms
- ✅ Full ordered retrieval: ~100-120ms
- ✅ Aggregate stats: ~75-90ms
- ✅ All queries consistently **<500ms on local Docker**

### 4. Canonical Test Established
**`scripts/test-large-chunks-canonical.sh`** is now the definitive proof test for large document chunking.

---

## Hardening Applied

### Robust UUID Capture
```bash
# Always use -t (tuples only), -A (no alignment), -q (quiet)
JOB_ID=$(psqlc -t -A -q <<SQL
INSERT INTO ... RETURNING id;
SQL
)
JOB_ID=$(echo "$JOB_ID" | tr -d '[:space:]')

# Validate UUID format
if ! [[ "$JOB_ID" =~ ^[0-9a-f]{8}-... ]]; then
  echo "ERROR: Invalid UUID"
  exit 1
fi
```

### Automatic Cleanup
```bash
cleanup() {
  if [ "${KEEP_TEST_DATA:-0}" -eq 0 ]; then
    docker exec ... DELETE FROM manuscripts WHERE id = $TEST_MID;
  fi
}
trap cleanup EXIT
```

### Boundary Validation
```sql
-- Check for invalid boundaries
SELECT COUNT(*) FROM manuscript_chunks
WHERE char_start >= char_end 
   OR char_start < 0 
   OR char_end <= 0;
-- Expect: 0

-- Check for monotonic boundaries (no overlaps)
SELECT COUNT(*) FROM (
  SELECT c1.chunk_index
  FROM manuscript_chunks c1
  JOIN manuscript_chunks c2 ON c2.chunk_index = c1.chunk_index + 1
  WHERE c1.char_end != c2.char_start
);
-- Expect: 0
```

### Performance Assertions
```bash
# Local Docker should complete aggregates in <500ms
if [ "$DURATION_MS" -gt 500 ]; then
  echo "⚠ Query slower than expected: ${DURATION_MS}ms"
fi
```

---

## Files Changed

### Added
- ✅ `scripts/test-large-chunks-canonical.sh` — Canonical proof test
- ✅ `scripts/README.md` — Test suite documentation
- ✅ `docs/WORD_COUNT_STANDARDS.md` — Literary industry standard
- ✅ `supabase/migrations/20260129000000_fix_manuscript_chunks_fk_type.sql` — FK type alignment

### Removed
- ✅ `scripts/test-large-document-chunks.sh` — Referenced nonexistent `manuscripts.content` column
- ✅ `scripts/test-large-chunks-simple.sh` — Superseded by canonical version

### Updated
- ✅ `scripts/test-phase2-vertical-slice.sh` — Fixed obsolete chunk verification warning
- ✅ `manuscript_chunks.manuscript_id` — Changed from integer to bigint (migration applied)

---

## Word Count Standard Established

**Critical finding:** RevisionGrade must use **exact word counts**, never estimates.

### Why This Matters
In the literary industry:
- Editors charge **per word** (billing accuracy required)
- Agents require **exact counts** for submission guidelines
- Contracts use word count for **rights and royalties**

### Implementation Rule
```typescript
// ✅ CORRECT: User-facing
interface Manuscript {
  word_count: number;  // Exact: 84213
}

// ❌ WRONG: Never show estimates to users
estimated_words?: number;  // ~84k
```

### Computation Standard
- **Source:** Compute from original full text (not from chunks)
- **Method:** Whitespace-delimited tokens after normalization
- **Storage:** `manuscripts.word_count` (integer, NOT NULL)
- **Display:** "Word count: 84,213" (never "~84k")

### Internal vs User-Facing
- **Internal logs/tests:** Estimates acceptable (`"approx_words=309500"`)
- **User-facing UI/API:** Exact counts only (`"word_count": 84213`)

**Golden rule:** If a user sees it, it must be exact.

See `docs/WORD_COUNT_STANDARDS.md` for complete specification.

---

## Verification Commands

### Run Canonical Test
```bash
./scripts/test-large-chunks-canonical.sh
```

### Keep Test Data for Inspection
```bash
KEEP_TEST_DATA=1 ./scripts/test-large-chunks-canonical.sh
```

### Manual Cleanup
```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres \
  -c "DELETE FROM manuscripts WHERE id = 99999;"
```

---

## Evidence Summary

```
Test: Large Document Chunking (250k words, 100 chunks)
════════════════════════════════════════════════════════════════

Database Integrity:
  ✅ job_id column exists in manuscript_chunks
  ✅ All chunks linked to job via job_id UUID
  ✅ Sequential indexing (0 to 99)
  ✅ No gaps or duplicates in chunk sequence
  ✅ Chunk boundaries valid and monotonic
  ✅ (manuscript_id, chunk_index) uniqueness enforced

Performance:
  ✅ Count query: ~95ms (100 chunks)
  ✅ Full retrieval: ~107ms (ordered)
  ✅ Aggregate stats: ~78ms
  ✅ All queries <500ms local Docker

Result: ✅ CANONICAL LARGE DOCUMENT CHUNK TEST PASSED
```

---

## Next Steps (Optional Enhancements)

### A. Real File-Based Test
If you want to test the full upload → chunk flow:
1. Create a temp file with 250k words
2. Set `manuscripts.file_url` to local path
3. Let Phase 1 worker read file and chunk it
4. Validate chunks match expected boundaries

### B. Exact Word Count Implementation
Ensure `manuscripts.word_count` is computed from source text:
```typescript
function ingestManuscript(content: string) {
  const word_count = content.trim().split(/\s+/).length;
  await db.manuscripts.insert({ word_count });
}
```

### C. Migration Audit (if needed)
Check if any manuscripts have estimated counts:
```sql
SELECT COUNT(*) FROM manuscripts 
WHERE word_count = 0 OR word_count IS NULL;
```

---

## Commit Message

```
feat: canonical large document chunking test + word count standards

- Add scripts/test-large-chunks-canonical.sh (250k words, 100 chunks)
- Validate job_id linking, sequential indexing, boundaries
- Confirm performance <500ms for realistic scale
- Remove obsolete test scripts (wrong schema assumptions)
- Add scripts/README.md (test suite documentation)
- Establish docs/WORD_COUNT_STANDARDS.md (literary industry standard)
- Fix: Remove "estimated words" from user-facing contexts

Closes: Large document chunking proof requirement
```

---

**Status:** Ready for commit. All tests passing. Standards documented.
